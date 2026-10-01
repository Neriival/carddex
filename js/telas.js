// js/telas.js
// Telas: início (séries) → série (coleções) → coleção (cartas)
// ============================================================
// TELAS DO SITE
// Fluxo: Início (séries) → Série (coleções) → Coleção (cartas)
// Cada tela é uma função que desenha o HTML dentro de <main id="app">.
// Para mudar o visual de uma tela, mexa no HTML dentro da função dela;
// para mudar cores/tamanhos, mexa nos arquivos da pasta css/.
// ============================================================

// Elemento onde todas as telas são desenhadas
var app = document.getElementById('app');
// Ajudantes: pad() completa com zeros (7 → 007), esc() protege textos no HTML, barra() desenha a barra de progresso
function pad(n, l) { return ('0000' + n).slice(-(l || 3)); }
function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
function barra(p) { return '<div class="barra"><i style="width:' + p + '%"></i></div>'; }
// Botão de uma coleção (usado na tela da série): logo, nome, data, progresso
function botaoColecao(c) {
  var p = Math.round(qtdTenho(c.id) / c.total * 100);
  return '<button class="colecao" onclick="telaColecao(\'' + c.id + '\')"><img src="assets/img/colecoes/' + c.serie + '/' + c.id + '.webp" alt="" onerror="logoAlt(this)"><h3>' + esc(c.nome) + '</h3><span class="sub">Lançamento: ' + dataBR(c.lancamento) + '</span><span class="sub">' + qtdTenho(c.id) + ' de ' + c.total + ' cartas · ' + p + '%</span>' + barra(p) + '</button>';
}

// TELA 1 – Início: destaque, estatísticas e botões das SÉRIES.
// O parâmetro 'ir' rola a página até um bloco (ex.: 'series'). A busca filtra séries e coleções.
function telaInicio(ir) {
  var q = ((document.getElementById('busca') || {}).value || '').toLowerCase();
  var lista = ESTADO.series.filter(function (s) {
    return !q || s.nome.toLowerCase().indexOf(q) > -1 || s.colecoes.some(function (c) { return c.nome.toLowerCase().indexOf(q) > -1; });
  });
  var botoes = lista.map(function (s) {
    var r = resumoSerie(s);
    return '<button class="colecao serie-btn" onclick="telaSerie(\'' + s.id + '\')"><img src="assets/img/series/' + s.id + '.webp" alt="" onerror="this.remove()"><h3>' + esc(s.nome) + '</h3><span class="sub">' + s.colecoes.length + ' coleções</span><span class="sub">' + r.tenho + ' de ' + r.total + ' cartas · ' + r.pct + '%</span>' + barra(r.pct) + '</button>';
  }).join('');
  app.innerHTML = '<section class="hero"><div><small>SEU ESPAÇO DE COLECIONADOR</small><h1>Seu álbum.<span>Suas conquistas.</span></h1><p>Explore as séries e marque as cartas Pokémon que você já tem.</p><button class="btn" onclick="telaInicio(\'series\')">Explorar séries →</button></div><img src="assets/img/carddex-logo.png" alt=""></section>' +
    '<div class="stats" id="stats"><div class="stat"><div>Séries disponíveis</div><b>' + pad(ESTADO.series.length, 2) + '</b></div><div class="stat"><div>Coleções disponíveis</div><b>' + pad(todasColecoes().length, 2) + '</b></div><div class="stat"><div>Cartas que você tem</div><b>' + totalTenho() + '</b></div></div>' +
    '<h2 id="series">Séries</h2><div class="colecoes">' + (botoes || '<p>Nenhuma série ou coleção encontrada.</p>') + '</div>';
  var alvo = ir && document.getElementById(ir);
  if (alvo) alvo.scrollIntoView({ behavior: 'smooth' }); else window.scrollTo(0, 0);
}

// TELA 2 – Série: lista as coleções da série, da mais antiga para a mais nova
function telaSerie(id) {
  var s = acharSerie(id);
  app.innerHTML = '<h2><button class="voltar" onclick="telaInicio(\'series\')">← Séries</button></h2><h2 style="margin-top:0">' + esc(s.nome) + '</h2><span class="sub">Coleções em ordem de lançamento</span><div class="colecoes">' + s.colecoes.map(botaoColecao).join('') + '</div>';
  window.scrollTo(0, 0);
}

