// js/modal.js
// Carta em tamanho grande, com efeito de abertura e brilho suave
// ============================================================
// CARTA GRANDE (janela que abre ao clicar na imagem)
// Para ajustar a inclinação 3D, mude MAX (graus) em abrirCarta().
// A animação de abertura fica em css/componentes.css (@keyframes abrir).
// ============================================================

var modal = document.getElementById('modal'), cartaAberta = null;
async function abrirCarta(colId, cartaId) {
  var c = acharColecao(colId), s = acharSerie(c.serie);
  var k = ESTADO.cartas[colId].filter(function (x) { return x.id === cartaId; })[0];
  await detalhesCarta(k); cartaAberta = { col: colId, k: k };
  var y = (ESTADO.tenho[colId] || []).indexOf(k.id) > -1;
  var tipo = (k.tipos || []).join(', ') || k.categoria || '—';
  modal.innerHTML = '<button class="fechar" onclick="fecharCarta()" aria-label="Fechar">×</button><div class="caixa"><div class="palco"><div class="carta3d" id="c3d">' +
    (k.imagem ? '<img src="' + esc(k.imagem) + '" alt="' + esc(k.nome) + '">' : '<div class="ph">' + esc(k.numero) + '</div>') + '<div class="brilho"></div></div></div>' +
    '<div class="info"><h3>' + esc(k.nome) + '</h3><span class="sub">' + esc(c.nome) + '</span><dl><dt>Número</dt><dd>' + esc(k.numero) + ' de ' + ESTADO.cartas[colId].length + '</dd><dt>Série</dt><dd>' + esc(s.nome) + '</dd><dt>Raridade</dt><dd>' + esc(k.raridade || '—') + '</dd><dt>Tipo</dt><dd>' + esc(tipo) + '</dd><dt>PS</dt><dd>' + esc(k.ps || '—') + '</dd><dt>Ilustrador</dt><dd>' + esc(k.ilustrador || '—') + '</dd></dl>' +
    '<button class="btn" onclick="alternarTenho()">' + (y ? '✓ Tenho esta carta' : 'Marcar como tenho') + '</button></div></div>';
  modal.hidden = false;
  // inclinação leve, só quando o mouse está sobre a carta
  var el = document.getElementById('c3d'), palco = modal.querySelector('.palco'), MAX = 7;
  palco.onmousemove = function (e) {
    var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, yy = (e.clientY - r.top) / r.height;
    x = Math.max(0, Math.min(1, x)); yy = Math.max(0, Math.min(1, yy));
    el.style.transform = 'rotateY(' + ((x - .5) * MAX * 2) + 'deg) rotateX(' + ((.5 - yy) * MAX * 2) + 'deg)';
    el.style.setProperty('--mx', x * 100 + '%'); el.style.setProperty('--my', yy * 100 + '%');
  };
  palco.onmouseleave = function () { el.style.transform = ''; };
  modal.onclick = function (e) { if (e.target === modal) fecharCarta(); };
}
// Botão "Marcar como tenho" dentro da janela
function alternarTenho() {
  var id = cartaAberta.col, l = ESTADO.tenho[id] || [], i = l.indexOf(cartaAberta.k.id);
  if (i > -1) l.splice(i, 1); else l.push(cartaAberta.k.id);
  ESTADO.tenho[id] = l; salvarTenho();
  document.querySelector('.info .btn').textContent = i < 0 ? '✓ Tenho esta carta' : 'Marcar como tenho';
}
// Fecha a janela, redesenha a grade e volta para a mesma posição da página
function fecharCarta() {
  modal.hidden = true;
  var y = window.scrollY; desenharColecao(); window.scrollTo(0, y);
}
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) fecharCarta(); });
