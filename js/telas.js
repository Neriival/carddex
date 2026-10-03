// js/telas.js
// Telas: início (jogos) → jogo (séries) → série (coleções) → coleção (cartas), e Minhas cartas
// ============================================================
// TELAS DO SITE
// Fluxo: Início (jogos: Pokémon, Yu-Gi-Oh!...) → Jogo (séries) → Série (coleções) → Coleção (cartas)
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
function pct(n, t) { return t ? Math.round(n / t * 100) : 0; }
// Deixa sublinhado o link do menu da tela atual (0 Início, 1 Séries, 2 Minhas cartas, 3 Ranking, 4 Admin; -1 nenhum)
function marcarMenu(n) {
  [].forEach.call(document.querySelectorAll('.links a'), function (a, i) { a.classList.toggle('on', i === n); });
}
// Botão de uma coleção (usado na tela da série): logo, nome, data, progresso
function botaoColecao(c) {
  var p = pct(qtdTenho(c.id), c.total);
  return '<button class="colecao" onclick="telaColecao(\'' + c.id + '\')"><img src="assets/img/colecoes/' + c.serie + '/' + c.id + '.webp" alt="" onerror="logoAlt(this)"><h3>' + esc(c.nome) + '</h3><span class="sub">Lançamento: ' + dataBR(c.lancamento) + '</span><span class="sub">' + qtdTenho(c.id) + ' de ' + c.total + ' cartas · ' + p + '%</span>' + barra(p) + '</button>';
}
// Botão de uma série (usado na tela do jogo e na busca)
function botaoSerie(s) {
  var r = resumoSerie(s);
  return '<button class="colecao serie-btn" onclick="telaSerie(\'' + s.id + '\')"><img src="assets/img/series/' + s.id + '.webp" alt="" onerror="this.remove()"><h3>' + esc(s.nome) + '</h3><span class="sub">' + s.colecoes.length + ' coleções</span><span class="sub">' + r.tenho + ' de ' + r.total + ' cartas · ' + r.pct + '%</span>' + barra(r.pct) + '</button>';
}
// Botão de um jogo (Pokémon, Yu-Gi-Oh!...). Ícones em assets/img/jogos/<id>.svg
function botaoJogo(j) {
  var series = seriesDoJogo(j.id);
  return '<button class="colecao jogo-btn' + (series.length ? '' : ' em-breve') + '" onclick="telaJogo(\'' + j.id + '\')"><img src="assets/img/jogos/' + j.id + '.svg" alt="" onerror="this.remove()"><h3>' + esc(j.nome) + '</h3><span class="sub">' +
    (series.length ? series.length + ' séries' : 'Em breve') + '</span></button>';
}

// TELA 1 – Início: destaque, estatísticas e botões dos JOGOS.
// O parâmetro 'ir' rola a página até um bloco (ex.: 'series'). Com algo na busca, mostra séries e coleções encontradas.
function telaInicio(ir) {
  ESTADO.redesenhar = null; marcarMenu(ir === 'series' ? 1 : 0);
  var q = ((document.getElementById('busca') || {}).value || '').trim().toLowerCase(), blocos;
  if (q) {
    var achou = function (t) { return t.toLowerCase().indexOf(q) > -1; };
    var ss = ESTADO.series.filter(function (s) { return achou(s.nome); });
    var cs = todasColecoes().filter(function (c) { return achou(c.nome); });
    blocos = '<h2 id="series">Resultados da busca</h2>' + (ss.length || cs.length ? '<div class="colecoes">' + ss.map(botaoSerie).join('') + cs.map(botaoColecao).join('') + '</div>' : '<p class="sub">Nenhuma série ou coleção encontrada.</p>');
  } else blocos = '<h2 id="series">Séries</h2><span class="sub">Escolha o jogo de cartas</span><div class="colecoes jogos">' + ESTADO.jogos.map(botaoJogo).join('') + '</div>';
  app.innerHTML = '<section class="hero"><div><small>SEU ESPAÇO DE COLECIONADOR</small><h1>Seu álbum.<span>Suas conquistas.</span></h1><p>Explore as séries e marque as cartas que você já tem.</p><button class="btn" onclick="telaInicio(\'series\')">Explorar séries →</button></div><img src="assets/img/carddex-logo.png" alt=""></section>' +
    '<div class="stats" id="stats"><div class="stat"><div>Séries disponíveis</div><b>' + pad(ESTADO.series.length, 2) + '</b></div><div class="stat"><div>Coleções disponíveis</div><b>' + pad(todasColecoes().length, 2) + '</b></div><div class="stat"><div>Cartas que você tem</div><b>' + totalTenho() + '</b></div></div>' + blocos;
  var alvo = ir && document.getElementById(ir);
  if (alvo) alvo.scrollIntoView({ behavior: 'smooth' }); else if (!q) window.scrollTo(0, 0);
}

