// js/conta/perfil.js
// TELA "MEU PERFIL" E OS CAMPOS DE PERFIL (usados também no cadastro)
// ============================================================
// Nick (público, aparece no ranking), sexo (só a pessoa e os admins veem), personagem ou foto
// e a opção de deixar a coleção aberta para os outros (começa fechada).
// Embaixo do formulário fica a "Minha vitrine" (js/recursos/vitrine.js).
// ============================================================

// CAMPOS DO FORMULÁRIO
function campoNick(valor) { return campoLogin('nick', 'Nick <small>(aparece no ranking)</small>', 'text', 'nickname', valor, ' maxlength="16"'); }

function campoSexo(atual) {
  return '<div class="campo"><label for="lg-sexo">Sexo <small>(só você vê)</small></label><select id="lg-sexo" name="sexo" onchange="sugerirAvatar(this)"><option value="">Selecione</option>' +
    [['masculino', 'Masculino'], ['feminino', 'Feminino'], ['nao_informar', 'Prefiro não dizer']].map(function (o) { return '<option value="' + o[0] + '"' + (atual === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>';
}

// Menino | Menina | Minha foto. atual = 'menino' | 'menina' | 'foto'; foto = endereço da foto atual (se tiver)
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

// Clicar em "Minha foto" abre a escolha do arquivo.
// Se já tem foto e outra opção estava marcada, o 1º clique só volta para a foto.
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
  op.querySelector('.foto-prev,.foto-vazia').outerHTML = '<img class="foto-prev" src="' + URL.createObjectURL(arq) + '" alt="">';
  op.querySelector('span:last-child').textContent = 'Trocar foto';
}

// Ao escolher o sexo, já marca o personagem correspondente (se a pessoa ainda não escolheu um)
function sugerirAvatar(sel) {
  var f = sel.form, a = { masculino: 'menino', feminino: 'menina' }[sel.value];
  if (a && !f.dataset.avatarEscolhido) f.elements.avatar.value = a;
}

// Confere nick, sexo e personagem/foto do formulário.
// Devolve { nick, sexo, avatar, usarFoto, arquivo } ou a mensagem de erro (texto).
// Com foto, o personagem continua guardado (aparece se a foto for removida).
function lerPerfil(f) {
  var escolha = f.avatar.value, u = AUTH.usuario() || {};
  var p = { nick: f.nick.value.trim(), sexo: f.sexo.value, avatar: escolha, usarFoto: escolha === 'foto', arquivo: f.arquivo && f.arquivo.files[0] };
  if (f.colecao_publica) p.colecao_publica = f.colecao_publica.checked;
  if (!NICK_OK.test(p.nick)) return 'O nick precisa ter de 3 a 16 letras, números, ponto ou _ (sem espaços).';
  if (!p.sexo) return 'Escolha o sexo (ou "Prefiro não dizer").';
  if (!escolha) return 'Escolha seu personagem ou uma foto.';
  if (p.usarFoto) {
    if (!p.arquivo && !u.foto) return 'Escolha a sua foto (toque em "Minha foto").';
    p.avatar = u.avatar || (p.sexo === 'feminino' ? 'menina' : 'menino');
  }
  return p;
}

// TELA – Meu perfil (conta sem nick vê "Complete seu perfil")
function telaPerfil() {
  var u = AUTH.usuario();
  if (!u) return telaLogin();
  document.body.classList.remove('na-login');
  ESTADO.redesenhar = null; marcarMenu(-1);
  app.innerHTML = '<section class="login"><form class="login-card" novalidate onsubmit="enviarPerfil(event)">' + avatarDe(u, 'login-logo') +
    '<h3>' + (u.nick ? 'Meu perfil' : 'Complete seu perfil') + '</h3><span class="sub">' + (u.nick ? esc(u.email) : 'Escolha um nick e um personagem para aparecer no ranking.') + '</span>' +
    campoNick(u.nick) + campoSexo(u.sexo) + escolhaAvatar(u.foto ? 'foto' : u.avatar, u.foto) +
    (logadoNaNuvem() && !AUTH.admin ? '<label class="opcao"><input type="checkbox" name="colecao_publica"' + (u.colecao_publica ? ' checked' : '') + '>' +
      '<span><b>Deixar outras pessoas verem minha coleção</b><small>Quem abrir seu perfil vê todas as cartas que você marcou e as suas repetidas.</small></span></label>' : '') +
    '<div class="erro" id="login-erro" role="alert"></div><button class="btn" type="submit">Salvar</button>' +
    '<button class="btn btn-sec" type="button" onclick="sairDaConta(this)">Sair da conta</button></form>' +
    (logadoNaNuvem() ? '<div class="login-card" id="minha-vitrine"><p class="sub">Carregando vitrine...</p></div>' : '') + '</section>';
  if (u.avatar || u.foto) app.querySelector('form').dataset.avatarEscolhido = 1;
  desenharMinhaVitrine();
  window.scrollTo(0, 0);
}

// Salvar: mostra "Perfil salvo!" e volta para o início
async function enviarPerfil(e) {
  e.preventDefault();
  var erro = document.getElementById('login-erro'), p = lerPerfil(e.target.elements), botao = e.target.querySelector('[type=submit]');
  erro.classList.remove('ok');
  if (typeof p === 'string') { erro.textContent = p; return; }
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
