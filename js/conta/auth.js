// js/conta/auth.js
// A CONTA DA PESSOA (entrar, criar, salvar perfil, sair)
// ============================================================
// Com o Supabase ligado (js/config.js), as contas ficam no banco: senha protegida pelo Supabase,
// perfil (nick, sexo, personagem, foto, vitrine) na tabela "perfis" e as cartas na tabela "colecoes".
// Sem o Supabase, funciona o modo antigo: tudo só no navegador (a senha NÃO é guardada nem conferida).
// As telas de login e de perfil ficam em js/conta/login.js e js/conta/perfil.js.
// ============================================================

// Nick: de 3 a 16 letras, números, ponto ou _ (o banco confere a mesma regra)
var NICK_OK = /^[A-Za-z0-9_.]{3,16}$/;

// Mensagens do Supabase traduzidas para o português
function erroAuth(e) {
  var m = (e && e.message) || '';
  if (/invalid login/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/already registered|already exists/i.test(m)) return 'Este e-mail já tem uma conta. Use a aba Entrar.';
  if (/not confirmed/i.test(m)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (/rate limit|too many/i.test(m)) return 'Muitas tentativas. Espere alguns minutos e tente de novo.';
  if (/weak|password should/i.test(m)) return 'Senha fraca. Use pelo menos 6 caracteres, misturando letras e números.';
  return m || 'Não foi possível entrar. Tente de novo.';
}

// Modo sem banco: guarda o "usuário" só no navegador
function salvarSessaoLocal(u) {
  try {
    localStorage.setItem('carddex_sessao',
      JSON.stringify(u));
  } catch (e) {}
  return u;
}

var AUTH = {
  _u: null, // usuário conectado { id, email, nick, sexo, avatar, foto, banner, vitrine, privacidade }
  admin: false, // true = pode abrir o painel adm (tabela "admins" no banco)

  usuario: function () {
    return sb ? AUTH._u : lerJSON('carddex_sessao');
  },
  convidado: function () {
    try {
      return localStorage.getItem('carddex_convidado') === '1';
    } catch (e) {
      return false;
    }
  },

  // Ao abrir o site: lê a sessão salva pelo Supabase e baixa as marcações da conta
  iniciar: async function () {
    if (!sb) return;
    try {
      var r = await sb.auth.getSession();
      await AUTH._usar(r.data.session && r.data.session.user);
    } catch (e) {}
    if (AUTH._u) await nuvemPuxar(nuvemPendente());
  },

  // Guarda o usuário e lê o perfil dele e se é admin
  _usar: async function (user) {
    AUTH._u = null;
    AUTH.admin = false;
    if (!user) return;
    var u = {
      id: user.id,
      email: user.email,
      nick: '',
      sexo: '',
      avatar: '',
      foto: '',
      banner: '',
      vitrine: [],
      privacidade: 'ninguem'
    };
    try {
      var r = await Promise.all([sb.from('perfis').select('nick,sexo,avatar,foto,banner,vitrine,privacidade').eq(
        'id',
        user.id).maybeSingle(), sb.rpc('eh_admin')]);
      var p = r[0].data;
      if (p) {
        u.nick = p.nick || '';
        u.sexo = p.sexo || '';
        u.avatar = p.avatar || '';
        u.foto = p.foto ||
          '';
        u.banner = p.banner || '';
        u.vitrine = p.vitrine || [];
        u.privacidade = p.privacidade || 'ninguem';
      }
      AUTH.admin = r[1].data === true;
    } catch (e) {}
    AUTH._u = u;
  },

  // Entrar: as cartas marcadas sem conta são juntadas com as da conta
  entrar: async function (email, senha) {
    if (!sb) return salvarSessaoLocal({
      nick: email.split('@')[0],
      email: email,
      avatar: 'ash'
    });
    var r = await sb.auth.signInWithPassword({
      email: email,
      password: senha
    });
    if (r.error) throw new Error(erroAuth(r.error));
    await AUTH._usar(r.data.user);
    await nuvemPuxar(true);
    return AUTH._u;
  },

  // Criar conta. p = { nick, sexo, avatar, usarFoto, arquivo }.
  // Devolve { confirmar: true } se o Supabase pedir confirmação por e-mail antes do primeiro login.
  criar: async function (email, senha, p) {
    if (!sb) return salvarSessaoLocal({
      nick: p.nick,
      sexo: p.sexo,
      avatar: p.avatar,
      email: email
    });
    var livre = await sb.rpc('nick_disponivel', {
      n: p.nick
    });
    if (livre.data === false) throw new Error('O nick "' + p.nick + '" já está em uso. Escolha outro.');
    var r = await sb.auth.signUp({
      email: email,
      password: senha,
      options: {
        data: {
          nick: p.nick,
          sexo: p.sexo,
          avatar: p.avatar
        }
      }
    });
    if (r.error) throw new Error(/database error/i.test(r.error.message) ? 'O nick "' + p.nick +
      '" acabou de ser escolhido por outra pessoa. Tente outro.' : erroAuth(r.error));
    if (!r.data.session) return {
      confirmar: true
    };
    await AUTH._usar(r.data.user);
    await nuvemPuxar(true);
    // a foto só pode subir depois que a conta existe; se falhar, a conta continua com o personagem
    if (p.usarFoto && p.arquivo) {
      try {
        await AUTH.salvarPerfil(p);
      } catch (e) {}
    }
    return AUTH._u;
  },

  // Troca nick, sexo, personagem, foto, banner e quem vê a coleção (tela Meu perfil).
  // Foto e banner novos sobem antes; os antigos são apagados depois.
  salvarPerfil: async function (p) {
    var dados = {
      nick: p.nick,
      sexo: p.sexo,
      avatar: p.avatar
    };
    if (!sb) {
      salvarSessaoLocal(Object.assign(lerJSON('carddex_sessao') || {}, dados));
      return;
    }
    if ('privacidade' in p) dados.privacidade = p.privacidade;
    var antiga = AUTH._u.foto || '',
      bannerAntigo = AUTH._u.banner || '',
      enviados = [];
    try {
      if (p.usarFoto && p.arquivo) enviados.push(dados.foto = await enviarImagemConta('fotos', p.arquivo));
      else if (!p.usarFoto) dados.foto = null;
      // banner: 'minha' = imagem enviada (nova ou a que já estava), '' = sem banner, ou o nome de um tipo
      if ('banner' in p) {
        if (p.banner !== 'minha') dados.banner = p.banner || null;
        else if (p.arquivoBanner) enviados.push(dados.banner = await enviarImagemConta('banners', p.arquivoBanner));
        else if (!/^https:/.test(bannerAntigo)) throw new Error('Escolha a sua imagem de banner.');
      }
    } catch (x) {
      enviados.forEach(apagarFoto);
      throw x;
    }
    var r = await sb.from('perfis').update(dados).eq('id', AUTH._u.id);
    if (r.error) {
      enviados.forEach(apagarFoto);
      throw new Error(r.error.code === '23505' ? 'O nick "' + p.nick +
        '" já está em uso. Escolha outro.' : 'Não foi possível salvar: ' + r.error.message);
    }
    if ('foto' in dados && antiga && antiga !== dados.foto) apagarFoto(antiga);
    if ('banner' in dados && bannerAntigo !== dados.banner) apagarFoto(bannerAntigo);
    Object.assign(AUTH._u, dados, {
      foto: 'foto' in dados ? dados.foto || '' : antiga,
      banner: 'banner' in dados ? dados.banner || '' : bannerAntigo
    });
  },

  // Sair: envia o que falta, e as marcações saem do navegador (continuam salvas na conta)
  sair: async function () {
    if (sb) {
      await nuvemEnviar();
      await sb.auth.signOut();
      AUTH._u = null;
      AUTH.admin = false;
      AMIGOS.lista = [];
      AMIGOS.recebidos = 0;
      limparMarcacoes();
    }
    try {
      localStorage.removeItem('carddex_sessao');
      localStorage.removeItem('carddex_convidado');
    } catch (e) {}
  }
};
