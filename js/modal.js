// js/modal.js
// Carta em tamanho grande: brilho suave, inclinação 3D e arrastar para o lado (próxima/anterior)
// ============================================================
// CARTA GRANDE (janela que abre ao clicar na imagem)
// Para ajustar a inclinação 3D, mude MAX (graus) em abrirCarta().
// Para ajustar a sensibilidade do arrastar, mude DIST_TROCA (pixels) mais abaixo.
// A animação de abertura fica em css/componentes.css (@keyframes abrir).
// ============================================================

var modal = document.getElementById('modal'), cartaAberta = null, tokenModal = 0, arr = null, arrastou = false;
var DIST_TROCA = 70;

// 'dir' (opcional): 1 = veio da próxima carta, -1 = veio da anterior (só muda a animação)
async function abrirCarta(colId, cartaId, dir) {
  var c = acharColecao(colId), s = acharSerie(c.serie), lista = ESTADO.cartas[colId], tok = ++tokenModal;
  var i = lista.findIndex(function (x) { return x.id === cartaId; }), k = lista[i];
  await detalhesCarta(k);
  if (tok !== tokenModal) return; // o usuário já foi para outra carta
  cartaAberta = { col: colId, k: k, i: i };
  var y = (ESTADO.tenho[colId] || []).indexOf(k.id) > -1;
  var tipo = (k.tipos || []).join(', ') || k.categoria || '—';
  var animC = dir ? ' style="animation:' + (dir > 0 ? 'deslizarDir' : 'deslizarEsq') + ' .28s ease-out"' : '', animI = dir ? ' style="animation:none"' : '';
  modal.innerHTML = '<button class="fechar" onclick="fecharCarta()" aria-label="Fechar">×</button>' +
    '<button class="nav-carta ant" onclick="navegarCarta(-1)" aria-label="Carta anterior"' + (i === 0 ? ' disabled' : '') + '>‹</button>' +
    '<button class="nav-carta prox" onclick="navegarCarta(1)" aria-label="Próxima carta"' + (i === lista.length - 1 ? ' disabled' : '') + '>›</button>' +
    '<div class="caixa"><div class="palco"><div class="carta3d" id="c3d"' + animC + '>' +
    (k.imagem ? '<img draggable="false" src="' + esc(k.imagem) + '" alt="' + esc(k.nome) + '">' : '<div class="ph">' + esc(k.numero) + '</div>') + '<div class="brilho"></div></div><p class="dica sub">‹ Arraste para o lado para ver as outras cartas ›</p></div>' +
    '<div class="info"' + animI + '><h3>' + esc(k.nome) + '</h3><span class="sub">' + esc(c.nome) + '</span><dl><dt>Número</dt><dd>' + esc(k.numero) + ' de ' + lista.length + '</dd><dt>Série</dt><dd>' + esc(s.nome) + '</dd><dt>Raridade</dt><dd>' + esc(k.raridade || '—') + '</dd><dt>Tipo</dt><dd>' + esc(tipo) + '</dd><dt>PS</dt><dd>' + esc(k.ps || '—') + '</dd><dt>Ilustrador</dt><dd>' + esc(k.ilustrador || '—') + '</dd></dl>' +
    '<button class="btn" onclick="alternarTenho()">' + (y ? '✓ Tenho esta carta' : 'Marcar como tenho') + '</button></div></div>';
  modal.hidden = false; modal.scrollTop = 0;
  // já carrega as imagens vizinhas para a troca ser instantânea
  [lista[i - 1], lista[i + 1]].forEach(function (v) { if (v && v.imagem) new Image().src = v.imagem; });
  // inclinação leve, só quando o mouse está sobre a carta
  var el = document.getElementById('c3d'), palco = modal.querySelector('.palco'), MAX = 7;
  palco.onmousemove = function (e) {
    if (arr && arr.ativo) return;
    var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, yy = (e.clientY - r.top) / r.height;
    x = Math.max(0, Math.min(1, x)); yy = Math.max(0, Math.min(1, yy));
    el.style.transform = 'rotateY(' + ((x - .5) * MAX * 2) + 'deg) rotateX(' + ((.5 - yy) * MAX * 2) + 'deg)';
    el.style.setProperty('--mx', x * 100 + '%'); el.style.setProperty('--my', yy * 100 + '%');
  };
  palco.onmouseleave = function () { if (!(arr && arr.ativo)) el.style.transform = ''; };
  modal.onclick = function (e) { if (e.target === modal && !arrastou) fecharCarta(); };
}

