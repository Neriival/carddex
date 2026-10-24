// js/conta/perfil.js
// TELA "MEU PERFIL" E OS CAMPOS DE PERFIL (usados também no cadastro)
// ============================================================
// Nick (público, aparece no ranking), sexo (só a pessoa e os admins veem), personagem (treinador do anime)
// ou foto, banner do perfil e quem pode ver a coleção (todo mundo, só amigos ou ninguém).
// No topo, a prévia do perfil (banner + personagem com o anel de nível) muda na hora ao escolher.
// Embaixo do formulário ficam "Meus amigos" (js/conta/amigos.js) e "Minha vitrine" (js/recursos/vitrine.js).
// ============================================================

// CAMPOS DO FORMULÁRIO
function campoNick(valor) {
  return campoLogin('nick', 'Nick <small>(aparece no ranking)</small>', 'text', 'nickname',
    valor, ' maxlength="16"');
}

// Caixa de seleção do sexo (só a própria pessoa e os admins veem)
function campoSexo(atual) {
  return '<div class="campo"><label for="lg-sexo">Sexo <small>(só você vê)</small></label>' +
    '<select id="lg-sexo" name="sexo" onchange="sugerirAvatar(this)">' +
    '<option value="">Selecione</option>' + [
      ['masculino', 'Masculino'],
      ['feminino', 'Feminino'],
      ['nao_informar',
        'Prefiro não dizer'
      ]
    ].map(function (o) {
      return '<option value="' + o[0] + '"' + (atual === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('') + '</select></div>';
}

// Uma opção de personagem (botão redondo com o nome embaixo)
function opcaoAvatar(id, nome, atual, cls) {
  return '<label class="avatar-op' + (cls || '') + '"><input type="radio" name="avatar" value="' + id + '"' +
    (atual === id ? ' checked' : '') + ' onchange="avatarEscolhido(this)">' + imgAvatar(id, '') + '<span>' + nome +
    '</span></label>';
}

// Minha foto (primeiro botão) e os treinadores do anime, todos numa grade só.
// atual = nome do treinador | 'foto' | '' (nada escolhido); foto = endereço da foto atual (se tiver)
function escolhaAvatar(atual, foto) {
  var ops = '';
  // "Minha foto" só existe com o banco ligado (a foto fica guardada no Supabase)
  if (sb) ops += '<label class="avatar-op op-treinador op-foto" onclick="escolherFoto(event,this)">' +
    '<input type="radio" name="avatar" value="foto"' + (atual === 'foto' ? ' checked' : '') + '>' +
    (foto ? '<img class="foto-prev" src="' + esc(foto) + '" alt="">' : '<span class="foto-vazia">+</span>') + '<span>' +
    (foto ? 'Trocar foto' : 'Minha foto') + '</span></label>';
  ops += TREINADORES.map(function (t) {
    return opcaoAvatar(t[0], t[1], atual, ' op-treinador');
  }).join('');
  return '<fieldset class="treinadores"><legend>Personagem ou foto</legend>' + ops + '</fieldset>' +
    (sb ? '<input type="file" name="arquivo" accept="image/*" hidden onchange="previaFoto(this)">' +
      '<small class="sub dica-foto">A foto aparece para todos no ranking. Escolha uma em que você esteja à vontade.</small>' :
      '');
}

// Escolheu um personagem: lembra a escolha (o sexo não troca mais) e atualiza a prévia
function avatarEscolhido(radio) {
  radio.form.dataset.avatarEscolhido = 1;
  atualizarPrevia(radio.form);
}

// Clicar em "Minha foto" abre a escolha do arquivo.
// Se já tem foto e outra opção estava marcada, o 1º clique só volta para a foto.
function escolherFoto(e, op) {
  if (e.target.type === 'radio') return; // o clique já chegou no próprio botão de opção
  var radio = op.querySelector('[type=radio]');
  if (!radio.checked && op.querySelector('.foto-prev')) {
    op.closest('form').dataset.avatarEscolhido = 1;
    setTimeout(function () {
      atualizarPrevia(op.closest('form'));
    });
    return;
  }
  e.preventDefault();
  op.closest('form').elements.arquivo.click();
}

// Mostra a foto escolhida dentro da opção e marca "Minha foto"
function previaFoto(input) {
  var arq = input.files[0],
    op = input.form.querySelector('.op-foto');
  if (!arq) return;
  input.form.elements.avatar.value = 'foto';
  input.form.dataset.avatarEscolhido = 1;
  op.querySelector('.foto-prev,.foto-vazia').outerHTML = '<img class="foto-prev" src="' + URL.createObjectURL(arq) +
    '" alt="">';
  op.querySelector('span:last-child').textContent = 'Trocar foto';
  atualizarPrevia(input.form);
}

// Ao escolher o sexo, já marca o personagem correspondente (se a pessoa ainda não escolheu um)
function sugerirAvatar(sel) {
  var f = sel.form,
    a = {
      masculino: 'ash',
      feminino: 'misty'
    } [sel.value];
  if (a && !f.dataset.avatarEscolhido) f.elements.avatar.value = a;
  atualizarPrevia(f);
}

// BANNER: sem banner | um por tipo de Pokémon | minha imagem. atual = '' | tipo | endereço da imagem enviada
function escolhaBanner(atual) {
  var minha = /^https:\/\//.test(atual || '');

  function op(valor, img, nome, cls) {
    return '<label class="banner-op' + (cls || '') + '"' +
      (valor === 'minha' ? ' onclick="escolherBanner(event,this)"' :
        '') + '><input type="radio" name="banner" value="' + valor + '"' +
      ((valor === 'minha' ? minha : !minha && (atual || '') === valor) ? ' checked' : '') +
      ' onchange="atualizarPrevia(this.form)">' + img + '<span>' + nome + '</span></label>';
  }
  return '<fieldset class="banners"><legend>Banner do perfil</legend>' +
    op('', '<span class="banner-vazio"></span>', 'Padrão') + BANNERS.map(function (b) {
      return op(b[0], '<img src="assets/img/banners/' + b[0] + '.webp" alt="" loading="lazy">', b[1]);
    }).join('') +
    op('minha', minha ? '<img class="banner-prev" src="' + esc(atual) + '" alt="">' :
      '<span class="banner-vazio foto-vazia">+</span>', minha ? 'Trocar imagem' : 'Minha imagem', ' op-minha') +
    '</fieldset>' +
    '<input type="file" name="arquivo_banner" accept="image/*" hidden onchange="previaBanner(this)">' +
    '<small class="sub dica-foto">Sua imagem é cortada no formato do banner (bem largo, 4 por 1).</small>';
}

// Clicar em "Minha imagem" abre a escolha do arquivo (se já tem imagem, o 1º clique só volta para ela)
function escolherBanner(e, op) {
  if (e.target.type === 'radio') return;
  var radio = op.querySelector('[type=radio]');
  if (!radio.checked && op.querySelector('.banner-prev')) return;
  e.preventDefault();
  op.closest('form').elements.arquivo_banner.click();
}

// Mostra a imagem escolhida dentro da opção e marca "Minha imagem"
function previaBanner(input) {
  var arq = input.files[0],
    op = input.form.querySelector('.op-minha');
  if (!arq) return;
  input.form.elements.banner.value = 'minha';
  op.querySelector('.banner-prev,.banner-vazio').outerHTML = '<img class="banner-prev" src="' + URL.createObjectURL(
    arq) + '" alt="">';
  op.querySelector('span:last-child').textContent = 'Trocar imagem';
  atualizarPrevia(input.form);
}

// QUEM PODE VER A COLEÇÃO: todo mundo | só amigos | ninguém
function campoPrivacidade(atual) {
  return '<fieldset class="privacidade">' +
    '<legend>Quem pode ver minha coleção completa</legend>' + [
      ['todos', 'Todo mundo', 'Qualquer pessoa que abrir seu perfil vê suas cartas e repetidas.'],
      ['amigos', 'Só amigos', 'Só quem você aceitou como amigo.'],
      ['ninguem', 'Ninguém', 'Os outros veem só a vitrine e o total de cartas.']
    ].map(function (o) {
      return '<label class="opcao"><input type="radio" name="privacidade" value="' + o[0] + '"' +
        (atual === o[0] ? ' checked' : '') + '><span><b>' + o[1] + '</b><small>' + o[2] + '</small></span></label>';
    }).join('') + '</fieldset>';
}

// PRÉVIA no topo do Meu perfil: banner + personagem/foto com o anel de nível, como os outros veem
function previaPerfil(u) {
  return '<div class="perfil-previa">' + bannerDe(u, 'perfil-capa') + avatarComNivel(u, totalTenho(), 'login-logo') +
    '</div>';
}

// Redesenha a prévia com o que está escolhido no formulário (ainda sem salvar)
function atualizarPrevia(f) {
  var box = f.querySelector('.perfil-previa');
  if (!box) return;
  var u = AUTH.usuario() || {},
    a = f.elements.avatar.value,
    b = f.elements.banner ? f.elements.banner.value : u.banner,
    arq = f.elements.arquivo && f.elements.arquivo.files[0],
    arqB = f.elements.arquivo_banner && f.elements.arquivo_banner.files[0];
  var p = {
    avatar: a === 'foto' ? u.avatar : a,
    foto: a === 'foto' ? (arq ? URL.createObjectURL(arq) : u.foto) : '',
    banner: b === 'minha' ? (arqB ? URL.createObjectURL(arqB) : u.banner) : b
  };
  box.outerHTML = previaPerfil(p);
}

// Confere nick, sexo e personagem/foto do formulário (e banner e privacidade, no Meu perfil).
// Devolve { nick, sexo, avatar, usarFoto, arquivo, banner, arquivoBanner, privacidade } ou a mensagem de erro (texto).
// Com foto, o personagem continua guardado (aparece se a foto for removida).
function lerPerfil(f) {
  var escolha = f.avatar.value,
    u = AUTH.usuario() || {};
  var p = {
    nick: f.nick.value.trim(),
    sexo: f.sexo.value,
    avatar: escolha,
    usarFoto: escolha === 'foto',
    arquivo: f.arquivo && f.arquivo.files[0]
  };
  if (f.privacidade) p.privacidade = f.privacidade.value || 'ninguem';
  if (f.banner) {
    p.banner = f.banner.value;
    p.arquivoBanner = f.arquivo_banner && f.arquivo_banner.files[0];
  }
  if (!NICK_OK.test(p.nick)) return 'O nick precisa ter de 3 a 16 letras, números, ponto ou _ (sem espaços).';
  if (!p.sexo) return 'Escolha o sexo (ou "Prefiro não dizer").';
  if (!escolha) return 'Escolha seu personagem ou uma foto.';
  if (p.usarFoto) {
    if (!p.arquivo && !u.foto) return 'Escolha a sua foto (toque em "Minha foto").';
    p.avatar = u.avatar || (p.sexo === 'feminino' ? 'misty' : 'ash');
  }
  return p;
}

// TELA – Meu perfil (conta sem nick vê "Complete seu perfil")
function telaPerfil() {
  var u = AUTH.usuario();
  if (!u) return telaLogin();
  var nuvem = logadoNaNuvem();
  document.body.classList.remove('na-login');
  ESTADO.redesenhar = null;
  marcarMenu(-1);
  app.innerHTML = '<section class="login">' +
    '<form class="login-card perfil-form" novalidate onsubmit="enviarPerfil(event)">' + previaPerfil(u) +
    '<h3>' + (u.nick ? 'Meu perfil' : 'Complete seu perfil') + '</h3><span class="sub">' +
    (u.nick ? esc(u.email) : 'Escolha um nick e um personagem para aparecer no ranking.') + '</span>' +
    campoNick(u.nick) + campoSexo(u.sexo) + escolhaAvatar(u.foto ? 'foto' : u.avatar && avatarValido(u.avatar),
      u.foto) +
    (nuvem ? escolhaBanner(u.banner) : '') +
    (nuvem && !AUTH.admin ? campoPrivacidade(u.privacidade) : '') +
    '<div class="erro" id="login-erro" role="alert"></div>' +
    '<button class="btn" type="submit">Salvar</button>' +
    '<button class="btn btn-sec" type="button" onclick="sairDaConta(this)">Sair da conta</button>' +
    '</form>' +
    (nuvem && !AUTH.admin && u.nick ? '<div class="login-card perfil-form" id="meus-amigos">' +
      '<p class="sub">Carregando amigos...</p></div>' : '') +
    (nuvem ? '<div class="login-card perfil-form" id="minha-vitrine">' +
      '<p class="sub">Carregando vitrine...</p></div>' : '') + '</section>';
  if (u.avatar || u.foto) app.querySelector('form').dataset.avatarEscolhido = 1;
  desenharMeusAmigos();
  desenharMinhaVitrine();
  window.scrollTo(0, 0);
}

// Salvar: mostra "Perfil salvo!" e volta para o início
async function enviarPerfil(e) {
  e.preventDefault();
  var erro = document.getElementById('login-erro'),
    p = lerPerfil(e.target.elements),
    botao = e.target.querySelector('[type=submit]');
  erro.classList.remove('ok');
  if (typeof p === 'string') {
    erro.textContent = p;
    return;
  }
  botao.disabled = true;
  botao.textContent = 'Salvando...';
  try {
    await AUTH.salvarPerfil(p);
    atualizarConta();
    e.target.querySelector('.perfil-previa').outerHTML = previaPerfil(AUTH.usuario());
    erro.classList.add('ok');
    erro.textContent = 'Perfil salvo! Voltando para o início...';
    botao.textContent = '✓ Salvo';
    setTimeout(function () {
      if (document.getElementById('login-erro') === erro) telaInicio();
    }, 900);
  } catch (x) {
    erro.textContent = x.message;
    botao.disabled = false;
    botao.textContent = 'Salvar';
  }
}

// Botão "Sair da conta"
async function sairDaConta(btn) {
  btn.disabled = true;
  btn.textContent = 'Saindo...';
  await AUTH.sair();
  atualizarConta();
  telaLogin();
}
