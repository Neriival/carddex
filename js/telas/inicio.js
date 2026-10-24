// js/telas/inicio.js
// TELAS DE NAVEGAÇÃO: Início (séries) → Série (coleções)
// ============================================================
// Início: destaque, números (com o valor da coleção), próximo lançamento com contagem regressiva,
// coleção mais recente (com as 5 cartas mais valiosas saindo do cartão),
// "Continue sua coleção" e as séries com os anos de cada era.
// Com mais de um jogo com cartas, o Início mostra os jogos e cada jogo abre a tela das suas séries (telaJogo).
// Cada tela é uma função que desenha o HTML dentro de <main id="app">.
// A tela da coleção (as cartas) fica em js/telas/colecao.js.
// ============================================================

// Botão de uma coleção: logo, nome, data de lançamento e progresso
// (coleção que ainda não saiu, "emBreve": true no series.json: mostra "Em breve" no lugar do progresso)
function botaoColecao(c) {
  var n = qtdTenho(c.id),
    completa = c.total && n >= c.total;
  if (c.emBreve) {
    return '<button class="colecao em-breve" onclick="telaColecao(\'' + c.id + '\')">' +
      '<img src="assets/img/colecoes/' + c.serie + '/' + c.id + '.webp" alt="" onerror="logoAlt(this)">' +
      '<h3>' + esc(c.nome) + '</h3>' +
      '<span class="sub">Lança em ' + dataBR(c.lancamento) + '</span>' +
      '<span class="selo-em-breve">Em breve</span></button>';
  }
  return '<button class="colecao' + (completa ? ' completa' : '') + '" onclick="telaColecao(\'' + c.id +
    '\')"><img src="assets/img/colecoes/' + c.serie + '/' + c.id + '.webp" alt="" onerror="logoAlt(this)"><h3>' +
    esc(c.nome) + '</h3>' +
    '<span class="sub">Lançamento: ' + dataBR(c.lancamento) + '</span>' + progresso(n, c.total) + '</button>';
}

// Anos da série ("2023 – 2025"); a série mais nova do jogo termina em "hoje"
function anosSerie(s) {
  var datas = s.colecoes.filter(function (c) {
    return !c.emBreve;
  }).map(function (c) {
    return c.lancamento;
  }).sort();
  if (!datas.length) return '';
  var inicio = datas[0].slice(0, 4),
    fim = seriesDoJogo(s.jogo)[0] === s ? 'hoje' : datas[datas.length - 1].slice(0, 4);
  return inicio === fim ? inicio : inicio + ' – ' + fim;
}

// Botão de uma série (tela inicial, tela do jogo e busca), com a faixa na cor da era (classe era-<id>)
function botaoSerie(s) {
  var r = resumoSerie(s),
    anos = anosSerie(s);
  return '<button class="colecao serie-btn era-' + s.id + '" onclick="telaSerie(\'' + s.id + '\')">' +
    '<img src="assets/img/series/' + s.id + '.webp" alt="" onerror="this.remove()"><h3>' + esc(s.nome) + '</h3>' +
    '<span class="sub">' + (anos ? anos + ' · ' : '') + s.colecoes.length + ' coleções</span>' +
    progresso(r.tenho, r.total) + '</button>';
}

// true se o site tem mais de um jogo com cartas (aí a tela inicial mostra os jogos antes das séries)
function variosJogos() {
  return ESTADO.jogos.filter(function (j) {
    return seriesDoJogo(j.id).length;
  }).length > 1;
}

// Dias que faltam até a data "AAAA-MM-DD" (0 = hoje; negativo = já passou)
function diasAte(data) {
  var hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((new Date(data + 'T00:00:00') - hoje) / 864e5);
}

