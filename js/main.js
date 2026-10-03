// js/main.js
// PONTO DE ENTRADA (último script do index.html)
// ============================================================
// Lê as séries e a sessão da conta e decide a primeira tela:
// - link de perfil (…/#perfil/<nick>) → perfil público, mesmo sem conta
// - link do e-mail "Esqueci minha senha" → tela de senha nova
// - já entrou ou escolheu "Continuar sem conta" → site (ou o atalho do app: #admin, #minhas, #ranking)
// - primeira visita → tela de login
// ============================================================
carregarParceiros();
Promise.all([carregarSeries(), AUTH.iniciar()]).then(function () {
  atualizarConta();
  var perfil = /^#perfil\/(.+)$/.exec(location.hash);
  if (perfil) { history.replaceState(null, '', location.pathname); telaPerfilPublico(decodeURIComponent(perfil[1])); }
  else if (RECUPERANDO && AUTH.usuario()) telaLogin('nova-senha');
  else if (AUTH.usuario() || (AUTH.convidado() && location.hash !== '#admin')) entrarNoApp();
  else telaLogin();
}).catch(function (e) {
  console.error(e); // o erro de verdade aparece no console (F12)
  document.getElementById('app').innerHTML = '<div class="aviso">Não foi possível ler dados/series.json. Abra o projeto por um servidor (Live Server do VS Code ou GitHub Pages), não direto pelo arquivo.</div>';
});

// App instalável (área de trabalho / tela inicial do celular): veja sw.js e manifest.webmanifest
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
