#!/usr/bin/env python3
"""Baixa o preço de mercado do TCGplayer (loja dos EUA) de cada carta, pela TCGdex, e a cotação do dólar.

Uso (na pasta do projeto):
    python scripts/atualizar_precos_tcgplayer.py

Roda sozinho todo dia pelo GitHub (.github/workflows/precos.yml), depois do atualizar_precos.py.

Para que serve: o TCGplayer é o "fiscal" dos preços do site. A TCGdex liga cada carta ao TCGplayer
separando direitinho a versão comum, a full art e a shiny. O site (js/base/precos.js) usa este preço:
  - quando o preço da Liga ou do Cardmarket está mais de 3 vezes acima ou abaixo dele
    (anúncio absurdo puxando a média da Liga, ou carta ligada ao produto errado no Cardmarket);
  - quando a carta não tem preço da Liga nem do Cardmarket.

Grava dados/precos-tcgplayer/<serie>.json:
    { "atualizado": "2026-10-24", "usd_brl": 4.97, "fonte": "TCGplayer",
      "precos": { "me01-001": [0.12], "me01-002": [0.3, 0.45], ... } }   # em dólar:
    [preço de mercado da carta, preço da versão reverse holo (só se tiver)]

São uns 15 mil acessos à TCGdex (6 de cada vez, uns 10 minutos). Se um acesso falhar,
a carta fica com o preço do arquivo anterior.
"""
import json, sys, datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

from comum import baixar  # download com novas tentativas (scripts/comum.py)

RAIZ = Path(__file__).resolve().parent.parent
API = 'https://api.tcgdex.net/v2'
COTACAO = 'https://economia.awesomeapi.com.br/json/last/USD-BRL'
PASTA = RAIZ / 'dados' / 'precos-tcgplayer'
# versões da carta no TCGplayer, da preferida para a menos usada (a reverse holo fica separada)
VERSOES = ('holofoil', 'normal', 'unlimited-holofoil', '1st-edition-holofoil', 'unlimited', '1st-edition')


def preco_tcgplayer(carta_id):
    """[preço da carta, preço da reverse holo] em dólar; [] = sem preço; None = a TCGdex não respondeu."""
    d = baixar(f'{API}/en/cards/{carta_id}', tentativas=2, tempo=30)
    if d is None:
        return None
    tp = (d.get('pricing') or {}).get('tcgplayer') or {}
    mercado = {v: (p or {}).get('marketPrice') for v, p in tp.items() if isinstance(p, dict)}
    normal = next((mercado[v] for v in VERSOES if mercado.get(v)), None)
    if not normal:  # outra versão com nome diferente: a mais cara que não seja reverse
        normal = max((p for v, p in mercado.items() if p and 'reverse' not in v), default=None)
    reverse = mercado.get('reverse-holofoil')
    if not normal and not reverse:
        return []
    return [round(normal or 0, 2)] + ([round(reverse, 2)] if reverse else [])


def main():
    series = json.loads((RAIZ / 'dados' / 'series.json').read_text(encoding='utf-8'))['series']
    cot = baixar(COTACAO)
    usd_brl = round(float(cot['USDBRL']['bid']), 4) if cot else None
    PASTA.mkdir(parents=True, exist_ok=True)
    hoje = datetime.date.today().isoformat()
    total = falhas = 0
    for s in series:
        ids = []
        for c in s['colecoes']:
            arq = RAIZ / 'dados' / 'cartas' / s['id'] / f"{c['id']}.json"
            if arq.exists():
                ids += [k['id'] for k in json.loads(arq.read_text(encoding='utf-8'))]
        if not ids:
            continue
        saida = PASTA / f"{s['id']}.json"
        antigo = json.loads(saida.read_text(encoding='utf-8')) if saida.exists() else {}
        precos = {}
        with ThreadPoolExecutor(max_workers=6) as ex:
            for k, p in zip(ids, ex.map(preco_tcgplayer, ids)):
                if p is None:  # TCGdex não respondeu: fica o preço de ontem
                    falhas += 1
                    p = (antigo.get('precos') or {}).get(k)
                if p:
                    precos[k] = p
        cambio = usd_brl or antigo.get('usd_brl')
        if not cambio:
            sys.exit('Não consegui a cotação do dólar.')
        saida.write_text(json.dumps({'atualizado': hoje, 'usd_brl': cambio, 'fonte': 'TCGplayer', 'precos': precos},
                                    separators=(',', ':')), encoding='utf-8')
        total += len(precos)
        print(f"{s['id']}: {len(precos)} de {len(ids)} cartas com preço no TCGplayer")
    print(f'Pronto! {total} cartas; US$ 1 = R$ {usd_brl}' + (f' ({falhas} acessos falharam)' if falhas else ''))
    if total == 0:
        sys.exit('Nenhum preço do TCGplayer: a TCGdex pode estar fora do ar.')


if __name__ == '__main__':
    main()
