// js/main.js
// Ponto de entrada: lê as séries e a sessão, e mostra o login (se ainda não escolheu) ou a tela inicial
carregarParceiros();
Promise.all([carregarSeries(), AUTH.iniciar()]).then(function () {
  atualizarConta();
  if (RECUPERANDO && AUTH.usuario()) telaLogin('nova-senha');
  else if (AUTH.usuario() || (AUTH.convidado() && location.hash !== '#admin')) entrarNoApp();
  else telaLogin();
}).catch(function () {
  document.getElementById('app').innerHTML = '<div class="aviso">Não foi possível ler dados/series.json. Abra o projeto por um servidor (Live Server do VS Code ou GitHub Pages), não direto pelo arquivo.</div>';
});

// App instalável (área de trabalho / tela inicial do celular)
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
