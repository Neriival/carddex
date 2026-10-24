// js/telas/perfil-publico.js
// TELA – PERFIL PÚBLICO de um colecionador
// ============================================================
// Mostra só: banner, personagem/foto com o anel de nível, nick, posição no ranking, total de cartas,
// número de amigos e a vitrine (nunca e-mail ou sexo). Quem tem conta vê o botão de amizade (js/conta/amigos.js).
// Se a privacidade da pessoa deixar (todo mundo, ou só amigos e você é amigo), aparece "Ver coleção" (js/telas/colecao-de.js).
// Abre pelo ranking ou pelo link …/#perfil/<nick> (dá para mandar no WhatsApp), mesmo para quem não tem conta.
// Contas de admin não têm perfil público (só o próprio admin vê o dele).
// Os dados vêm da função "perfil_publico" do banco (docs/supabase.sql).
// ============================================================

async function telaPerfilPublico(nick) {
  document.body.classList.remove('na-login');
  ESTADO.redesenhar = null;
  marcarMenu(-1);
  vitrineAberta = null;
  var volta = '<h2><button class="voltar" onclick="telaRanking()">← Ranking</button></h2>';
  if (!sb) {
    app.innerHTML = volta +
      '<div class="aviso">Os perfis aparecem quando o site estiver ligado ao banco de dados.</div>';
    return;
  }
  app.innerHTML = volta + '<p class="sub">Carregando perfil...</p>';
  window.scrollTo(0, 0);
  var r = await sb.rpc('perfil_publico', {
      n: nick
    }),
    p = r.data;
  if (r.error || !p) {
    app.innerHTML = volta + '<div class="aviso">Não encontramos o colecionador "' + esc(nick) +
      '".</div>';
    return;
  }
  var cartas = await cartasDaVitrine(p.vitrine || []);
  vitrineAberta = cartas.map(function (v) {
    return {
      c: v.c,
      k: v.k.id
    };
  });
  var u = AUTH.usuario(),
    nickJs = esc(p.nick),
    nv = nivel(p.total),
    // botão de amizade: só para quem tem conta com nick, no perfil de outra pessoa (admins não usam amigos)
    amizade = logadoNaNuvem() && u.nick && !p.eu && !p.admin && !AUTH.admin ? botaoAmizade(p) : '';
  app.innerHTML = volta +
    (p.admin ?
      '<div class="aviso">Sua conta é de <b>administrador</b>: ela fica fora do ranking e este perfil só você vê.</div>' :
      '') +
    '<section class="perfil-pub">' + bannerDe(p, 'perfil-capa') + '<div class="perfil-corpo">' +
    avatarComNivel(p, p.total, 'perfil-avatar') + '<div class="perfil-dados"><h2>' + esc(p.nick) +
    (p.eu ? ' <small>(você)</small>' : '') + '</h2>' +
    '<div class="perfil-numeros"><span><b>Nv ' + nv.n + '</b> colecionador</span>' +
    (p.posicao ? '<span><b>' + p.posicao + 'º</b> no ranking</span>' : '') +
    '<span><b>' + p.total + '</b> cartas</span>' + (p.admin ? '' : '<span><b>' + (p.amigos || 0) + '</b> ' +
      (p.amigos === 1 ? 'amigo' : 'amigos') + '</span>') + '</div>' +
    '<div class="perfil-acoes">' + (p.pode_ver ? '<button class="btn" onclick="telaColecaoDe(\'' + nickJs +
      '\')">Ver coleção</button>' : '') + amizade +
    (p.admin ? '' : '<button class="btn btn-sec" onclick="compartilharPerfil(\'' + nickJs +
      '\')">Compartilhar perfil</button>') +
    (p.eu ? '<button class="btn btn-sec" onclick="telaPerfil()">Editar meu perfil</button>' : '') + '</div>' +
    (p.eu && !p.admin && p.privacidade !== 'todos' ? '<span class="sub">' + (p.privacidade === 'amigos' ?
        'Só seus amigos veem sua coleção completa.' : 'Sua coleção está fechada.') +
      ' Para mudar, vá em <a href="#" onclick="telaPerfil();return false">Meu perfil</a>.</span>' : '') +
    (!p.eu && !p.pode_ver && p.amizade !== 'amigo' && amizade ? '<span class="sub">A coleção completa de ' +
      esc(p.nick) + ' não está aberta para todos. Amigos podem conseguir ver.</span>' : '') +
    '<p class="sub" id="msg-compartilhar" role="status"></p></div></div></section>' +
    '<h2>Vitrine</h2><span class="sub">' + (p.eu ? 'Suas cartas favoritas ou mais raras. ' : 'As cartas que ' +
      esc(p.nick) + ' mais gosta. ') + 'Toque para ver em tamanho grande.</span>' +
    (cartas.length ? gradeVitrine(cartas, true) : '<div class="aviso">' +
      (p.eu ? 'Sua vitrine está vazia. Abra uma carta que você tem e toque em <b>☆ Pôr na vitrine</b>.' : esc(p.nick) +
        ' ainda não escolheu as cartas da vitrine.') + '</div>') +
    (!u ? '<div class="rank-eu"><b>Monte a sua vitrine também</b>' +
      '<span class="sub">Crie uma conta grátis, marque suas cartas e mostre as mais raras.</span>' +
      '<button class="btn" onclick="telaLogin(\'criar\')">Criar conta</button></div>' : '');
}

// Link do perfil: no celular abre o menu de compartilhar; no computador copia o link
function linkPerfil(nick) {
  return location.origin + location.pathname + '#perfil/' + encodeURIComponent(nick);
}

// Botão "Compartilhar perfil": menu do celular ou copia o link
async function compartilharPerfil(nick) {
  var url = linkPerfil(nick),
    texto = 'Olha a minha coleção de cartas no CardDex!',
    msg = document.getElementById('msg-compartilhar');
  if (navigator.share && matchMedia('(hover:none)').matches) {
    try {
      await navigator.share({
        title: 'CardDex – ' + nick,
        text: texto,
        url: url
      });
    } catch (e) {}
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    msg.innerHTML = 'Link copiado! Cole onde quiser, ou <a href="https://wa.me/?text=' + encodeURIComponent(texto +
      ' ' + url) + '" target="_blank" rel="noopener">mande no WhatsApp</a>.';
  } catch (e) {
    msg.innerHTML = 'Seu link: <b>' + esc(url) + '</b>';
  }
}

// Link …/#perfil/<nick> aberto com o site já aberto
window.addEventListener('hashchange', function () {
  var m = /^#perfil\/(.+)$/.exec(location.hash);
  if (m) telaPerfilPublico(decodeURIComponent(m[1]));
});
