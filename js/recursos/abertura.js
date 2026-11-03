// js/recursos/abertura.js
// ABERTURA DO SITE
// ============================================================
// A tela de abertura (<div id="abertura"> no index.html, estilo em css/componentes/abertura.css)
// aparece logo que a página abre. Existem duas, e TIPO_ABERTURA escolhe qual o site usa:
// - 'video': o vídeo assets/video/abertura.mp4 (sem som, porque os navegadores só deixam tocar sozinho
//   vídeo mudo), com o botão "Pular".
// - 'logo': a abertura antiga, o logo crescendo com brilho dourado (guardada para comparar).
// Para ver a outra sem mudar o site, abra o endereço com ?abertura=logo ou ?abertura=video
// (ex.: https://neriival.github.io/carddex/?abertura=logo).
// Quem desativa animações no sistema não vê o vídeo (fica o logo parado, que some logo).
// Quando a primeira tela fica pronta (js/main.js chama fecharAbertura) E o vídeo acabou,
// a abertura some esmaecendo e o conteúdo entra subindo de leve.
// Este arquivo é carregado logo depois da <div id="abertura">, antes dos outros scripts,
// para o vídeo começar o quanto antes.
// ============================================================

var TIPO_ABERTURA = 'video'; // 'video' ou 'logo'

var ABERTURA_INICIO = Date.now();
var TEMPO_MINIMO = 900; // milissegundos (abertura do logo)
var VIDEO_LIMITE = 15000; // segurança: se o vídeo travar, a abertura some depois disso
var ABERTURA_VIDEO = iniciarVideoAbertura(); // promessa que termina quando o vídeo acaba (ou null)

// Qual abertura mostrar: a do endereço (?abertura=...) ou a de TIPO_ABERTURA
function tipoAbertura() {
  var m = /[?&]abertura=(video|logo)\b/.exec(location.search);
  var tipo = m ? m[1] : TIPO_ABERTURA;
  if (tipo === 'video' && window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return 'logo';
  return tipo;
}

// Troca o logo pelo vídeo e devolve uma promessa que termina quando o vídeo acaba, dá erro ou a pessoa pula
function iniciarVideoAbertura() {
  var el = document.getElementById('abertura');
  if (!el || tipoAbertura() !== 'video') return null;
  el.classList.add('com-video');
  el.removeAttribute('aria-hidden');
  el.innerHTML = '<video src="assets/video/abertura.mp4" autoplay muted playsinline preload="auto">' +
    '</video>' +
    '<button class="abertura-pular" type="button">Pular</button>';
  var v = el.querySelector('video');
  return new Promise(function (terminou) {
    v.onended = terminou;
    v.onerror = terminou;
    el.querySelector('button').onclick = function () {
      v.pause();
      terminou();
    };
    setTimeout(terminou, VIDEO_LIMITE);
    // alguns celulares (modo economia) bloqueiam o vídeo: aí segue sem ele
    var p = v.play();
    if (p && p.catch) p.catch(terminou);
  });
}

// Esconde a abertura (pode ser chamada mais de uma vez: só a primeira vale)
function fecharAbertura() {
  var el = document.getElementById('abertura');
  if (!el || el.dataset.fechando) return;
  el.dataset.fechando = 1;
  (ABERTURA_VIDEO || Promise.resolve()).then(function () {
    var espera = ABERTURA_VIDEO ? 0 : Math.max(0, TEMPO_MINIMO - (Date.now() - ABERTURA_INICIO));
    setTimeout(function () {
      el.classList.add('saindo');
      document.body.classList.add('abriu');
      // tira do HTML depois que terminar de esmaecer
      setTimeout(function () {
        el.remove();
      }, 600);
    }, espera);
  });
}
