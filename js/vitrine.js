// js/vitrine.js
// VITRINE E PERFIL PÚBLICO
// ============================================================
// Cada conta escolhe até 5 cartas que tem para mostrar no perfil (botão "Pôr na vitrine" na carta grande).
// O perfil público mostra só: personagem/foto, nick, posição no ranking, total de cartas e a vitrine.
// Ele abre pelo ranking ou pelo link …/#perfil/<nick> (dá para mandar no WhatsApp).
// O banco confere que só entram cartas marcadas como "tenho" (docs/supabase.sql).
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
function gradeVitrine(cartas, clicavel) {
  return '<div class="vitrine">' + cartas.map(function (v) {
    var src = v.k.mini || v.k.imagem;
    return '<button class="carta-vitrine" ' + (clicavel ? 'onclick="abrirDaVitrine(\'' + v.c + '\',\'' + esc(v.k.id) + '\')"' : 'disabled') + ' title="' + esc(v.k.nome) + '">' +
      (src ? '<img loading="lazy" src="' + esc(src) + '" alt="' + esc(v.k.nome) + '">' : '<span>' + esc(v.k.numero) + '</span>') + '</button>';
  }).join('') + '</div>';
}
function abrirDaVitrine(c, k) { abrirCarta(c, k, 0, true); }

// TELA – Perfil público de alguém
async function telaPerfilPublico(nick) {
  document.body.classList.remove('na-login');
  ESTADO.redesenhar = null; marcarMenu(-1); vitrineAberta = null;
  var volta = '<h2><button class="voltar" onclick="telaRanking()">← Ranking</button></h2>';
  if (!sb) { app.innerHTML = volta + '<div class="aviso">Os perfis aparecem quando o site estiver ligado ao banco de dados.</div>'; return; }
  app.innerHTML = volta + '<p class="sub">Carregando perfil...</p>'; window.scrollTo(0, 0);
  var r = await sb.rpc('perfil_publico', { n: nick }), p = r.data;
  if (r.error || !p) { app.innerHTML = volta + '<div class="aviso">Não encontramos o colecionador "' + esc(nick) + '".</div>'; return; }
  var cartas = await cartasDaVitrine(p.vitrine || []);
  vitrineAberta = cartas.map(function (v) { return { c: v.c, k: v.k.id }; });
  var u = AUTH.usuario();
  app.innerHTML = volta + '<section class="perfil-pub">' + avatarDe(p, 'perfil-avatar') + '<div class="perfil-dados"><h2>' + esc(p.nick) + (p.eu ? ' <small>(você)</small>' : '') + '</h2>' +
    '<div class="perfil-numeros">' + (p.posicao ? '<span><b>' + p.posicao + 'º</b> no ranking</span>' : '') + '<span><b>' + p.total + '</b> cartas</span></div>' +
    '<div class="perfil-acoes"><button class="btn" onclick="compartilharPerfil(\'' + esc(p.nick) + '\')">Compartilhar perfil</button>' + (p.eu ? '<button class="btn btn-sec" onclick="telaPerfil()">Editar meu perfil</button>' : '') + '</div>' +
    '<p class="sub" id="msg-compartilhar" role="status"></p></div></section>' +
    '<h2>Vitrine</h2><span class="sub">' + (p.eu ? 'Suas cartas favoritas ou mais raras. ' : 'As cartas que ' + esc(p.nick) + ' mais gosta. ') + 'Toque para ver em tamanho grande.</span>' +
    (cartas.length ? gradeVitrine(cartas, true) : '<div class="aviso">' + (p.eu ? 'Sua vitrine está vazia. Abra uma carta que você tem e toque em <b>☆ Pôr na vitrine</b>.' : esc(p.nick) + ' ainda não escolheu as cartas da vitrine.') + '</div>') +
    (!u ? '<div class="rank-eu"><b>Monte a sua vitrine também</b><span class="sub">Crie uma conta grátis, marque suas cartas e mostre as mais raras.</span><button class="btn" onclick="telaLogin(\'criar\')">Criar conta</button></div>' : '');
}

// Link do perfil: no celular abre o menu de compartilhar; no computador copia o link
function linkPerfil(nick) { return location.origin + location.pathname + '#perfil/' + encodeURIComponent(nick); }
async function compartilharPerfil(nick) {
  var url = linkPerfil(nick), texto = 'Olha a minha coleção de cartas no CardDex!', msg = document.getElementById('msg-compartilhar');
  if (navigator.share && matchMedia('(hover:none)').matches) { try { await navigator.share({ title: 'CardDex – ' + nick, text: texto, url: url }); } catch (e) {} return; }
  try { await navigator.clipboard.writeText(url); msg.innerHTML = 'Link copiado! Cole onde quiser, ou <a href="https://wa.me/?text=' + encodeURIComponent(texto + ' ' + url) + '" target="_blank" rel="noopener">mande no WhatsApp</a>.'; }
  catch (e) { msg.innerHTML = 'Seu link: <b>' + esc(url) + '</b>'; }
}

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
async function tirarDaVitrine(c, k) {
  try { await salvarVitrine(minhaVitrine().filter(function (v) { return !(v.c === c && v.k === k); })); } catch (e) {}
  desenharMinhaVitrine();
}

// Link …/#perfil/<nick> aberto com o site já aberto
window.addEventListener('hashchange', function () {
  var m = /^#perfil\/(.+)$/.exec(location.hash);
  if (m) telaPerfilPublico(decodeURIComponent(m[1]));
});
