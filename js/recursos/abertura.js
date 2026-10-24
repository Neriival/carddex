// js/recursos/abertura.js
// ANIMAÇÃO LEVE AO ABRIR O SITE
// ============================================================
// A tela de abertura (<div id="abertura"> no index.html, estilo em css/componentes/abertura.css)
// aparece logo que a página abre. Quando a primeira tela fica pronta (js/main.js chama fecharAbertura),
// ela some esmaecendo e o conteúdo entra subindo de leve.
// Fica pelo menos TEMPO_MINIMO na tela, para a animação do logo não ser cortada no meio.
// ============================================================

var ABERTURA_INICIO = Date.now();
var TEMPO_MINIMO = 900; // milissegundos

// Esconde a abertura (pode ser chamada mais de uma vez: só a primeira vale)
function fecharAbertura() {
  var el = document.getElementById('abertura');
  if (!el || el.dataset.fechando) return;
  el.dataset.fechando = 1;
  setTimeout(function () {
    el.classList.add('saindo');
    document.body.classList.add('abriu');
    // tira do HTML depois que terminar de esmaecer
    setTimeout(function () {
      el.remove();
    }, 600);
  }, Math.max(0, TEMPO_MINIMO - (Date.now() - ABERTURA_INICIO)));
}
