// js/telas/minhas.js
// TELA "MINHAS CARTAS" E BACKUP
// ============================================================
// Mostra só as cartas marcadas, separadas por coleção.
// Backup: exporta um .json com as marcações e as repetidas; importar JUNTA com o que já está marcado.
// ============================================================

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
      var l = ESTADO.cartas[c.id].filter(function (k) { return temCarta(c.id, k.id); });
      return '<section class="minhas-col"><button class="voltar" onclick="telaColecao(\'' + c.id + '\')"><h3>' + esc(c.nome) + '</h3></button>' +
        '<span class="sub">' + esc(s.nome) + ' · ' + qtdTenho(c.id) + ' de ' + ESTADO.cartas[c.id].length + ' cartas</span>' +
        '<div class="grade">' + l.map(function (k) { return cartaGrade(c, k, true); }).join('') + '</div></section>';
    }).join('');
  }).join('');
  var textoBackup = logadoNaNuvem()
    ? 'Suas marcações estão salvas na sua conta e aparecem em qualquer aparelho em que você entrar. Se quiser, guarde também uma cópia em arquivo.'
    : 'Sem conta, as marcações ficam salvas só neste navegador. Crie uma conta para levar para qualquer aparelho, ou exporte um arquivo.';
  app.innerHTML = '<h2>Minhas cartas</h2><span class="sub">' + totalTenho() + ' cartas marcadas. Clique no nome da coleção para ver todas as cartas dela.</span>' +
    '<div class="backup"><div><b>Backup da coleção</b><span class="sub">' + textoBackup + '</span></div>' +
    '<div class="backup-acoes"><button class="btn" onclick="exportarColecao()">Exportar backup</button><button class="btn btn-sec" onclick="this.nextElementSibling.click()">Importar backup</button>' +
    '<input type="file" accept=".json,application/json" onchange="importarColecao(this)" hidden></div><p class="sub" id="backup-msg" role="status"></p></div>' +
    (blocos || '<div class="aviso">Você ainda não marcou nenhuma carta. Abra uma coleção e toque no círculo da carta para marcar.</div>');
}

// BACKUP: baixa um .json com as marcações e as repetidas
function exportarColecao() {
  var dados = { app: 'CardDex', versao: 2, exportado: new Date().toISOString(), tenho: ESTADO.tenho, repetidas: ESTADO.repetidas };
  var url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 1)], { type: 'application/json' }));
  var a = document.createElement('a'); a.href = url; a.download = 'carddex-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  document.getElementById('backup-msg').textContent = 'Backup exportado com ' + totalTenho() + ' cartas.';
}

// Lê um backup e JUNTA com as marcações atuais (nada que já está marcado é apagado)
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
    // repetidas (backups da versão 2): fica a maior quantidade de cada carta
    if (d.repetidas && typeof d.repetidas === 'object') Object.keys(d.repetidas).forEach(function (col) {
      Object.keys(d.repetidas[col] || {}).forEach(function (k) {
        var n = parseInt(d.repetidas[col][k], 10);
        if (n > 0 && temCarta(col, k) && n > qtdRepetida(col, k)) (ESTADO.repetidas[col] || (ESTADO.repetidas[col] = {}))[k] = Math.min(n, 99);
      });
    });
    salvarRepetidas(); salvarTenho();
    telaMinhas().then(function () {
      var m = document.getElementById('backup-msg');
      if (m) m.textContent = novas ? novas + ' cartas importadas.' : 'Nenhuma carta nova: tudo do backup já estava marcado.';
    });
  };
  r.readAsText(arq);
  input.value = '';
}
