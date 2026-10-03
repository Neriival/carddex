# CardDex – Sua coleção de cartas

Site para fãs de Pokémon TCG marcarem as cartas que já têm, organizado por **jogos → séries → coleções → cartas**, tudo em português.

**Site:** https://neriival.github.io/carddex/

- Carta grande com efeito 3D, informações e arrastar para o lado
- Marcar "tenho" e contar **repetidas** direto na grade
- Imagem das cartas que faltam ou das repetidas para mandar no **WhatsApp**
- **Conta** com nick e personagem ou foto; as cartas ficam salvas na conta (qualquer aparelho)
- **Ranking** e **perfil público** com vitrine de 5 cartas
- **Painel adm**: contas, números do site, parceiros e moderação de fotos
- Funciona como **app instalável** (computador e celular)
- Dados e imagens da [TCGdex](https://tcgdex.dev); contas no [Supabase](https://supabase.com)

## Rodar localmente
Use o Live Server do VS Code no `index.html`.

## Deixar as imagens dentro do projeto
```bash
python scripts/baixar_cartas.py
```

## Documentação
- `LEIA-ME.txt` – estrutura de pastas, como adicionar coleções e onde mexer
- `docs/SUPABASE.md` – banco de dados (passo a passo e limites do plano grátis)
- `docs/supabase.sql` – tabelas, funções e regras de segurança
- `docs/PROXIMAS_FASES.md` – o que já foi feito e o que falta

## GitHub Pages
Settings → Pages → branch `main` → pasta `/ (root)`.
