// js/base/util.js
// AJUDANTES usados no site inteiro (carregado logo depois do config.js).
// ============================================================
// Nada aqui depende de outras partes do site: são funções pequenas de texto, números e menu.
// ============================================================

// Elemento onde todas as telas são desenhadas (<main id="app"> no index.html)
var app = document.getElementById('app');

// Completa com zeros à esquerda: pad(7) → '007', pad(4, 2) → '04'
function pad(n, l) { return ('0000' + n).slice(-(l || 3)); }

// Protege um texto antes de colocar no HTML (evita que nomes com < ou " quebrem a página)
function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;'); }

// Porcentagem arredondada (sem dividir por zero) e a barra de progresso azul → dourada
function pct(n, t) { return t ? Math.round(n / t * 100) : 0; }
function barra(p) { return '<div class="barra"><i style="width:' + p + '%"></i></div>'; }
// Progresso completo: "4 de 188 cartas" + porcentagem em destaque + barra grossa ("✓ Completa" em 100%)
function progresso(n, t) {
  var p = pct(n, t), completa = t && n >= t;
  return '<div class="progresso' + (completa ? ' completa' : '') + '"><div class="progresso-txt"><span>' + n + ' de ' + t + ' cartas</span><b>' + (completa ? '✓ Completa' : p + '%') + '</b></div>' + barra(p) + '</div>';
}

// '2026-05-22' → '22/05/2026'
function dataBR(d) { var p = d.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }

// Lista sem repetidos e sem vazios, em ordem alfabética (usada nos filtros de raridade e tipo)
function unicos(l) { return l.filter(function (x, i) { return x && l.indexOf(x) === i; }).sort(function (a, b) { return a.localeCompare(b, 'pt'); }); }

// Lê um JSON guardado no navegador (null se não existir ou estiver corrompido)
function lerJSON(chave) { try { return JSON.parse(localStorage.getItem(chave) || 'null'); } catch (e) { return null; } }

// Deixa sublinhado o link do menu da tela atual: 0 Início, 1 Séries, 2 Minhas cartas, 3 Ranking, 4 Admin, -1 nenhum
function marcarMenu(n) {
  [].forEach.call(document.querySelectorAll('.links a'), function (a, i) { a.classList.toggle('on', i === n); });
}

// Logo da coleção: se o .webp não existir, tenta o .svg; se também não existir, esconde a imagem
function logoAlt(img) {
  if (!img.dataset.tentou) { img.dataset.tentou = 1; img.src = img.src.replace('.webp', '.svg'); }
  else img.remove();
}
