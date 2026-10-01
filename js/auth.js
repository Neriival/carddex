// js/auth.js
// Login e conta do usuário.
// ============================================================
// ATENÇÃO: por enquanto NÃO existe banco de dados. As funções de AUTH
// só guardam nome e e-mail no navegador (a senha NÃO é guardada nem conferida).
// Quando o banco existir (Supabase, Firebase, API própria...), troque apenas o
// conteúdo de AUTH.entrar / AUTH.criar / AUTH.sair: a tela já está pronta.
// ============================================================
function lerJSON(ch) { try { return JSON.parse(localStorage.getItem(ch) || 'null'); } catch (e) { return null; } }
var AUTH = {
  usuario: function () { return lerJSON('carddex_sessao'); },
  convidado: function () { try { return localStorage.getItem('carddex_convidado') === '1'; } catch (e) { return false; } },
  // TODO banco: validar e-mail/senha no servidor e lançar Error('mensagem') se estiver errado
  entrar: async function (email, senha) {
    var u = { nome: email.split('@')[0], email: email };
    try { localStorage.setItem('carddex_sessao', JSON.stringify(u)); } catch (e) {}
    return u;
  },
  // TODO banco: criar o usuário no servidor (guardar a senha só com hash, nunca no navegador)
  criar: async function (nome, email, senha) {
    var u = { nome: nome, email: email };
    try { localStorage.setItem('carddex_sessao', JSON.stringify(u)); } catch (e) {}
    return u;
  },
  sair: function () { try { localStorage.removeItem('carddex_sessao'); localStorage.removeItem('carddex_convidado'); } catch (e) {} }
};

// Campo de formulário (rótulo + input)
function campoLogin(id, rotulo, tipo, auto) {
  return '<div class="campo"><label for="lg-' + id + '">' + rotulo + '</label><input id="lg-' + id + '" name="' + id + '" type="' + tipo + '" autocomplete="' + auto + '"></div>';
}

// TELA DE LOGIN: abas Entrar / Criar conta, ou continuar sem conta
function telaLogin(modo) {
  var novo = modo === 'criar';
  document.body.classList.add('na-login');
  app.innerHTML = '<section class="login"><form class="login-card" novalidate onsubmit="enviarLogin(event,' + novo + ')">' +
    '<img class="login-logo" src="assets/img/carddex-logo.png" alt="CardDex">' +
    '<div class="login-tabs"><button type="button" class="' + (novo ? '' : 'on') + '" onclick="telaLogin()">Entrar</button><button type="button" class="' + (novo ? 'on' : '') + '" onclick="telaLogin(\'criar\')">Criar conta</button></div>' +
    (novo ? campoLogin('nome', 'Nome', 'text', 'name') : '') + campoLogin('email', 'E-mail', 'email', 'email') + campoLogin('senha', 'Senha', 'password', novo ? 'new-password' : 'current-password') +
    '<div class="erro" id="login-erro" role="alert"></div>' +
    '<button class="btn" type="submit">' + (novo ? 'Criar conta' : 'Entrar') + '</button>' +
    '<button class="btn btn-sec" type="button" onclick="entrarNoApp(true)">Continuar sem conta</button></form></section>';
  window.scrollTo(0, 0);
}

async function enviarLogin(e, novo) {
  e.preventDefault();
  var f = e.target.elements, erro = document.getElementById('login-erro');
  var nome = novo ? f.nome.value.trim() : '', email = f.email.value.trim(), senha = f.senha.value;
  if (novo && !nome) { erro.textContent = 'Digite seu nome.'; return; }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { erro.textContent = 'Digite um e-mail válido.'; return; }
  if (senha.length < 6) { erro.textContent = 'A senha precisa ter pelo menos 6 caracteres.'; return; }
  try { if (novo) await AUTH.criar(nome, email, senha); else await AUTH.entrar(email, senha); entrarNoApp(); }
  catch (x) { erro.textContent = x.message || 'Não foi possível entrar. Tente de novo.'; }
}

// Sai do login e mostra o site. 'convidado' lembra a escolha de usar sem conta.
function entrarNoApp(convidado) {
  if (convidado) { try { localStorage.setItem('carddex_convidado', '1'); } catch (e) {} }
  document.body.classList.remove('na-login');
  atualizarConta(); telaInicio();
}

// Botão do menu: "Entrar" (visitante) ou "Sair" (logado)
function atualizarConta() {
  var u = AUTH.usuario(), b = document.getElementById('nav-conta');
  b.textContent = u ? 'Sair' : 'Entrar'; b.title = u ? 'Conectado como ' + u.email : 'Entrar na sua conta';
}
function clicarConta() { if (AUTH.usuario()) AUTH.sair(); atualizarConta(); telaLogin(); }
