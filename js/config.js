// js/config.js
// CONFIGURAÇÕES DO CARDDEX (carregado antes de todos os outros .js)
// ============================================================
// SUPABASE (contas, cartas na conta, ranking, perfis e painel adm)
// Os dois valores ficam em supabase.com → projeto carddex → Project Settings → API Keys.
// A chave pública (publishable) pode ficar no site: quem protege os dados são as regras do banco (docs/supabase.sql).
// Se ficarem vazios, o site funciona sem banco (tudo só no navegador, sem ranking).
// Passo a passo completo em docs/SUPABASE.md
// ============================================================
var CONFIG = {
  supabaseUrl: 'https://fqynjcaiwmeprxkzfwed.supabase.co',
  supabaseChave: 'sb_publishable_pifwr2rO0xGKEBV8tfOFrA_96tyuozl' // chave pública (publishable)
};

// Cliente do banco (null = Supabase ainda não configurado)
var sb = window.supabase && /^https:\/\//.test(CONFIG.supabaseUrl) && CONFIG.supabaseChave ?
  window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseChave) : null;

// Link do e-mail "Esqueci minha senha": o site abre direto na tela de senha nova
var RECUPERANDO = /type=recovery/.test(location.hash);
if (sb) sb.auth.onAuthStateChange(function (evento) {
  if (evento === 'PASSWORD_RECOVERY') RECUPERANDO = true;
});
