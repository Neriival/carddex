#!/usr/bin/env python3
"""Atualiza os preços das cartas (Cardmarket, em euro) e a cotação do euro em real.

Uso (na pasta do projeto):
    python scripts/atualizar_precos.py

Roda sozinho todo dia pelo GitHub (.github/workflows/precos.yml), mas também dá para rodar à mão.

Como funciona:
 1) dados/cardmarket.json guarda o número de cada carta no Cardmarket ("idProduct"), que vem da TCGdex.
    Só as cartas que ainda não estão lá são buscadas (a primeira vez demora; depois, segundos).
    Coleção nova entra sozinha na próxima rodada. Carta sem número (0) é tentada de novo toda segunda-feira.
    A TCGdex às vezes liga cartas diferentes ao mesmo produto (ex.: a versão comum e a full art, ou a comum e a
    shiny). Quando um produto aparece em cartas com nome ou raridade diferentes, essas cartas ficam SEM preço do
    Cardmarket: o site usa o do TCGplayer (scripts/atualizar_precos_tcgplayer.py).
 2) Baixa o arquivo público de preços do Cardmarket (um só arquivo com todos os produtos de Pokémon).
 3) Baixa a cotação do euro em real (AwesomeAPI).
 4) Grava dados/precos/<serie>.json, que o site lê (js/base/precos.js):
      { "atualizado": "2026-10-06", "eur_brl": 5.61, "fonte": "Cardmarket",
        "precos": { "me01-001": [0.06, 0.2, 0.02], ... } }   # em euro:
      [preço típico (tendência), preço da versão reverse holo (0 = não tem), menor anúncio]
      (os dois últimos podem faltar; o menor anúncio costuma ser de carta danificada ou em outro idioma,
       por isso o site usa o preço típico e mostra o menor só como "a partir de" na carta grande)
"""
import json, sys, datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

from comum import baixar  # download com novas tentativas (scripts/comum.py)

RAIZ = Path(__file__).resolve().parent.parent
API = 'https://api.tcgdex.net/v2'
GUIA_CARDMARKET = 'https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_6.json'  # 6 = Pokémon
COTACAO = 'https://economia.awesomeapi.com.br/json/last/EUR-BRL'
MAPA = RAIZ / 'dados' / 'cardmarket.json'
PASTA_PRECOS = RAIZ / 'dados' / 'precos'




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
    info = {}  # id -> (nome, raridade): para achar produtos ligados a cartas diferentes
    for s in series:
        for c in s['colecoes']:
            arq = RAIZ / 'dados' / 'cartas' / s['id'] / f"{c['id']}.json"
            if arq.exists():
                lista = json.loads(arq.read_text(encoding='utf-8'))
                cartas.setdefault(s['id'], []).extend(k['id'] for k in lista)
                info.update({k['id']: (k.get('nome'), k.get('raridade')) for k in lista})

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

    # produto ligado a cartas com nome ou raridade diferentes: não dá para saber de qual delas é o preço
    por_produto = {}
    for k, idp in mapa.items():
        if idp and k in info:
            por_produto.setdefault(idp, []).append(k)
    duvidosas = {k for ks in por_produto.values() if len({info[k] for k in ks}) > 1 for k in ks}
    if duvidosas:
        print(f'{len(duvidosas)} cartas sem preço do Cardmarket (produto ligado a cartas diferentes)')

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
            if not p or k in duvidosas:
                continue
            normal, reverse = valor(p), valor(p, '-holo')
            if normal or reverse:
                menor = round(p['low'], 2) if p.get('low') else None  # anúncio mais barato (qualquer estado/idioma)
                precos[k] = [normal or 0] + ([reverse or 0, menor] if menor else [reverse] if reverse else [])
        saida = {'atualizado': hoje, 'eur_brl': eur_brl, 'fonte': 'Cardmarket', 'precos': precos}
        (PASTA_PRECOS / f'{serie}.json').write_text(json.dumps(saida, separators=(',', ':')), encoding='utf-8')
        print(f'{serie}: {len(precos)} de {len(ids)} cartas com preço')
    print(f'Pronto! €1 = R$ {eur_brl}')


if __name__ == '__main__':
    main()
