// js/base/precos.js
// PREÇOS DAS CARTAS EM REAIS
// ============================================================
// Referência principal: Liga Pokémon (mercado brasileiro), preço médio em real.
//   dados/precos-liga/<serie>.json – gerado por scripts/atualizar_precos_liga.py (.github/workflows/precos-liga.yml)
// Reserva: Cardmarket (loja europeia), em euro convertido para real, só para as coleções que ainda
// não têm preço da Liga (uma coleção usa uma fonte só, para os números não se misturarem).
//   dados/precos/<serie>.json – gerado por scripts/atualizar_precos.py (.github/workflows/precos.yml)
// Fiscal: TCGplayer (loja dos EUA), em dólar convertido para real. Ele separa bem a versão comum, a full art e a
// shiny de cada carta. Quando o preço da Liga ou do Cardmarket está mais de 3 vezes acima ou abaixo do TCGplayer
// (anúncio absurdo na Liga, carta ligada ao produto errado no Cardmarket), ou a carta não tem preço, vale o TCGplayer.
//   dados/precos-tcgplayer/<serie>.json – gerado por scripts/atualizar_precos_tcgplayer.py (mesmo robô diário)
// ============================================================

var PRECOS = {}; // série → { liga: {...} ou null, cm: {...} ou null, tcgp: {...} ou null }
var precosPedidos = {}; // série → leitura em andamento (para não baixar o mesmo arquivo duas vezes)

// Baixa um arquivo .json (null se não existir ou der erro)
function lerJson(url) {
  return fetch(url).then(function (r) {
    return r.ok ? r.json() : null;
  }).catch(function () {
    return null;
  });
}

// Lê os arquivos de preços da série (uma vez por dia; sem arquivo, a série fica sem preços)
function carregarPrecos(serie) {
  if (!precosPedidos[serie]) {
    var dia = new Date().toISOString().slice(0, 10);
    precosPedidos[serie] = Promise.all([lerJson('dados/precos-liga/' + serie + '.json?d=' + dia),
        lerJson('dados/precos/' + serie + '.json?d=' + dia),
        lerJson('dados/precos-tcgplayer/' + serie + '.json?d=' + dia)
      ])
      .then(function (r) {
        PRECOS[serie] = {
          liga: r[0],
          cm: r[1],
          tcgp: r[2]
        };
        return PRECOS[serie];
      });
  }
  return precosPedidos[serie];
}

// A coleção já tem preço da Liga?
function usaLiga(serie, col) {
  var d = PRECOS[serie];
  return !!(d && d.liga && d.liga.colecoes[col]);
}

// Preço do TCGplayer em reais: { fonte: 'tcgp', real, reverse } ou null
function precoTcgplayer(d, k) {
  var p = d.tcgp && d.tcgp.precos[k];
  return p ? {
    fonte: 'tcgp',
    real: p[0] * d.tcgp.usd_brl,
    reverse: (p[1] || 0) * d.tcgp.usd_brl
  } : null;
}

// true se o valor v (em reais) está fora do normal perto do TCGplayer t: mais de 3 vezes acima ou abaixo
// e com mais de R$ 100 de diferença (em cartas baratas, uma diferença grande em vezes não importa)
function foraDoTcgplayer(v, t) {
  return !!(t && v && (v > 3 * t || v < t / 3) && Math.abs(v - t) > 100);
}

// Preço da carta k (id) da coleção c ({ id, serie }) ou null se não tiver:
//   Liga:       { fonte: 'liga', real: médio, menor, maior }
//   Cardmarket: { fonte: 'cm', real: tendência, reverse, menor: anúncio mais barato (0 = não informado) }
//   TCGplayer:  { fonte: 'tcgp', real, reverse, trocado: true se substituiu um preço fora do normal }
// "real" (o preço típico) é o que aparece embaixo da carta e entra no valor da coleção;
// o menor aparece só na carta grande, como "a partir de" (costuma ser de carta danificada ou em outro idioma).
function precoCarta(c, k) {
  var d = PRECOS[c.serie],
    p, preco = null;
  if (!d) return null;
  var tcgp = precoTcgplayer(d, k);
  if (usaLiga(c.serie, c.id)) {
    p = d.liga.precos[k];
    if (p) preco = {
      fonte: 'liga',
      real: p[1],
      menor: p[0],
      maior: p[2]
    };
  } else if (d.cm && d.cm.precos[k]) {
    p = d.cm.precos[k];
    preco = {
      fonte: 'cm',
      real: p[0] * d.cm.eur_brl,
      reverse: (p[1] || 0) * d.cm.eur_brl,
      menor: (p[2] || 0) * d.cm.eur_brl
    };
  }
  if (!preco) return tcgp;
  if (tcgp && foraDoTcgplayer(preco.real || preco.reverse, tcgp.real || tcgp.reverse)) {
    tcgp.trocado = true;
    return tcgp;
  }
  return preco;
}

