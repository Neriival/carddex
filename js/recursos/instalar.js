// js/recursos/instalar.js
// AVISO "INSTALE O APP" (sem Google Play: o próprio navegador instala o site como app)
// ============================================================
// - Android (Chrome, Samsung Internet), computador (Chrome, Edge): o navegador avisa que dá para instalar
//   (evento beforeinstallprompt). Aí aparece a faixa com o botão "Instalar", que abre a janela do navegador.
// - iPhone/iPad (Safari): não existe botão automático; a faixa explica: Compartilhar → Adicionar à Tela de Início.
// - Quem já abriu pelo app instalado não vê nada. Quem fecha a faixa (×) só vê de novo depois de 30 dias.
// O app em si é o manifest.webmanifest + sw.js (ícones em assets/img/app/). Estilo: css/componentes/instalar.css
// ============================================================

var PEDIDO_INSTALAR = null; // o aviso guardado do navegador (Android/computador)
var INSTALAR_PAUSA = 30 * 864e5; // 30 dias sem mostrar depois de fechar

// true se o site já está aberto como app instalado
function rodandoComoApp() {
  return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
}

// true se a pessoa fechou a faixa há menos de 30 dias
function instalarFechadoRecente() {
  try {
    return Date.now() - Number(localStorage.getItem('carddex_instalar_fechado') || 0) < INSTALAR_PAUSA;
  } catch (e) {
    return false;
  }
}

// iPhone/iPad no Safari (inclui iPad que se diz Mac)
function ehIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Desenha a faixa no fim da tela (texto e botão mudam no iPhone)
function mostrarFaixaInstalar() {
  if (rodandoComoApp() || instalarFechadoRecente() || document.getElementById('instalar')) return;
  var ios = !PEDIDO_INSTALAR && ehIOS();
  if (!PEDIDO_INSTALAR && !ios) return;
  var el = document.createElement('div');
  el.id = 'instalar';
  el.className = 'instalar';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Instalar o CardDex');
  el.innerHTML = '<img src="assets/img/app/icone-192.png" alt="">' +
    '<div class="instalar-txt"><b>Instale o CardDex</b>' +
    (ios ? '<span>Toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.</span>' :
      '<span>Abra direto da tela inicial, como um app. Grátis e sem loja.</span>') +
    '</div>' +
    (ios ? '' : '<button class="btn" type="button" onclick="instalarApp()">Instalar</button>') +
    '<button class="instalar-fechar" type="button" aria-label="Fechar" onclick="fecharFaixaInstalar()">×</button>';
  document.body.appendChild(el);
}

// Botão "Instalar": abre a janela de instalação do navegador
function instalarApp() {
  if (!PEDIDO_INSTALAR) return;
  PEDIDO_INSTALAR.prompt();
  PEDIDO_INSTALAR.userChoice.then(function () {
    PEDIDO_INSTALAR = null;
    tirarFaixaInstalar();
  });
}

// "×": esconde a faixa e só mostra de novo daqui a 30 dias
function fecharFaixaInstalar() {
  try {
    localStorage.setItem('carddex_instalar_fechado', String(Date.now()));
  } catch (e) {}
  tirarFaixaInstalar();
}

// Tira a faixa da tela
function tirarFaixaInstalar() {
  var el = document.getElementById('instalar');
  if (el) el.remove();
}

// O navegador avisa que dá para instalar: guarda o aviso e mostra a faixa
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  PEDIDO_INSTALAR = e;
  mostrarFaixaInstalar();
});

// Instalou (pelo botão ou pelo menu do navegador): some a faixa
window.addEventListener('appinstalled', tirarFaixaInstalar);
