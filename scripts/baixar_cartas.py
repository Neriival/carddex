#!/usr/bin/env python3
"""Baixa as cartas (em português) e as imagens para dentro do projeto, separado por série.

Uso (na pasta do projeto):
    python scripts/baixar_cartas.py              # tudo que está em dados/series.json
    python scripts/baixar_cartas.py me           # só a série Mega Evolução
    python scripts/baixar_cartas.py sv01 me05    # só algumas coleções
    python scripts/baixar_cartas.py --listar me  # mostra as coleções da série na TCGdex

Gera:
    dados/cartas/<serie>/<colecao>.json
    assets/img/cartas/<serie>/<colecao>/001.webp        (grande; não baixa nas séries com "imagens": "mini")
    assets/img/cartas/<serie>/<colecao>/001-mini.webp   (miniatura rápida)
    assets/img/colecoes/<serie>/<colecao>.webp          (logo da coleção)
    assets/img/series/<serie>.webp                      (logo da série, se existir)
Também atualiza o "total" de cada coleção no dados/series.json.
Fonte: TCGdex (https://tcgdex.dev). Sem tradução em português -> usa inglês nessa carta.
Pode rodar de novo: arquivos já baixados são pulados.
"""
import json, sys, time, urllib.request, urllib.error
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

RAIZ = Path(__file__).resolve().parent.parent
API = 'https://api.tcgdex.net/v2'
CATEGORIAS = {'Pokemon': 'Pokémon', 'Pokémon': 'Pokémon', 'Trainer': 'Treinador', 'Energy': 'Energia'}
# cartas sem tradução: tipo e raridade em português (nomes iguais aos da TCGdex em pt)
TIPOS = {'Grass': 'Planta', 'Fire': 'Fogo', 'Water': 'Água', 'Lightning': 'Elétrico', 'Psychic': 'Psíquico',
         'Fighting': 'Lutador', 'Darkness': 'Sombrio', 'Metal': 'Metal', 'Dragon': 'Dragão',
         'Colorless': 'Incolor', 'Fairy': 'Fada'}
RARIDADES = {'Common': 'Comum', 'Uncommon': 'Incomum', 'Rare': 'Rara', 'Double rare': 'Rara Dupla',
             'Illustration rare': 'Ilustração Rara', 'Special illustration rare': 'Ilustração Rara Especial',
             'Ultra Rare': 'Ultra Rara', 'Hyper rare': 'Hiper rara', 'Rare Holo': 'Rara Holo',
             'Holo Rare': 'Rara Holo', 'Holo Rare V': 'Rara Holo V', 'Holo Rare VMAX': 'Rara Holo VMAX',
             'Holo Rare VSTAR': 'Rara Holo VSTAR', 'Radiant Rare': 'Rara Radiante', 'Amazing Rare': 'Raras Incríveis',
             'Secret Rare': 'Rara Secreta', 'ACE SPEC Rare': 'ACE SPEC Raro', 'Shiny rare': 'Shiny rara',
             'Shiny rare V': 'Shiny rara V', 'Shiny rare VMAX': 'Shiny rara VMAX', 'Shiny Ultra Rare': 'Brilhante Ultra Rara',
             'Full Art Trainer': 'Arte Completa de Treinador', 'Black White Rare': 'Rara Preto e Branco',
             'Mega Hyper Rare': 'Mega Hiper Raro', 'None': None}

def baixar(url, binario=False, tentativas=3):
    for i in range(tentativas):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'CardDex'})
            with urllib.request.urlopen(req, timeout=30) as r:
                dados = r.read()
                return dados if binario else json.loads(dados)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
        except Exception:
            pass
        time.sleep(1 + i)
    return None

def salvar_imagem(url, destino):
    if destino.exists() and destino.stat().st_size > 0:
        return True
    dados = baixar(url, binario=True)
    if not dados:
        return False
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(dados)
    return True

def numero(n):
    n = str(n)
    return n.zfill(3) if n.isdigit() else n

def resolver_id(serie_id, col):
    """Acha o id da coleção na TCGdex pelo nome em inglês; se não achar, usa o id informado."""
    if col.get('busca'):
        s = baixar(f'{API}/en/series/{serie_id}') or {}
        for x in s.get('sets', []):
            if x['name'].lower() == col['busca'].lower():
                return x['id']
    return col.get('tcgdex', col['id'])

