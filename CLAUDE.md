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

## Padrão de código (seguir sempre)
- Formatação automática: **`python scripts/formatar_codigo.py`** depois de mexer em CSS/JS
  (`--conferir` só aponta o que está fora do padrão). Precisa de `pip install jsbeautifier cssbeautifier esprima`.
  O formatador só muda espaços/quebras e divide textos de HTML compridos; o comportamento não muda.
- 2 espaços de recuo; Python com 4. `.editorconfig` e `.vscode/settings.json` deixam o editor no padrão.
- CSS: uma propriedade por linha terminando em `;`, linha em branco entre regras, seções com
  `/* ===== NOME ===== */`, ajustes de celular num `@media(max-width:760px)` no **fim do próprio arquivo**.
- JS: blocos `{ }` abertos em várias linhas, linhas de até ~120 caracteres, HTML montado em pedaços
  `'...>' +` um por linha. Cada arquivo começa com cabeçalho (caminho + o que faz) e cada função com
  um comentário de uma linha dizendo o que faz. Nomes em português (telaX, desenharX, carregarX...).
- Um arquivo por assunto: tela nova → `js/telas/<tela>.js` + `css/telas/<tela>.css`, incluídos no `index.html`
  na seção certa. Ajudante usado em vários lugares → `js/base/util.js` (não duplicar).
- Python: funções comuns em `scripts/comum.py` (ex.: `baixar()`); não copiar entre scripts.
- Antes de reorganizar: tirar "foto" do estilo calculado de várias telas e comparar depois.

## Dados das cartas e preços
- Cartas e imagens: TCGdex (+ Pokémon TCG API/TCGplayer/Limitless para imagens que faltam).
  Séries "imagens: mini" guardam só a miniatura no projeto (limite de 1 GB do GitHub Pages).
- Preços: Liga Pokémon (mercado brasileiro) quando a coleção tem; senão Cardmarket (euro → real).
  Fiscal: TCGplayer (pela TCGdex, dólar → real, `dados/precos-tcgplayer/`): se Liga/Cardmarket estiver >3x acima
  ou abaixo dele (e >R$100 de diferença), a carta usa o TCGplayer (`foraDoTcgplayer` em js/base/precos.js).
  Verificação de 25/10/2026: a TCGdex liga ~430 cartas ao produto errado no Cardmarket (comum x full art x shiny);
  a média da Liga é distorcida por anúncios absurdos em promos.
  Robôs no GitHub Actions: `.github/workflows/precos.yml` (diário: "toque" no Supabase para não pausar,
  `baixar_cartas.py --em-breve` para coleções `"emBreve": true` que a TCGdex já publicou, e preços do Cardmarket)
  e `precos-liga.yml` (Liga: **só manual**; no GitHub a Liga bloqueia, então roda-se o script em casa).
  O robô diário faz commits no `main` → **sempre `git pull --rebase` antes de publicar**.

## Banco (Supabase, projeto `carddex`, ref `fqynjcaiwmeprxkzfwed`, plano grátis)
- Login, perfis (nick, sexo, personagem/treinador/foto, banner, vitrine, privacidade todos|amigos|ninguem),
  amigos (tabela `amizades`, só por funções), cartas na conta, ranking, parceiros e painel adm.
  `colecao_publica` é legado (sincronizado com `privacidade` por gatilho para o site antigo em cache). Tabelas, funções e regras de segurança (RLS): **`docs/supabase.sql`** é a
  fonte da verdade (pode rodar de novo sem apagar nada). Passo a passo: `docs/SUPABASE.md`.
- No site só vai a chave **publishable** (pública de propósito). **Nunca** colocar a chave `secret`/`service_role`
  nem tokens (`sbp_...`) em arquivos ou commits.
- Para mexer no banco: pedir ao dono um token do Supabase só do projeto carddex (24 h), usar só em comandos
  (Management API), e lembrar de apagar depois. Testar com contas `@example.com` e apagá-las no fim.
- Plano grátis: pausa após ~7 dias sem uso (Restore no painel), ~2 e-mails/hora, e-mails em inglês.
- Contas de admin (tabela `admins`) ficam fora do ranking, sem perfil público e sem amigos; coleção fechada
  não abre nem para admin (decisão do dono).
- Nível do perfil: `nivel(total)` em js/base/util.js (do nível n para o n+1 são mais 25×n cartas).
- Imagens de treinadores (anime) e banners de tipo (arte oficial) são da Nintendo/TPC: uso de fã, há risco de direitos.

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
