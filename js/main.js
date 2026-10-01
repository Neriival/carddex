// js/main.js
// Ponto de entrada
// PONTO DE ENTRADA: lê as séries e mostra a tela inicial
carregarSeries().then(function () { telaInicio(); }).catch(function () {
  document.getElementById('app').innerHTML = '<div class="aviso">Não foi possível ler dados/series.json. Abra o projeto por um servidor (Live Server do VS Code ou GitHub Pages), não direto pelo arquivo.</div>';
});
