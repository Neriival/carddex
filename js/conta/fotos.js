// js/conta/fotos.js
// PERSONAGENS E FOTOS DE PERFIL
// ============================================================
// Sem foto, a pessoa aparece com o personagem (assets/img/avatares/menino.svg ou menina.svg).
// A foto fica no Supabase Storage (pasta "fotos/<id da conta>/"), e só a própria pessoa mexe nela.
// ============================================================

// Imagem do personagem
function imgAvatar(a, cls) { return '<img class="' + cls + '" src="assets/img/avatares/' + (a === 'menina' ? 'menina' : 'menino') + '.svg" alt="">'; }

// Foto da pessoa (se tiver) ou o personagem. u = { avatar, foto }. Se a foto não carregar, volta o personagem.
function avatarDe(u, cls) {
  if (!u.foto || !/^https:\/\//.test(u.foto)) return imgAvatar(u.avatar, cls);
  var reserva = 'assets/img/avatares/' + (u.avatar === 'menina' ? 'menina' : 'menino') + '.svg';
  return '<img class="' + cls + ' foto-perfil" src="' + esc(u.foto) + '" alt="" data-reserva="' + reserva + '" onerror="fotoQuebrada(this)">';
}
function fotoQuebrada(img) { img.onerror = null; img.classList.remove('foto-perfil'); img.src = img.dataset.reserva; }

// Recorta no meio (quadrado), reduz para 256×256 e converte para WEBP.
// Redesenhar a imagem também apaga os dados escondidos da foto (como a localização GPS).
async function prepararFoto(arq) {
  if (!/^image\//.test(arq.type)) throw new Error('Escolha um arquivo de imagem (JPG, PNG ou WEBP).');
  if (arq.size > 20 * 1048576) throw new Error('A foto é muito grande (mais de 20 MB).');
  var bmp;
  try { bmp = await createImageBitmap(arq); } catch (e) { throw new Error('Não consegui abrir essa imagem. Tente uma foto JPG ou PNG.'); }
  var L = 256, s = Math.min(bmp.width, bmp.height), c = document.createElement('canvas');
  c.width = c.height = L;
  var ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, L, L);
  return new Promise(function (ok) { c.toBlob(ok, 'image/webp', 0.85); });
}

// Envia a foto e devolve o endereço público dela
async function enviarFoto(arq) {
  var blob = await prepararFoto(arq), ext = blob.type === 'image/webp' ? 'webp' : 'png';
  var caminho = AUTH._u.id + '/foto-' + Date.now() + '.' + ext;
  var r = await sb.storage.from('fotos').upload(caminho, blob, { contentType: blob.type });
  if (r.error) throw new Error('Não foi possível enviar a foto: ' + r.error.message);
  return sb.storage.from('fotos').getPublicUrl(caminho).data.publicUrl;
}

// Apaga do Storage uma foto pelo endereço (usado ao trocar de foto e na moderação do painel)
function apagarFoto(url) {
  var m = /\/public\/fotos\/(.+)$/.exec(url || '');
  if (m) sb.storage.from('fotos').remove([decodeURIComponent(m[1])]);
}
