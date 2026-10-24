// js/telas/minhas.js
// TELA "MINHAS CARTAS" E BACKUP
// ============================================================
// Resumo (cartas, coleções e valor), filtro por série e ordem, e as coleções em que a pessoa marcou cartas,
// cada uma fechada numa linha (logo, nome, progresso e valor). Clicar na linha abre e mostra as cartas dela.
// Backup (no fim): exporta um .json com as marcações e as repetidas; importar JUNTA com o que já está marcado.
// ============================================================

// Filtro e coleções abertas (ficam enquanto o site está aberto)
var MINHAS = {
  serie: '', // '' = todas as séries
  ordem: 'recentes', // recentes | completas | valiosas | nome
  abertas: {} // coleções abertas: { me01: true }
};

async function telaMinhas() {
  ESTADO.redesenhar = desenharMinhas;
  marcarMenu(2);
  app.innerHTML = '<h2>Minhas cartas</h2><p class="sub">Carregando...</p>';
  await carregarMinhasColecoes();
  if (ESTADO.redesenhar === desenharMinhas) desenharMinhas();
}

// Coleções da pessoa (com cartas carregadas), já filtradas pela série e na ordem escolhida
function minhasColecoes() {
  var cols = todasColecoes().filter(function (c) {
    return qtdTenho(c.id) && ESTADO.cartas[c.id] && (!MINHAS.serie || c.serie === MINHAS.serie);
  });
  var valor = function (c) {
      var v = valorColecao(c);
      return v ? v.meu : 0;
    },
    feito = function (c) {
      return qtdTenho(c.id) / (ESTADO.cartas[c.id].length || 1);
    };
  var ordens = {
    recentes: function (a, b) {
      return a.lancamento < b.lancamento ? 1 : a.lancamento > b.lancamento ? -1 : 0;
    },
    completas: function (a, b) {
      return feito(b) - feito(a);
    },
    valiosas: function (a, b) {
      return valor(b) - valor(a);
    },
    nome: function (a, b) {
      return a.nome.localeCompare(b.nome, 'pt');
    }
  };
  return cols.sort(ordens[MINHAS.ordem] || ordens.recentes);
}

// Uma coleção: linha fechada (logo, nome, série, progresso e valor) e, se estiver aberta, as cartas
function blocoMinhaColecao(c) {
  var total = ESTADO.cartas[c.id].length,
    n = qtdTenho(c.id),
    v = valorColecao(c),
    aberta = !!MINHAS.abertas[c.id];
  var cartas = aberta ? '<div class="minhas-cartas"><div class="grade">' + ESTADO.cartas[c.id].filter(function (k) {
      return temCarta(c.id, k.id);
    }).map(function (k) {
      return cartaGrade(c, k, true);
    }).join('') + '</div><button class="btn btn-sec" onclick="telaColecao(\'' + c.id +
    '\')">Ver a coleção completa →</button></div>' : '';
  return '<section class="minhas-col' + (aberta ? ' aberta' : '') + '">' +
    '<button class="minhas-linha" aria-expanded="' + aberta + '" onclick="abrirMinhaColecao(\'' + c.id + '\')">' +
    '<img src="assets/img/colecoes/' + c.serie + '/' + c.id + '.webp" alt="" onerror="logoAlt(this)">' +
    '<span class="minhas-nome"><b>' + esc(c.nome) + '</b><small>' + esc(acharSerie(c.serie).nome) + ' · ' + n +
    ' de ' + total + ' cartas</small>' + barra(pct(n, total)) + '</span>' +
    '<span class="minhas-valor">' + (v && v.meu ? reais(v.meu) : '') +
    '</span><span class="seta" aria-hidden="true">▾</span>' +
    '</button>' + cartas + '</section>';
}

// Clique na linha de uma coleção: abre (mostra as cartas) ou fecha
function abrirMinhaColecao(id) {
  MINHAS.abertas[id] = !MINHAS.abertas[id];
  desenharMinhas();
}

// Filtro por série e ordem
function filtrarMinhas(campo, valor) {
  MINHAS[campo] = valor;
  desenharMinhas();
}