// TELA 2 – Jogo: séries do jogo, da mais nova para a mais antiga (ou "Em breve")
function telaJogo(id) {
  var j = acharJogo(id), series = seriesDoJogo(id);
  ESTADO.redesenhar = null; marcarMenu(1);
  app.innerHTML = '<h2><button class="voltar" onclick="telaInicio(\'series\')">← Séries</button></h2><div class="titulo-jogo"><img src="assets/img/jogos/' + j.id + '.svg" alt="" onerror="this.remove()"><h2>' + esc(j.nome) + '</h2></div>' +
    (series.length ? '<span class="sub">Séries da mais nova para a mais antiga</span><div class="colecoes">' + series.map(botaoSerie).join('') + '</div>'
      : '<div class="aviso">As cartas de ' + esc(j.nome) + ' ainda vão chegar ao CardDex. Fique de olho!</div>');
  window.scrollTo(0, 0);
}

// TELA 3 – Série: lista as coleções da série, da mais nova para a mais antiga
function telaSerie(id) {
  var s = acharSerie(id), j = acharJogo(s.jogo) || ESTADO.jogos[0];
  ESTADO.redesenhar = null; marcarMenu(1);
  app.innerHTML = '<h2><button class="voltar" onclick="telaJogo(\'' + j.id + '\')">← ' + esc(j.nome) + '</button></h2><h2 style="margin-top:0">' + esc(s.nome) + '</h2><span class="sub">Coleções da mais nova para a mais antiga</span><div class="colecoes">' + s.colecoes.map(botaoColecao).join('') + '</div>';
  window.scrollTo(0, 0);
}

// TELA 4 – Coleção: carrega as cartas (dados.js) e chama desenharColecao()
async function telaColecao(id) {
  var c = acharColecao(id); ESTADO.atual = c; ESTADO.raridade = ''; ESTADO.tipo = '';
  ESTADO.redesenhar = desenharColecao; marcarMenu(1);
  var volta = '<h2><button class="voltar" onclick="telaSerie(\'' + c.serie + '\')">← ' + esc(acharSerie(c.serie).nome) + '</button></h2>';
  app.innerHTML = volta + '<p class="sub">Carregando cartas...</p>';
  try { await carregarCartas(c); desenharColecao(); }
  catch (e) { app.innerHTML = volta + '<div class="aviso">Não foi possível carregar as cartas desta coleção. Rode o script <b>scripts/baixar_cartas.py</b> ou verifique sua internet.</div>'; }
}

