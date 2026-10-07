#!/usr/bin/env python3
"""Atualiza os preços das cartas (Cardmarket, em euro) e a cotação do euro em real.

Uso (na pasta do projeto):
    python scripts/atualizar_precos.py

Roda sozinho todo dia pelo GitHub (.github/workflows/precos.yml), mas também dá para rodar à mão.

Como funciona:
 1) dados/cardmarket.json guarda o número de cada carta no Cardmarket ("idProduct"), que vem da TCGdex.
    Só as cartas que ainda não estão lá são buscadas (a primeira vez demora; depois, segundos).
    Coleção nova entra sozinha na próxima rodada. Carta sem número (0) é tentada de novo toda segunda-feira.
 2) Baixa o arquivo público de preços do Cardmarket (um só arquivo com todos os produtos de Pokémon).
 3) Baixa a cotação do euro em real (AwesomeAPI).
 4) Grava dados/precos/<serie>.json, que o site lê (js/base/precos.js):
      { "atualizado": "2026-10-06", "eur_brl": 5.61, "fonte": "Cardmarket",
        "precos": { "me01-001": [0.06, 0.2], ... } }      # [preço, preço da versão reverse holo] em euro
"""
import json, sys, time, datetime, urllib.request, urllib.error
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

RAIZ = Path(__file__).resolve().parent.parent
API = 'https://api.tcgdex.net/v2'
GUIA_CARDMARKET = 'https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_6.json'  # 6 = Pokémon
COTACAO = 'https://economia.awesomeapi.com.br/json/last/EUR-BRL'
MAPA = RAIZ / 'dados' / 'cardmarket.json'
PASTA_PRECOS = RAIZ / 'dados' / 'precos'


def baixar(url, tentativas=3):
    for i in range(tentativas):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'CardDex (github.com/Neriival/carddex)'})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
        except Exception:
            pass
        time.sleep(1 + i)
    return None


def id_cardmarket(carta_id):
    """Número do produto no Cardmarket (0 = a carta não está à venda lá)."""
    d = baixar(f'{API}/en/cards/{carta_id}')
    if d is None:
        return None  # falhou: tenta de novo na próxima vez
    return ((d.get('pricing') or {}).get('cardmarket') or {}).get('idProduct') or 0


def valor(p, sufixo=''):
    """Preço de referência: tendência; se não tiver, média; se não tiver, o menor."""
    for campo in ('trend', 'avg', 'low'):
        v = p.get(campo + sufixo)
        if v:
            return round(v, 2)
    return None


def main():
    series = json.loads((RAIZ / 'dados' / 'series.json').read_text(encoding='utf-8'))['series']
    cartas = {}  # serie -> [ids]
    for s in series:
        for c in s['colecoes']:
            arq = RAIZ / 'dados' / 'cartas' / s['id'] / f"{c['id']}.json"
            if arq.exists():
                cartas.setdefault(s['id'], []).extend(k['id'] for k in json.loads(arq.read_text(encoding='utf-8')))

    # 1) números do Cardmarket que faltam
    mapa = json.loads(MAPA.read_text(encoding='utf-8')) if MAPA.exists() else {}
    # cartas novas; e, às segundas-feiras, também as que ainda não tinham número no Cardmarket
    # (logo depois do lançamento de uma coleção, a TCGdex às vezes ainda não tem esse número)
    segunda = datetime.date.today().weekday() == 0
    faltam = [k for ids in cartas.values() for k in ids if k not in mapa or (segunda and not mapa[k])]
    if faltam:
        print(f'Buscando o número do Cardmarket de {len(faltam)} cartas na TCGdex...')
        with ThreadPoolExecutor(max_workers=6) as ex:
            for i, (k, cm) in enumerate(zip(faltam, ex.map(id_cardmarket, faltam)), 1):
                if cm is not None:
                    mapa[k] = cm
                if i % 500 == 0 or i == len(faltam):
                    print(f'  {i}/{len(faltam)}')
                    MAPA.write_text(json.dumps(mapa, sort_keys=True, separators=(',', ':')), encoding='utf-8')

    # 2) preços do Cardmarket e 3) cotação do euro
    guia = baixar(GUIA_CARDMARKET)
    if not guia:
        sys.exit('Não consegui baixar o arquivo de preços do Cardmarket.')
    produtos = {p['idProduct']: p for p in guia['priceGuides']}
    cot = baixar(COTACAO)
    eur_brl = round(float(cot['EURBRL']['bid']), 4) if cot else None
    if not eur_brl:  # sem cotação nova: usa a do último arquivo
        antigo = next(PASTA_PRECOS.glob('*.json'), None)
        eur_brl = antigo and json.loads(antigo.read_text(encoding='utf-8')).get('eur_brl')
        if not eur_brl:
            sys.exit('Não consegui a cotação do euro.')

    # 4) um arquivo por série
    PASTA_PRECOS.mkdir(parents=True, exist_ok=True)
    hoje = datetime.date.today().isoformat()
    for serie, ids in cartas.items():
        precos = {}
        for k in ids:
            p = produtos.get(mapa.get(k))
            if not p:
                continue
            normal, reverse = valor(p), valor(p, '-holo')
            if normal or reverse:
                precos[k] = [normal or 0] + ([reverse] if reverse else [])
        saida = {'atualizado': hoje, 'eur_brl': eur_brl, 'fonte': 'Cardmarket', 'precos': precos}
        (PASTA_PRECOS / f'{serie}.json').write_text(json.dumps(saida, separators=(',', ':')), encoding='utf-8')
        print(f'{serie}: {len(precos)} de {len(ids)} cartas com preço')
    print(f'Pronto! €1 = R$ {eur_brl}')


if __name__ == '__main__':
    main()
