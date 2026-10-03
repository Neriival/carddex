// js/nuvem.js
// CARTAS MARCADAS NA CONTA (Supabase, tabela "colecoes")
// ============================================================
// O navegador continua guardando uma cópia (localStorage) para o site abrir rápido.
// Logado: cada marcação é enviada para a conta logo depois (espera 0,8 s para juntar cliques seguidos).
// Ao entrar: o que estava marcado sem conta é JUNTADO com o que já estava na conta (nada se perde).
// Ao voltar para a aba: baixa de novo, para ver o que foi marcado em outro aparelho.
// ============================================================
var nuvemTimer = null;

function logadoNaNuvem() { return !!(sb && AUTH._u); }
// 'carddex_pendente' = há marcações que ainda não chegaram na conta (ex.: fechou a aba logo depois de marcar)
function nuvemPendente() { try { return localStorage.getItem('carddex_pendente') === '1'; } catch (e) { return false; } }
function marcarPendente(p) { try { if (p) localStorage.setItem('carddex_pendente', '1'); else localStorage.removeItem('carddex_pendente'); } catch (e) {} }

// Chamado por salvarTenho() (js/dados.js) a cada marcação
function nuvemAgendar() {
  if (!logadoNaNuvem()) return;
  marcarPendente(true);
  clearTimeout(nuvemTimer);
  nuvemTimer = setTimeout(nuvemEnviar, 800);
}

async function nuvemEnviar() {
  clearTimeout(nuvemTimer); nuvemTimer = null;
  if (!logadoNaNuvem() || !nuvemPendente()) return;
  var r = await sb.from('colecoes').upsert({ user_id: AUTH._u.id, tenho: ESTADO.tenho, repetidas: ESTADO.repetidas, atualizado_em: new Date().toISOString() });
  if (!r.error) marcarPendente(false);
}

// Baixa as marcações (e repetidas) da conta. juntar = true soma com o que está no navegador e envia o resultado.
async function nuvemPuxar(juntar) {
  if (!logadoNaNuvem()) return false;
  var r = await sb.from('colecoes').select('tenho,repetidas').eq('user_id', AUTH._u.id).maybeSingle();
  if (r.error) return false;
  var conta = (r.data && r.data.tenho) || {}, rep = (r.data && r.data.repetidas) || {};
  var naConta = JSON.stringify([conta, rep]), antes = JSON.stringify([ESTADO.tenho, ESTADO.repetidas]);
  if (juntar) {
    Object.keys(ESTADO.tenho).forEach(function (col) {
      var l = conta[col] || (conta[col] = []);
      (ESTADO.tenho[col] || []).forEach(function (id) { if (l.indexOf(id) < 0) l.push(id); });
    });
    // repetidas: fica a maior quantidade de cada carta
    Object.keys(ESTADO.repetidas).forEach(function (col) {
      var m = rep[col] || (rep[col] = {});
      Object.keys(ESTADO.repetidas[col] || {}).forEach(function (k) { m[k] = Math.max(m[k] || 0, ESTADO.repetidas[col][k]); });
    });
  }
  ESTADO.tenho = conta; ESTADO.repetidas = rep;
  try { localStorage.setItem('carddex_tenho', JSON.stringify(conta)); localStorage.setItem('carddex_repetidas', JSON.stringify(rep)); } catch (e) {}
  if (juntar && (!r.data || naConta !== JSON.stringify([conta, rep]))) { marcarPendente(true); await nuvemEnviar(); }
  else marcarPendente(false);
  return antes !== JSON.stringify([conta, rep]);
}

// Ao sair da conta: as marcações saem deste navegador (continuam salvas na conta)
function limparMarcacoes() {
  ESTADO.tenho = {}; ESTADO.repetidas = {}; marcarPendente(false);
  try { localStorage.removeItem('carddex_tenho'); localStorage.removeItem('carddex_repetidas'); } catch (e) {}
}

// Saindo da aba: envia na hora o que falta. Voltando: baixa as novidades de outro aparelho e redesenha.
document.addEventListener('visibilitychange', async function () {
  if (!logadoNaNuvem()) return;
  if (document.hidden) { nuvemEnviar(); return; }
  if (nuvemPendente() || !modal.hidden) return;
  if (await nuvemPuxar(false) && ESTADO.redesenhar) ESTADO.redesenhar();
});
