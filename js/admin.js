// js/admin.js
// PAINEL ADM: contas criadas e parceiros.
// Só aparece para quem está na tabela "admins" do Supabase (veja docs/SUPABASE.md).
// O banco também confere isso: mesmo abrindo a tela por fora, quem não é admin não lê as contas nem muda os parceiros.

function telaAdmin() {
  ESTADO.redesenhar = null; marcarMenu(4);
  if (!sb) { app.innerHTML = '<h2>Painel adm</h2><div class="aviso">Configure o Supabase em <b>js/config.js</b> para usar o painel (passo a passo em docs/SUPABASE.md).</div>'; return; }
  if (!AUTH.admin) { app.innerHTML = '<h2>Painel adm</h2><div class="aviso">Entre com uma conta de administrador para ver o painel.</div>'; return; }
  app.innerHTML = '<h2>Painel adm</h2><span class="sub">Acompanhe as contas e cuide dos parceiros do site.</span>' +
    '<div class="stats" id="adm-stats">' + statAdm('Contas criadas') + statAdm('Últimos 7 dias') + statAdm('Últimos 30 dias') + '</div>' +
    '<div class="stats" id="adm-site">' + statAdm('Cartas marcadas no site') + statAdm('Colecionadores ativos') + statAdm('Masculino / Feminino') + '</div>' +
    '<h2>Coleções mais colecionadas</h2><div id="adm-top"><p class="sub">Carregando...</p></div>' +
    '<h2>Parceiros</h2><span class="sub">4 quadrados de cada lado. Use imagem quadrada (ex.: 300×300) em PNG, JPG ou WEBP, até 1 MB.</span>' +
    '<div class="adm-parceiros">' + POSICOES.esq.concat(POSICOES.dir).map(formParceiro).join('') + '</div>' +
    '<h2>Últimas contas criadas</h2><div id="adm-contas"><p class="sub">Carregando...</p></div>';
  window.scrollTo(0, 0);
  carregarContas(); carregarResumo(); carregarCliques();
}
function statAdm(rotulo, valor) { return '<div class="stat"><div>' + rotulo + '</div><b>' + (valor == null ? '…' : valor) + '</b></div>'; }

// CONTAS: totais (geral, 7 e 30 dias) e as 100 mais recentes
async function carregarContas() {
  function desde(dias) { return new Date(Date.now() - dias * 864e5).toISOString(); }
  function contar(q) { return q.then(function (r) { return r.error ? '–' : r.count; }); }
  var base = function () { return sb.from('perfis').select('id', { count: 'exact', head: true }); };
  var n = await Promise.all([contar(base()), contar(base().gte('criado_em', desde(7))), contar(base().gte('criado_em', desde(30)))]);
  var lista = await sb.from('perfis').select('nick,nome,email,sexo,criado_em').order('criado_em', { ascending: false }).limit(100);
  var st = document.getElementById('adm-stats'), box = document.getElementById('adm-contas');
  if (!st) return; // saiu da tela antes de terminar
  st.innerHTML = statAdm('Contas criadas', n[0]) + statAdm('Últimos 7 dias', n[1]) + statAdm('Últimos 30 dias', n[2]);
  if (lista.error) { box.innerHTML = '<div class="aviso">Não foi possível ler as contas: ' + esc(lista.error.message) + '</div>'; return; }
  box.innerHTML = lista.data.length ? '<div class="adm-tabela"><table><thead><tr><th>Nick</th><th>E-mail</th><th>Sexo</th><th>Criada em</th></tr></thead><tbody>' +
    lista.data.map(function (c) { return '<tr><td>' + esc(c.nick || c.nome || '–') + '</td><td>' + esc(c.email) + '</td><td>' + (NOMES_SEXO[c.sexo] || '–') + '</td><td>' + new Date(c.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) + '</td></tr>'; }).join('') +
    '</tbody></table></div>' + (n[0] > 100 ? '<p class="sub">Mostrando as 100 mais recentes.</p>' : '') : '<p class="sub">Nenhuma conta criada ainda.</p>';
}

var NOMES_SEXO = { masculino: 'Masculino', feminino: 'Feminino', nao_informar: 'Não informou' };

// NÚMEROS DO SITE: total de cartas marcadas, quem marcou, sexo e as 10 coleções com mais colecionadores
async function carregarResumo() {
  var r = await sb.rpc('admin_resumo'), box = document.getElementById('adm-site'), top = document.getElementById('adm-top');
  if (!box) return;
  if (r.error) { top.innerHTML = '<div class="aviso">Não foi possível ler os números: ' + esc(r.error.message) + '</div>'; return; }
  var d = r.data, sx = d.sexo || {};
  box.innerHTML = statAdm('Cartas marcadas no site', d.cartas) + statAdm('Colecionadores ativos', d.colecionadores) + statAdm('Masculino / Feminino', (sx.masculino || 0) + ' / ' + (sx.feminino || 0));
  top.innerHTML = d.top.length ? '<div class="adm-tabela"><table><thead><tr><th>Coleção</th><th>Série</th><th>Colecionadores</th><th>Cartas marcadas</th></tr></thead><tbody>' + d.top.map(function (t) {
    var c = acharColecao(t.colecao), s = c && acharSerie(c.serie);
    return '<tr><td>' + esc(c ? c.nome : t.colecao) + '</td><td>' + esc(s ? s.nome : '–') + '</td><td>' + t.pessoas + '</td><td>' + t.cartas + '</td></tr>';
  }).join('') + '</tbody></table></div>' : '<p class="sub">Ninguém marcou cartas ainda.</p>';
}

