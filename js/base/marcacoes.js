// js/base/marcacoes.js
// CARTAS QUE A PESSOA TEM E AS REPETIDAS
// ============================================================
// ESTADO.tenho     = { 'me04': ['me04-001', 'me04-015', ...], ... }   cartas marcadas
// ESTADO.repetidas = { 'me04': { 'me04-001': 2 }, ... }              cópias a mais de cada carta
// Ficam no navegador (localStorage) e, com conta, também na conta (js/base/nuvem.js).
// ============================================================

ESTADO.tenho = lerJSON('carddex_tenho') || {};
ESTADO.repetidas = lerJSON('carddex_repetidas') || {};

// Grava no navegador e agenda o envio para a conta (se estiver logado)
function salvarTenho() { try { localStorage.setItem('carddex_tenho', JSON.stringify(ESTADO.tenho)); } catch (e) {} nuvemAgendar(); }
function salvarRepetidas() { try { localStorage.setItem('carddex_repetidas', JSON.stringify(ESTADO.repetidas)); } catch (e) {} nuvemAgendar(); }

// Contagens
function temCarta(col, k) { return (ESTADO.tenho[col] || []).indexOf(k) > -1; }
function qtdTenho(col) { return (ESTADO.tenho[col] || []).length; }
function totalTenho() { return Object.keys(ESTADO.tenho).reduce(function (a, c) { return a + ESTADO.tenho[c].length; }, 0); }
function resumoSerie(s) {
  var t = 0, m = 0;
  s.colecoes.forEach(function (c) { t += c.total; m += qtdTenho(c.id); });
  return { total: t, tenho: m, pct: pct(m, t) };
}

// Marca ou desmarca uma carta. Devolve true se agora tem.
// Ao desmarcar, a carta também sai da vitrine e perde as repetidas.
function alternarMarcacao(col, k) {
  var l = ESTADO.tenho[col] || (ESTADO.tenho[col] = []), i = l.indexOf(k);
  if (i > -1) l.splice(i, 1); else l.push(k);
  salvarTenho();
  if (i > -1) {
    conferirVitrine(col, k);
    if (qtdRepetida(col, k)) mudarRepetida(col, k, 0);
  }
  return i < 0;
}

// REPETIDAS (de 0 a 99 por carta)
function qtdRepetida(col, k) { return (ESTADO.repetidas[col] || {})[k] || 0; }
function mudarRepetida(col, k, n) {
  var m = ESTADO.repetidas[col] || (ESTADO.repetidas[col] = {});
  if (n > 0) m[k] = Math.min(n, 99); else delete m[k];
  if (!Object.keys(m).length) delete ESTADO.repetidas[col];
  salvarRepetidas();
}
// Soma (+1) ou tira (-1) uma repetida e devolve a quantidade nova
function somarRepetida(col, k, d) {
  var n = Math.max(0, Math.min(99, qtdRepetida(col, k) + d));
  mudarRepetida(col, k, n);
  return n;
}
