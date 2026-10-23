#!/usr/bin/env python3
"""Deixa todo o CSS e o JavaScript do site no mesmo formato (o "padrão de organização" do CardDex).

Uso (na pasta do projeto):
    python scripts/formatar_codigo.py            # formata tudo em css/ e js/ (e o sw.js)
    python scripts/formatar_codigo.py --conferir # só mostra quais arquivos estão fora do padrão (não muda nada)

Precisa do formatador (uma vez só):  pip install jsbeautifier cssbeautifier esprima

O padrão:
  - 2 espaços de recuo (sem tab)
  - CSS: uma propriedade por linha, terminando com ";", e uma linha em branco entre as regras
  - JS: um comando por linha, blocos { } sempre abertos em várias linhas,
        no máximo 1 linha em branco seguida e linhas de até ~100 caracteres
  - textos de HTML compridos dentro do JS são divididos em pedaços ('...>' + '<...'), um por linha
  - arquivo termina com uma linha em branco
O formatador só mexe em espaços, quebras de linha e na divisão dos textos: o que o código faz não muda.
"""
import re
import sys
from pathlib import Path

try:
    import jsbeautifier
    import cssbeautifier
    import esprima
except ImportError:
    sys.exit('Falta o formatador. Rode: pip install jsbeautifier cssbeautifier esprima')

RAIZ = Path(__file__).resolve().parent.parent
LARGURA = 120          # tamanho máximo desejado de uma linha
PEDACO = 80            # tamanho de cada pedaço quando um texto de HTML comprido é dividido

OPCOES_JS = {
    'indent_size': 2,
    'max_preserve_newlines': 2,         # no máximo 1 linha em branco seguida
    'preserve_newlines': True,
    'wrap_line_length': LARGURA,
    'brace_style': 'collapse',          # "{" na mesma linha; o conteúdo do bloco nas linhas de baixo
    'space_after_anon_function': True,  # function () { ... }
    'end_with_newline': True,
}
OPCOES_CSS = {
    'indent_size': 2,
    'newline_between_rules': True,
    'selector_separator_newline': False,  # ".a, .b {" numa linha só
    'end_with_newline': True,
}

# Só divide um texto se o que vem antes e depois dele garante que "a" + "b" dá o mesmo resultado
# (por exemplo, nunca antes de um "." como em 'texto'.length)
ANTES_OK = {'+', '(', ',', '=', ':', '?', '[', '||', '&&', 'return', '+=', '{'}
DEPOIS_OK = {'+', ')', ',', ';', ':', ']', '}', '?', '||', '&&'}


def dividir_texto(token):
    """'<a><b>...' (comprido) → ["'<a>'", "'<b>...'"]: pedaços de até ~PEDACO caracteres, cortados entre '>' e '<'."""
    conteudo = token[1:-1]
    partes = re.split(r'(?<=>)(?=<)', conteudo)
    pedacos, atual = [], ''
    for p in partes:
        if atual and len(atual) + len(p) > PEDACO:
            pedacos.append(atual)
            atual = ''
        atual += p
    pedacos.append(atual)
    return ["'" + p + "'" for p in pedacos]


def quebrar_textos(js):
    """Divide os textos de HTML compridos (aspas simples) em vários, ligados por '+', um por linha."""
    tokens = esprima.tokenize(js, {'range': True})
    trocas = []
    for i, t in enumerate(tokens):
        if t.type != 'String' or not t.value.startswith("'") or len(t.value) <= PEDACO + 2:
            continue
        antes = tokens[i - 1].value if i else ''
        depois = tokens[i + 1].value if i + 1 < len(tokens) else ''
        if antes not in ANTES_OK or depois not in DEPOIS_OK:
            continue
        pedacos = dividir_texto(t.value)
        if len(pedacos) > 1:
            trocas.append((t.range[0], t.range[1], ' +\n'.join(pedacos)))
    for ini, fim, novo in reversed(trocas):
        js = js[:ini] + novo + js[fim:]
    return js


def juntar_quebras_estranhas(js):
    """O formatador às vezes quebra 'esc(c' + nova linha + '.nome)': junta de volta ('esc(c.nome)').
    Só '.then' e '.catch' em linha própria ficam (promessas encadeadas de propósito)."""
    return re.sub(r'([A-Za-z0-9_$\])])\n[ \t]+(\.(?!then\b|catch\b)[A-Za-z_$])', r'\1\2', js)


def separar_funcoes(js):
    """Uma linha em branco entre o fim de uma função ('}' na margem) e o que vem depois (comentário ou código)."""
    return re.sub(r'^(\}[;)]*)\n(?=[^\n}])', r'\1\n\n', js, flags=re.M)


QUEBRA_DEPOIS = {'+', '&&', '||', ','}  # quebrar a linha logo depois destes é sempre seguro


def quebrar_linhas_longas(js):
    """Linha com mais de LARGURA caracteres: quebra depois do último '+', '&&', '||' ou ',' que cabe na linha."""
    tokens = esprima.tokenize(js, {'range': True, 'loc': True})
    linhas = js.split('\n')
    cortes = []
    for t in tokens:
        if t.type != 'Punctuator' or t.value not in QUEBRA_DEPOIS:
            continue
        lin, col_fim = t.loc.end.line, t.loc.end.column
        if t.loc.start.line == lin and len(linhas[lin - 1]) > LARGURA and col_fim <= LARGURA \
                and linhas[lin - 1][col_fim:].strip():
            cortes.append((lin, col_fim, t.range[1]))
    # um corte por linha: o mais à direita que ainda cabe
    melhor = {}
    for lin, col, pos in cortes:
        if lin not in melhor or col > melhor[lin][0]:
            melhor[lin] = (col, pos)
    for col, pos in sorted(melhor.values(), key=lambda x: -x[1]):
        js = js[:pos] + '\n' + js[pos:].lstrip(' ')
    return js


def pontos_e_virgulas(css):
    """Põe ';' na última propriedade de cada bloco (o formatador deixa sem)."""
    return re.sub(r'([^;{}\s/])\n(\s*)\}', r'\1;\n\2}', css)


def formatar(caminho):
    texto = caminho.read_text(encoding='utf-8')
    if caminho.suffix == '.js':
        # repete até parar de mudar (às vezes o recuo só acerta na segunda passada)
        novo = quebrar_textos(texto)
        for _ in range(10):
            # o formatador (que acerta o recuo) roda por último
            proximo = separar_funcoes(juntar_quebras_estranhas(
                jsbeautifier.beautify(quebrar_linhas_longas(novo), OPCOES_JS)))
            if proximo == novo:
                break
            novo = proximo
    else:
        novo = pontos_e_virgulas(cssbeautifier.beautify(texto, OPCOES_CSS))
    return texto, novo


def arquivos_do_site():
    return sorted(list((RAIZ / 'css').rglob('*.css')) + list((RAIZ / 'js').rglob('*.js')) + [RAIZ / 'sw.js'])


def main():
    so_conferir = '--conferir' in sys.argv
    arquivos = arquivos_do_site()
    fora = 0
    for arq in arquivos:
        antes, depois = formatar(arq)
        if antes.replace('\r\n', '\n') == depois:
            continue
        fora += 1
        print(('fora do padrão: ' if so_conferir else 'formatado: ') + str(arq.relative_to(RAIZ)))
        if not so_conferir:
            arq.write_text(depois, encoding='utf-8', newline='\n')
    print(f'{fora} de {len(arquivos)} arquivos {"fora do padrão" if so_conferir else "formatados"}.')


if __name__ == '__main__':
    main()
