// js/ranking.js
// TELA – Ranking: quem tem mais cartas marcadas. Mostra só nick e personagem (nunca o e-mail).
// Os dados vêm da função "ranking" do banco (docs/supabase.sql): top 50 + a sua posição.

async function telaRanking() {
  ESTADO.redesenhar = telaRanking; marcarMenu(3);
  var u = AUTH.usuario(), topo = '<h2>Ranking</h2><span class="sub">Quem tem mais cartas marcadas no CardDex. Toque em alguém para ver o perfil.</span>';
  if (!sb) { app.innerHTML = topo + '<div class="aviso">O ranking aparece quando o site estiver ligado ao banco de dados.</div>'; return; }
  if (!app.querySelector('.ranking')) app.innerHTML = topo + '<p class="sub">Carregando...</p>';
  await nuvemEnviar(); // garante que suas últimas marcações já contam
  var r = await sb.rpc('ranking', { limite: 50 });
  if (ESTADO.redesenhar !== telaRanking) return; // saiu da tela antes de terminar
  if (r.error) { app.innerHTML = topo + '<div class="aviso">Não foi possível carregar o ranking. Tente de novo em instantes.</div>'; return; }
  var lista = r.data || [], eu = lista.filter(function (x) { return x.eu; })[0];
  var meu = !u ? '<div class="rank-eu"><b>Quer aparecer aqui?</b><span class="sub">Crie uma conta, marque suas cartas e dispute o topo com outros colecionadores.</span><button class="btn" onclick="telaLogin(\'criar\')">Criar conta</button></div>'
    : !u.nick ? '<div class="rank-eu"><b>Falta escolher seu nick</b><span class="sub">Sem nick você não aparece no ranking.</span><button class="btn" onclick="telaPerfil()">Escolher nick</button></div>'
    : '<div class="rank-eu">' + avatarDe(u, 'rank-avatar') + '<div><b>' + (eu ? eu.posicao + 'º lugar' : 'Fora do ranking') + '</b><span class="sub">' + esc(u.nick) + ' · ' + totalTenho() + ' cartas' +
      (eu ? '' : ' · marque cartas para entrar') + '</span></div></div>';
  app.innerHTML = topo + meu + (lista.length ? '<ol class="ranking">' + lista.map(function (x) {
    var med = x.posicao <= 3 ? ' top' + x.posicao : '';
    return '<li class="' + (x.eu ? 'sou-eu' : '') + med + '" tabindex="0" role="link" title="Ver perfil de ' + esc(x.nick) + '" onclick="telaPerfilPublico(\'' + esc(x.nick) + '\')" onkeydown="if(event.key===\'Enter\')this.click()"><span class="rank-pos">' + x.posicao + 'º</span>' + avatarDe(x, 'rank-avatar') +
      '<span class="rank-nick">' + esc(x.nick) + (x.eu ? ' <small>(você)</small>' : '') + '</span><span class="rank-total">' + x.total + ' <small>cartas</small></span></li>';
  }).join('') + '</ol>' : '<p class="sub">Ninguém marcou cartas ainda. Seja o primeiro!</p>');
}
