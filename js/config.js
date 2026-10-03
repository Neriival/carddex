// js/config.js
// CONFIGURAÇÕES DO CARDDEX (carregado antes de todos os outros .js)
// ============================================================
// SUPABASE (contas, cartas na conta, ranking, perfis, painel adm e parceiros)
// Os dois valores ficam em supabase.com → projeto carddex → Project Settings → API Keys.
// A chave pública (publishable) pode ficar no site: quem protege os dados são as regras do banco (docs/supabase.sql).
// Se ficarem vazios, o site funciona sem banco (tudo só no navegador, sem ranking nem parceiros).
// Passo a passo completo em docs/SUPABASE.md
// ============================================================
var CONFIG = {
  supabaseUrl: 'https://fqynjcaiwmeprxkzfwed.supabase.co',
  supabaseChave: 'sb_publishable_pifwr2rO0xGKEBV8tfOFrA_96tyuozl', // chave pública (publishable)
  // Para onde vai quem clica em "Seja um parceiro" (ex.: 'https://wa.me/5511999999999' ou 'mailto:voce@email.com').
  // Vazio = o quadrado aparece, mas sem link.
  contatoParceiro: 'https://wa.me/5513991258303?text=' + encodeURIComponent('Olá! Vi o CardDex e quero ser parceiro.')
};

// Cliente do banco (null = Supabase ainda não configurado)
var sb = window.supabase && /^https:\/\//.test(CONFIG.supabaseUrl) && CONFIG.supabaseChave
  ? window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseChave) : null;

// Link do e-mail "Esqueci minha senha": o site abre direto na tela de senha nova
var RECUPERANDO = /type=recovery/.test(location.hash);
if (sb) sb.auth.onAuthStateChange(function (evento) { if (evento === 'PASSWORD_RECOVERY') RECUPERANDO = true; });
