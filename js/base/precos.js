// js/base/precos.js
// PREÇOS DAS CARTAS EM REAIS
// ============================================================
// Referência: Cardmarket (maior loja de cartas da Europa), em euro, convertido para real.
// Os arquivos dados/precos/<serie>.json são gerados todo dia por scripts/atualizar_precos.py
// (roda sozinho no GitHub: .github/workflows/precos.yml).
// São valores de referência de uma loja estrangeira, não o preço do mercado brasileiro.
// ============================================================

var PRECOS = {};          // série → dados já lidos: { atualizado, eur_brl, fonte, precos: { 'me01-001': [euro, euroReverse] } }
var precosPedidos = {};   // série → leitura em andamento (para não baixar o mesmo arquivo duas vezes)

// Lê o arquivo de preços da série (uma vez por dia; sem arquivo, a série fica sem preços)
function carregarPrecos(serie) {
  if (!precosPedidos[serie]) {
    var dia = new Date().toISOString().slice(0, 10);
    precosPedidos[serie] = fetch('dados/precos/' + serie + '.json?d=' + dia)
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (d) { PRECOS[serie] = d; return d; });
  }
  return precosPedidos[serie];
}

// Preço de uma carta: { real, reverse, euro, euroReverse } ou null se não tiver
function precoCarta(serie, k) {
  var d = PRECOS[serie], p = d && d.precos[k];
  if (!p) return null;
  return { euro: p[0], euroReverse: p[1] || 0, real: p[0] * d.eur_brl, reverse: (p[1] || 0) * d.eur_brl };
}

// Valor de referência da carta em reais (o normal; se a carta só tiver preço de reverse holo, esse). 0 = sem preço.
// Usado na grade, na ordenação e no valor da coleção, para todos mostrarem o mesmo número.
function valorCarta(serie, k) { var p = precoCarta(serie, k); return p ? p.real || p.reverse : 0; }

// 1234.5 → "R$ 1.234,50"; € 0.06 → "€ 0,06"
function reais(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function euros(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'EUR' }); }

// Valor de uma coleção: o que a pessoa tem (contando as repetidas) e a coleção completa
function valorColecao(c) {
  var meu = 0, completa = 0, tem = false;
  (ESTADO.cartas[c.id] || []).forEach(function (k) {
    var v = valorCarta(c.serie, k.id);
    if (!v) return;
    tem = true; completa += v;
    if (temCarta(c.id, k.id)) meu += v * (1 + qtdRepetida(c.id, k.id));
  });
  return tem ? { meu: meu, completa: completa } : null;
}

// Rodapé que explica de onde vem o preço (carta grande)
function notaPreco(serie) {
  var d = PRECOS[serie];
  return d ? 'Referência do ' + d.fonte + ' convertida (€ 1 = ' + reais(d.eur_brl) + '), atualizada em ' + dataBR(d.atualizado) + '.' : '';
}
