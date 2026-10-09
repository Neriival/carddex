// js/telas/colecao.js
// TELA DA COLEÇÃO: a grade de cartas, filtros, marcar "tenho" e as repetidas
// ============================================================
// Filtros: Todas / Tenho / Faltam / Repetidas + Raridade e Tipo (só aparecem se houver 2 opções ou mais)
// e Ordenar (número, mais caras, mais baratas).
// Cada carta da grade: clique na imagem abre a carta grande (js/recursos/carta-grande.js),
// o círculo marca "tenho", a barra − N + conta as repetidas e embaixo fica o preço (js/base/precos.js).
// ============================================================

// TELA – Coleção: carrega as cartas e desenha
async function telaColecao(id) {
  var c = acharColecao(id); ESTADO.atual = c; ESTADO.raridade = ''; ESTADO.tipo = ''; ESTADO.ordem = 'numero';
  ESTADO.redesenhar = desenharColecao; marcarMenu(1);
  var volta = '<h2><button class="voltar" onclick="telaSerie(\'' + c.serie + '\')">← ' + esc(acharSerie(c.serie).nome) + '</button></h2>';
  app.innerHTML = volta + '<p class="sub">Carregando cartas...</p>';
  try { await Promise.all([carregarCartas(c), carregarPrecos(c.serie)]); desenharColecao(); }
  catch (e) { app.innerHTML = volta + '<div class="aviso">Não foi possível carregar as cartas desta coleção. Rode o script <b>scripts/baixar_cartas.py</b> ou verifique sua internet.</div>'; }
}

// Cartas que passam nos filtros de raridade e tipo (sem olhar Tenho/Faltam)
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

