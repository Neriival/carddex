// js/telas/colecao-de.js
// TELA – COLEÇÃO DE OUTRA PESSOA (só aparece se ela deixou a coleção aberta no "Meu perfil")
// ============================================================
// Mostra as cartas que a pessoa marcou, separadas por coleção, com as repetidas dela (+N)
// e um selo nas cartas que VOCÊ ainda não tem. É só para ver: não dá para marcar nada aqui.
// Filtros: Todas | Repetidas dela | Pra trocar comigo (repetidas dela que você não tem).
// Os dados vêm da função "colecao_de" do banco (docs/supabase.sql), que confere a permissão.
// ============================================================

var COLECAO_DE = null;    // { nick, avatar, foto, tenho, repetidas }
var FILTRO_DE = 'todas';  // todas | repetidas | troca

async function telaColecaoDe(nick) {
  ESTADO.redesenhar = null; marcarMenu(-1); vitrineAberta = null;
  var volta = '<h2><button class="voltar" onclick="telaPerfilPublico(\'' + esc(nick) + '\')">← Perfil de ' + esc(nick) + '</button></h2>';
  app.innerHTML = volta + '<p class="sub">Carregando coleção...</p>'; window.scrollTo(0, 0);
  var r = sb ? await sb.rpc('colecao_de', { n: nick }) : { data: null };
  if (r.error || !r.data) { app.innerHTML = volta + '<div class="aviso">A coleção de ' + esc(nick) + ' não está aberta para outras pessoas.</div>'; return; }
  COLECAO_DE = r.data; FILTRO_DE = 'todas';
  var cols = todasColecoes().filter(function (c) { return (COLECAO_DE.tenho[c.id] || []).length; });
  var series = cols.map(function (c) { return c.serie; }).filter(function (s, i, l) { return l.indexOf(s) === i; });
  await Promise.all(cols.map(function (c) { return carregarCartas(c).catch(function () {}); }).concat(series.map(carregarPrecos)));
  ESTADO.redesenhar = desenharColecaoDe;
  desenharColecaoDe();
}

function desenharColecaoDe() {
  var d = COLECAO_DE, navegar = [], total = 0, totalRep = 0;
  var blocos = ESTADO.series.map(function (s) {
    return s.colecoes.filter(function (c) { return (d.tenho[c.id] || []).length && ESTADO.cartas[c.id]; }).map(function (c) {
      var dela = d.tenho[c.id], rep = d.repetidas[c.id] || {};
      var cartas = ESTADO.cartas[c.id].filter(function (k) { return dela.indexOf(k.id) > -1; });
      total += cartas.length;
      cartas.forEach(function (k) { totalRep += rep[k.id] || 0; });
      if (FILTRO_DE !== 'todas') cartas = cartas.filter(function (k) { return rep[k.id] > 0 && (FILTRO_DE === 'repetidas' || !temCarta(c.id, k.id)); });
      if (!cartas.length) return '';
      cartas.forEach(function (k) { navegar.push({ c: c.id, k: k.id }); });
      var t = ESTADO.cartas[c.id].length, n = dela.length;
      return '<section class="minhas-col"><h3>' + esc(c.nome) + '</h3><span class="sub">' + esc(s.nome) + '</span>' + progresso(n, t) +
        '<div class="grade">' + cartas.map(function (k) { return cartaVisita(c, k, rep[k.id] || 0); }).join('') + '</div></section>';
    }).join('');
  }).join('');
  vitrineAberta = navegar; // a carta grande navega só entre as cartas mostradas
  var filtros = [['todas', 'Todas'], ['repetidas', 'Repetidas dela'], ['troca', 'Pra trocar comigo']].map(function (f) {
    return '<button class="' + (FILTRO_DE === f[0] ? 'on' : '') + '" onclick="FILTRO_DE=\'' + f[0] + '\';desenharColecaoDe()">' + f[1] + '</button>';
  }).join('');
  app.innerHTML = '<h2><button class="voltar" onclick="telaPerfilPublico(\'' + esc(d.nick) + '\')">← Perfil de ' + esc(d.nick) + '</button></h2>' +
    '<div class="colecao-de-topo">' + avatarDe(d, 'rank-avatar') + '<div><h2 class="titulo">Coleção de ' + esc(d.nick) + '</h2>' +
    '<span class="sub">' + total + ' cartas · ' + totalRep + ' repetidas. Toque numa carta para ver grande.</span></div></div>' +
    '<div class="filtros filtros-3">' + filtros + '</div>' +
    (FILTRO_DE === 'troca' ? '<p class="sub">Repetidas de ' + esc(d.nick) + ' que você ainda não marcou como "tenho".</p>' : '') +
    (blocos || '<div class="aviso">' + (FILTRO_DE === 'todas' ? esc(d.nick) + ' ainda não marcou cartas.' : 'Nenhuma carta com esse filtro.') + '</div>');
}

// Carta só para ver: repetidas dela (+N), selo "Você não tem" e o preço embaixo
function cartaVisita(c, k, rep) {
  var src = k.mini || k.imagem;
  return '<div class="carta-item"><button class="carta tenho visita" onclick="abrirDaVitrine(\'' + c.id + '\',\'' + k.id + '\')" title="Ver ' + esc(k.nome) + '">' +
    (src ? '<img loading="lazy" src="' + esc(src) + '" alt="' + esc(k.nome) + '">' : '<span>' + esc(k.numero) + '</span>') +
    (temCarta(c.id, k.id) ? '' : '<span class="falta-eu">Você não tem</span>') +
    (rep ? '<span class="rep-selo" title="' + rep + ' repetida' + (rep > 1 ? 's' : '') + '">+' + rep + '</span>' : '') + '</button>' +
    numGrade(c, k) + precoGrade(valorCarta(c, k.id)) + '</div>';
}
