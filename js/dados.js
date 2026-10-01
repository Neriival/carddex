// js/dados.js
// Dados e estado do CardDex
// ============================================================
// DADOS E ESTADO
// Aqui ficam: a lista de séries/coleções, as cartas carregadas e as
// cartas que você marcou (salvas no navegador, em localStorage).
// ============================================================

// Endereço da API usada quando as cartas ainda não foram baixadas pelo script
var API_TCGDEX = 'https://api.tcgdex.net/v2';
var ESTADO = { series: [], cartas: {}, tenho: {}, filtro: 'todas', atual: null, tid: {} };
try { ESTADO.tenho = JSON.parse(localStorage.getItem('carddex_tenho') || '{}'); } catch (e) {}
// Salva/lê as cartas marcadas. ESTADO.tenho = { 'me04': ['me04-001', ...], ... }
function salvarTenho() { try { localStorage.setItem('carddex_tenho', JSON.stringify(ESTADO.tenho)); } catch (e) {} }
function qtdTenho(id) { return (ESTADO.tenho[id] || []).length; }
function totalTenho() { return Object.keys(ESTADO.tenho).reduce(function (a, k) { return a + ESTADO.tenho[k].length; }, 0); }
function todasColecoes() { return ESTADO.series.reduce(function (a, s) { return a.concat(s.colecoes); }, []); }
function acharColecao(id) { return todasColecoes().filter(function (c) { return c.id === id; })[0]; }
function acharSerie(id) { return ESTADO.series.filter(function (s) { return s.id === id; })[0]; }
// Ajudantes: converte '2026-05-22' em '22/05/2026' e soma o progresso de uma série inteira
function dataBR(d) { var p = d.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
function resumoSerie(s) {
  var t = 0, m = 0;
  s.colecoes.forEach(function (c) { t += c.total; m += qtdTenho(c.id); });
  return { total: t, tenho: m, pct: t ? Math.round(m / t * 100) : 0 };
}

// Lê dados/series.json e deixa as coleções em ordem de lançamento
async function carregarSeries() {
  var r = await fetch('dados/series.json');
  ESTADO.series = (await r.json()).series;
  // coleções em ordem de lançamento (da mais antiga para a mais nova)
  ESTADO.series.forEach(function (s) {
    s.colecoes.forEach(function (c) { c.serie = s.id; });
    s.colecoes.sort(function (a, b) { return a.lancamento < b.lancamento ? -1 : 1; });
  });
}

// Descobre o id da coleção na TCGdex (pelo nome em inglês, ou pelo id informado)
async function idTcgdex(c) {
  if (ESTADO.tid[c.id]) return ESTADO.tid[c.id];
  var id = c.tcgdex || c.id;
  if (c.busca) {
    try {
      var s = await (await fetch(API_TCGDEX + '/en/series/' + c.serie)).json();
      var f = (s.sets || []).filter(function (x) { return x.name.toLowerCase() === c.busca.toLowerCase(); })[0];
      if (f) id = f.id;
    } catch (e) {}
  }
  ESTADO.tid[c.id] = id;
  return id;
}

// 1) usa dados/cartas/<serie>/<colecao>.json (gerado pelo script, com imagens locais)
// 2) se não existir, busca online na TCGdex (português; inglês se faltar)
async function carregarCartas(c) {
  if (ESTADO.cartas[c.id]) return ESTADO.cartas[c.id];
  var lista = null;
  try { var r = await fetch('dados/cartas/' + c.serie + '/' + c.id + '.json'); if (r.ok) lista = await r.json(); } catch (e) {}
  if (!lista) {
    var tid = await idTcgdex(c), s = null;
    try { var r1 = await fetch(API_TCGDEX + '/pt/sets/' + tid); if (r1.ok) s = await r1.json(); } catch (e) {}
    if (!s || !(s.cards || []).length) s = await (await fetch(API_TCGDEX + '/en/sets/' + tid)).json();
    lista = (s.cards || []).map(function (x) {
      var base = x.image || 'https://assets.tcgdex.net/en/' + c.serie + '/' + tid + '/' + x.localId;
      return { id: x.id, numero: x.localId, nome: x.name, mini: base + '/low.webp', imagem: base + '/high.webp', remoto: true, tid: tid };
    });
  }
  ESTADO.cartas[c.id] = lista;
  return lista;
}

// Busca raridade, tipo, PS e ilustrador (só no modo online; no modo local já vêm no .json)
async function detalhesCarta(k) {
  if (!k.remoto || k.detalhes) return k;
  try {
    var d = await (await fetch(API_TCGDEX + '/pt/cards/' + k.id)).json();
    if (!d || !d.name) d = await (await fetch(API_TCGDEX + '/en/cards/' + k.id)).json();
    k.raridade = d.rarity; k.tipos = d.types; k.ps = d.hp; k.categoria = d.category; k.ilustrador = d.illustrator; k.detalhes = true;
  } catch (e) {}
  return k;
}
