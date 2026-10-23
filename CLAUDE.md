# CardDex – contexto para o Claude

Site em português para fãs de Pokémon TCG marcarem as cartas que têm (jogos → séries → coleções → cartas).
No ar em https://neriival.github.io/carddex/ (GitHub Pages, branch `main`, repositório Neriival/carddex).

## Quem é o dono
- Neriival (Juniinho no site) está **aprendendo HTML, CSS e JavaScript** e não é programador.
- Sempre responder **em português, de forma simples**, explicando o porquê das coisas.
- **Perguntar antes de publicar** (`git push` muda o site no ar). Commit local pode.
- Mudanças grandes: mostrar o plano/diagnóstico antes de alterar.

## Tecnologia (sem framework, sem build)
- HTML + CSS + JavaScript puro, carregados por `<script>`/`<link>` no `index.html`, **na ordem certa**
  (config → base → conta → recursos → telas → main). Funções são globais; telas montam HTML em strings.
- Sempre usar `esc()` (js/base/util.js) ao colocar texto vindo de dados/usuário no HTML.
- Cada `.css` e `.js` no `index.html` tem `?v=AAAAMMDD`: **trocar em todas as linhas a cada publicação**
  (senão o navegador e o app instalado mostram a versão antiga).
- Estrutura completa e "onde mexer": ver `LEIA-ME.txt`. Resumo:
  - `css/` base, layout, `componentes/`, `telas/`, responsivo (cada arquivo com cabeçalho comentado)
  - `js/base` (util, dados, marcacoes, precos, nuvem), `js/conta`, `js/recursos`, `js/telas`, `js/config.js`, `js/main.js`
  - `dados/series.json` (séries/coleções), `dados/cartas/<serie>/<colecao>.json`, `assets/img/...`
  - `scripts/` (Python): baixar_cartas.py, completar_imagens.py, atualizar_precos.py, atualizar_precos_liga.py
- App instalável: `manifest.webmanifest` + `sw.js` (o sw não guarda cache).

## Dados das cartas e preços
- Cartas e imagens: TCGdex (+ Pokémon TCG API/TCGplayer/Limitless para imagens que faltam).
  Séries "imagens: mini" guardam só a miniatura no projeto (limite de 1 GB do GitHub Pages).
- Preços: Liga Pokémon (mercado brasileiro) quando a coleção tem; senão Cardmarket (euro → real).
  Robôs no GitHub Actions: `.github/workflows/precos.yml` (Cardmarket, diário, e "toque" no Supabase para
  não pausar) e `precos-liga.yml` (Liga: **só manual**; no GitHub a Liga bloqueia, então roda-se o script em casa).
  O robô diário faz commits no `main` → **sempre `git pull --rebase` antes de publicar**.

## Banco (Supabase, projeto `carddex`, ref `fqynjcaiwmeprxkzfwed`, plano grátis)
- Login, perfis (nick, sexo, personagem/foto, vitrine, coleção aberta), cartas na conta, ranking,
  parceiros e painel adm. Tabelas, funções e regras de segurança (RLS): **`docs/supabase.sql`** é a
  fonte da verdade (pode rodar de novo sem apagar nada). Passo a passo: `docs/SUPABASE.md`.
- No site só vai a chave **publishable** (pública de propósito). **Nunca** colocar a chave `secret`/`service_role`
  nem tokens (`sbp_...`) em arquivos ou commits.
- Para mexer no banco: pedir ao dono um token do Supabase só do projeto carddex (24 h), usar só em comandos
  (Management API), e lembrar de apagar depois. Testar com contas `@example.com` e apagá-las no fim.
- Plano grátis: pausa após ~7 dias sem uso (Restore no painel), ~2 e-mails/hora, e-mails em inglês.
- Contas de admin (tabela `admins`) ficam fora do ranking e sem perfil público; coleção fechada
  não abre nem para admin (decisão do dono).

## Testes
- Não há testes automáticos no repositório. Testar no Chrome sem janela (headless) via DevTools
  (Python + websocket-client), contra um servidor local (`python -m http.server 8765`).
- Antes de reorganizações: comparar prints da versão publicada com a nova.

## Cuidados no Windows
- Não editar JS/CSS por heredoc do bash (barras `\'` somem e acentos/travessões quebram):
  usar a ferramenta de edição ou um arquivo .py escrito com a ferramenta Write.
- No Git Bash, `git show origin/main:caminho` precisa de `MSYS_NO_PATHCONV=1`.

## Situação conhecida (23/10/2026)
- Supabase ficou pausado (reativado pelo dono em 23/10); o robô diário agora "toca" o banco todo dia.
- Robô da Liga: de 08 a 23/10 rodou ~5 h duas vezes por dia sem salvar nada (provável bloqueio da Liga aos
  servidores do GitHub). Agendamento desligado; o script agora termina com erro quando não salva nada.
- Diagnóstico de 23/10 (pendentes, por importância): LGPD (política de privacidade, apagar a própria conta,
  repensar o campo sexo; público tem muitas crianças), mensagem clara quando o servidor está fora do ar
  (hoje o login mostra "Failed to fetch"), ranking aceita cartas inexistentes via API, cadastro sem confirmar
  e-mail, cliques de parceiros e envio de fotos sem limite, menu quebra em notebook pequeno,
  site publicado com ~470 MB (limite do Pages: 1 GB).
- Ideias pendentes: ver `docs/PROXIMAS_FASES.md`.