// Desenha Minhas cartas: resumo, filtros, coleções e a caixa de backup
function desenharMinhas() {
  var todas = todasColecoes().filter(function (c) {
    return qtdTenho(c.id) && ESTADO.cartas[c.id];
  });
  var total = valorTotal(todas),
    series = ESTADO.series.filter(function (s) {
      return todas.some(function (c) {
        return c.serie === s.id;
      });
    });
  if (MINHAS.serie && !series.some(function (s) {
      return s.id === MINHAS.serie;
    })) MINHAS.serie = '';
  var cols = minhasColecoes();
  var chips = [{
    id: '',
    nome: 'Todas'
  }].concat(series).map(function (s) {
    return '<button class="chip' + (MINHAS.serie === s.id ? ' on' : '') + '" onclick="filtrarMinhas(\'serie\',\'' +
      s.id + '\')">' + esc(s.nome) + '</button>';
  }).join('');
  var ordem = '<label class="minhas-ordem">Ordenar <select onchange="filtrarMinhas(\'ordem\',this.value)">' + [
    ['recentes', 'Mais recentes'],
    ['completas', 'Mais completas'],
    ['valiosas', 'Mais valiosas'],
    ['nome', 'Nome (A–Z)']
  ].map(function (o) {
    return '<option value="' + o[0] + '"' + (MINHAS.ordem === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
  }).join('') + '</select></label>';
  var textoBackup = logadoNaNuvem() ?
    'Suas marcações estão salvas na sua conta e aparecem em qualquer aparelho em que você entrar. Se quiser, guarde também uma cópia em arquivo.' :
    'Sem conta, as marcações ficam salvas só neste navegador. Crie uma conta para levar para qualquer aparelho, ou exporte um arquivo.';
  app.innerHTML = '<h2>Minhas cartas</h2>' +
    (todas.length ? '<div class="minhas-resumo"><div><b>' + totalTenho() + '</b><span>cartas</span></div>' +
      '<div><b>' + todas.length + '</b><span>' + (todas.length === 1 ? 'coleção' : 'coleções') + '</span></div>' +
      (total ? '<div title="' + esc(fontePrecos(todas)) + ', contando as repetidas"><b>' + reais(total) +
        '</b><span>valor estimado</span></div>' : '') +
      '</div>' +
      '<div class="minhas-filtros"><div class="chips">' + chips + '</div>' + ordem + '</div>' +
      '<span class="sub">Toque numa coleção para ver as suas cartas dela.</span>' +
      '<div class="minhas-lista">' + cols.map(blocoMinhaColecao).join('') + '</div>' :
      '<div class="aviso">Você ainda não marcou nenhuma carta. Abra uma coleção e toque no círculo da carta para marcar.</div>'
    ) +
    '<div class="backup"><div><b>Backup da coleção</b><span class="sub">' + textoBackup + '</span></div>' +
    '<div class="backup-acoes">' +
    '<button class="btn" onclick="exportarColecao()">Exportar backup</button>' +
    '<button class="btn btn-sec" onclick="this.nextElementSibling.click()">Importar backup</button>' +
    '<input type="file" accept=".json,application/json" onchange="importarColecao(this)" hidden>' +
    '</div><p class="sub" id="backup-msg" role="status"></p></div>';
}

// BACKUP: baixa um .json com as marcações e as repetidas
function exportarColecao() {
  var dados = {
    app: 'CardDex',
    versao: 2,
    exportado: new Date().toISOString(),
    tenho: ESTADO.tenho,
    repetidas: ESTADO.repetidas
  };
  var url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 1)], {
    type: 'application/json'
  }));
  var a = document.createElement('a');
  a.href = url;
  a.download = 'carddex-backup-' + new Date().toISOString().slice(0,
    10) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 1000);
  document.getElementById('backup-msg').textContent = 'Backup exportado com ' + totalTenho() + ' cartas.';
}

// Lê um backup e JUNTA com as marcações atuais (nada que já está marcado é apagado)
function importarColecao(input) {
  var arq = input.files[0],
    msg = document.getElementById('backup-msg');
  if (!arq) return;
  var r = new FileReader();
  r.onload = function () {
    var d;
    try {
      d = JSON.parse(r.result);
    } catch (e) {
      d = null;
    }
    if (!d || d.app !== 'CardDex' ||
      typeof d.tenho !== 'object') {
      msg.textContent = 'Este arquivo não é um backup do CardDex.';
      return;
    }
    var novas = 0;
    Object.keys(d.tenho).forEach(function (col) {
      if (!Array.isArray(d.tenho[col])) return;
      var l = ESTADO.tenho[col] || (ESTADO.tenho[col] = []);
      d.tenho[col].forEach(function (id) {
        if (typeof id === 'string' && l.indexOf(id) < 0) {
          l.push(id);
          novas++;
        }
      });
    });
    // repetidas (backups da versão 2): fica a maior quantidade de cada carta
    if (d.repetidas && typeof d.repetidas === 'object') Object.keys(d.repetidas).forEach(function (col) {
      Object.keys(d.repetidas[col] || {}).forEach(function (k) {
        var n = parseInt(d.repetidas[col][k], 10);
        if (n > 0 && temCarta(col, k) && n > qtdRepetida(col, k))(ESTADO.repetidas[col] ||
          (ESTADO.repetidas[col] = {}))[k] = Math.min(n, 99);
      });
    });
    salvarRepetidas();
    salvarTenho();
    telaMinhas().then(function () {
      var m = document.getElementById('backup-msg');
      if (m) m.textContent = novas ? novas +
        ' cartas importadas.' : 'Nenhuma carta nova: tudo do backup já estava marcado.';
    });
  };
  r.readAsText(arq);
  input.value = '';
}