def processar_carta(args):
    serie_id, colecao, ref, so_mini = args
    cid = ref['id']
    d = baixar(f'{API}/pt/cards/{cid}')
    idioma = 'pt'
    if not d or not d.get('image') or not d.get('name'):
        en = baixar(f'{API}/en/cards/{cid}') or {}
        d = {**en, **{k: v for k, v in (d or {}).items() if v}}
        if not (d or {}).get('image'):
            d['image'] = en.get('image')
        idioma = 'en'
    if not d:
        return None
    num = numero(ref.get('localId', cid.split('-')[-1]))
    pasta = RAIZ / 'assets' / 'img' / 'cartas' / serie_id / colecao
    rel = f'assets/img/cartas/{serie_id}/{colecao}/{num}'
    # imagem em português; se não existir no servidor, usa a imagem em inglês
    bases = [b for b in (d.get('image'), ref.get('image')) if b]
    bases += [b.replace('/pt/', '/en/') for b in bases if '/pt/' in b]
    tem, grande = False, f'{rel}.webp'
    for base in bases:
        # séries com "imagens": "mini" guardam só a miniatura; a carta grande vem da internet
        if so_mini and not (pasta / f'{num}.webp').exists():
            if salvar_imagem(base + '/low.webp', pasta / f'{num}-mini.webp'):
                tem, grande = True, base + '/high.webp'
                break
        elif salvar_imagem(base + '/high.webp', pasta / f'{num}.webp') \
                and salvar_imagem(base + '/low.webp', pasta / f'{num}-mini.webp'):
            tem = True
            break
    return {
        'id': cid, 'numero': num, 'nome': d.get('name') or ref.get('name'),
        'raridade': RARIDADES.get(d.get('rarity'), d.get('rarity')),
        'tipos': [TIPOS.get(t, t) for t in d.get('types') or []], 'ps': d.get('hp'),
        'categoria': CATEGORIAS.get(d.get('category'), d.get('category')),
        'ilustrador': d.get('illustrator'), 'idioma': idioma,
        'imagem': grande if tem else None, 'mini': f'{rel}-mini.webp' if tem else None,
    }

def listar(serie_id):
    for idioma in ('pt', 'en'):
        s = baixar(f'{API}/{idioma}/series/{serie_id}')
        if s:
            print(f'Coleções da série "{serie_id}" ({idioma}):')
            for x in s.get('sets', []):
                print(f"  {x['id']:<10} {x['name']}")
            return
    print('Série não encontrada.')

def main():
    args = sys.argv[1:]
    if args and args[0] == '--listar':
        return listar(args[1] if len(args) > 1 else 'me')
    caminho = RAIZ / 'dados' / 'series.json'
    dados = json.loads(caminho.read_text(encoding='utf-8'))
    for serie in dados['series']:
        # logo da série (português; se não existir, inglês)
        for idioma in ('pt', 'en'):
            s = baixar(f"{API}/{idioma}/series/{serie['id']}") or {}
            if s.get('logo') and salvar_imagem(s['logo'] + '.webp', RAIZ / 'assets' / 'img' / 'series' / f"{serie['id']}.webp"):
                break
        for col in serie['colecoes']:
            if args and serie['id'] not in args and col['id'] not in args:
                continue
            cid = col['id']
            print(f"\n== {serie['nome']} / {col['nome']} ==")
            tid = resolver_id(serie['id'], col)
            conj = baixar(f'{API}/pt/sets/{tid}')
            em_pt = bool(conj and conj.get('cards'))
            if not em_pt:
                conj = baixar(f'{API}/en/sets/{tid}')
            if em_pt and conj.get('name') and not col.get('nomeFixo'):
                col['nome'] = conj['name'].strip()  # nome oficial em português ("nomeFixo": true mantém o nome do series.json)
            if not conj:
                print(f'  não encontrei "{tid}" na TCGdex. Veja: python scripts/baixar_cartas.py --listar {serie["id"]}')
                continue
            # logo da coleção: tenta o do conjunto em português; se não tiver, o em inglês
            logo = conj.get('logo') or (baixar(f'{API}/en/sets/{tid}') or {}).get('logo')
            if logo:
                destino = RAIZ / 'assets' / 'img' / 'colecoes' / serie['id'] / f'{cid}.webp'
                if not salvar_imagem(logo + '.webp', destino) and '/pt/' in logo:
                    salvar_imagem(logo.replace('/pt/', '/en/') + '.webp', destino)
            # junta as cartas em português com as que só existem em inglês
            cartas = list(conj.get('cards', []))
            if em_pt:
                ids = {c['id'] for c in cartas}
                cartas += [c for c in (baixar(f'{API}/en/sets/{tid}') or {}).get('cards', []) if c['id'] not in ids]
            so_mini = serie.get('imagens') == 'mini'
            res = []
            with ThreadPoolExecutor(max_workers=6) as ex:
                for i, r in enumerate(ex.map(processar_carta, [(serie['id'], cid, c, so_mini) for c in cartas]), 1):
                    res.append(r)
                    print(f'  {i}/{len(cartas)}', end='\r')
            res = [r for r in res if r]
            res.sort(key=lambda r: r['numero'])
            saida = RAIZ / 'dados' / 'cartas' / serie['id'] / f'{cid}.json'
            saida.parent.mkdir(parents=True, exist_ok=True)
            saida.write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding='utf-8')
            col['total'] = len(res)
            print(f'  {len(res)} cartas salvas em {saida.relative_to(RAIZ)}')
    caminho.write_text(json.dumps(dados, ensure_ascii=False, indent=2), encoding='utf-8')
    print('\nPronto! Abra o projeto com o Live Server.')

if __name__ == '__main__':
    main()