// DESTAQUES da tela inicial: a próxima coleção ("Em breve", com contagem regressiva, num cartão estreito)
// e a mais recente, com as cartas mais valiosas saindo do cartão
function blocoDestaques() {
  var cols = todasColecoes(),
    // mesma data (ex.: coleção principal + coleção clássica que vem junto): a maior conta como a mais nova
    porData = function (a, b) {
      return a.lancamento < b.lancamento ? -1 : a.lancamento > b.lancamento ? 1 : a.total - b.total;
    };
  var proxima = cols.filter(function (c) {
      return c.emBreve;
    }).sort(porData)[0],
    recente = cols.filter(function (c) {
      return !c.emBreve;
    }).sort(porData).pop();

  function cartao(c, cls, rotulo, lado) {
    // é um <div> que funciona como link (e não um <button>) porque as cartas "mais raras" dentro dele são clicáveis
    return '<div class="destaque ' + cls + '" role="link" tabindex="0" onclick="telaColecao(\'' + c.id + '\')"' +
      ' onkeydown="if(event.key===\'Enter\')this.click()"><small>' + rotulo +
      '</small><img src="assets/img/colecoes/' + c.serie + '/' + c.id + '.webp" alt="" onerror="logoAlt(this)">' +
      '<div class="destaque-txt"><h3>' + esc(c.nome) + '</h3><span class="sub">' + esc(acharSerie(c.serie).nome) +
      ' · ' + dataBR(c.lancamento) + '</span></div>' + lado + '</div>';
  }
  var html = '';
  if (proxima) {
    var d = diasAte(proxima.lancamento),
      // já passou da data, mas o robô ainda não achou as cartas: "Saiu! cartas em breve"
      contagem = d > 1 ? '<span>chega em</span><b>' + d + '</b><span>dias</span>' : d === 1 ?
      '<span>chega</span><b>amanhã</b>' : d === 0 ? '<span>chega</span><b>hoje</b>' :
      '<b>Saiu!</b><span>cartas em breve</span>';
    html += cartao(proxima, 'proxima', 'Próximo lançamento', '<div class="contagem">' + contagem + '</div>');
  }
  // a coleção mais recente, com as 5 cartas mais valiosas saindo do cartão: ao lado da contagem ou, sem
  // lançamento divulgado, na linha toda (o espaço .raras é preenchido depois, por preencherRaras)
  if (recente) html += cartao(recente, 'recente com-raras', 'Coleção mais recente', '<span class="destaque-ver">' +
    recente.total + ' cartas · Ver coleção →</span><div class="raras" id="raras" data-col="' + recente.id +
    '"></div>');
  return html ? '<div class="destaques' + (proxima ? ' com-proxima' : '') + '">' + html + '</div>' : '';
}

// Peso da raridade (quanto mais rara, maior), para desempatar as cartas sem preço
var RARIDADES_TOPO = ['rara', 'dupla', 'ultra', 'ilustração rara', 'especial', 'hiper'];

// Peso da raridade de uma carta (0 = comum ou desconhecida)
function pesoRaridade(k) {
  var r = (k.raridade || '').toLowerCase(),
    peso = 0;
  RARIDADES_TOPO.forEach(function (t, i) {
    if (r.indexOf(t) > -1) peso = i + 1;
  });
  return peso;
}

// AS MAIS RARAS: as 5 cartas mais valiosas da coleção mais recente, em leque, saindo de dentro do cartão.
// A mais valiosa fica no meio, na frente; as seguintes vão para os lados. Clicar numa carta abre a carta grande.
// Os preços mudam todo dia (robô), então as cartas escolhidas também podem mudar.
async function preencherRaras(box) {
  var c = acharColecao(box.dataset.col),
    lista = await carregarCartas(c).catch(function () {
      return [];
    });
  await carregarPrecos(c.serie);
  if (!document.body.contains(box)) return; // saiu da tela antes de terminar
  var top = lista.filter(function (k) {
    return k.mini || k.imagem;
  }).sort(function (a, b) {
    return valorCarta(c, b.id) - valorCarta(c, a.id) || pesoRaridade(b) - pesoRaridade(a);
  }).slice(0, 5);
  if (top.length < 5) { // coleção sem imagens: fica o cartão normal
    box.parentNode.classList.remove('com-raras');
    box.remove();
    return;
  }
  // da esquerda para a direita: 4ª, 2ª, 1ª (a mais valiosa, no meio), 3ª, 5ª
  box.innerHTML = [top[3], top[1], top[0], top[2], top[4]].map(function (k, i) {
    var v = valorCarta(c, k.id);
    return '<img class="rara-' + i + '" src="' + esc(k.mini || k.imagem) + '" alt="' + esc(k.nome) + '" title="' +
      esc(k.nome) + (v ? ' · ' + reais(v) : '') + '" onclick="event.stopPropagation();abrirCarta(\'' + c.id +
      '\',\'' + esc(k.id) + '\')">';
  }).join('');
}

