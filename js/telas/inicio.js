// js/telas/inicio.js
// TELAS DE NAVEGAÇÃO: Início (jogos) → Jogo (séries) → Série (coleções)
// ============================================================
// Cada tela é uma função que desenha o HTML dentro de <main id="app">.
// A tela da coleção (as cartas) fica em js/telas/colecao.js.
// ============================================================

// Botão de uma coleção: logo, nome, data de lançamento e progresso
function botaoColecao(c) {
  var n = qtdTenho(c.id), p = pct(n, c.total);
  return '<button class="colecao" onclick="telaColecao(\'' + c.id + '\')"><img src="assets/img/colecoes/' + c.serie + '/' + c.id + '.webp" alt="" onerror="logoAlt(this)"><h3>' + esc(c.nome) + '</h3>' +
    '<span class="sub">Lançamento: ' + dataBR(c.lancamento) + '</span><span class="sub">' + n + ' de ' + c.total + ' cartas · ' + p + '%</span>' + barra(p) + '</button>';
}

// Botão de uma série (tela do jogo e busca)
function botaoSerie(s) {
  var r = resumoSerie(s);
  return '<button class="colecao serie-btn" onclick="telaSerie(\'' + s.id + '\')"><img src="assets/img/series/' + s.id + '.webp" alt="" onerror="this.remove()"><h3>' + esc(s.nome) + '</h3>' +
    '<span class="sub">' + s.colecoes.length + ' coleções</span><span class="sub">' + r.tenho + ' de ' + r.total + ' cartas · ' + r.pct + '%</span>' + barra(r.pct) + '</button>';
}

// Botão de um jogo (Pokémon, Yu-Gi-Oh!...). Ícones em assets/img/jogos/<id>.svg
function botaoJogo(j) {
  var series = seriesDoJogo(j.id);
  return '<button class="colecao jogo-btn' + (series.length ? '' : ' em-breve') + '" onclick="telaJogo(\'' + j.id + '\')"><img src="assets/img/jogos/' + j.id + '.svg" alt="" onerror="this.remove()"><h3>' + esc(j.nome) + '</h3>' +
    '<span class="sub">' + (series.length ? series.length + ' séries' : 'Em breve') + '</span></button>';
}

// TELA – Início: destaque, números e botões dos jogos.
// 'ir' rola a página até um bloco (ex.: 'series'). Com algo na busca, mostra as séries e coleções encontradas.
function telaInicio(ir) {
  ESTADO.redesenhar = null; marcarMenu(ir === 'series' ? 1 : 0);
  var q = ((document.getElementById('busca') || {}).value || '').trim().toLowerCase(), blocos;
  if (q) {
    var achou = function (t) { return t.toLowerCase().indexOf(q) > -1; };
    var ss = ESTADO.series.filter(function (s) { return achou(s.nome); });
    var cs = todasColecoes().filter(function (c) { return achou(c.nome); });
    blocos = '<h2 id="series">Resultados da busca</h2>' + (ss.length || cs.length ? '<div class="colecoes">' + ss.map(botaoSerie).join('') + cs.map(botaoColecao).join('') + '</div>' : '<p class="sub">Nenhuma série ou coleção encontrada.</p>');
  } else blocos = '<h2 id="series">Séries</h2><span class="sub">Escolha o jogo de cartas</span><div class="colecoes jogos">' + ESTADO.jogos.map(botaoJogo).join('') + '</div>';
  app.innerHTML = '<section class="hero"><div><small>SEU ESPAÇO DE COLECIONADOR</small><h1>Seu álbum.<span>Suas conquistas.</span></h1><p>Explore as séries e marque as cartas que você já tem.</p>' +
    '<button class="btn" onclick="telaInicio(\'series\')">Explorar séries →</button></div><img src="assets/img/carddex-logo.png" alt=""></section>' +
    '<div class="stats" id="stats"><div class="stat"><div>Séries disponíveis</div><b>' + pad(ESTADO.series.length, 2) + '</b></div><div class="stat"><div>Coleções disponíveis</div><b>' + pad(todasColecoes().length, 2) + '</b></div>' +
    '<div class="stat"><div>Cartas que você tem</div><b>' + totalTenho() + '</b></div></div>' + blocos;
  var alvo = ir && document.getElementById(ir);
  if (alvo) alvo.scrollIntoView({ behavior: 'smooth' }); else if (!q) window.scrollTo(0, 0);
}

// TELA – Jogo: séries do jogo, da mais nova para a mais antiga (ou "Em breve")
function telaJogo(id) {
  var j = acharJogo(id), series = seriesDoJogo(id);
  ESTADO.redesenhar = null; marcarMenu(1);
  app.innerHTML = '<h2><button class="voltar" onclick="telaInicio(\'series\')">← Séries</button></h2><div class="titulo-jogo"><img src="assets/img/jogos/' + j.id + '.svg" alt="" onerror="this.remove()"><h2>' + esc(j.nome) + '</h2></div>' +
    (series.length ? '<span class="sub">Séries da mais nova para a mais antiga</span><div class="colecoes">' + series.map(botaoSerie).join('') + '</div>'
      : '<div class="aviso">As cartas de ' + esc(j.nome) + ' ainda vão chegar ao CardDex. Fique de olho!</div>');
  window.scrollTo(0, 0);
}

// TELA – Série: coleções da série, da mais nova para a mais antiga
function telaSerie(id) {
  var s = acharSerie(id), j = acharJogo(s.jogo) || ESTADO.jogos[0];
  ESTADO.redesenhar = null; marcarMenu(1);
  app.innerHTML = '<h2><button class="voltar" onclick="telaJogo(\'' + j.id + '\')">← ' + esc(j.nome) + '</button></h2><h2 class="titulo">' + esc(s.nome) + '</h2>' +
    '<span class="sub">Coleções da mais nova para a mais antiga</span><div class="colecoes">' + s.colecoes.map(botaoColecao).join('') + '</div>';
  window.scrollTo(0, 0);
}
