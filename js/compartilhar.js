// js/compartilhar.js
// Gera uma imagem com as cartas que faltam (ou as repetidas) da coleção atual e compartilha (WhatsApp)
// ============================================================
// COMPARTILHAR CARTAS QUE FALTAM
// Botão na tela da coleção → abrirCompartilhar() desenha a imagem num <canvas>
// e mostra uma prévia. No celular, "Compartilhar" abre o menu do sistema
// (é só escolher o WhatsApp). No computador, a imagem é baixada e o
// WhatsApp Web abre com a lista de números para você anexar a imagem.
// Para mudar o visual da imagem, mexa em desenharFaltantes().
// ============================================================

var IMG_LARGURA = 1080; // largura da imagem gerada (px), boa para o WhatsApp
var faltantes = null;   // { arquivo: File, url: 'blob:...', texto: '...' }

// Carrega uma imagem e devolve null se der erro (ex.: carta sem imagem)
function carregarImg(src) {
  return new Promise(function (ok) {
    if (!src) return ok(null);
    var img = new Image();
    if (/^https?:/.test(src)) img.crossOrigin = 'anonymous';
    img.onload = function () { ok(img); };
    img.onerror = function () { ok(null); };
    img.src = src;
  });
}
// Logo da coleção: .webp, se não existir tenta o .svg
async function logoColecao(c) {
  var base = 'assets/img/colecoes/' + c.serie + '/' + c.id;
  return (await carregarImg(base + '.webp')) || (await carregarImg(base + '.svg'));
}
// Corta o texto com "…" para caber na largura
function cortarTexto(ctx, t, larg) {
  if (ctx.measureText(t).width <= larg) return t;
  while (t.length > 1 && ctx.measureText(t + '…').width > larg) t = t.slice(0, -1);
  return t + '…';
}
function retanguloArredondado(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// Desenha a imagem e devolve o <canvas>
// 'filtro' (opcional): texto dos filtros de raridade/tipo ativos, aparece no título
// 'modo': 'repetidas' desenha as repetidas (com a quantidade de cada uma); sem modo, as que faltam
async function desenharFaltantes(c, lista, filtro, modo) {
  var rep = modo === 'repetidas', copias = lista.reduce(function (a, k) { return a + qtdRepetida(c.id, k.id); }, 0);
  var s = acharSerie(c.serie), total = cartasFiltradas(c).length;
  var W = IMG_LARGURA, M = 48, GAP = 14;
  var cols = lista.length <= 8 ? 4 : lista.length <= 24 ? 6 : lista.length <= 60 ? 8 : 10;
  var cw = (W - M * 2 - GAP * (cols - 1)) / cols, ch = cw * 7 / 5;
  var fonteRot = cols <= 6 ? 20 : cols <= 8 ? 17 : 15, rotH = fonteRot * 2.6;
  var topo = 300, linhas = Math.ceil(lista.length / cols) || 1;
  var H = topo + linhas * (ch + rotH + GAP) + 90;

  try { await document.fonts.load('800 40px Outfit'); await document.fonts.load('600 20px Outfit'); } catch (e) {}
  var imgs = await Promise.all([carregarImg('assets/img/carddex-logo.png'), logoColecao(c)].concat(lista.map(function (k) { return carregarImg(k.mini || k.imagem); })));
  var marca = imgs[0], logo = imgs[1], cartas = imgs.slice(2);

  var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  var ctx = cv.getContext('2d'), F = 'Outfit, system-ui, sans-serif';
  // fundo nas cores do site
  var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#011c52'); g.addColorStop(1, '#000d2f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // cabeçalho: marca CardDex + logo da coleção + título
  if (marca) { ctx.save(); ctx.beginPath(); ctx.arc(M + 28, 56, 28, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(marca, M, 28, 56, 56); ctx.restore(); }
  ctx.textBaseline = 'middle'; ctx.font = '800 30px ' + F;
  ctx.fillStyle = '#4aa3ff'; ctx.fillText('Card', M + 70, 58);
  ctx.fillStyle = '#ffc61a'; ctx.fillText('Dex', M + 70 + ctx.measureText('Card').width, 58);
  if (logo && logo.width) { // cabe numa caixa de 380x90, alinhado à direita
    var esc2 = Math.min(380 / logo.width, 90 / logo.height), lw = logo.width * esc2, lh = logo.height * esc2;
    ctx.drawImage(logo, W - M - lw, 56 - lh / 2, lw, lh);
  }
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#8fb4f0'; ctx.font = '600 24px ' + F;
  ctx.fillText(cortarTexto(ctx, (rep ? 'CARTAS REPETIDAS' : 'CARTAS QUE FALTAM') + (filtro ? '  ·  ' + filtro.toUpperCase() : ''), W - M * 2), M, 160);
  ctx.fillStyle = '#ffc61a'; ctx.font = '800 46px ' + F; ctx.fillText(cortarTexto(ctx, c.nome, W - M * 2), M, 212);
  ctx.fillStyle = '#eaf2ff'; ctx.font = '600 24px ' + F;
  ctx.fillText(cortarTexto(ctx, s.nome + '  ·  ' + (rep ? lista.length + ' carta' + (lista.length === 1 ? '' : 's') + ' repetida' + (lista.length === 1 ? '' : 's') + ' (' + copias + ' cópia' + (copias === 1 ? '' : 's') + ' para troca)' : 'Faltam ' + lista.length + ' de ' + total + ' cartas'), W - M * 2), M, 254);
  ctx.fillStyle = '#0f3f9e'; ctx.fillRect(M, 276, W - M * 2, 2);

  // grade de cartas
  lista.forEach(function (k, i) {
    var x = M + (i % cols) * (cw + GAP), y = topo + Math.floor(i / cols) * (ch + rotH + GAP);
    ctx.save(); retanguloArredondado(ctx, x, y, cw, ch, 8); ctx.clip();
    ctx.fillStyle = '#00143e'; ctx.fillRect(x, y, cw, ch);
    if (cartas[i]) ctx.drawImage(cartas[i], x, y, cw, ch);
    else { ctx.fillStyle = '#ffc61a'; ctx.font = '800 ' + Math.round(cw / 4) + 'px ' + F; ctx.textAlign = 'center'; ctx.fillText(k.numero, x + cw / 2, y + ch / 2); ctx.textAlign = 'left'; }
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffc61a'; ctx.font = '800 ' + fonteRot + 'px ' + F; ctx.fillText('Nº ' + k.numero + (rep ? '  ·  ' + qtdRepetida(c.id, k.id) + 'x' : ''), x + cw / 2, y + ch + fonteRot * 1.15);
    ctx.fillStyle = '#eaf2ff'; ctx.font = '400 ' + Math.round(fonteRot * .85) + 'px ' + F;
    ctx.fillText(cortarTexto(ctx, k.nome || '', cw), x + cw / 2, y + ch + fonteRot * 2.2);
    ctx.textAlign = 'left';
  });
  if (!lista.length) { ctx.fillStyle = '#ffc61a'; ctx.font = '800 40px ' + F; ctx.textAlign = 'center'; ctx.fillText(rep ? 'Nenhuma carta repetida' : 'Coleção completa!', W / 2, topo + 80); ctx.textAlign = 'left'; }

  // rodapé
  ctx.fillStyle = '#8fb4f0'; ctx.font = '400 20px ' + F; ctx.textAlign = 'center';
  ctx.fillText('Gerado pelo CardDex em ' + new Date().toLocaleDateString('pt-BR'), W / 2, H - 36);
  ctx.textAlign = 'left';
  return cv;
}

// Abre a janela com a prévia da imagem e os botões. modo = 'repetidas' para as repetidas.
async function abrirCompartilhar(modo) {
  var c = ESTADO.atual, meu = ESTADO.tenho[c.id] || [], filtro = rotuloFiltros(), rep = modo === 'repetidas';
  // respeita os filtros de raridade e tipo da tela (ex.: só as Ilustrações Raras que faltam)
  var lista = cartasFiltradas(c).filter(function (k) { return rep ? meu.indexOf(k.id) > -1 && qtdRepetida(c.id, k.id) > 0 : meu.indexOf(k.id) < 0; });
  cartaAberta = null; tokenModal++; // não deixa as setas do teclado abrirem cartas por baixo
  modal.onclick = function (e) { if (e.target === modal) fecharCompartilhar(); };
  modal.innerHTML = '<button class="fechar" onclick="fecharCompartilhar()" aria-label="Fechar">×</button><div class="share-box"><p class="sub">Gerando imagem...</p></div>';
  modal.hidden = false; modal.scrollTop = 0;

  var cv = await desenharFaltantes(c, lista, filtro, modo);
  var blob = await new Promise(function (ok) { cv.toBlob(ok, 'image/png'); });
  if (modal.hidden) return; // fechou enquanto gerava
  var box = modal.querySelector('.share-box');
  if (!blob) { box.innerHTML = '<div class="aviso">Não foi possível gerar a imagem neste navegador.</div>'; return; }
  if (faltantes) URL.revokeObjectURL(faltantes.url);
  var nome = 'carddex-' + c.id + (rep ? '-repetidas.png' : '-faltam.png'), serie = acharSerie(c.serie).nome;
  faltantes = {
    arquivo: new File([blob], nome, { type: 'image/png' }), url: URL.createObjectURL(blob), nome: nome,
    texto: rep ? (lista.length ? 'Cartas repetidas da coleção ' + c.nome + ' (' + serie + ')' + (filtro ? ' – ' + filtro : '') + ', para troca: ' + lista.map(function (k) { return k.numero + ' (' + qtdRepetida(c.id, k.id) + 'x)'; }).join(', ')
      : 'Não tenho cartas repetidas da coleção ' + c.nome + ' (' + serie + ').') : lista.length ? 'Cartas que faltam na coleção ' + c.nome + ' (' + acharSerie(c.serie).nome + ')' + (filtro ? ' – ' + filtro : '') + ': ' + lista.map(function (k) { return k.numero; }).join(', ')
      : (filtro ? 'Tenho todas as cartas ' + filtro + ' da coleção ' : 'Completei a coleção ') + c.nome + ' (' + acharSerie(c.serie).nome + ')!'
  };
  box.innerHTML = '<h3>' + (rep ? 'Cartas repetidas' : 'Cartas que faltam') + '</h3><span class="sub">' + esc(c.nome) + (filtro ? ' · ' + esc(filtro) : '') + ' · ' + lista.length + ' carta' + (lista.length === 1 ? '' : 's') + '</span>' +
    '<img class="share-prev" src="' + faltantes.url + '" alt="Imagem com as cartas ' + (rep ? 'repetidas' : 'que faltam') + ' em ' + esc(c.nome) + '">' +
    '<div class="share-acoes"><button class="btn" onclick="compartilharFaltantes()">Compartilhar no WhatsApp</button><button class="btn btn-sec" onclick="baixarFaltantes()">Baixar imagem</button></div>' +
    '<p class="sub share-msg" id="share-msg"></p>';
}

// Celular: menu de compartilhar do sistema (com a imagem). Computador: baixa e abre o WhatsApp Web.
async function compartilharFaltantes() {
  var f = faltantes, dados = { files: [f.arquivo], text: f.texto };
  if (navigator.canShare && navigator.canShare(dados)) {
    try { await navigator.share(dados); } catch (e) {}
    return;
  }
  baixarFaltantes();
  window.open('https://wa.me/?text=' + encodeURIComponent(f.texto), '_blank');
  document.getElementById('share-msg').textContent = 'A imagem foi baixada. No WhatsApp, anexe o arquivo ' + f.nome + '.';
}
function baixarFaltantes() {
  var a = document.createElement('a'); a.href = faltantes.url; a.download = faltantes.nome;
  document.body.appendChild(a); a.click(); a.remove();
}
function fecharCompartilhar() { modal.hidden = true; modal.innerHTML = ''; }
