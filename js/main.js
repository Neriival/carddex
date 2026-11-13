// js/main.js
// PONTO DE ENTRADA (último script do index.html)
// ============================================================
// Lê as séries e a sessão da conta e decide a primeira tela:
// - link de perfil (…/#perfil/<nick>) → perfil público, mesmo sem conta
// - link do e-mail "Esqueci minha senha" → tela de senha nova
// - já entrou, escolheu "Continuar sem conta" ou é a primeira visita → site como visitante
//   (ou o atalho do app: #admin, #minhas, #ranking). O visitante vê no início o convite para criar a conta.
// - atalho #admin sem estar conectado → tela de login
// Com a primeira tela pronta (ou se der erro), some a animação de abertura (js/recursos/abertura.js).
// ============================================================
Promise.all([carregarSeries(), AUTH.iniciar()]).then(function () {
  atualizarConta();
  var perfil = /^#perfil\/(.+)$/.exec(location.hash);
  if (perfil) {
    history.replaceState(null, '', location.pathname);
    telaPerfilPublico(decodeURIComponent(perfil[1]));
  } else if (RECUPERANDO && AUTH.usuario()) telaLogin('nova-senha');
  else if (location.hash === '#admin' && !AUTH.usuario()) telaLogin();
  else entrarNoApp();
}).catch(function (e) {
  console.error(e); // o erro de verdade aparece no console (F12)
  document.getElementById('app').innerHTML =
    '<div class="aviso">Não foi possível ler dados/series.json. Abra o projeto por um servidor (Live Server do VS Code ou GitHub Pages), não direto pelo arquivo.</div>';
}).then(fecharAbertura).then(function () {
  // no iPhone não há aviso do navegador: a faixa "Instale o CardDex" aparece uns segundos depois de abrir
  setTimeout(mostrarFaixaInstalar, 4000);
});

// App instalável (área de trabalho / tela inicial do celular): veja sw.js e manifest.webmanifest
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