// Valor de referência da carta em reais (Liga: o médio; Cardmarket e TCGplayer: o normal ou, se só tiver, o reverse holo).
// 0 = sem preço.
// Usado na grade, na ordenação e no valor da coleção, para todos mostrarem o mesmo número.
function valorCarta(c, k) {
  var p = precoCarta(c, k);
  return p ? p.real || p.reverse || 0 : 0;
}

// 1234.5 → "R$ 1.234,50"
function reais(v) {
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

// Valor de uma coleção: o que a pessoa tem (contando as repetidas) e a coleção completa
function valorColecao(c) {
  var meu = 0,
    completa = 0,
    tem = false;
  (ESTADO.cartas[c.id] || []).forEach(function (k) {
    var v = valorCarta(c, k.id);
    if (!v) return;
    tem = true;
    completa += v;
    if (temCarta(c.id, k.id)) meu += v * (1 + qtdRepetida(c.id, k.id));
  });
  return tem ? {
    meu: meu,
    completa: completa
  } : null;
}

// Coleções em que a pessoa marcou alguma carta, já com as cartas e os preços carregados
// (usado em "Minhas cartas" e no valor da coleção da tela inicial)
async function carregarMinhasColecoes() {
  var cols = todasColecoes().filter(function (c) {
    return qtdTenho(c.id);
  });
  var series = cols.map(function (c) {
    return c.serie;
  }).filter(function (s, i, l) {
    return l.indexOf(s) === i;
  });
  await Promise.all(cols.map(function (c) {
    return carregarCartas(c).catch(function () {});
  }).concat(series.map(carregarPrecos)));
  return cols;
}

// Valor de tudo que a pessoa tem, somando as coleções (contando as repetidas). 0 = sem preço
function valorTotal(cols) {
  return cols.reduce(function (soma, c) {
    var v = valorColecao(c);
    return soma + (v ? v.meu : 0);
  }, 0);
}

// Texto curto da fonte, para ir entre parênteses: "preço médio da Liga Pokémon" ou "referência Cardmarket"
// (algumas cartas podem usar o TCGplayer, quando o preço principal está fora do normal ou falta)
function fontePreco(serie, col) {
  return usaLiga(serie,
    col) ? 'preço médio da Liga Pokémon' : 'referência Cardmarket';
}

// O mesmo para várias coleções [{ serie, id }] (tela "Minhas cartas")
function fontePrecos(cols) {
  var f = {};
  cols.forEach(function (c) {
    f[fontePreco(c.serie, c.id)] = 1;
  });
  f = Object.keys(f);
  return (f.length === 1 ? f[0] : 'preço médio da Liga Pokémon; Cardmarket nas coleções ainda sem preço da Liga') +
    '; TCGplayer nas cartas com preço fora do normal';
}

// Rodapé que explica de onde vem o preço da carta (carta grande). preco = resultado de precoCarta
function notaPreco(c, preco) {
  var d = PRECOS[c.serie];
  if (preco.fonte === 'tcgp') return 'Referência do TCGplayer (loja dos EUA) convertida (US$ 1 = ' +
    reais(d.tcgp.usd_brl) + '), atualizada em ' + dataBR(d.tcgp.atualizado) + '.' + (preco.trocado ?
      ' O preço ' + (usaLiga(c.serie, c.id) ? 'da Liga' : 'do Cardmarket') +
      ' desta carta estava fora do normal, então usamos o do TCGplayer.' : '');
  if (preco.fonte === 'liga') return 'Preços da Liga Pokémon (mercado brasileiro), atualizados em ' +
    dataBR(d.liga.colecoes[c.id]) + '.';
  return 'Referência do Cardmarket convertida (€ 1 = ' + reais(d.cm.eur_brl) + '), atualizada em ' +
    dataBR(d.cm.atualizado) + '.';
}
