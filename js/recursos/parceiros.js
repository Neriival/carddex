// js/recursos/parceiros.js
// QUADRADOS DE PARCEIROS: 4 na lateral esquerda (e1–e4) e 4 na direita (d1–d4).
// Em telas estreitas (celular/tablet) os 8 aparecem numa faixa no fim da página.
// Os parceiros ficam na tabela "parceiros" do Supabase e são editados no painel adm (js/telas/admin.js).
// Quadrado sem parceiro mostra "Seja um parceiro" (link em CONFIG.contatoParceiro, js/config.js).
var POSICOES = { esq: ['e1', 'e2', 'e3', 'e4'], dir: ['d1', 'd2', 'd3', 'd4'] };
var PARCEIROS = {}; // { e1: { posicao, nome, link, imagem }, ... }

// Só aceita endereços http/https (evita links perigosos como "javascript:")
function linkSeguro(u) { return /^https?:\/\//i.test(u || '') ? u : ''; }
function nomePosicao(pos) { return (pos[0] === 'e' ? 'Esquerda ' : 'Direita ') + pos[1]; }

// Lê os parceiros do banco e desenha os quadrados
async function carregarParceiros() {
  if (sb) {
    try {
      var r = await sb.from('parceiros').select('posicao,nome,link,imagem');
      PARCEIROS = {};
      (r.data || []).forEach(function (p) { PARCEIROS[p.posicao] = p; });
    } catch (e) {}
  }
  desenharParceiros();
}

// Um quadrado: imagem com link para o site do parceiro, ou "Seja um parceiro"
function quadroParceiro(pos) {
  var p = PARCEIROS[pos];
  if (p && linkSeguro(p.link) && linkSeguro(p.imagem))
    return '<a class="parceiro" href="' + esc(p.link) + '" target="_blank" rel="noopener sponsored" title="' + esc(p.nome) + '" onclick="registrarClique(\'' + pos + '\')"><img loading="lazy" src="' + esc(p.imagem) + '" alt="' + esc(p.nome) + '"></a>';
  var c = linkSeguro(CONFIG.contatoParceiro) || (/^mailto:/i.test(CONFIG.contatoParceiro) ? CONFIG.contatoParceiro : '');
  var txt = '<span>Seja um<br><b>parceiro</b></span>';
  return c ? '<a class="parceiro vago" href="' + esc(c) + '" target="_blank" rel="noopener" title="Anuncie no CardDex">' + txt + '</a>' : '<div class="parceiro vago">' + txt + '</div>';
}

// Desenha as duas laterais e a faixa do celular
function desenharParceiros() {
  document.getElementById('parc-esq').innerHTML = POSICOES.esq.map(quadroParceiro).join('');
  document.getElementById('parc-dir').innerHTML = POSICOES.dir.map(quadroParceiro).join('');
  document.getElementById('parc-faixa').innerHTML = '<span class="sub">Parceiros</span><div>' + POSICOES.esq.concat(POSICOES.dir).map(quadroParceiro).join('') + '</div>';
}

// Conta o clique (aparece no painel adm). Não atrasa a abertura do site do parceiro.
function registrarClique(pos) { if (sb) sb.rpc('registrar_clique', { p: pos }).then(function () {}, function () {}); }
