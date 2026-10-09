#!/usr/bin/env python3
"""Completa as imagens que a TCGdex não tem: Pokémon TCG API (images.pokemontcg.io) e, se lá também não tiver, TCGplayer.

Uso (na pasta do projeto, depois do baixar_cartas.py):
    python scripts/completar_imagens.py svp            # uma coleção
    python scripts/completar_imagens.py swshp smp      # várias

Para cada carta sem imagem em dados/cartas/<serie>/<colecao>.json:
  - procura a carta na Pokémon TCG API pelo número (o id da coleção é o mesmo da TCGdex, ou "ptcg" no series.json)
  - grava a miniatura em assets/img/cartas/<serie>/<colecao>/<numero>-mini.webp
  - a carta grande fica com o endereço da imagem na Pokémon TCG API
Se a Pokémon TCG API não tiver a carta, usa a foto da TCGplayer (o número do produto vem da TCGdex):
  - séries com "imagens": "mini" guardam só a miniatura e a carta grande fica com o endereço da TCGplayer
  - as outras guardam também a grande em <numero>.webp
Carta que não existe em nenhuma das bases continua sem imagem (o site mostra o número).
"""
import io, json, sys, time, urllib.request, urllib.error
from pathlib import Path
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
IMG = 'https://images.pokemontcg.io'
TCGDEX = 'https://api.tcgdex.net/v2/en/cards/'
TCGPLAYER = 'https://tcgplayer-cdn.tcgplayer.com/product/{}_in_1000x1000.jpg'
MINI = (245, 337)  # mesmo tamanho das miniaturas da TCGdex


def baixar(url, tentativas=3):
    for i in range(tentativas):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'CardDex (github.com/Neriival/carddex)'})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
        except Exception:
            pass
        time.sleep(1 + i)
    return None


def numeros(n):
    """Formas do número para tentar: '007' → ['007', '7']; 'SWSH001' → ['SWSH001', 'SWSH1']."""
    l = [n]
    if n.isdigit():
        l.append(str(int(n)))
    else:
        pre = n.rstrip('0123456789'); dig = n[len(pre):]
        if dig.isdigit():
            l.append(pre + str(int(dig)))
    return list(dict.fromkeys(l))


def foto_tcgplayer(carta_id):
    """Endereço da foto da carta na TCGplayer, pelo número do produto que a TCGdex informa (ou None)."""
    d = baixar(TCGDEX + carta_id)
    if not d:
        return None
    d = json.loads(d)
    ids = [v.get('thirdParty', {}).get('tcgplayer') for v in d.get('variants_detailed') or []]
    ids.append(((d.get('pricing') or {}).get('tcgplayer') or {}).get('productId'))
    pid = next((i for i in ids if i), None)
    return TCGPLAYER.format(pid) if pid else None


def main():
    pedidas = sys.argv[1:]
    series = json.loads((RAIZ / 'dados' / 'series.json').read_text(encoding='utf-8'))['series']
    for s in series:
        for c in s['colecoes']:
            if c['id'] not in pedidas:
                continue
            arq = RAIZ / 'dados' / 'cartas' / s['id'] / f"{c['id']}.json"
            cartas = json.loads(arq.read_text(encoding='utf-8'))
            ptcg = c.get('ptcg') or c.get('tcgdex') or c['id']
            faltam = [k for k in cartas if not k.get('imagem')]
            achei = 0
            for k in faltam:
                for n in numeros(k['numero']):
                    pequena = baixar(f'{IMG}/{ptcg}/{n}.png')
                    if not pequena:
                        continue
                    destino = RAIZ / 'assets' / 'img' / 'cartas' / s['id'] / c['id'] / f"{k['numero']}-mini.webp"
                    destino.parent.mkdir(parents=True, exist_ok=True)
                    Image.open(io.BytesIO(pequena)).convert('RGBA').save(destino, 'WEBP', quality=80)
                    k['mini'] = f"assets/img/cartas/{s['id']}/{c['id']}/{k['numero']}-mini.webp"
                    k['imagem'] = f'{IMG}/{ptcg}/{n}_hires.png'
                    achei += 1
                    break
                else:
                    url = foto_tcgplayer(k['id'])
                    foto = url and baixar(url)
                    if not foto:
                        continue
                    pasta = RAIZ / 'assets' / 'img' / 'cartas' / s['id'] / c['id']
                    pasta.mkdir(parents=True, exist_ok=True)
                    img = Image.open(io.BytesIO(foto)).convert('RGB')
                    img.resize(MINI, Image.LANCZOS).save(pasta / f"{k['numero']}-mini.webp", 'WEBP', quality=80)
                    k['mini'] = f"assets/img/cartas/{s['id']}/{c['id']}/{k['numero']}-mini.webp"
                    if s.get('imagens') == 'mini':
                        k['imagem'] = url
                    else:
                        img.save(pasta / f"{k['numero']}.webp", 'WEBP', quality=88)
                        k['imagem'] = f"assets/img/cartas/{s['id']}/{c['id']}/{k['numero']}.webp"
                    achei += 1
            arq.write_text(json.dumps(cartas, ensure_ascii=False, indent=1), encoding='utf-8')
            print(f"{c['nome']}: {achei} de {len(faltam)} imagens que faltavam foram completadas")


if __name__ == '__main__':
    main()