// TELA 3 – Coleção: carrega as cartas (dados.js) e chama desenharColecao()
async function telaColecao(id) {
  var c = acharColecao(id); ESTADO.atual = c;
  var volta = '<h2><button class="voltar" onclick="telaSerie(\'' + c.serie + '\')">← ' + esc(acharSerie(c.serie).nome) + '</button></h2>';
  app.innerHTML = volta + '<p class="sub">Carregando cartas...</p>';
  try { await carregarCartas(c); desenharColecao(); }
  catch (e) { app.innerHTML = volta + '<div class="aviso">Não foi possível carregar as cartas desta coleção. Rode o script <b>scripts/baixar_cartas.py</b> ou verifique sua internet.</div>'; }
}

// Desenha a grade de cartas da coleção atual, respeitando o filtro (Todas / Tenho / Faltam).
// Cada carta tem 2 botões: .abrir (abre a carta grande) e .check (marca que tem).
function desenharColecao() {
  var c = ESTADO.atual, s = acharSerie(c.serie), lista = ESTADO.cartas[c.id], meu = ESTADO.tenho[c.id] || [];
  var html = lista.filter(function (k) {
    var y = meu.indexOf(k.id) > -1;
    return ESTADO.filtro === 'todas' || (ESTADO.filtro === 'tenho' ? y : !y);
  }).map(function (k) {
    var y = meu.indexOf(k.id) > -1, src = k.mini || k.imagem;
    return '<div class="carta' + (y ? ' tenho' : '') + '">' +
      '<button class="abrir" onclick="abrirCarta(\'' + c.id + '\',\'' + k.id + '\')" title="Ver ' + esc(k.nome) + '">' +
      (src ? '<img loading="lazy" src="' + esc(src) + '" alt="' + esc(k.nome) + '">' : '<span>' + esc(k.numero) + '</span>') + '</button>' +
      '<button class="check" onclick="marcarRapido(this,\'' + c.id + '\',\'' + k.id + '\')" aria-label="Marcar ' + esc(k.nome) + ' como tenho" title="Marcar como tenho">' + (y ? '✓' : '') + '</button></div>';
  }).join('');
  var p = Math.round(meu.length / lista.length * 100);
  app.innerHTML = '<h2><button class="voltar" onclick="telaSerie(\'' + s.id + '\')">← ' + esc(s.nome) + '</button></h2><h2 style="margin-top:0">' + esc(c.nome) + '</h2><span class="sub" id="prog-txt"></span><div class="barra"><i id="prog-bar" style="width:' + p + '%"></i></div>' +
    (c.obs ? '<div class="aviso">' + esc(c.obs) + '</div>' : '') + '<div class="filtros">' + [['todas', 'Todas'], ['tenho', 'Tenho'], ['faltam', 'Faltam']].map(function (f) { return '<button class="' + (ESTADO.filtro === f[0] ? 'on' : '') + '" onclick="ESTADO.filtro=\'' + f[0] + '\';desenharColecao()">' + f[1] + '</button>'; }).join('') + '</div><div class="grade">' + html + '</div>';
  atualizarProgresso();
}

// Atualiza o texto e a barra de progresso sem redesenhar a página
function atualizarProgresso() {
  var c = ESTADO.atual, n = qtdTenho(c.id), t = ESTADO.cartas[c.id].length, p = Math.round(n / t * 100);
  document.getElementById('prog-txt').textContent = n + ' de ' + t + ' cartas · ' + p + '%';
  document.getElementById('prog-bar').style.width = p + '%';
}

// Marca/desmarca direto na grade, sem abrir a carta grande
function marcarRapido(el, colId, cartaId) {
  var l = ESTADO.tenho[colId] || [], i = l.indexOf(cartaId);
  if (i > -1) l.splice(i, 1); else l.push(cartaId);
  ESTADO.tenho[colId] = l; salvarTenho();
  var y = i < 0, caixa = el.parentNode;
  if (ESTADO.filtro !== 'todas') caixa.remove();
  else { caixa.classList.toggle('tenho', y); el.textContent = y ? '✓' : ''; }
  atualizarProgresso();
}

// Se o logo .webp da coleção não existir, tenta o .svg; se também não existir, esconde a imagem
function logoAlt(img) {
  if (!img.dataset.tentou) { img.dataset.tentou = 1; img.src = img.src.replace('.webp', '.svg'); }
  else img.remove();
}
