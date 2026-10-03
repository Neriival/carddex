// js/telas/perfil-publico.js
// TELA – PERFIL PÚBLICO de um colecionador
// ============================================================
// Mostra só: personagem/foto, nick, posição no ranking, total de cartas e a vitrine (nunca e-mail ou sexo).
// Abre pelo ranking ou pelo link …/#perfil/<nick> (dá para mandar no WhatsApp), mesmo para quem não tem conta.
// Os dados vêm da função "perfil_publico" do banco (docs/supabase.sql).
// ============================================================

async function telaPerfilPublico(nick) {
  document.body.classList.remove('na-login');
  ESTADO.redesenhar = null; marcarMenu(-1); vitrineAberta = null;
  var volta = '<h2><button class="voltar" onclick="telaRanking()">← Ranking</button></h2>';
  if (!sb) { app.innerHTML = volta + '<div class="aviso">Os perfis aparecem quando o site estiver ligado ao banco de dados.</div>'; return; }
  app.innerHTML = volta + '<p class="sub">Carregando perfil...</p>'; window.scrollTo(0, 0);
  var r = await sb.rpc('perfil_publico', { n: nick }), p = r.data;
  if (r.error || !p) { app.innerHTML = volta + '<div class="aviso">Não encontramos o colecionador "' + esc(nick) + '".</div>'; return; }
  var cartas = await cartasDaVitrine(p.vitrine || []);
  vitrineAberta = cartas.map(function (v) { return { c: v.c, k: v.k.id }; });
  var u = AUTH.usuario();
  app.innerHTML = volta + '<section class="perfil-pub">' + avatarDe(p, 'perfil-avatar') + '<div class="perfil-dados"><h2>' + esc(p.nick) + (p.eu ? ' <small>(você)</small>' : '') + '</h2>' +
    '<div class="perfil-numeros">' + (p.posicao ? '<span><b>' + p.posicao + 'º</b> no ranking</span>' : '') + '<span><b>' + p.total + '</b> cartas</span></div>' +
    '<div class="perfil-acoes"><button class="btn" onclick="compartilharPerfil(\'' + esc(p.nick) + '\')">Compartilhar perfil</button>' + (p.eu ? '<button class="btn btn-sec" onclick="telaPerfil()">Editar meu perfil</button>' : '') + '</div>' +
    '<p class="sub" id="msg-compartilhar" role="status"></p></div></section>' +
    '<h2>Vitrine</h2><span class="sub">' + (p.eu ? 'Suas cartas favoritas ou mais raras. ' : 'As cartas que ' + esc(p.nick) + ' mais gosta. ') + 'Toque para ver em tamanho grande.</span>' +
    (cartas.length ? gradeVitrine(cartas, true) : '<div class="aviso">' + (p.eu ? 'Sua vitrine está vazia. Abra uma carta que você tem e toque em <b>☆ Pôr na vitrine</b>.' : esc(p.nick) + ' ainda não escolheu as cartas da vitrine.') + '</div>') +
    (!u ? '<div class="rank-eu"><b>Monte a sua vitrine também</b><span class="sub">Crie uma conta grátis, marque suas cartas e mostre as mais raras.</span><button class="btn" onclick="telaLogin(\'criar\')">Criar conta</button></div>' : '');
}

// Link do perfil: no celular abre o menu de compartilhar; no computador copia o link
function linkPerfil(nick) { return location.origin + location.pathname + '#perfil/' + encodeURIComponent(nick); }
async function compartilharPerfil(nick) {
  var url = linkPerfil(nick), texto = 'Olha a minha coleção de cartas no CardDex!', msg = document.getElementById('msg-compartilhar');
  if (navigator.share && matchMedia('(hover:none)').matches) { try { await navigator.share({ title: 'CardDex – ' + nick, text: texto, url: url }); } catch (e) {} return; }
  try { await navigator.clipboard.writeText(url); msg.innerHTML = 'Link copiado! Cole onde quiser, ou <a href="https://wa.me/?text=' + encodeURIComponent(texto + ' ' + url) + '" target="_blank" rel="noopener">mande no WhatsApp</a>.'; }
  catch (e) { msg.innerHTML = 'Seu link: <b>' + esc(url) + '</b>'; }
}

// Link …/#perfil/<nick> aberto com o site já aberto
window.addEventListener('hashchange', function () {
  var m = /^#perfil\/(.+)$/.exec(location.hash);
  if (m) telaPerfilPublico(decodeURIComponent(m[1]));
});
