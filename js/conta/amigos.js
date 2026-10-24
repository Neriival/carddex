// js/conta/amigos.js
// AMIGOS: pedidos de amizade, lista de amigos e o aviso de pedidos no menu
// ============================================================
// A pessoa manda um pedido pelo nick (ou pelo botão no perfil público) e o outro aceita ou recusa.
// Amigos podem ver a coleção um do outro quando a privacidade for "Só amigos" (Meu perfil).
// Tudo passa pelas funções do banco (pedir_amizade, responder_amizade, remover_amizade, meus_amigos):
// ninguém lê a tabela de amizades direto. Contas de admin não usam amigos.
// ============================================================

var AMIGOS = {
  lista: [], // [{ nick, avatar, foto, total, estado: 'amigo' | 'recebido' | 'enviado' }]
  recebidos: 0 // pedidos esperando a minha resposta (bolinha no botão da conta)
};

// Lê a lista do banco e atualiza a bolinha de pedidos no menu
async function carregarAmigos() {
  if (!logadoNaNuvem() || AUTH.admin) {
    AMIGOS.lista = [];
    AMIGOS.recebidos = 0;
    return;
  }
  var r = await sb.rpc('meus_amigos');
  if (r.error) return;
  AMIGOS.lista = r.data || [];
  AMIGOS.recebidos = AMIGOS.lista.filter(function (a) {
    return a.estado === 'recebido';
  }).length;
  atualizarConta();
}

// Pedir, aceitar, recusar ou desfazer amizade. Devolve a mensagem de erro ('' = deu certo).
async function acaoAmizade(acao, nick) {
  var r = acao === 'pedir' ? await sb.rpc('pedir_amizade', {
    n: nick
  }) : acao === 'aceitar' || acao === 'recusar' ? await sb.rpc('responder_amizade', {
    n: nick,
    aceitar: acao === 'aceitar'
  }) : await sb.rpc('remover_amizade', {
    n: nick
  });
  if (r.error) return r.error.message;
  await carregarAmigos();
  return '';
}

// Uma pessoa da lista: personagem/foto, nick (abre o perfil), total e os botões da situação
function linhaAmigo(a) {
  var n = esc(a.nick),
    botoes = a.estado === 'recebido' ?
    '<button class="btn" type="button" onclick="clicarAmizade(this,\'aceitar\',\'' + n + '\')">Aceitar</button>' +
    '<button class="btn btn-sec" type="button" onclick="clicarAmizade(this,\'recusar\',\'' + n +
    '\')">Recusar</button>' :
    a.estado === 'enviado' ?
    '<button class="btn btn-sec" type="button" onclick="clicarAmizade(this,\'remover\',\'' + n +
    '\')">Cancelar</button>' :
    '<button class="btn-link" type="button" title="Desfazer amizade" onclick="clicarAmizade(this,\'remover\',\'' + n +
    '\',true)">Remover</button>';
  return '<li><button class="amigo-nome" type="button" onclick="telaPerfilPublico(\'' + n + '\')">' +
    avatarDe(a, 'rank-avatar') + '<span><b>' + n + '</b><small>' + a.total + ' cartas · Nv ' + nivel(a.total).n +
    '</small></span></button><span class="amigo-acoes">' + botoes + '</span></li>';
}

// Quadro "Meus amigos" no Meu perfil: adicionar pelo nick, pedidos recebidos, amigos e pedidos enviados
async function desenharMeusAmigos() {
  var box = document.getElementById('meus-amigos');
  if (!box) return;
  await carregarAmigos();
  if (box !== document.getElementById('meus-amigos')) return; // saiu da tela antes de terminar

  function grupo(estado, titulo) {
    var l = AMIGOS.lista.filter(function (a) {
      return a.estado === estado;
    });
    return l.length ? '<h4>' + titulo + ' <small>(' + l.length + ')</small></h4><ul class="amigos">' + l.map(
      linhaAmigo).join('') + '</ul>' : '';
  }
  var amigos = grupo('amigo', 'Amigos');
  box.innerHTML = '<h3>Meus amigos</h3>' +
    '<form class="amigo-novo" onsubmit="adicionarAmigo(event)">' +
    '<div class="campo"><input name="nick" type="text" maxlength="16" ' +
    'placeholder="Nick do colecionador" aria-label="Nick do colecionador" autocomplete="off">' +
    '</div>' +
    '<button class="btn" type="submit">Adicionar</button></form>' +
    '<p class="sub" id="msg-amigos" role="status"></p>' +
    grupo('recebido', 'Pedidos para você') + (amigos ||
      '<p class="sub">Você ainda não tem amigos aqui. Adicione pelo nick ou pelo perfil de alguém no ranking.</p>') +
    grupo('enviado', 'Pedidos enviados');
}

// Formulário "Adicionar" do Meu perfil
async function adicionarAmigo(e) {
  e.preventDefault();
  var campo = e.target.elements.nick,
    nick = campo.value.trim(),
    msg = document.getElementById('msg-amigos');
  if (!NICK_OK.test(nick)) {
    msg.textContent = 'Digite o nick certinho (de 3 a 16 letras, números, ponto ou _).';
    return;
  }
  msg.textContent = 'Enviando...';
  var erro = await acaoAmizade('pedir', nick);
  if (erro) {
    msg.textContent = erro;
    return;
  }
  await desenharMeusAmigos();
  var m = document.getElementById('msg-amigos');
  if (m) m.textContent = 'Pedido enviado para ' + nick + '!';
}

// Botões da lista (Aceitar, Recusar, Cancelar, Remover). confirmar = pergunta antes (desfazer amizade)
async function clicarAmizade(btn, acao, nick, confirmar) {
  if (confirmar && !confirm('Desfazer a amizade com ' + nick + '?')) return;
  btn.disabled = true;
  var erro = await acaoAmizade(acao, nick);
  if (erro) {
    btn.disabled = false;
    alert(erro);
    return;
  }
  desenharMeusAmigos();
}

// Botão de amizade do perfil público (muda conforme a situação) e o que acontece ao clicar nele
function botaoAmizade(p) {
  var n = esc(p.nick);

  function b(txt, acao, sec) {
    return '<button class="btn' + (sec ? ' btn-sec' : '') + '" onclick="amizadeNoPerfil(this,\'' + acao + '\',\'' + n +
      '\')">' + txt + '</button>';
  }
  if (p.amizade === 'amigo') return b('✓ Amigos', 'remover', true);
  if (p.amizade === 'enviado') return b('Pedido enviado · cancelar', 'remover', true);
  if (p.amizade === 'recebido') return b('Aceitar amizade', 'aceitar') + b('Recusar', 'recusar', true);
  return b('+ Adicionar amigo', 'pedir');
}

// Clique no botão de amizade do perfil público: faz a ação e redesenha o perfil
async function amizadeNoPerfil(btn, acao, nick) {
  if (acao === 'remover' && btn.textContent.indexOf('Amigos') >= 0 && !confirm('Desfazer a amizade com ' + nick +
      '?')) return;
  btn.disabled = true;
  var erro = await acaoAmizade(acao, nick);
  if (erro) {
    btn.disabled = false;
    alert(erro);
    return;
  }
  telaPerfilPublico(nick);
}
