// js/telas/admin.js
// TELA – PAINEL ADM
// ============================================================
// Contas criadas, números do site, coleções mais colecionadas e moderação de fotos e banners.
// Só aparece para quem está na tabela "admins" do Supabase (veja docs/SUPABASE.md).
// O banco também confere isso: mesmo abrindo a tela por fora, quem não é admin não lê as contas nem muda nada.
// ============================================================

var NOMES_SEXO = {
  masculino: 'Masculino',
  feminino: 'Feminino',
  nao_informar: 'Não informou'
};

// TELA – Painel adm (só para admins)
function telaAdmin() {
  ESTADO.redesenhar = null;
  marcarMenu(4);
  if (!sb) {
    app.innerHTML = '<h2>Painel adm</h2>' +
      '<div class="aviso">Configure o Supabase em <b>js/config.js</b> para usar o painel (passo a passo em docs/SUPABASE.md).</div>';
    return;
  }
  if (!AUTH.admin) {
    app.innerHTML = '<h2>Painel adm</h2>' +
      '<div class="aviso">Entre com uma conta de administrador para ver o painel.</div>';
    return;
  }
  app.innerHTML = '<h2>Painel adm</h2>' +
    '<span class="sub">Acompanhe as contas e os números do site.</span>' +
    '<div class="stats" id="adm-stats">' + statAdm('Contas criadas') + statAdm('Últimos 7 dias') +
    statAdm('Últimos 30 dias') + '</div>' +
    '<div class="stats" id="adm-site">' + statAdm('Cartas marcadas no site') + statAdm('Colecionadores ativos') +
    statAdm('Masculino / Feminino') + '</div>' +
    '<h2>Coleções mais colecionadas</h2><div id="adm-top">' +
    '<p class="sub">Carregando...</p></div>' +
    '<h2>Últimas contas criadas</h2><div id="adm-contas">' +
    '<p class="sub">Carregando...</p></div>';
  window.scrollTo(0, 0);
  carregarContas();
  carregarResumo();
}

// Cartão de número (… enquanto carrega)
function statAdm(rotulo, valor) {
  return '<div class="stat"><div>' + rotulo + '</div><b>' +
    (valor == null ? '…' : valor) + '</b></div>';
}

// CONTAS: totais (geral, 7 e 30 dias) e as 100 mais recentes
async function carregarContas() {
  function desde(dias) {
    return new Date(Date.now() - dias * 864e5).toISOString();
  }

  function contar(q) {
    return q.then(function (r) {
      return r.error ? '–' : r.count;
    });
  }
  var base = function () {
    return sb.from('perfis').select('id', {
      count: 'exact',
      head: true
    });
  };
  var n = await Promise.all([contar(base()), contar(base().gte('criado_em', desde(7))), contar(base().gte('criado_em',
    desde(30)))]);
  var lista = await sb.from('perfis').select('id,nick,nome,email,sexo,avatar,foto,banner,criado_em').order(
    'criado_em', {
      ascending: false
    }).limit(100);
  var st = document.getElementById('adm-stats'),
    box = document.getElementById('adm-contas');
  if (!st) return; // saiu da tela antes de terminar
  st.innerHTML = statAdm('Contas criadas', n[0]) + statAdm('Últimos 7 dias', n[1]) + statAdm('Últimos 30 dias', n[2]);
  if (lista.error) {
    box.innerHTML = '<div class="aviso">Não foi possível ler as contas: ' + esc(lista.error.message) +
      '</div>';
    return;
  }
  box.innerHTML = lista.data.length ? '<div class="adm-tabela"><table><thead><tr><th>Foto</th><th>Nick</th>' +
    '<th>E-mail</th><th>Sexo</th><th>Criada em</th></tr></thead><tbody>' +
    lista.data.map(function (c) {
      return '<tr><td class="adm-foto">' + avatarDe(c, 'adm-mini') +
        (c.foto ? '<button class="adm-remover" type="button" onclick="removerFotoAdm(this,\'' + c.id +
          '\')">Remover foto</button>' : '') +
        (/^https:/.test(c.banner || '') ? '<a class="adm-banner" href="' + esc(c.banner) +
          '" target="_blank" rel="noopener"><img src="' + esc(c.banner) + '" alt="Banner enviado"></a>' +
          '<button class="adm-remover" type="button" onclick="removerBannerAdm(this,\'' + c.id +
          '\')">Remover banner</button>' :
          '') + '</td><td>' + esc(c.nick || c.nome || '–') + '</td><td>' + esc(c.email) +
        '</td><td>' + (NOMES_SEXO[c.sexo] || '–') + '</td><td>' + new Date(c.criado_em).toLocaleString(
          'pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short'
          }) + '</td></tr>';
    }).join('') +
    '</tbody></table></div>' +
    (n[0] > 100 ? '<p class="sub">Mostrando as 100 mais recentes.</p>' : '') :
    '<p class="sub">Nenhuma conta criada ainda.</p>';
}