// CONTINUE SUA COLEÇÃO: as 6 coleções que a pessoa está mais perto de completar (só para quem marcou cartas)
function blocoContinuar() {
  var feito = function (c) {
    return qtdTenho(c.id) / c.total;
  };
  var l = todasColecoes().filter(function (c) {
    return !c.emBreve && c.total && qtdTenho(c.id) && qtdTenho(c.id) < c.total;
  }).sort(function (a, b) {
    return feito(b) - feito(a);
  }).slice(0, 6);
  // versão enxuta: logo pequeno, nome, barra fina e a porcentagem (o resto fica na tela da coleção)
  return l.length ? '<h3 class="continuar-titulo">Continue sua coleção</h3><div class="continuar">' +
    l.map(function (c) {
      var p = pct(qtdTenho(c.id), c.total);
      return '<button class="continuar-item" onclick="telaColecao(\'' + c.id + '\')" title="Faltam ' +
        (c.total - qtdTenho(c.id)) + ' cartas"><img src="assets/img/colecoes/' + c.serie + '/' + c.id +
        '.webp" alt="" onerror="logoAlt(this)"><span class="continuar-txt"><b>' + esc(c.nome) + '</b>' +
        barra(p) + '</span>' +
        '<span class="continuar-pct">' + p + '%</span></button>';
    }).join('') + '</div>' : '';
}

// Botão de um jogo (Pokémon, Yu-Gi-Oh!...). Ícones em assets/img/jogos/<id>.svg
function botaoJogo(j) {
  var series = seriesDoJogo(j.id);
  return '<button class="colecao jogo-btn' + (series.length ? '' : ' em-breve') + '" onclick="telaJogo(\'' + j.id +
    '\')"><img src="assets/img/jogos/' + j.id + '.svg" alt="" onerror="this.remove()"><h3>' + esc(j.nome) + '</h3>' +
    '<span class="sub">' + (series.length ? series.length + ' séries' : 'Em breve') + '</span></button>';
}