// Cartas da coleção que passam nos filtros de raridade e tipo (sem olhar Tenho/Faltam)
function cartasFiltradas(c) {
  return ESTADO.cartas[c.id].filter(function (k) {
    return (!ESTADO.raridade || k.raridade === ESTADO.raridade) && (!ESTADO.tipo || (k.tipos || []).indexOf(ESTADO.tipo) > -1 || k.categoria === ESTADO.tipo);
  });
}
// Texto dos filtros ativos (ex.: "Ilustração Rara · Fogo"), usado também na imagem do WhatsApp
function rotuloFiltros() { return [ESTADO.raridade, ESTADO.tipo].filter(Boolean).join(' · '); }
// Caixa de seleção de um filtro; só aparece se a coleção tiver pelo menos 2 opções
function seletor(rotulo, campo, opcoes) {
  if (opcoes.length < 2) return '';
  return '<label class="seletor"><span>' + rotulo + '</span><select onchange="ESTADO.' + campo + '=this.value;desenharColecao()"><option value="">Todas</option>' +
    opcoes.map(function (o) { return '<option' + (ESTADO[campo] === o ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></label>';
}
function unicos(l) { return l.filter(function (x, i) { return x && l.indexOf(x) === i; }).sort(function (a, b) { return a.localeCompare(b, 'pt'); }); }

// Uma carta na grade: .abrir (abre a carta grande), .check (marca que tem) e, se tem, o contador de repetidas embaixo
function cartaGrade(c, k, y) {
  var src = k.mini || k.imagem;
  return '<div class="carta' + (y ? ' tenho' : '') + '">' + (y ? repGradeHtml(c.id, k.id) : '') +
    '<button class="abrir" onclick="abrirCarta(\'' + c.id + '\',\'' + k.id + '\')" title="Ver ' + esc(k.nome) + '">' +
    (src ? '<img loading="lazy" src="' + esc(src) + '" alt="' + esc(k.nome) + '">' : '<span>' + esc(k.numero) + '</span>') + '</button>' +
    '<button class="check" onclick="marcarRapido(this,\'' + c.id + '\',\'' + k.id + '\')" aria-label="Marcar ' + esc(k.nome) + ' como tenho" title="Marcar como tenho">' + (y ? '✓' : '') + '</button></div>';
}

// Desenha a grade de cartas da coleção atual, respeitando os filtros (Todas / Tenho / Faltam / Repetidas, raridade e tipo).
function desenharColecao() {
  var c = ESTADO.atual, s = acharSerie(c.serie), lista = ESTADO.cartas[c.id], meu = ESTADO.tenho[c.id] || [];
  var html = cartasFiltradas(c).filter(function (k) {
    var y = meu.indexOf(k.id) > -1;
    if (ESTADO.filtro === 'repetidas') return y && qtdRepetida(c.id, k.id) > 0;
    return ESTADO.filtro === 'todas' || (ESTADO.filtro === 'tenho' ? y : !y);
  }).map(function (k) { return cartaGrade(c, k, meu.indexOf(k.id) > -1); }).join('');
  var rar = unicos(lista.map(function (k) { return k.raridade; }));
  var tip = unicos([].concat.apply([], lista.map(function (k) { return (k.tipos || []).length ? k.tipos : [k.categoria]; })));
  app.innerHTML = '<h2><button class="voltar" onclick="telaSerie(\'' + s.id + '\')">← ' + esc(s.nome) + '</button></h2><h2 style="margin-top:0">' + esc(c.nome) + '</h2><span class="sub" id="prog-txt"></span><div class="barra"><i id="prog-bar" style="width:' + pct(meu.length, lista.length) + '%"></i></div>' +
    (c.obs ? '<div class="aviso">' + esc(c.obs) + '</div>' : '') + '<div class="filtros">' + [['todas', 'Todas'], ['tenho', 'Tenho'], ['faltam', 'Faltam'], ['repetidas', 'Repetidas']].map(function (f) { return '<button class="' + (ESTADO.filtro === f[0] ? 'on' : '') + '" onclick="ESTADO.filtro=\'' + f[0] + '\';desenharColecao()">' + f[1] + '</button>'; }).join('') + '</div>' +
    '<div class="filtros-extra">' + seletor('Raridade', 'raridade', rar) + seletor('Tipo', 'tipo', tip) + '</div>' +
    '<div class="compartilhar-acoes"><button class="btn btn-sec btn-compartilhar" onclick="abrirCompartilhar()">Compartilhar cartas que faltam</button>' +
    '<button class="btn btn-sec btn-compartilhar" onclick="abrirCompartilhar(\'repetidas\')">Compartilhar repetidas</button></div>' +
    (html ? '<div class="grade">' + html + '</div>' : '<p class="sub">Nenhuma carta com esses filtros.</p>');
  atualizarProgresso();
}

// Atualiza o texto e a barra de progresso sem redesenhar a página (só na tela da coleção)
function atualizarProgresso() {
  var txt = document.getElementById('prog-txt');
  if (!txt) return;
  var c = ESTADO.atual, n = qtdTenho(c.id), t = ESTADO.cartas[c.id].length, p = pct(n, t);
  txt.textContent = n + ' de ' + t + ' cartas · ' + p + '%';
  document.getElementById('prog-bar').style.width = p + '%';
}

// Marca/desmarca direto na grade, sem abrir a carta grande
function marcarRapido(el, colId, cartaId) {
  var l = ESTADO.tenho[colId] || [], i = l.indexOf(cartaId);
  if (i > -1) l.splice(i, 1); else l.push(cartaId);
  ESTADO.tenho[colId] = l; salvarTenho();
  if (i > -1) { conferirVitrine(colId, cartaId); if (qtdRepetida(colId, cartaId)) mudarRepetida(colId, cartaId, 0); }
  var y = i < 0, caixa = el.parentNode, ctrl = caixa.querySelector('.rep-mini');
  if (ESTADO.redesenhar === desenharColecao && ESTADO.filtro !== 'todas') caixa.remove();
  else {
    caixa.classList.toggle('tenho', y); el.textContent = y ? '✓' : '';
    if (ctrl) ctrl.remove();
    if (y) caixa.insertAdjacentHTML('afterbegin', repGradeHtml(colId, cartaId));
  }
  atualizarProgresso();
}

// REPETIDAS NA GRADE: − N + na parte de baixo da carta (só para carta que tem)
function repGradeHtml(col, k) {
  var n = qtdRepetida(col, k);
  return '<div class="rep-mini' + (n ? '' : ' zero') + '" title="Repetidas (cópias a mais)">' +
    '<button type="button" onclick="repGrade(this,\'' + col + '\',\'' + k + '\',-1)" aria-label="Uma repetida a menos"' + (n ? '' : ' disabled') + '>−</button>' +
    '<b aria-live="polite">' + (n ? n + ' rep.' : 'rep.') + '</b>' +
    '<button type="button" onclick="repGrade(this,\'' + col + '\',\'' + k + '\',1)" aria-label="Uma repetida a mais">+</button></div>';
}
function repGrade(btn, col, k, d) {
  var n = Math.max(0, Math.min(99, qtdRepetida(col, k) + d)), box = btn.parentNode;
  mudarRepetida(col, k, n);
  box.querySelector('b').textContent = n ? n + ' rep.' : 'rep.';
  box.querySelector('button').disabled = !n;
  box.classList.toggle('zero', !n);
}

// TELA – Minhas cartas: só as cartas marcadas, separadas por coleção, + backup (exportar/importar)
async function telaMinhas() {
  ESTADO.redesenhar = desenharMinhas; marcarMenu(2);
  app.innerHTML = '<h2>Minhas cartas</h2><p class="sub">Carregando...</p>';
  var cols = todasColecoes().filter(function (c) { return qtdTenho(c.id); });
  await Promise.all(cols.map(function (c) { return carregarCartas(c).catch(function () {}); }));
  if (ESTADO.redesenhar === desenharMinhas) desenharMinhas();
}
function desenharMinhas() {
  var blocos = ESTADO.series.map(function (s) {
    return s.colecoes.filter(function (c) { return qtdTenho(c.id) && ESTADO.cartas[c.id]; }).map(function (c) {
      var meu = ESTADO.tenho[c.id], l = ESTADO.cartas[c.id].filter(function (k) { return meu.indexOf(k.id) > -1; });
      return '<section class="minhas-col"><button class="voltar" onclick="telaColecao(\'' + c.id + '\')"><h3>' + esc(c.nome) + '</h3></button><span class="sub">' + esc(s.nome) + ' · ' + meu.length + ' de ' + ESTADO.cartas[c.id].length + ' cartas</span>' +
        '<div class="grade">' + l.map(function (k) { return cartaGrade(c, k, true); }).join('') + '</div></section>';
    }).join('');
  }).join('');
  app.innerHTML = '<h2>Minhas cartas</h2><span class="sub">' + totalTenho() + ' cartas marcadas. Clique no nome da coleção para ver todas as cartas dela.</span>' +
    '<div class="backup"><div><b>Backup da coleção</b><span class="sub">' + (logadoNaNuvem() ? 'Suas marcações estão salvas na sua conta e aparecem em qualquer aparelho em que você entrar. Se quiser, guarde também uma cópia em arquivo.' : 'Sem conta, as marcações ficam salvas só neste navegador. Crie uma conta para levar para qualquer aparelho, ou exporte um arquivo.') + '</span></div>' +
    '<div class="backup-acoes"><button class="btn" onclick="exportarColecao()">Exportar backup</button><button class="btn btn-sec" onclick="this.nextElementSibling.click()">Importar backup</button><input type="file" accept=".json,application/json" onchange="importarColecao(this)" hidden></div><p class="sub" id="backup-msg" role="status"></p></div>' +
    (blocos || '<div class="aviso">Você ainda não marcou nenhuma carta. Abra uma coleção e toque no círculo da carta para marcar.</div>');
}

// BACKUP: baixa um .json com todas as marcações
function exportarColecao() {
  var dados = { app: 'CardDex', versao: 2, exportado: new Date().toISOString(), tenho: ESTADO.tenho, repetidas: ESTADO.repetidas };
  var url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 1)], { type: 'application/json' }));
  var a = document.createElement('a'); a.href = url; a.download = 'carddex-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  document.getElementById('backup-msg').textContent = 'Backup exportado com ' + totalTenho() + ' cartas.';
}
// Lê um backup e JUNTA com as marcações atuais (nada que você já marcou é apagado)
function importarColecao(input) {
  var arq = input.files[0], msg = document.getElementById('backup-msg');
  if (!arq) return;
  var r = new FileReader();
  r.onload = function () {
    var d; try { d = JSON.parse(r.result); } catch (e) { d = null; }
    if (!d || d.app !== 'CardDex' || typeof d.tenho !== 'object') { msg.textContent = 'Este arquivo não é um backup do CardDex.'; return; }
    var novas = 0;
    Object.keys(d.tenho).forEach(function (col) {
      if (!Array.isArray(d.tenho[col])) return;
      var l = ESTADO.tenho[col] || (ESTADO.tenho[col] = []);
      d.tenho[col].forEach(function (id) { if (typeof id === 'string' && l.indexOf(id) < 0) { l.push(id); novas++; } });
    });
    // repetidas (backups novos): fica a maior quantidade de cada carta
    if (d.repetidas && typeof d.repetidas === 'object') Object.keys(d.repetidas).forEach(function (col) {
      Object.keys(d.repetidas[col] || {}).forEach(function (k) {
        var n = parseInt(d.repetidas[col][k], 10);
        if (n > 0 && (ESTADO.tenho[col] || []).indexOf(k) > -1 && n > qtdRepetida(col, k)) (ESTADO.repetidas[col] || (ESTADO.repetidas[col] = {}))[k] = Math.min(n, 99);
      });
    });
    try { localStorage.setItem('carddex_repetidas', JSON.stringify(ESTADO.repetidas)); } catch (e) {}
    salvarTenho();
    telaMinhas().then(function () {
      var m = document.getElementById('backup-msg');
      if (m) m.textContent = novas ? novas + ' cartas importadas.' : 'Nenhuma carta nova: tudo do backup já estava marcado.';
    });
  };
  r.readAsText(arq);
  input.value = '';
}

// Se o logo .webp da coleção não existir, tenta o .svg; se também não existir, esconde a imagem
function logoAlt(img) {
  if (!img.dataset.tentou) { img.dataset.tentou = 1; img.src = img.src.replace('.webp', '.svg'); }
  else img.remove();
}
