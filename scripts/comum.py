"""Funções usadas por mais de um script do CardDex.

Os scripts importam daqui com:  from comum import baixar
(o Python acha este arquivo porque ele está na mesma pasta do script que está rodando).
"""
import json
import time
import urllib.error
import urllib.request

# Como o CardDex se apresenta para os sites de onde baixa dados
NAVEGADOR = 'CardDex (github.com/Neriival/carddex)'


def baixar(url, binario=False, tentativas=3, tempo=60):
    """Baixa um endereço da internet, tentando de novo se falhar.

    binario=False → devolve o JSON já lido (dicionário/lista)
    binario=True  → devolve os bytes (imagens, por exemplo)
    Devolve None se o endereço não existir (erro 404) ou se falhar em todas as tentativas.
    """
    for i in range(tentativas):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': NAVEGADOR})
            with urllib.request.urlopen(req, timeout=tempo) as r:
                dados = r.read()
                return dados if binario else json.loads(dados)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
        except Exception:
            pass
        time.sleep(1 + i)  # espera um pouco mais a cada tentativa
    return None