// NÚMEROS DO SITE: total de cartas marcadas, quem marcou, sexo e as 10 coleções com mais colecionadores
async function carregarResumo() {
  var r = await sb.rpc('admin_resumo'),
    box = document.getElementById('adm-site'),
    top = document.getElementById('adm-top');
  if (!box) return;
  if (r.error) {
    top.innerHTML = '<div class="aviso">Não foi possível ler os números: ' + esc(r.error.message) +
      '</div>';
    return;
  }
  var d = r.data,
    sx = d.sexo || {};
  box.innerHTML = statAdm('Cartas marcadas no site', d.cartas) + statAdm('Colecionadores ativos', d.colecionadores) +
    statAdm('Masculino / Feminino', (sx.masculino || 0) + ' / ' + (sx.feminino || 0));
  top.innerHTML = d.top.length ? '<div class="adm-tabela"><table><thead><tr><th>Coleção</th><th>Série</th>' +
    '<th>Colecionadores</th><th>Cartas marcadas</th></tr></thead><tbody>' + d.top.map(function (t) {
      var c = acharColecao(t.colecao),
        s = c && acharSerie(c.serie);
      return '<tr><td>' + esc(c ? c.nome : t.colecao) + '</td><td>' + esc(s ? s.nome : '–') + '</td><td>' + t.pessoas +
        '</td><td>' + t.cartas + '</td></tr>';
    }).join('') + '</tbody></table></div>' : '<p class="sub">Ninguém marcou cartas ainda.</p>';
}

// MODERAÇÃO: tira a foto de alguém (a pessoa volta a aparecer com o personagem) e apaga o arquivo
async function removerFotoAdm(btn, id) {
  var img = btn.parentNode.querySelector('img'),
    url = img.getAttribute('src');
  if (!confirm('Remover esta foto? A pessoa volta a aparecer com o personagem.')) return;
  btn.disabled = true;
  var r = await sb.rpc('remover_foto', {
    alvo: id
  });
  if (r.error) {
    btn.disabled = false;
    alert('Não foi possível remover: ' + r.error.message);
    return;
  }
  apagarFoto(url);
  fotoQuebrada(img);
  btn.remove();
}

// MODERAÇÃO: tira o banner enviado por alguém (o perfil volta ao fundo padrão) e apaga o arquivo
async function removerBannerAdm(btn, id) {
  var link = btn.previousElementSibling;
  if (!confirm('Remover este banner? O perfil volta ao fundo padrão.')) return;
  btn.disabled = true;
  var r = await sb.rpc('remover_banner', {
    alvo: id
  });
  if (r.error) {
    btn.disabled = false;
    alert('Não foi possível remover: ' + r.error.message);
    return;
  }
  apagarFoto(link.getAttribute('href'));
  link.remove();
  btn.remove();
}
