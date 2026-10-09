#!/usr/bin/env python3
"""Atualiza os preços das cartas pela Liga Pokémon (mercado brasileiro, em real).

Uso (na pasta do projeto):
    python scripts/atualizar_precos_liga.py            # atualiza o que der no tempo limite
    python scripts/atualizar_precos_liga.py me01 sv01  # só essas coleções

Roda sozinho no GitHub (.github/workflows/precos-liga.yml), mas também dá para rodar à mão.

Como funciona:
 1) A página de uma coleção na Liga (?view=cards/search&card=ed=<SIGLA>) já traz todas as cartas
    com o menor, o médio e o maior preço. Então é um acesso por coleção, não por carta.
 2) A Liga pede (robots.txt, "Crawl-delay: 360") 6 minutos entre um acesso e outro. O script respeita isso,
    por isso as ~85 coleções não cabem numa rodada só: cada rodada atualiza primeiro as que estão há mais
    tempo sem atualizar, até o tempo limite (TEMPO_LIMITE_MIN, padrão 315 minutos).
 3) Grava dados/precos-liga/<serie>.json, que o site lê (js/base/precos.js):
      { "fonte": "Liga Pokémon", "colecoes": { "me01": "2026-10-08", ... },
        "precos": { "me01-001": [0.12, 2.38, 60.0], ... } }      # [menor, médio, maior] em real
    Coleção que ainda não está em "colecoes" continua com o preço do Cardmarket no site.
"""
import json, os, re, sys, time, datetime, urllib.request, urllib.parse
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PASTA = RAIZ / 'dados' / 'precos-liga'
URL = 'https://www.ligapokemon.com.br/?view=cards/search&card=' + urllib.parse.quote('ed=')
UA = 'Mozilla/5.0 (compatible; CardDex/1.0; +https://github.com/Neriival/carddex)'
ESPERA = 360  # segundos entre acessos (Crawl-delay da Liga)

# Coleção do CardDex → sigla da coleção na Liga (lista em ?view=cards/edicoes)
SIGLAS = {
    # Mega Evolução
    'me01': 'MEG', 'mep': 'MEP', 'mee': 'MEEb', 'me02': 'PFL', 'me025': 'ASC', 'me03': 'POR', 'me04': 'CRI', 'me05': 'PBL',
    '30c': '30C', '30cc': '30C-C',
    # Escarlate e Violeta
    'sv01': 'SV1', 'sv02': 'PAL', 'sv03': 'OBF', 'sv035': 'MEW', 'sv04': 'PAR', 'sv045': 'PAF',
    'sv05': 'TEF', 'sv06': 'TWM', 'sv065': 'SFA', 'sv07': 'SCR', 'sv08': 'SSP', 'sv085': 'PRE',
    'sv09': 'JTG', 'sv10': 'DRI', 'sv105w': 'WHT', 'sv105b': 'BLK', 'svp': 'SVP', 'sve': 'SV-BE',
    # Espada e Escudo
    'swsh1': 'SSH', 'swsh2': 'RCL', 'swsh3': 'DAA', 'fut2020': 'FUT20', 'swsh35': 'CPA', 'swsh4': 'VIV',
    'swsh45': 'SHF', 'swsh45sv': 'SFS', 'swsh5': 'BST', 'swsh6': 'CRE', 'swsh7': 'EVS',
    'cel25': 'CEL', 'cel25cc': 'CCC', 'swsh8': 'FST', 'swsh9': 'BRS', 'swsh9tg': 'BSTG',
    'swsh10': 'ASR', 'swsh10tg': 'ARTG', 'swsh105': 'PGO', 'swsh11': 'LOR', 'swsh11tg': 'LORTG',
    'swsh12': 'SIT', 'swsh12tg': 'SITTG', 'swsh125': 'CRZ', 'swsh125gg': 'CZGG', 'swshp': 'SSPR',
    # Sol e Lua
    'sm1': 'SUM', 'sm2': 'GRI', 'sm3': 'BUS', 'sm35': 'SLG', 'sm4': 'CIN', 'sm5': 'UPR', 'sm6': 'FLI',
    'sm7': 'CES', 'sm75': 'DRM', 'sm8': 'LOT', 'sm9': 'TEU', 'det1': 'DET', 'sm10': 'UNB',
    'sm11': 'UNM', 'sm115': 'HIF', 'sma': 'HIF', 'sm12': 'CEC', 'smp': 'SMP',
    # XY
    'xyp': 'XYPR', 'xy0': 'KSS', 'xy1': 'XY', 'xy2': 'FLF', 'xy3': 'FFI', 'xy4': 'PHF', 'xy5': 'PRC',
    'dc1': 'DCR', 'xy6': 'ROS', 'xy7': 'AOR', 'xy8': 'BKT', 'xy9': 'BKP', 'g1': 'GEN', 'xy10': 'FCO',
    'xy11': 'STS', 'xy12': 'EVO',
}

# Coleções em que a Liga usa outra numeração (o número original de cada carta), mas na mesma ordem:
# a carta é achada pela posição na lista.
POR_ORDEM = {'30cc'}