// Vai para a carta seguinte (+1) ou anterior (-1). Devolve false se não há mais cartas.
function navegarCarta(d) {
  if (!cartaAberta) return false;
  var l = ESTADO.cartas[cartaAberta.col], n = cartaAberta.i + d;
  if (n < 0 || n >= l.length) return false;
  abrirCarta(cartaAberta.col, l[n].id, d);
  return true;
}

// ARRASTAR PARA O LADO (dedo no celular ou mouse). Arrastar para a esquerda = próxima carta.
modal.addEventListener('pointerdown', function (e) {
  var el = document.getElementById('c3d');
  if (!el || (e.pointerType === 'mouse' && e.button !== 0) || e.target.closest('button,input,a')) return;
  arr = { x: e.clientX, y: e.clientY, dx: 0, el: el, id: e.pointerId, ativo: false };
});
modal.addEventListener('pointermove', function (e) {
  if (!arr || e.pointerId !== arr.id) return;
  var dx = e.clientX - arr.x, dy = e.clientY - arr.y;
  if (!arr.ativo) {
    if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return; // ainda não é um arrasto horizontal
    arr.ativo = true; arr.el.style.transition = 'none';
    try { modal.setPointerCapture(e.pointerId); } catch (x) {}
  }
  var fim = (dx > 0 && cartaAberta.i === 0) || (dx < 0 && cartaAberta.i === ESTADO.cartas[cartaAberta.col].length - 1);
  arr.dx = fim ? dx * .3 : dx; // nas pontas, a carta "resiste"
  arr.el.style.transform = 'translateX(' + arr.dx + 'px) rotate(' + arr.dx / 25 + 'deg)';
});
function soltarArrasto(e) {
  if (!arr || e.pointerId !== arr.id) return;
  var a = arr; arr = null;
  if (!a.ativo) return;
  arrastou = true; setTimeout(function () { arrastou = false; }, 0); // evita fechar a janela ao soltar
  a.el.style.transition = '';
  if (e.type === 'pointerup' && Math.abs(a.dx) > DIST_TROCA && navegarCarta(a.dx < 0 ? 1 : -1)) return;
  a.el.style.transform = '';
}
modal.addEventListener('pointerup', soltarArrasto);
modal.addEventListener('pointercancel', soltarArrasto);

// Botão "Marcar como tenho" dentro da janela
function alternarTenho() {
  var id = cartaAberta.col, l = ESTADO.tenho[id] || [], i = l.indexOf(cartaAberta.k.id);
  if (i > -1) l.splice(i, 1); else l.push(cartaAberta.k.id);
  ESTADO.tenho[id] = l; salvarTenho();
  document.querySelector('.info .btn').textContent = i < 0 ? '✓ Tenho esta carta' : 'Marcar como tenho';
}
// Fecha a janela, redesenha a tela (coleção ou Minhas cartas) e volta para a mesma posição da página
function fecharCarta() {
  tokenModal++; modal.hidden = true;
  var y = window.scrollY; if (ESTADO.redesenhar) ESTADO.redesenhar(); window.scrollTo(0, y);
}
document.addEventListener('keydown', function (e) {
  if (modal.hidden) return;
  if (e.key === 'Escape') fecharCarta();
  else if (e.key === 'ArrowRight') navegarCarta(1);
  else if (e.key === 'ArrowLeft') navegarCarta(-1);
});
