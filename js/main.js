// js/main.js
// Ponto de entrada: lê as séries e mostra o login (se ainda não escolheu) ou a tela inicial
atualizarConta();
carregarSeries().then(function () {
  if (AUTH.usuario() || AUTH.convidado()) telaInicio(); else telaLogin();
}).catch(function () {
  document.getElementById('app').innerHTML = '<div class="aviso">Não foi possível ler dados/series.json. Abra o projeto por um servidor (Live Server do VS Code ou GitHub Pages), não direto pelo arquivo.</div>';
});