// TELA – Início: destaque, números e botões dos jogos.
// 'ir' rola a página até um bloco (ex.: 'series'). Com algo na busca, mostra as séries e coleções encontradas.
function telaInicio(ir) {
  ESTADO.redesenhar = null;
  marcarMenu(ir === 'series' ? 1 : 0);
  var q = ((document.getElementById('busca') || {}).value || '').trim().toLowerCase(),
    blocos;
  if (q) {
    var achou = function (t) {
      return t.toLowerCase().indexOf(q) > -1;
    };
    var ss = ESTADO.series.filter(function (s) {
      return achou(s.nome);
    });
    var cs = todasColecoes().filter(function (c) {
      return achou(c.nome);
    });
    blocos = '<h2 id="series">Resultados da busca</h2>' + (ss.length || cs.length ? '<div class="colecoes">' +
      ss.map(botaoSerie).join('') + cs.map(botaoColecao).join('') + '</div>' :
      '<p class="sub">Nenhuma série ou coleção encontrada.</p>');
  } else blocos = blocoDestaques() + blocoContinuar() + '<h2 id="series">Séries</h2>' + (variosJogos() ?
    '<span class="sub">Escolha o jogo de cartas</span><div class="colecoes jogos">' +
    ESTADO.jogos.map(botaoJogo).join('') + '</div>' : '<span class="sub">Da mais nova para a mais antiga</span>' +
    '<div class="colecoes">' + ESTADO.series.map(botaoSerie).join('') + '</div>');
  app.innerHTML = '<section class="hero"><div><small>SEU ESPAÇO DE COLECIONADOR</small>' +
    '<h1>Seu álbum.<span>Suas conquistas.</span></h1>' +
    '<p>Explore as séries e marque as cartas que você já tem.</p>' +
    '<button class="btn" onclick="telaInicio(\'series\')">Explorar séries →</button>' +
    '</div><img src="assets/img/carddex-logo.png" alt=""></section>' +
    '<div class="stats" id="stats"><div class="stat"><div>Coleções disponíveis</div>' +
    '<b>' +
    pad(todasColecoes().filter(function (c) {
      return !c.emBreve; // não conta as que ainda não saíram
    }).length, 2) + '</b></div>' +
    '<div class="stat"><div>Cartas que você tem</div><b>' + totalTenho() + '</b></div>' +
    '<div class="stat"><div>Valor da sua coleção</div><b id="stat-valor">' + (totalTenho() ? '...' : reais(0)) +
    '</b></div></div>' + blocos;
  // o valor precisa das cartas e dos preços das coleções da pessoa: aparece quando terminam de carregar
  if (totalTenho()) carregarMinhasColecoes().then(function (cols) {
    var el = document.getElementById('stat-valor');
    if (el) el.textContent = reais(valorTotal(cols));
  });
  var raras = document.getElementById('raras');
  if (raras) preencherRaras(raras);
  var alvo = ir && document.getElementById(ir);
  if (alvo) alvo.scrollIntoView({
    behavior: 'smooth'
  });
  else if (!q) window.scrollTo(0, 0);
}

// TELA – Jogo: séries do jogo, da mais nova para a mais antiga (ou "Em breve")
function telaJogo(id) {
  var j = acharJogo(id),
    series = seriesDoJogo(id);
  ESTADO.redesenhar = null;
  marcarMenu(1);
  app.innerHTML = '<h2><button class="voltar" onclick="telaInicio(\'series\')">← Séries</button>' +
    '</h2><div class="titulo-jogo"><img src="assets/img/jogos/' + j.id + '.svg" alt="" onerror="this.remove()"><h2>' +
    esc(j.nome) + '</h2></div>' +
    (series.length ? '<span class="sub">Séries da mais nova para a mais antiga</span>' +
      '<div class="colecoes">' + series.map(botaoSerie).join('') + '</div>' :
      '<div class="aviso">As cartas de ' + esc(j.nome) + ' ainda vão chegar ao CardDex. Fique de olho!</div>');
  window.scrollTo(0, 0);
}

// TELA – Série: coleções da série, da mais nova para a mais antiga
function telaSerie(id) {
  var s = acharSerie(id),
    j = acharJogo(s.jogo) || ESTADO.jogos[0];
  ESTADO.redesenhar = null;
  marcarMenu(1);
  // com um jogo só, o "voltar" leva direto às séries da tela inicial
  var volta = variosJogos() ? '<button class="voltar" onclick="telaJogo(\'' + j.id + '\')">← ' + esc(j.nome) +
    '</button>' : '<button class="voltar" onclick="telaInicio(\'series\')">← Séries</button>';
  app.innerHTML = '<h2>' + volta + '</h2><h2 class="titulo">' + esc(s.nome) + '</h2>' +
    '<span class="sub">' + (anosSerie(s) ? anosSerie(s) + ' · ' : '') +
    'Coleções da mais nova para a mais antiga</span>' +
    '<div class="colecoes">' + s.colecoes.map(botaoColecao).join('') + '</div>';
  window.scrollTo(0, 0);
}