// ORDENAR: por número (padrão), mais caras primeiro ou mais baratas primeiro.
// Cartas sem preço vão sempre para o fim. Só aparece se a coleção tiver preços.
function valorDaCarta(c, k) { return valorCarta(c, k.id); }
function ordenarCartas(c, l) {
  if (ESTADO.ordem === 'numero') return l;
  var sinal = ESTADO.ordem === 'caras' ? -1 : 1;
  return l.slice().sort(function (a, b) {
    var va = valorDaCarta(c, a), vb = valorDaCarta(c, b);
    if (!va || !vb) return (vb ? 1 : 0) - (va ? 1 : 0); // sem preço no fim
    return sinal * (va - vb);
  });
}
function seletorOrdem(c) {
  if (!ESTADO.cartas[c.id].some(function (k) { return valorDaCarta(c, k); })) return '';
  return '<label class="seletor"><span>Ordenar</span><select onchange="ESTADO.ordem=this.value;desenharColecao()">' +
    [['numero', 'Número'], ['caras', 'Mais caras primeiro'], ['baratas', 'Mais baratas primeiro']].map(function (o) {
      return '<option value="' + o[0] + '"' + (ESTADO.ordem === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('') + '</select></label>';
}

// Uma carta na grade com o número e o preço embaixo (também usada em Minhas cartas). y = tem a carta.
function cartaGrade(c, k, y) {
  var src = k.mini || k.imagem, v = valorCarta(c, k.id);
  return '<div class="carta-item"><div class="carta' + (y ? ' tenho' : '') + '">' + (y ? repGradeHtml(c.id, k.id) : '') +
    '<button class="abrir" onclick="abrirCarta(\'' + c.id + '\',\'' + k.id + '\')" title="Ver ' + esc(k.nome) + '">' +
    (src ? '<img loading="lazy" src="' + esc(src) + '" alt="' + esc(k.nome) + '">' : '<span>' + esc(k.numero) + '</span>') + '</button>' +
    '<button class="check" onclick="marcarRapido(this,\'' + c.id + '\',\'' + k.id + '\')" aria-label="Marcar ' + esc(k.nome) + ' como tenho" title="Marcar como tenho">' + (y ? '✓' : '') + '</button></div>' +
    numGrade(c, k) + precoGrade(v) + '</div>';
}
// Número impresso embaixo da carta (211/193)
function numGrade(c, k) { return '<span class="num-carta">' + esc(numeroCarta(c, k).numero) + '</span>'; }
// Preço embaixo da carta ("–" quando não tem)
function precoGrade(v) { return '<span class="preco' + (v ? '' : ' sem') + '">' + (v ? reais(v) : '–') + '</span>'; }

// Desenha a grade da coleção atual, respeitando todos os filtros
function desenharColecao() {
  var c = ESTADO.atual, s = acharSerie(c.serie), lista = ESTADO.cartas[c.id];
  var html = ordenarCartas(c, cartasFiltradas(c).filter(function (k) {
    var y = temCarta(c.id, k.id);
    if (ESTADO.filtro === 'repetidas') return y && qtdRepetida(c.id, k.id) > 0;
    return ESTADO.filtro === 'todas' || (ESTADO.filtro === 'tenho' ? y : !y);
  })).map(function (k) { return cartaGrade(c, k, temCarta(c.id, k.id)); }).join('');
  var rar = unicos(lista.map(function (k) { return k.raridade; }));
  var tip = unicos([].concat.apply([], lista.map(function (k) { return (k.tipos || []).length ? k.tipos : [k.categoria]; })));
  var filtros = [['todas', 'Todas'], ['tenho', 'Tenho'], ['faltam', 'Faltam'], ['repetidas', 'Repetidas']].map(function (f) {
    return '<button class="' + (ESTADO.filtro === f[0] ? 'on' : '') + '" onclick="ESTADO.filtro=\'' + f[0] + '\';desenharColecao()">' + f[1] + '</button>';
  }).join('');
  app.innerHTML = '<h2><button class="voltar" onclick="telaSerie(\'' + s.id + '\')">← ' + esc(s.nome) + '</button></h2><h2 class="titulo">' + esc(c.nome) + '</h2>' +
    '<span class="sub" id="prog-txt"></span><div class="barra grossa"><i id="prog-bar"></i></div><p class="valor-colecao" id="valor-txt"></p>' +
    (c.obs ? '<div class="aviso">' + esc(c.obs) + '</div>' : '') +
    '<div class="filtros">' + filtros + '</div>' +
    '<div class="filtros-extra">' + seletor('Raridade', 'raridade', rar) + seletor('Tipo', 'tipo', tip) + seletorOrdem(c) + '</div>' +
    '<div class="compartilhar-acoes"><button class="btn btn-sec btn-compartilhar" onclick="abrirCompartilhar()">Compartilhar cartas que faltam</button>' +
    '<button class="btn btn-sec btn-compartilhar" onclick="abrirCompartilhar(\'repetidas\')">Compartilhar repetidas</button></div>' +
    (html ? '<div class="grade">' + html + '</div>' : '<p class="sub">Nenhuma carta com esses filtros.</p>');
  atualizarProgresso();
}

// Atualiza o progresso e o valor da coleção sem redesenhar a página
function atualizarProgresso() {
  var txt = document.getElementById('prog-txt');
  if (!txt) return;
  var c = ESTADO.atual, n = qtdTenho(c.id), t = ESTADO.cartas[c.id].length, p = pct(n, t), v = valorColecao(c);
  txt.textContent = n + ' de ' + t + ' cartas · ' + p + '%';
  document.getElementById('prog-bar').style.width = p + '%';
  document.getElementById('valor-txt').innerHTML = v ? 'Suas cartas valem <b>' + reais(v.meu) + '</b>' + (Object.keys(ESTADO.repetidas[c.id] || {}).length ? ' (com as repetidas)' : '') +
    ' · coleção completa: ' + reais(v.completa) + ' <small>(' + fontePreco(c.serie, c.id) + ')</small>' : '';
}

// Círculo da carta: marca/desmarca direto na grade, sem abrir a carta grande
function marcarRapido(el, col, k) {
  var y = alternarMarcacao(col, k), caixa = el.parentNode, ctrl = caixa.querySelector('.rep-mini');
  // com filtro (Tenho, Faltam, Repetidas), a carta sai da lista
  if (ESTADO.redesenhar === desenharColecao && ESTADO.filtro !== 'todas') caixa.parentNode.remove();
  else {
    caixa.classList.toggle('tenho', y); el.textContent = y ? '✓' : '';
    if (ctrl) ctrl.remove();
    if (y) caixa.insertAdjacentHTML('afterbegin', repGradeHtml(col, k));
  }
  atualizarProgresso();
}

// REPETIDAS NA GRADE: barra − N + na parte de baixo da carta (só para carta que tem)
function repGradeHtml(col, k) {
  var n = qtdRepetida(col, k);
  return '<div class="rep-mini' + (n ? '' : ' zero') + '" title="Repetidas (cópias a mais)">' +
    '<button type="button" onclick="repGrade(this,\'' + col + '\',\'' + k + '\',-1)" aria-label="Uma repetida a menos"' + (n ? '' : ' disabled') + '>−</button>' +
    '<b aria-live="polite">' + (n ? n + ' rep.' : 'rep.') + '</b>' +
    '<button type="button" onclick="repGrade(this,\'' + col + '\',\'' + k + '\',1)" aria-label="Uma repetida a mais">+</button></div>';
}
function repGrade(btn, col, k, d) {
  var n = somarRepetida(col, k, d), box = btn.parentNode;
  box.querySelector('b').textContent = n ? n + ' rep.' : 'rep.';
  box.querySelector('button').disabled = !n;
  box.classList.toggle('zero', !n);
  // o valor da coleção conta as repetidas: atualiza na tela da coleção e em Minhas cartas
  if (ESTADO.redesenhar === desenharMinhas) { var y = window.scrollY; desenharMinhas(); window.scrollTo(0, y); }
  else atualizarProgresso();
}
