// js/conta/login.js
// TELA DE LOGIN E BOTÃO DA CONTA NO MENU
// ============================================================
// Modos da tela: entrar | 'criar' (cadastro) | 'esqueci' (pede o link) | 'nova-senha' (link do e-mail)
// Os pedaços do formulário de perfil (nick, sexo, personagem/foto) ficam em js/conta/perfil.js.
// ============================================================

// Campo de formulário (rótulo + caixa de texto)
function campoLogin(id, rotulo, tipo, auto, valor, extra) {
  return '<div class="campo"><label for="lg-' + id + '">' + rotulo + '</label><input id="lg-' + id + '" name="' + id + '" type="' + tipo + '" autocomplete="' + auto + '" value="' + esc(valor || '') + '"' + (extra || '') + '></div>';
}

function telaLogin(modo) {
  var novo = modo === 'criar', corpo;
  document.body.classList.add('na-login');
  if (modo === 'esqueci') corpo = '<h3>Esqueci minha senha</h3><span class="sub">Digite o e-mail da sua conta. Vamos mandar um link para você criar uma senha nova.</span>' +
    campoLogin('email', 'E-mail', 'email', 'email') + '<div class="erro" id="login-erro" role="alert"></div><button class="btn" type="submit">Enviar link</button>' +
    '<button class="btn btn-sec" type="button" onclick="telaLogin()">Voltar</button>';
  else if (modo === 'nova-senha') corpo = '<h3>Criar senha nova</h3>' + campoLogin('senha', 'Senha nova', 'password', 'new-password') + campoLogin('senha2', 'Repita a senha', 'password', 'new-password') +
    '<div class="erro" id="login-erro" role="alert"></div><button class="btn" type="submit">Salvar senha</button>';
  else corpo = '<div class="login-tabs"><button type="button" class="' + (novo ? '' : 'on') + '" onclick="telaLogin()">Entrar</button><button type="button" class="' + (novo ? 'on' : '') + '" onclick="telaLogin(\'criar\')">Criar conta</button></div>' +
    (novo ? campoNick('') : '') +
    campoLogin('email', 'E-mail', 'email', 'email') + campoLogin('senha', 'Senha', 'password', novo ? 'new-password' : 'current-password') +
    (novo ? campoSexo('') + escolhaAvatar('', '') : (sb ? '<button class="link-esqueci" type="button" onclick="telaLogin(\'esqueci\')">Esqueci minha senha</button>' : '')) +
    '<div class="erro" id="login-erro" role="alert"></div>' +
    '<button class="btn" type="submit">' + (novo ? 'Criar conta' : 'Entrar') + '</button>' +
    '<button class="btn btn-sec" type="button" onclick="entrarNoApp(true)">Continuar sem conta</button>';
  app.innerHTML = '<section class="login"><form class="login-card" novalidate onsubmit="enviarLogin(event,\'' + (modo || '') + '\')">' +
    '<img class="login-logo" src="assets/img/carddex-logo.png" alt="CardDex">' + corpo + '</form></section>';
  window.scrollTo(0, 0);
}

// Envio do formulário (todos os modos)
async function enviarLogin(e, modo) {
  e.preventDefault();
  var f = e.target.elements, erro = document.getElementById('login-erro'), botao = e.target.querySelector('[type=submit]');
  function msg(t, ok) { erro.classList.toggle('ok', !!ok); erro.textContent = t; }
  var email = f.email ? f.email.value.trim() : '', senha = f.senha ? f.senha.value : '', p = null;
  if (f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return msg('Digite um e-mail válido.');
  if (f.senha && senha.length < 6) return msg('A senha precisa ter pelo menos 6 caracteres.');
  if (modo === 'nova-senha' && senha !== f.senha2.value) return msg('As duas senhas não são iguais.');
  if (modo === 'criar') { p = lerPerfil(f); if (typeof p === 'string') return msg(p); }
  msg('Aguarde...', true); botao.disabled = true;
  try {
    if (modo === 'esqueci') {
      var r = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      if (r.error) throw new Error(erroAuth(r.error));
      return msg('Pronto! Se existir uma conta com ' + email + ', o link chega em alguns minutos. Olhe também o spam.', true);
    }
    if (modo === 'nova-senha') {
      var n = await sb.auth.updateUser({ password: senha });
      if (n.error) throw new Error(/different from the old/i.test(n.error.message) ? 'A senha nova precisa ser diferente da antiga.' : erroAuth(n.error));
      RECUPERANDO = false; history.replaceState(null, '', location.pathname);
      await AUTH._usar(n.data.user); await nuvemPuxar(true);
      return entrarNoApp();
    }
    var u = modo === 'criar' ? await AUTH.criar(email, senha, p) : await AUTH.entrar(email, senha);
    if (u && u.confirmar) return msg('Conta criada! Abra o link que enviamos para ' + email + ' e depois entre.', true);
    entrarNoApp();
  }
  catch (x) { msg(x.message || 'Não foi possível entrar. Tente de novo.'); }
  finally { botao.disabled = false; }
}

// Sai do login e mostra o site. 'convidado' lembra a escolha de usar sem conta.
// Conta sem nick vai direto para o perfil. Atalhos do app instalado (#admin, #minhas, #ranking) abrem a tela certa.
function entrarNoApp(convidado) {
  if (convidado) { try { localStorage.setItem('carddex_convidado', '1'); } catch (e) {} }
  document.body.classList.remove('na-login');
  atualizarConta();
  var u = AUTH.usuario(), atalho = { '#admin': telaAdmin, '#minhas': telaMinhas, '#ranking': telaRanking }[location.hash];
  if (atalho) history.replaceState(null, '', location.pathname);
  if (u && !u.nick) telaPerfil(); else if (atalho) atalho(); else telaInicio();
}

// Botão do menu: "Entrar" (visitante) ou personagem/foto + nick (logado). O link "Admin" só aparece para administradores.
function atualizarConta() {
  var u = AUTH.usuario(), b = document.getElementById('nav-conta');
  b.innerHTML = u ? avatarDe(u, 'nav-avatar') + '<span>' + esc(u.nick || 'Meu perfil') + '</span>' : 'Entrar';
  b.classList.toggle('logado', !!u);
  b.title = u ? 'Meu perfil (' + u.email + ')' : 'Entrar na sua conta';
  document.getElementById('nav-admin').hidden = !AUTH.admin;
}
function clicarConta() { if (AUTH.usuario()) telaPerfil(); else telaLogin(); }
