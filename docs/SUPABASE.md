# Supabase (login, cartas na conta, ranking, painel adm e parceiros)

**Já está configurado** no projeto `carddex` (região São Paulo, plano grátis):
tabelas criadas, site ligado (`js/config.js`), cadastro sem confirmação de e-mail e endereço do site
`https://neriival.github.io/carddex/`. Os passos abaixo servem para refazer tudo do zero, se precisar.

Limites do plano grátis:
- O Supabase só envia uns **2 e-mails por hora** (usados no "Esqueci minha senha") e o texto do e-mail fica em inglês.
  Para mais e-mails e texto em português, ligue um SMTP próprio (Resend, Brevo...) em Authentication → Emails.
- Projeto sem acesso por 7 dias é **pausado**; é só entrar no painel do Supabase e clicar em Restore.

## 1. Criar o projeto
1. Entre em [supabase.com](https://supabase.com) e crie uma conta (dá para usar a do GitHub).
2. **New project**: nome `carddex`, crie uma senha do banco (guarde-a) e escolha a região **South America (São Paulo)**.
3. Espere o projeto ficar pronto (1 a 2 minutos).

## 2. Criar as tabelas
1. Menu lateral → **SQL Editor** → **New query**.
2. Cole todo o conteúdo de `docs/supabase.sql` e clique em **Run**. Deve aparecer "Success".

## 3. Ligar o site ao banco
1. **Project Settings** → **API Keys**.
2. Copie a **Project URL** e a chave **publishable** (começa com `sb_publishable_`).
3. Cole as duas em `js/config.js` (`supabaseUrl` e `supabaseChave`).
4. Ainda em `js/config.js`, preencha `contatoParceiro` com o link de quem quer anunciar (ex.: `https://wa.me/55DDDNUMERO`).

A chave *publishable* é pública de propósito: quem protege os dados são as regras do `supabase.sql`.
**Nunca** coloque no site a chave `secret` (ou `service_role`).

## 4. Endereço do site (para os e-mails de confirmação)
**Authentication** → **URL Configuration**:
- **Site URL**: o endereço do site no GitHub Pages (ex.: `https://seuusuario.github.io/carddex/`)
- **Redirect URLs**: adicione também `http://127.0.0.1:5500/**` para testar com o Live Server.

Desligue a confirmação de e-mail no cadastro (o plano grátis manda poucos e-mails):
**Authentication** → **Sign In / Providers** → **Email** → desmarque **Confirm email**.

## 5. Virar admin
1. Abra o site e crie sua conta na aba **Criar conta**.
2. No **SQL Editor**, rode (com o seu e-mail):
   ```sql
   insert into public.admins (user_id) select id from auth.users where email = 'SEU_EMAIL_AQUI' on conflict do nothing;
   ```
3. Saia e entre de novo no site: o link **Admin** aparece no menu.

## Usando o painel
- **Contas criadas**: total, últimos 7 e 30 dias, e a lista das 100 mais recentes (nick, e-mail, sexo).
- **Números do site**: cartas marcadas, colecionadores ativos, masculino/feminino e as coleções mais colecionadas.
- **Parceiros**: um quadro para cada um dos 8 espaços (Esquerda 1–4, Direita 1–4).
  Preencha o nome, o site e a imagem (quadrada, até 1 MB) e clique em **Salvar**. **Remover** libera o espaço,
  que volta a mostrar "Seja um parceiro". Cada quadro mostra os cliques do parceiro (30 dias e total).