// CLIQUES: mostra em cada quadro de parceiro quantos cliques o parceiro atual recebeu
var CLIQUES = [];
async function carregarCliques() {
  var r = await sb.rpc('cliques_resumo');
  CLIQUES = r.data || [];
  POSICOES.esq.concat(POSICOES.dir).forEach(mostrarCliques);
}
function mostrarCliques(pos) {
  var el = document.getElementById('cliques-' + pos), p = PARCEIROS[pos];
  if (!el) return;
  var c = p && CLIQUES.filter(function (x) { return x.posicao === pos && x.nome === p.nome; })[0];
  el.textContent = p ? (c ? c.mes + ' cliques nos últimos 30 dias · ' + c.total + ' no total' : 'Nenhum clique ainda') : '';
}

// PARCEIROS: um formulário por quadrado
function formParceiro(pos) {
  var p = PARCEIROS[pos] || {};
  return '<form class="adm-parc" onsubmit="salvarParceiro(event,\'' + pos + '\')"><div class="adm-topo">' +
    '<div class="adm-prev">' + (p.imagem ? '<img src="' + esc(p.imagem) + '" alt="">' : '<span>Vago</span>') + '</div><div><b>' + nomePosicao(pos) + '</b><span class="sub adm-cliques" id="cliques-' + pos + '"></span></div></div>' +
    campoAdm('nome', 'Nome do parceiro', 'text', p.nome) + campoAdm('link', 'Site (https://...)', 'url', p.link) +
    '<div class="campo"><label>' + (p.imagem ? 'Trocar imagem' : 'Imagem') + '</label><input name="arquivo" type="file" accept="image/png,image/jpeg,image/webp"></div>' +
    '<p class="erro" role="status"></p><div class="adm-acoes"><button class="btn" type="submit">Salvar</button>' +
    (p.posicao ? '<button class="btn btn-sec" type="button" onclick="removerParceiro(this,\'' + pos + '\')">Remover</button>' : '') + '</div></form>';
}
function campoAdm(nome, rotulo, tipo, valor) {
  return '<div class="campo"><label>' + rotulo + '</label><input name="' + nome + '" type="' + tipo + '" value="' + esc(valor || '') + '"></div>';
}

async function salvarParceiro(e, pos) {
  e.preventDefault();
  var f = e.target, el = f.elements, msg = f.querySelector('.erro'), arq = el.arquivo.files[0], atual = PARCEIROS[pos] || {};
  var nome = el.nome.value.trim(), link = el.link.value.trim();
  function erro(t) { msg.classList.remove('ok'); msg.textContent = t; }
  if (!nome) return erro('Digite o nome do parceiro.');
  if (!linkSeguro(link)) return erro('O site precisa começar com https://');
  if (!arq && !atual.imagem) return erro('Escolha a imagem do parceiro.');
  if (arq && arq.size > 1048576) return erro('A imagem passa de 1 MB. Diminua e tente de novo.');
  msg.classList.add('ok'); msg.textContent = 'Salvando...';
  var imagem = atual.imagem;
  if (arq) {
    var caminho = pos + '-' + Date.now() + '.' + (arq.name.split('.').pop() || 'png').toLowerCase();
    var up = await sb.storage.from('parceiros').upload(caminho, arq, { contentType: arq.type });
    if (up.error) return erro('Erro ao enviar a imagem: ' + up.error.message);
    imagem = sb.storage.from('parceiros').getPublicUrl(caminho).data.publicUrl;
  }
  var r = await sb.from('parceiros').upsert({ posicao: pos, nome: nome, link: link, imagem: imagem, atualizado_em: new Date().toISOString() });
  if (r.error) return erro('Erro ao salvar: ' + r.error.message);
  if (arq && atual.imagem) apagarImagem(atual.imagem);
  await carregarParceiros();
  f.outerHTML = formParceiro(pos); mostrarCliques(pos);
}

async function removerParceiro(btn, pos) {
  var p = PARCEIROS[pos];
  if (!p || !confirm('Remover o parceiro "' + p.nome + '" de ' + nomePosicao(pos) + '?')) return;
  var r = await sb.from('parceiros').delete().eq('posicao', pos);
  if (r.error) { var m = btn.form.querySelector('.erro'); m.classList.remove('ok'); m.textContent = 'Erro ao remover: ' + r.error.message; return; }
  apagarImagem(p.imagem);
  await carregarParceiros();
  btn.form.outerHTML = formParceiro(pos);
}

// Apaga do Storage a imagem antiga (só as que foram enviadas pelo painel)
function apagarImagem(url) {
  var m = /\/parceiros\/([^/?]+)$/.exec(url || '');
  if (m) sb.storage.from('parceiros').remove([decodeURIComponent(m[1])]);
}
