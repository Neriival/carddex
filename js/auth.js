// js/auth.js
// Login e conta do usuário.
// ============================================================
// Com o Supabase configurado (js/config.js), as contas ficam no banco:
// senha protegida pelo Supabase, perfil (nick, sexo, personagem) na tabela "perfis"
// e as cartas marcadas salvas na conta (js/nuvem.js).
// Sem o Supabase, continua o modo antigo: tudo só no navegador (a senha NÃO é guardada nem conferida).
// ============================================================
function lerJSON(ch) { try { return JSON.parse(localStorage.getItem(ch) || 'null'); } catch (e) { return null; } }
// Mensagens do Supabase em português
function erroAuth(e) {
  var m = (e && e.message) || '';
  if (/invalid login/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/already registered|already exists/i.test(m)) return 'Este e-mail já tem uma conta. Use a aba Entrar.';
  if (/not confirmed/i.test(m)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (/rate limit|too many/i.test(m)) return 'Muitas tentativas. Espere alguns minutos e tente de novo.';
  if (/weak|password should/i.test(m)) return 'Senha fraca. Use pelo menos 6 caracteres, misturando letras e números.';
  return m || 'Não foi possível entrar. Tente de novo.';
}

var NICK_OK = /^[A-Za-z0-9_.]{3,16}$/;
var AUTH = {
  _u: null,      // usuário conectado { id, email, nick, sexo, avatar }
  admin: false,  // true = pode abrir o painel adm (tabela "admins" no banco)
  usuario: function () { return sb ? AUTH._u : lerJSON('carddex_sessao'); },
  convidado: function () { try { return localStorage.getItem('carddex_convidado') === '1'; } catch (e) { return false; } },
  // Lê a sessão salva pelo Supabase e baixa as marcações da conta (chamado uma vez ao abrir o site)
  iniciar: async function () {
    if (!sb) return;
    try { var r = await sb.auth.getSession(); await AUTH._usar(r.data.session && r.data.session.user); } catch (e) {}
    if (AUTH._u) await nuvemPuxar(nuvemPendente());
  },
  // Guarda o usuário e lê o perfil dele (nick, sexo, avatar, foto) e se é admin
  _usar: async function (user) {
    AUTH._u = null; AUTH.admin = false;
    if (!user) return;
    var u = { id: user.id, email: user.email, nick: '', sexo: '', avatar: '', foto: '', vitrine: [] };
    try {
      var r = await Promise.all([sb.from('perfis').select('nick,sexo,avatar,foto,vitrine').eq('id', user.id).maybeSingle(), sb.rpc('eh_admin')]);
      if (r[0].data) { u.nick = r[0].data.nick || ''; u.sexo = r[0].data.sexo || ''; u.avatar = r[0].data.avatar || ''; u.foto = r[0].data.foto || ''; u.vitrine = r[0].data.vitrine || []; }
      AUTH.admin = r[1].data === true;
    } catch (e) {}
    AUTH._u = u;
  },
  entrar: async function (email, senha) {
    if (sb) {
      var r = await sb.auth.signInWithPassword({ email: email, password: senha });
      if (r.error) throw new Error(erroAuth(r.error));
      await AUTH._usar(r.data.user); await nuvemPuxar(true); return AUTH._u;
    }
    var u = { nick: email.split('@')[0], email: email, avatar: 'menino' };
    try { localStorage.setItem('carddex_sessao', JSON.stringify(u)); } catch (e) {}
    return u;
  },
  // p = { nick, sexo, avatar, usarFoto, arquivo }. Retorna { confirmar: true } se o Supabase pedir confirmação por e-mail.
  criar: async function (email, senha, p) {
    if (sb) {
      var livre = await sb.rpc('nick_disponivel', { n: p.nick });
      if (livre.data === false) throw new Error('O nick "' + p.nick + '" já está em uso. Escolha outro.');
      var r = await sb.auth.signUp({ email: email, password: senha, options: { data: { nick: p.nick, sexo: p.sexo, avatar: p.avatar } } });
      if (r.error) throw new Error(/database error/i.test(r.error.message) ? 'O nick "' + p.nick + '" acabou de ser escolhido por outra pessoa. Tente outro.' : erroAuth(r.error));
      if (!r.data.session) return { confirmar: true };
      await AUTH._usar(r.data.user); await nuvemPuxar(true);
      // a foto só pode subir depois que a conta existe; se falhar, a conta continua criada com o personagem
      if (p.usarFoto && p.arquivo) { try { await AUTH.salvarPerfil(p); } catch (e) {} }
      return AUTH._u;
    }
    var u = { nick: p.nick, sexo: p.sexo, avatar: p.avatar, email: email };
    try { localStorage.setItem('carddex_sessao', JSON.stringify(u)); } catch (e) {}
    return u;
  },
  // Troca nick, sexo, personagem e foto (tela Meu perfil). Foto nova sobe antes; a antiga é apagada depois.
  salvarPerfil: async function (p) {
    var dados = { nick: p.nick, sexo: p.sexo, avatar: p.avatar };
    if (sb) {
      var antiga = AUTH._u.foto || '';
      if (p.usarFoto && p.arquivo) dados.foto = await enviarFoto(p.arquivo);
      else if (!p.usarFoto) dados.foto = null;
      var r = await sb.from('perfis').update(dados).eq('id', AUTH._u.id);
      if (r.error) {
        if (p.arquivo && dados.foto) apagarFoto(dados.foto);
        throw new Error(r.error.code === '23505' ? 'O nick "' + p.nick + '" já está em uso. Escolha outro.' : 'Não foi possível salvar: ' + r.error.message);
      }
      if ('foto' in dados && antiga && antiga !== dados.foto) apagarFoto(antiga);
      Object.assign(AUTH._u, dados, { foto: 'foto' in dados ? dados.foto || '' : antiga }); return;
    }
    var u = Object.assign(lerJSON('carddex_sessao') || {}, dados);
    try { localStorage.setItem('carddex_sessao', JSON.stringify(u)); } catch (e) {}
  },
  // Ao sair, as marcações saem do navegador (elas continuam salvas na conta)
  sair: async function () {
    if (sb) { await nuvemEnviar(); await sb.auth.signOut(); AUTH._u = null; AUTH.admin = false; limparMarcacoes(); }
    try { localStorage.removeItem('carddex_sessao'); localStorage.removeItem('carddex_convidado'); } catch (e) {}
  }
};

// Pedaços de formulário: campo de texto, sexo e escolha do personagem
function campoLogin(id, rotulo, tipo, auto, valor, extra) {
  return '<div class="campo"><label for="lg-' + id + '">' + rotulo + '</label><input id="lg-' + id + '" name="' + id + '" type="' + tipo + '" autocomplete="' + auto + '" value="' + esc(valor || '') + '"' + (extra || '') + '></div>';
}
function campoSexo(atual) {
  return '<div class="campo"><label for="lg-sexo">Sexo <small>(só você vê)</small></label><select id="lg-sexo" name="sexo" onchange="sugerirAvatar(this)"><option value="">Selecione</option>' +
    [['masculino', 'Masculino'], ['feminino', 'Feminino'], ['nao_informar', 'Prefiro não dizer']].map(function (o) { return '<option value="' + o[0] + '"' + (atual === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>';
}
// atual = 'menino' | 'menina' | 'foto'; foto = endereço da foto atual (se tiver)
function escolhaAvatar(atual, foto) {
  var ops = [['menino', 'Menino'], ['menina', 'Menina']].map(function (a) {
    return '<label class="avatar-op"><input type="radio" name="avatar" value="' + a[0] + '"' + (atual === a[0] ? ' checked' : '') + ' onchange="this.form.dataset.avatarEscolhido=1"><img src="assets/img/avatares/' + a[0] + '.svg" alt=""><span>' + a[1] + '</span></label>';
  }).join('');
  // "Minha foto" só existe com o banco ligado (a foto fica guardada no Supabase)
  if (sb) ops += '<label class="avatar-op op-foto" onclick="escolherFoto(event,this)"><input type="radio" name="avatar" value="foto"' + (atual === 'foto' ? ' checked' : '') + '>' +
    (foto ? '<img class="foto-prev" src="' + esc(foto) + '" alt="">' : '<span class="foto-vazia">+</span>') + '<span>' + (foto ? 'Trocar foto' : 'Minha foto') + '</span></label>';
  return '<fieldset class="avatares' + (sb ? ' com-foto' : '') + '"><legend>Personagem ou foto</legend>' + ops + '</fieldset>' +
    (sb ? '<input type="file" name="arquivo" accept="image/*" hidden onchange="previaFoto(this)"><small class="sub dica-foto">A foto aparece para todos no ranking. Escolha uma em que você esteja à vontade.</small>' : '');
}
// Clicar em "Minha foto" abre a escolha do arquivo. Se já tem foto e outra opção estava marcada, o 1º clique só volta para a foto.
function escolherFoto(e, op) {
  if (e.target.type === 'radio') return; // o clique já chegou no próprio botão de opção
  var radio = op.querySelector('[type=radio]');
  if (!radio.checked && op.querySelector('.foto-prev')) { op.closest('form').dataset.avatarEscolhido = 1; return; }
  e.preventDefault();
  op.closest('form').elements.arquivo.click();
}
// Mostra a foto escolhida dentro da opção e marca "Minha foto"
function previaFoto(input) {
  var arq = input.files[0], op = input.form.querySelector('.op-foto');
  if (!arq) return;
  input.form.elements.avatar.value = 'foto'; input.form.dataset.avatarEscolhido = 1;
  var velha = op.querySelector('.foto-prev,.foto-vazia');
  velha.outerHTML = '<img class="foto-prev" src="' + URL.createObjectURL(arq) + '" alt="">';
  op.querySelector('span:last-child').textContent = 'Trocar foto';
}
// Ao escolher o sexo, já marca o personagem correspondente (se a pessoa ainda não escolheu um)
function sugerirAvatar(sel) {
  var f = sel.form, a = { masculino: 'menino', feminino: 'menina' }[sel.value];
  if (a && !f.dataset.avatarEscolhido) f.elements.avatar.value = a;
}
function imgAvatar(a, cls) { return '<img class="' + cls + '" src="assets/img/avatares/' + (a === 'menina' ? 'menina' : 'menino') + '.svg" alt="">'; }
// Foto da pessoa (se tiver) ou o personagem. u = { avatar, foto }. Se a foto não carregar, volta o personagem.
function avatarDe(u, cls) {
  if (!u.foto || !/^https:\/\//.test(u.foto)) return imgAvatar(u.avatar, cls);
  var reserva = 'assets/img/avatares/' + (u.avatar === 'menina' ? 'menina' : 'menino') + '.svg';
  return '<img class="' + cls + ' foto-perfil" src="' + esc(u.foto) + '" alt="" data-reserva="' + reserva + '" onerror="fotoQuebrada(this)">';
}
function fotoQuebrada(img) { img.onerror = null; img.classList.remove('foto-perfil'); img.src = img.dataset.reserva; }

// FOTO DE PERFIL: recorta no meio (quadrado), reduz para 256×256 e envia como WEBP.
// Redesenhar a imagem também apaga os dados escondidos da foto (como a localização GPS).
async function prepararFoto(arq) {
  if (!/^image\//.test(arq.type)) throw new Error('Escolha um arquivo de imagem (JPG, PNG ou WEBP).');
  if (arq.size > 20 * 1048576) throw new Error('A foto é muito grande (mais de 20 MB).');
  var bmp;
  try { bmp = await createImageBitmap(arq); } catch (e) { throw new Error('Não consegui abrir essa imagem. Tente uma foto JPG ou PNG.'); }
  var L = 256, s = Math.min(bmp.width, bmp.height), c = document.createElement('canvas');
  c.width = c.height = L;
  var ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, L, L);
  return new Promise(function (ok) { c.toBlob(ok, 'image/webp', 0.85); });
}
async function enviarFoto(arq) {
  var blob = await prepararFoto(arq), ext = blob.type === 'image/webp' ? 'webp' : 'png';
  var caminho = AUTH._u.id + '/foto-' + Date.now() + '.' + ext;
  var r = await sb.storage.from('fotos').upload(caminho, blob, { contentType: blob.type });
  if (r.error) throw new Error('Não foi possível enviar a foto: ' + r.error.message);
  return sb.storage.from('fotos').getPublicUrl(caminho).data.publicUrl;
}
function apagarFoto(url) {
  var m = /\/public\/fotos\/(.+)$/.exec(url || '');
  if (m) sb.storage.from('fotos').remove([decodeURIComponent(m[1])]);
}
// Confere nick, sexo e personagem/foto do formulário.
// Devolve { nick, sexo, avatar, usarFoto, arquivo } ou a mensagem de erro (texto).
// Com foto, o personagem continua guardado (aparece se a foto for removida).
function lerPerfil(f) {
  var escolha = f.avatar.value, u = AUTH.usuario() || {};
  var p = { nick: f.nick.value.trim(), sexo: f.sexo.value, avatar: escolha, usarFoto: escolha === 'foto', arquivo: f.arquivo && f.arquivo.files[0] };
  if (!NICK_OK.test(p.nick)) return 'O nick precisa ter de 3 a 16 letras, números, ponto ou _ (sem espaços).';
  if (!p.sexo) return 'Escolha o sexo (ou "Prefiro não dizer").';
  if (!escolha) return 'Escolha seu personagem ou uma foto.';
  if (p.usarFoto) {
    if (!p.arquivo && !u.foto) return 'Escolha a sua foto (toque em "Minha foto").';
    p.avatar = u.avatar || (p.sexo === 'feminino' ? 'menina' : 'menino');
  }
  return p;
}

// TELA DE LOGIN. modo: (vazio) entrar | 'criar' | 'esqueci' | 'nova-senha' (link do e-mail de recuperação)
function telaLogin(modo) {
  var novo = modo === 'criar', corpo;
  document.body.classList.add('na-login');
  if (modo === 'esqueci') corpo = '<h3>Esqueci minha senha</h3><span class="sub">Digite o e-mail da sua conta. Vamos mandar um link para você criar uma senha nova.</span>' +
    campoLogin('email', 'E-mail', 'email', 'email') + '<div class="erro" id="login-erro" role="alert"></div><button class="btn" type="submit">Enviar link</button>' +
    '<button class="btn btn-sec" type="button" onclick="telaLogin()">Voltar</button>';
  else if (modo === 'nova-senha') corpo = '<h3>Criar senha nova</h3>' + campoLogin('senha', 'Senha nova', 'password', 'new-password') + campoLogin('senha2', 'Repita a senha', 'password', 'new-password') +
    '<div class="erro" id="login-erro" role="alert"></div><button class="btn" type="submit">Salvar senha</button>';
  else corpo = '<div class="login-tabs"><button type="button" class="' + (novo ? '' : 'on') + '" onclick="telaLogin()">Entrar</button><button type="button" class="' + (novo ? 'on' : '') + '" onclick="telaLogin(\'criar\')">Criar conta</button></div>' +
    (novo ? campoLogin('nick', 'Nick <small>(aparece no ranking)</small>', 'text', 'nickname', '', ' maxlength="16"') : '') +
    campoLogin('email', 'E-mail', 'email', 'email') + campoLogin('senha', 'Senha', 'password', novo ? 'new-password' : 'current-password') +
    (novo ? campoSexo('') + escolhaAvatar('', '') : (sb ? '<button class="link-esqueci" type="button" onclick="telaLogin(\'esqueci\')">Esqueci minha senha</button>' : '')) +
    '<div class="erro" id="login-erro" role="alert"></div>' +
    '<button class="btn" type="submit">' + (novo ? 'Criar conta' : 'Entrar') + '</button>' +
    '<button class="btn btn-sec" type="button" onclick="entrarNoApp(true)">Continuar sem conta</button>';
  app.innerHTML = '<section class="login"><form class="login-card" novalidate onsubmit="enviarLogin(event,\'' + (modo || '') + '\')">' +
    '<img class="login-logo" src="assets/img/carddex-logo.png" alt="CardDex">' + corpo + '</form></section>';
  window.scrollTo(0, 0);
}

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
// Conta sem nick vai direto para o perfil. Atalhos do app (#admin, #minhas, #ranking) abrem a tela certa.
function entrarNoApp(convidado) {
  if (convidado) { try { localStorage.setItem('carddex_convidado', '1'); } catch (e) {} }
  document.body.classList.remove('na-login');
  atualizarConta();
  var u = AUTH.usuario(), atalho = { '#admin': telaAdmin, '#minhas': telaMinhas, '#ranking': telaRanking }[location.hash];
  if (atalho) history.replaceState(null, '', location.pathname);
  if (u && !u.nick) telaPerfil(); else if (atalho) atalho(); else telaInicio();
}

// Botão do menu: "Entrar" (visitante) ou personagem + nick (logado). O link "Admin" só aparece para administradores.
function atualizarConta() {
  var u = AUTH.usuario(), b = document.getElementById('nav-conta');
  b.innerHTML = u ? avatarDe(u, 'nav-avatar') + '<span>' + esc(u.nick || 'Meu perfil') + '</span>' : 'Entrar';
  b.classList.toggle('logado', !!u);
  b.title = u ? 'Meu perfil (' + u.email + ')' : 'Entrar na sua conta';
  document.getElementById('nav-admin').hidden = !AUTH.admin;
}
function clicarConta() { if (AUTH.usuario()) telaPerfil(); else telaLogin(); }

// TELA – Meu perfil: trocar nick, sexo e personagem, e sair da conta
function telaPerfil() {
  var u = AUTH.usuario();
  if (!u) return telaLogin();
  document.body.classList.remove('na-login');
  ESTADO.redesenhar = null; marcarMenu(-1);
  app.innerHTML = '<section class="login"><form class="login-card" novalidate onsubmit="enviarPerfil(event)">' + avatarDe(u, 'login-logo') +
    '<h3>' + (u.nick ? 'Meu perfil' : 'Complete seu perfil') + '</h3><span class="sub">' + (u.nick ? esc(u.email) : 'Escolha um nick e um personagem para aparecer no ranking.') + '</span>' +
    campoLogin('nick', 'Nick <small>(aparece no ranking)</small>', 'text', 'nickname', u.nick, ' maxlength="16"') + campoSexo(u.sexo) + escolhaAvatar(u.foto ? 'foto' : u.avatar, u.foto) +
    '<div class="erro" id="login-erro" role="alert"></div><button class="btn" type="submit">Salvar</button>' +
    '<button class="btn btn-sec" type="button" onclick="sairDaConta(this)">Sair da conta</button></form>' +
    (logadoNaNuvem() ? '<div class="login-card" id="minha-vitrine"><p class="sub">Carregando vitrine...</p></div>' : '') + '</section>';
  if (u.avatar || u.foto) app.querySelector('form').dataset.avatarEscolhido = 1;
  desenharMinhaVitrine();
  window.scrollTo(0, 0);
}
async function enviarPerfil(e) {
  e.preventDefault();
  var erro = document.getElementById('login-erro'), p = lerPerfil(e.target.elements);
  erro.classList.remove('ok');
  if (typeof p === 'string') { erro.textContent = p; return; }
  var botao = e.target.querySelector('[type=submit]');
  botao.disabled = true; botao.textContent = 'Salvando...';
  try {
    await AUTH.salvarPerfil(p); atualizarConta();
    e.target.querySelector('.login-logo').outerHTML = avatarDe(AUTH.usuario(), 'login-logo');
    erro.classList.add('ok'); erro.textContent = 'Perfil salvo! Voltando para o início...';
    botao.textContent = '✓ Salvo';
    setTimeout(function () { if (document.getElementById('login-erro') === erro) telaInicio(); }, 900);
  } catch (x) { erro.textContent = x.message; botao.disabled = false; botao.textContent = 'Salvar'; }
}
async function sairDaConta(btn) {
  btn.disabled = true; btn.textContent = 'Saindo...';
  await AUTH.sair(); atualizarConta(); telaLogin();
}
