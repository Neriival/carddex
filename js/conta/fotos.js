// js/conta/fotos.js
// PERSONAGENS, FOTOS, BANNERS E NÍVEL DO PERFIL
// ============================================================
// Sem foto, a pessoa aparece com o personagem: menino, menina (assets/img/avatares/*.svg)
// ou um treinador do anime (assets/img/avatares/treinadores/<nome>.webp).
// Banner: um dos banners de tipo (assets/img/banners/<tipo>.webp) ou uma imagem enviada pela pessoa.
// Foto e banner enviados ficam no Supabase Storage (pastas "fotos/<id>/" e "banners/<id>/"),
// e só a própria pessoa mexe neles. O anel em volta do personagem mostra o nível (pelo total de cartas).
// ============================================================

// Treinadores do anime, na ordem em que aparecem na escolha (nome do arquivo, nome na tela)
var TREINADORES = [
  ['ash', 'Ash'],
  ['misty', 'Misty'],
  ['brock', 'Brock'],
  ['may', 'May'],
  ['max', 'Max'],
  ['dawn', 'Dawn'],
  ['iris', 'Iris'],
  ['cilan', 'Cilan'],
  ['serena', 'Serena'],
  ['clemont', 'Clemont'],
  ['bonnie', 'Bonnie'],
  ['lillie', 'Lillie'],
  ['goh', 'Goh'],
  ['chloe', 'Chloe'],
  ['liko', 'Liko'],
  ['roy', 'Roy'],
  ['gary', 'Gary'],
  ['tracey', 'Tracey'],
  ['jessie', 'Jessie'],
  ['james', 'James'],
  ['joy', 'Enfermeira Joy'],
  ['jenny', 'Oficial Jenny'],
  ['cynthia', 'Cynthia'],
  ['lance', 'Lance'],
  ['leon', 'Leon']
];

// Banners de tipo: um por tipo de Pokémon (nome do arquivo, nome na tela)
var BANNERS = [
  ['normal', 'Normal'],
  ['fogo', 'Fogo'],
  ['agua', 'Água'],
  ['planta', 'Planta'],
  ['eletrico', 'Elétrico'],
  ['gelo', 'Gelo'],
  ['lutador', 'Lutador'],
  ['venenoso', 'Venenoso'],
  ['terrestre', 'Terrestre'],
  ['voador', 'Voador'],
  ['psiquico', 'Psíquico'],
  ['inseto', 'Inseto'],
  ['pedra', 'Pedra'],
  ['fantasma', 'Fantasma'],
  ['dragao', 'Dragão'],
  ['sombrio', 'Sombrio'],
  ['metalico', 'Metálico'],
  ['fada', 'Fada']
];

// true se a lista [[id, nome], ...] tem esse id
function temId(lista, id) {
  return lista.some(function (x) {
    return x[0] === id;
  });
}

// Endereço da imagem do personagem (nome desconhecido vira o menino)
function srcAvatar(a) {
  if (a === 'menina') return 'assets/img/avatares/menina.svg';
  if (temId(TREINADORES, a)) return 'assets/img/avatares/treinadores/' + a + '.webp';
  return 'assets/img/avatares/menino.svg';
}

// Imagem do personagem
function imgAvatar(a, cls) {
  return '<img class="' + cls + (temId(TREINADORES, a) ? ' avatar-treinador' : '') + '" src="' + srcAvatar(a) +
    '" alt="">';
}

// Foto da pessoa (se tiver) ou o personagem. u = { avatar, foto }. Se a foto não carregar, volta o personagem.
function avatarDe(u, cls) {
  if (!u.foto || !/^https:\/\//.test(u.foto)) return imgAvatar(u.avatar, cls);
  return '<img class="' + cls + ' foto-perfil" src="' + esc(u.foto) + '" alt="" data-reserva="' + srcAvatar(u.avatar) +
    '" onerror="fotoQuebrada(this)">';
}

// A foto não carregou: mostra o personagem no lugar
function fotoQuebrada(img) {
  img.onerror = null;
  img.classList.remove('foto-perfil');
  img.src = img.dataset.reserva;
}

// Endereço do banner: tipo do site ou imagem enviada ('' = sem banner)
function srcBanner(b) {
  if (/^https:\/\//.test(b || '')) return b;
  return temId(BANNERS, b) ? 'assets/img/banners/' + b + '.webp' : '';
}

// Faixa do banner no topo do perfil (sem banner, fica o degradê azul do site)
function bannerDe(u, cls) {
  var src = srcBanner(u.banner);
  return '<div class="' + cls + '">' + (src ? '<img src="' + esc(src) + '" alt="" onerror="this.remove()">' : '') +
    '</div>';
}

// Personagem/foto dentro do anel de nível, com o número do nível embaixo
function avatarComNivel(u, total, cls) {
  var nv = nivel(total);
  return '<div class="anel-nivel" style="--pct:' + nv.pct + '%" title="Nível ' + nv.n + ' · faltam ' + nv.falta +
    ' cartas para o nível ' + (nv.n + 1) + '">' + avatarDe(u, cls) + '<span class="selo-nivel">Nv ' + nv.n +
    '</span></div>';
}

// Recorta no meio na proporção largura×altura, reduz para esse tamanho e converte para WEBP.
// Redesenhar a imagem também apaga os dados escondidos da foto (como a localização GPS).
async function prepararImagem(arq, largura, altura) {
  if (!/^image\//.test(arq.type)) throw new Error('Escolha um arquivo de imagem (JPG, PNG ou WEBP).');
  if (arq.size > 20 * 1048576) throw new Error('A imagem é muito grande (mais de 20 MB).');
  var bmp;
  try {
    bmp = await createImageBitmap(arq);
  } catch (e) {
    throw new Error('Não consegui abrir essa imagem. Tente uma imagem JPG ou PNG.');
  }
  var escala = Math.min(bmp.width / largura, bmp.height / altura),
    w = largura * escala,
    h = altura * escala,
    c = document.createElement('canvas');
  c.width = largura;
  c.height = altura;
  var ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, (bmp.width - w) / 2, (bmp.height - h) / 2, w, h, 0, 0, largura, altura);
  return new Promise(function (ok) {
    c.toBlob(ok, 'image/webp', 0.85);
  });
}

// Envia a imagem para a pasta da pessoa no Storage e devolve o endereço público.
// pasta = 'fotos' (256×256) ou 'banners' (1200×300)
async function enviarImagemConta(pasta, arq) {
  var banner = pasta === 'banners',
    blob = await prepararImagem(arq, banner ? 1200 : 256, banner ? 300 : 256),
    ext = blob.type === 'image/webp' ? 'webp' : 'png';
  var caminho = AUTH._u.id + '/' + (banner ? 'banner-' : 'foto-') + Date.now() + '.' + ext;
  var r = await sb.storage.from(pasta).upload(caminho, blob, {
    contentType: blob.type
  });
  if (r.error) throw new Error('Não foi possível enviar a imagem: ' + r.error.message);
  return sb.storage.from(pasta).getPublicUrl(caminho).data.publicUrl;
}

// Apaga do Storage uma foto ou banner pelo endereço (ao trocar e na moderação do painel)
function apagarFoto(url) {
  var m = /\/public\/(fotos|banners)\/(.+)$/.exec(url || '');
  if (m) sb.storage.from(m[1]).remove([decodeURIComponent(m[2])]);
}
