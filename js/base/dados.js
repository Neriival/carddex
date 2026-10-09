// js/base/dados.js
// DADOS DAS CARTAS E ESTADO DO SITE
// ============================================================
// - dados/series.json: jogos, séries e coleções (em ordem de lançamento)
// - dados/cartas/<serie>/<colecao>.json: as cartas (geradas por scripts/baixar_cartas.py)
// - se o .json da coleção não existir, as cartas vêm direto da TCGdex (internet)
// As cartas que a pessoa marcou ficam em js/base/marcacoes.js.
// ============================================================

// Endereço da API usada quando as cartas ainda não foram baixadas pelo script
var API_TCGDEX = 'https://api.tcgdex.net/v2';

// Estado do site (tudo que muda enquanto a pessoa navega)
var ESTADO = {
  jogos: [],        // Pokémon, Yu-Gi-Oh!, Dragon Ball... (cada série pertence a um jogo)
  series: [],       // séries com suas coleções (de dados/series.json)
  cartas: {},       // cartas já carregadas, por coleção: { 'me01': [ {id, numero, nome, imagem...}, ... ] }
  tenho: {},        // cartas marcadas (js/base/marcacoes.js)
  repetidas: {},    // cópias a mais de cada carta (js/base/marcacoes.js)
  filtro: 'todas',  // filtro da coleção: todas | tenho | faltam | repetidas
  raridade: '', tipo: '', // filtros extras da coleção
  ordem: 'numero',  // ordem da grade: numero | caras | baratas
  atual: null,      // coleção aberta
  tid: {},          // id de cada coleção na TCGdex (cache)
  redesenhar: null  // função da tela atual, chamada quando a carta grande fecha ou chegam dados novos
};

// Procurar coisas pelo id
function todasColecoes() { return ESTADO.series.reduce(function (a, s) { return a.concat(s.colecoes); }, []); }
function acharColecao(id) { return todasColecoes().filter(function (c) { return c.id === id; })[0]; }
function acharSerie(id) { return ESTADO.series.filter(function (s) { return s.id === id; })[0]; }
function acharJogo(id) { return ESTADO.jogos.filter(function (j) { return j.id === id; })[0]; }
function seriesDoJogo(id) { return ESTADO.series.filter(function (s) { return s.jogo === id; }); }

// Número como vem impresso na carta: { numero: '211/193', codigo: 'PAL PT' }
// - total depois da barra: "oficial" da coleção (series.json); promos e coleções clássicas não têm
// - número com letras (TG01, RC5, SV1): o total é das cartas com as mesmas letras (TG01/TG30, RC5/RC32)
// - HGSS, Preto e Branco, XY e Sol e Lua imprimem sem zeros à esquerda (1/146); da Espada e Escudo em diante, com (001/202)
var SERIES_SEM_ZEROS = ['sm', 'xy', 'bw', 'hgss'];
function numeroCarta(c, k) {
  var m = /^([A-Za-z]*)(\d+)$/.exec(k.numero), semZeros = SERIES_SEM_ZEROS.indexOf(c.serie) > -1;
  var codigo = c.sigla ? c.sigla + ' ' + (k.idioma || 'pt').toUpperCase() : '';
  if (!m || !c.oficial) return { numero: k.numero, codigo: codigo };
  var letras = m[1], dig = semZeros ? String(+m[2]) : m[2], total = c.oficial;
  if (letras) total = (ESTADO.cartas[c.id] || []).filter(function (x) { var y = /^([A-Za-z]*)\d+$/.exec(x.numero); return y && y[1] === letras; }).length || total;
  total = String(total);
  if (!semZeros) while (total.length < dig.length) total = '0' + total;
  return { numero: letras + dig + '/' + letras + total, codigo: codigo };
}

// Lê dados/series.json e deixa séries e coleções em ordem de lançamento (mais novas primeiro)
async function carregarSeries() {
  var r = await fetch('dados/series.json'), d = await r.json();
  ESTADO.series = d.series;
  ESTADO.jogos = d.jogos || [{ id: 'pokemon', nome: 'Pokémon' }];
  ESTADO.series.forEach(function (s) {
    s.colecoes.forEach(function (c) { c.serie = s.id; });
    // mesma data (ex.: coleção + galeria de treinador): mantém a ordem do series.json
    s.colecoes.sort(function (a, b) { return a.lancamento < b.lancamento ? 1 : a.lancamento > b.lancamento ? -1 : 0; });
    s.lancamento = s.colecoes.length ? s.colecoes[s.colecoes.length - 1].lancamento : '';
  });
  // séries: pela data da primeira coleção, a série mais nova primeiro
  ESTADO.series.sort(function (a, b) { return a.lancamento < b.lancamento ? 1 : -1; });
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

// Cartas de uma coleção:
// 1) dados/cartas/<serie>/<colecao>.json (gerado pelo script, com imagens no projeto)
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

// Raridade, tipo, PS e ilustrador (só no modo online; no modo local já vêm no .json)
async function detalhesCarta(k) {
  if (!k.remoto || k.detalhes) return k;
  try {
    var d = await (await fetch(API_TCGDEX + '/pt/cards/' + k.id)).json();
    if (!d || !d.name) d = await (await fetch(API_TCGDEX + '/en/cards/' + k.id)).json();
    k.raridade = d.rarity; k.tipos = d.types; k.ps = d.hp; k.categoria = d.category; k.ilustrador = d.illustrator; k.detalhes = true;
  } catch (e) {}
  return k;
}