def numero(n):
    """'001' → '1', 'TG01' → 'TG1', 'SWSH001' → 'SWSH1', 'RC5' → 'RC5' (para comparar os dois lados)."""
    m = re.fullmatch(r'([A-Za-z]*)0*(\d+)([A-Za-z]*)', (n or '').strip())
    return (m.group(1) + m.group(2) + m.group(3)).upper() if m else (n or '').strip().upper()


def real(v):
    try:
        v = round(float(v), 2)
        return v if v > 0 else None
    except (TypeError, ValueError):
        return None


def cartas_da_liga(sigla):
    """Baixa a página da coleção e devolve ({ número normalizado: [menor, médio, maior] }, [preço de cada carta na ordem da Liga])."""
    req = urllib.request.Request(URL + urllib.parse.quote(sigla), headers={'User-Agent': UA, 'Accept-Language': 'pt-BR'})
    with urllib.request.urlopen(req, timeout=90) as r:
        html = r.read().decode('utf-8', 'ignore')
    i = html.find('var cardsjson = ')
    if i < 0:
        raise ValueError('página sem a lista de cartas (a Liga mudou o site ou bloqueou o acesso)')
    lista, _ = json.JSONDecoder().raw_decode(html, i + len('var cardsjson = '))
    precos, ordem = {}, []
    for c in sorted(lista, key=lambda c: c.get('dN') or ''):
        p = [real(c.get('p1a')), real(c.get('p1b')), real(c.get('p1c'))]
        if not any(p):
            ordem.append(None)
            continue
        medio = p[1] or p[0] or p[2]
        p = [p[0] or medio, medio, p[2] or medio]
        ordem.append(p)
        n = numero(c.get('sN'))
        # a mesma carta pode aparecer mais de uma vez (versões com carimbo etc.): fica a mais barata, que é a comum
        if n not in precos or p[1] < precos[n][1]:
            precos[n] = p
    return precos, ordem


def main():
    series = json.loads((RAIZ / 'dados' / 'series.json').read_text(encoding='utf-8'))['series']
    colecoes = {}  # coleção → (série, [(id da carta, número)])
    for s in series:
        for c in s['colecoes']:
            arq = RAIZ / 'dados' / 'cartas' / s['id'] / f"{c['id']}.json"
            if arq.exists() and c['id'] in SIGLAS:
                colecoes[c['id']] = (s['id'], [(k['id'], k['numero']) for k in json.loads(arq.read_text(encoding='utf-8'))])
    sem_sigla = [c['id'] for s in series for c in s['colecoes'] if c['id'] not in SIGLAS]
    if sem_sigla:
        print('Coleções sem sigla da Liga (adicione em SIGLAS):', ', '.join(sem_sigla))

    PASTA.mkdir(parents=True, exist_ok=True)
    dados = {}
    for serie in {v[0] for v in colecoes.values()}:
        arq = PASTA / f'{serie}.json'
        dados[serie] = json.loads(arq.read_text(encoding='utf-8')) if arq.exists() else {'fonte': 'Liga Pokémon', 'colecoes': {}, 'precos': {}}

    # ordem: as escolhidas na linha de comando; senão, nunca atualizadas primeiro e depois as mais antigas
    if sys.argv[1:]:
        fila = [c for c in sys.argv[1:] if c in colecoes]
    else:
        fila = sorted(colecoes, key=lambda c: dados[colecoes[c][0]]['colecoes'].get(c, ''))
    limite = time.time() + float(os.environ.get('TEMPO_LIMITE_MIN', 315)) * 60

    feitas = 0
    for n, col in enumerate(fila):
        if n and time.time() + ESPERA > limite:
            print(f'Tempo limite: {len(fila) - n} coleções ficam para a próxima rodada.')
            break
        if n:
            time.sleep(ESPERA)
        serie, cartas = colecoes[col]
        try:
            liga, ordem = cartas_da_liga(SIGLAS[col])
        except Exception as e:
            print(f'{col} ({SIGLAS[col]}): erro – {e}')
            continue
        d = dados[serie]
        if col in POR_ORDEM and len(ordem) != len(cartas):
            print(f'{col} ({SIGLAS[col]}): a Liga listou {len(ordem)} cartas e o CardDex tem {len(cartas)}; não dá para ligar pela ordem')
            continue
        for i, (k, num) in enumerate(cartas):
            p = ordem[i] if col in POR_ORDEM else liga.get(numero(num))
            if p:
                d['precos'][k] = p
            else:
                d['precos'].pop(k, None)
        d['colecoes'][col] = datetime.date.today().isoformat()
        d['atualizado'] = max(d['colecoes'].values())
        (PASTA / f'{serie}.json').write_text(json.dumps(d, ensure_ascii=False, sort_keys=True, separators=(',', ':')), encoding='utf-8')
        com = sum(1 for k, _ in cartas if k in d['precos'])
        print(f'{col} ({SIGLAS[col]}): {com} de {len(cartas)} cartas com preço (a Liga listou {len(ordem)})', flush=True)
        feitas += 1
    print(f'Pronto! {feitas} coleções atualizadas.')


if __name__ == '__main__':
    main()
