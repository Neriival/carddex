// js/recursos/vitrine.js
// VITRINE: até 5 cartas que a pessoa escolhe para mostrar no perfil público
// ============================================================
// Botão "Pôr na vitrine" na carta grande; "Minha vitrine" no Meu perfil (com × para tirar).
// O banco confere que só entram cartas marcadas como "tenho" (docs/supabase.sql).
// A tela do perfil público fica em js/telas/perfil-publico.js.
// ============================================================
var VITRINE_MAX = 5;
var vitrineAberta = null; // cartas da vitrine que está sendo vista (para navegar entre elas na carta grande)

function minhaVitrine() { return (AUTH._u && AUTH._u.vitrine) || []; }
function naVitrine(c, k) { return minhaVitrine().some(function (v) { return v.c === c && v.k === k; }); }

// Grava a vitrine na conta. As marcações vão antes, porque o banco confere se a carta está marcada.
async function salvarVitrine(nova) {
  marcarPendente(true); await nuvemEnviar();
  var r = await sb.from('perfis').update({ vitrine: nova }).eq('id', AUTH._u.id);
  if (r.error) throw new Error(/tenho/.test(r.error.message) ? 'Só dá para pôr na vitrine cartas que você marcou como "tenho".' : 'Não foi possível salvar a vitrine. Tente de novo.');
  AUTH._u.vitrine = nova;
}

// Botão da carta grande: põe ou tira a carta aberta da vitrine
async function alternarVitrine(btn) {
  var c = cartaAberta.col, k = cartaAberta.k.id, msg = modal.querySelector('.msg-vitrine'), l = minhaVitrine().slice();
  var tem = naVitrine(c, k);
  if (!tem && l.length >= VITRINE_MAX) { msg.textContent = 'Sua vitrine já tem ' + VITRINE_MAX + ' cartas. Tire uma no "Meu perfil" para pôr esta.'; return; }
  btn.disabled = true; msg.textContent = '';
  try {
    await salvarVitrine(tem ? l.filter(function (v) { return !(v.c === c && v.k === k); }) : l.concat([{ c: c, k: k }]));
    btn.textContent = tem ? '☆ Pôr na vitrine' : '★ Na vitrine (tirar)';
    btn.classList.toggle('on', !tem);
    msg.textContent = tem ? '' : 'Pronto! ' + minhaVitrine().length + ' de ' + VITRINE_MAX + ' na sua vitrine.';
  } catch (e) { msg.textContent = e.message; }
  btn.disabled = false;
}
// Botão da carta grande (só para quem está logado e tem a carta)
function botaoVitrine(c, k, tenho) {
  if (!logadoNaNuvem() || !tenho) return '';
  var on = naVitrine(c, k.id);
  return '<button class="btn btn-sec btn-vitrine' + (on ? ' on' : '') + '" onclick="alternarVitrine(this)">' + (on ? '★ Na vitrine (tirar)' : '☆ Pôr na vitrine') + '</button><p class="sub msg-vitrine" role="status"></p>';
}

// Ao desmarcar uma carta que estava na vitrine, ela sai da vitrine também
function conferirVitrine(c, k) {
  if (!logadoNaNuvem() || !naVitrine(c, k)) return;
  salvarVitrine(minhaVitrine().filter(function (v) { return !(v.c === c && v.k === k); })).catch(function () {});
}

// Busca os dados de cada carta da vitrine (nome e imagem vêm dos arquivos da coleção)
async function cartasDaVitrine(lista) {
  var r = await Promise.all(lista.map(async function (v) {
    var col = acharColecao(v.c);
    if (!col) return null;
    try { await carregarCartas(col); } catch (e) { return null; }
    var k = ESTADO.cartas[v.c].filter(function (x) { return x.id === v.k; })[0];
    return k ? { c: v.c, k: k } : null;
  }));
  return r.filter(Boolean);
}
// As cartas da vitrine lado a lado (clicavel = abre a carta grande)
function gradeVitrine(cartas, clicavel) {
  return '<div class="vitrine">' + cartas.map(function (v) {
    var src = v.k.mini || v.k.imagem;
    return '<button class="carta-vitrine" ' + (clicavel ? 'onclick="abrirDaVitrine(\'' + v.c + '\',\'' + esc(v.k.id) + '\')"' : 'disabled') + ' title="' + esc(v.k.nome) + '">' +
      (src ? '<img loading="lazy" src="' + esc(src) + '" alt="' + esc(v.k.nome) + '">' : '<span>' + esc(v.k.numero) + '</span>') + '</button>';
  }).join('') + '</div>';
}
// Abre a carta grande navegando só entre as cartas da vitrine
function abrirDaVitrine(c, k) { abrirCarta(c, k, 0, true); }

// Bloco "Minha vitrine" dentro do Meu perfil
async function desenharMinhaVitrine() {
  var box = document.getElementById('minha-vitrine'), u = AUTH._u;
  if (!box || !u) return;
  var cartas = await cartasDaVitrine(minhaVitrine());
  box.innerHTML = '<h3>Minha vitrine <small>' + cartas.length + ' de ' + VITRINE_MAX + '</small></h3>' +
    (cartas.length ? '<div class="vitrine vitrine-edit">' + cartas.map(function (v) {
      return '<div class="carta-vitrine"><img src="' + esc(v.k.mini || v.k.imagem) + '" alt="' + esc(v.k.nome) + '"><button class="tirar" onclick="tirarDaVitrine(\'' + v.c + '\',\'' + esc(v.k.id) + '\')" aria-label="Tirar ' + esc(v.k.nome) + ' da vitrine" title="Tirar da vitrine">×</button></div>';
    }).join('') + '</div>' : '<p class="sub">Abra uma carta que você tem e toque em <b>☆ Pôr na vitrine</b>.</p>') +
    (u.nick ? '<button class="btn btn-sec" type="button" onclick="telaPerfilPublico(\'' + esc(u.nick) + '\')">Ver meu perfil público</button>' : '');
}
// × de cada carta na Minha vitrine
async function tirarDaVitrine(c, k) {
  try { await salvarVitrine(minhaVitrine().filter(function (v) { return !(v.c === c && v.k === k); })); } catch (e) {}
  desenharMinhaVitrine();
}
