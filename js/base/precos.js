// js/base/precos.js
// PREÇOS DAS CARTAS EM REAIS
// ============================================================
// Referência principal: Liga Pokémon (mercado brasileiro), preço médio em real.
//   dados/precos-liga/<serie>.json – gerado por scripts/atualizar_precos_liga.py (.github/workflows/precos-liga.yml)
// Reserva: Cardmarket (loja europeia), em euro convertido para real, só para as coleções que ainda
// não têm preço da Liga (uma coleção usa uma fonte só, para os números não se misturarem).
//   dados/precos/<serie>.json – gerado por scripts/atualizar_precos.py (.github/workflows/precos.yml)
// ============================================================

var PRECOS = {};          // série → { liga: {...} ou null, cm: {...} ou null }
var precosPedidos = {};   // série → leitura em andamento (para não baixar o mesmo arquivo duas vezes)

function lerJson(url) {
  return fetch(url).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
}

// Lê os arquivos de preços da série (uma vez por dia; sem arquivo, a série fica sem preços)
function carregarPrecos(serie) {
  if (!precosPedidos[serie]) {
    var dia = new Date().toISOString().slice(0, 10);
    precosPedidos[serie] = Promise.all([lerJson('dados/precos-liga/' + serie + '.json?d=' + dia), lerJson('dados/precos/' + serie + '.json?d=' + dia)])
      .then(function (r) { PRECOS[serie] = { liga: r[0], cm: r[1] }; return PRECOS[serie]; });
  }
  return precosPedidos[serie];
}

// A coleção já tem preço da Liga?
function usaLiga(serie, col) { var d = PRECOS[serie]; return !!(d && d.liga && d.liga.colecoes[col]); }

// Preço da carta k (id) da coleção c ({ id, serie }) ou null se não tiver:
//   Liga:       { fonte: 'liga', real: médio, menor, maior }
//   Cardmarket: { fonte: 'cm', real, reverse }
function precoCarta(c, k) {
  var d = PRECOS[c.serie], p;
  if (!d) return null;
  if (usaLiga(c.serie, c.id)) {
    p = d.liga.precos[k];
    return p ? { fonte: 'liga', real: p[1], menor: p[0], maior: p[2] } : null;
  }
  p = d.cm && d.cm.precos[k];
  return p ? { fonte: 'cm', real: p[0] * d.cm.eur_brl, reverse: (p[1] || 0) * d.cm.eur_brl } : null;
}

// Valor de referência da carta em reais (Liga: o médio; Cardmarket: o normal ou, se só tiver, o reverse holo). 0 = sem preço.
// Usado na grade, na ordenação e no valor da coleção, para todos mostrarem o mesmo número.
function valorCarta(c, k) { var p = precoCarta(c, k); return p ? p.real || p.reverse || 0 : 0; }

// 1234.5 → "R$ 1.234,50"
function reais(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

// Valor de uma coleção: o que a pessoa tem (contando as repetidas) e a coleção completa
function valorColecao(c) {
  var meu = 0, completa = 0, tem = false;
  (ESTADO.cartas[c.id] || []).forEach(function (k) {
    var v = valorCarta(c, k.id);
    if (!v) return;
    tem = true; completa += v;
    if (temCarta(c.id, k.id)) meu += v * (1 + qtdRepetida(c.id, k.id));
  });
  return tem ? { meu: meu, completa: completa } : null;
}

// Texto curto da fonte, para ir entre parênteses: "preço médio da Liga Pokémon" ou "referência Cardmarket"
function fontePreco(serie, col) { return usaLiga(serie, col) ? 'preço médio da Liga Pokémon' : 'referência Cardmarket'; }

// O mesmo para várias coleções [{ serie, id }] (tela "Minhas cartas")
function fontePrecos(cols) {
  var f = {};
  cols.forEach(function (c) { f[fontePreco(c.serie, c.id)] = 1; });
  f = Object.keys(f);
  return f.length === 1 ? f[0] : 'preço médio da Liga Pokémon; Cardmarket nas coleções ainda sem preço da Liga';
}

// Rodapé que explica de onde vem o preço (carta grande)
function notaPreco(serie, col) {
  var d = PRECOS[serie];
  if (usaLiga(serie, col)) return 'Preços da Liga Pokémon (mercado brasileiro), atualizados em ' + dataBR(d.liga.colecoes[col]) + '.';
  return d && d.cm ? 'Referência do Cardmarket convertida (€ 1 = ' + reais(d.cm.eur_brl) + '), atualizada em ' + dataBR(d.cm.atualizado) + '.' : '';
}
