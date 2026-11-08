"""Conferência automática do kit do agente de trade.

Uso (numa sessão do Claude Code, com internet):
    python3 ferramentas/validar_kit.py [esquema.json]

Sem o argumento, baixa o esquema oficial de configurações do Claude Code.
Precisa de jsonschema e pyyaml. Sai com código 1 se houver falha.
"""
import datetime
import glob
import json
import os
import re
import sys
import urllib.request

import jsonschema
import yaml

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KIT = os.path.join(RAIZ, "pasta-do-robo")
URL_ESQUEMA = "https://www.schemastore.org/claude-code-settings.json"
SO_BASH = {"Bash(env)", "Bash(env *)", "Bash(printenv*)", "Bash(export)", "Bash(export -p*)",
           "Bash(declare -x*)", "Bash(declare -p*)", "Bash(typeset -x*)", "Bash(typeset -p*)"}
falhas, avisos = [], []


def ler(p, binario=False):
    with open(p, "rb" if binario else "r", **({} if binario else {"encoding": "utf-8"})) as f:
        return f.read()


def checa(cond, msg):
    if cond:
        print("  ok   ", msg)
    else:
        falhas.append(msg)
        print("  FALHA", msg)


def carregar_esquema():
    if len(sys.argv) > 1:
        return json.loads(ler(sys.argv[1]))
    with urllib.request.urlopen(URL_ESQUEMA, timeout=30) as r:
        return json.loads(r.read())


esquema = carregar_esquema()
defs = esquema.get("$defs") or esquema.get("definitions")
padrao_regra = re.compile(defs["permissionRule"]["pattern"])
guia = ler(os.path.join(KIT, "CONFIGURAR-AGENTE.md"))
versao = re.search(r"guia versão (\d+\.\d+)", guia).group(1)

print(f"Guia na versão {versao}")
print("1. Permissões")
settings = json.loads(ler(os.path.join(KIT, ".claude/settings.json")))
try:
    jsonschema.validate(settings, esquema)
    checa(True, "settings.json válido pelo esquema oficial")
except jsonschema.ValidationError as e:
    checa(False, f"settings.json inválido: {e.message}")
bloco = re.search(r"```json\n(\{\n  \"\$schema\".*?\n\})\n```", guia, re.S)
checa(bloco is not None and json.loads(bloco.group(1)) == settings, "bloco JSON da seção 9 idêntico ao settings.json")
perm = settings["permissions"]
todas = [r for k in ("allow", "ask", "deny") for r in perm[k]]
checa(len(todas) == len(set(todas)), f"sem regras repetidas ({len(todas)} regras)")
for r in todas:
    if r.startswith("Bash(") and r not in SO_BASH and "PowerShell(" + r[5:] not in todas:
        avisos.append(f"regra Bash sem espelho PowerShell: {r}")
for alvo in perm["allow"]:
    cmd = alvo[alvo.index("(") + 1:-1]
    for d in perm["deny"]:
        if d.split("(")[0] == alvo.split("(")[0]:
            rx = "^" + re.escape(d[d.index("(") + 1:-1]).replace(r"\*", ".*") + "$"
            if re.match(rx, cmd):
                checa(False, f"'{d}' bloquearia o comando liberado '{alvo}'")
checa(True, "nenhum bloqueio atinge comando liberado")

print("2. Rotinas")
for nome in ("revisao-diaria", "atualizar-eventos"):
    t = ler(os.path.join(KIT, f".claude/skills/{nome}/SKILL.md"))
    fm = yaml.safe_load(t.split("---\n")[1])
    checa(fm.get("name") == nome, f"{nome}: nome confere")
    checa(isinstance(fm.get("description"), str) and len(fm["description"]) < 1024, f"{nome}: descrição válida")
    if "allowed-tools" in fm:
        ruins = [x.strip() for x in fm["allowed-tools"].split(",") if not padrao_regra.match(x.strip())]
        checa(not ruins, f"{nome}: allowed-tools no formato do esquema {ruins or ''}")

print("3. Atalhos")
for b in ("abrir_agente.bat", "abrir_agente_chrome.bat", "revisao_diaria.bat"):
    raw = ler(os.path.join(KIT, b), binario=True)
    linhas = raw.split(b"\n")
    checa(all(x.endswith(b"\r") for x in linhas[:-1]) and linhas[-1] == b"", f"{b}: linhas em CRLF")
    checa(all(c < 128 for c in raw), f"{b}: só ASCII")
    txt = raw.decode()
    checa(txt.count("(") == txt.count(")"), f"{b}: parênteses balanceados")
    checa('cd /d "%~dp0"' in txt and "\ncall claude" in txt.replace("\r", ""), f"{b}: entra na pasta e usa 'call claude'")
rev = ler(os.path.join(KIT, "revisao_diaria.bat"))
regras = re.findall(r'"([A-Za-z]+(?:\([^)]*\))?)"', rev.split("--allowedTools", 1)[1])
ruins = [x for x in regras if not padrao_regra.match(x)]
checa(regras and not ruins, f"revisao_diaria.bat: {len(regras)} regras no formato do esquema {ruins or ''}")
checa("Write(resultados/revisao/**)" in regras and "--permission-mode dontAsk" in rev, "revisao_diaria.bat: grava a revisão, modo dontAsk")

print("4. Eventos")
arqs = glob.glob(os.path.join(KIT, "kit-fase0", "eventos-*.csv"))
checa(len(arqs) == 1, "um único arquivo de eventos no kit")
nome_csv = os.path.basename(arqs[0])
lin = ler(arqs[0]).strip("\n").split("\n")
checa(all(re.fullmatch(r"\d{4}-\d{2}-\d{2} \d{2}:\d{2};[ -~]+", x) for x in lin), "formato AAAA-MM-DD HH:MM;descrição, só ASCII")
datas = [datetime.datetime.strptime(x.split(";")[0], "%Y-%m-%d %H:%M") for x in lin]
checa(datas == sorted(datas) and len(set(lin)) == len(lin), f"{len(lin)} eventos em ordem, sem repetição")
checa(all(d.weekday() < 5 for d in datas), "todos em dia útil")
checa(f"kit-fase0/{nome_csv}" in guia, f"guia cita o arquivo {nome_csv}")
ini, fim = datas[0], datas[-1]
checa(f"{ini.year}-{ini.month:02d}" in nome_csv and f"{fim.year}-{fim.month:02d}" in nome_csv, "nome do arquivo cobre o primeiro e o último mês")

print("5. Guia")
secoes = set(re.findall(r"^## (\d+)\.", guia, re.M)) | set(re.findall(r"^### (\d+\.\d+)", guia, re.M))
faltando = sorted(r for r in set(re.findall(r"seç(?:ão|ões) (\d+(?:\.\d+)?)", guia)) if r not in secoes)
checa(not faltando, f"toda 'seção N' citada existe {faltando or ''}")
for arq in ("abrir_agente.bat", "abrir_agente_chrome.bat", "revisao_diaria.bat", "kit-fase0/CLAUDE-secao-agente.md",
            ".claude/settings.json", ".claude/skills/revisao-diaria/SKILL.md"):
    checa(arq.split("/")[-1] in guia and os.path.exists(os.path.join(KIT, arq)), f"citado e presente: {arq}")
checa(not re.search(r"\(v1\.\d\)|Kit v1\.\d|vem no kit \(v", guia), "sem rótulos velhos de versão")
checa(f"**Versão {versao} (" in guia.split("## 16.")[-1] and "está na seção 16" in guia, "histórico de versões na seção 16, com a versão atual")
checa(not re.search(r"Claude Code sem janela|revisão diária sem janela|SKILL.md` sem janela", guia), "não promete revisão sem janela")
for trecho in ("32 caracteres", "Reinício automático", "pyw -3", "closePosition=true`, não envie"):
    checa(trecho in guia, f"guia contém: {trecho}")

print("6. Tabelas markdown")
for p in ("pasta-do-robo/CONFIGURAR-AGENTE.md", "README.md", "docs/historico-robo-trade.md"):
    codigo, cols0 = False, None
    for n, x in enumerate(ler(os.path.join(RAIZ, p)).split("\n"), 1):
        if x.startswith("```"):
            codigo = not codigo
        if codigo or not x.startswith("|"):
            cols0 = None
            continue
        cols = len(re.findall(r"(?<!\\)\|", re.sub(r"`[^`]*`", "", x))) - 1
        if cols0 is None:
            cols0 = cols
        elif cols != cols0:
            checa(False, f"{p}:{n} tem {cols} colunas, a tabela tem {cols0}")
    checa(True, f"{p}: tabelas conferidas")

print("7. Regras do guia x seção 'Agente' do CLAUDE.md")
sec = ler(os.path.join(KIT, "kit-fase0/CLAUDE-secao-agente.md"))
rg = dict(re.findall(r"^(\d+)\. (.*)$", guia.split("## 4. Regras invioláveis")[1].split("## 5.")[0], re.M))
rc = dict(re.findall(r"^(\d+)\. (.*)$", sec, re.M))
checa(list(rg) == list(rc) == [str(i) for i in range(1, 17)], "as duas listas têm as regras 1 a 16")
dif = [k for k in rg if rg[k] != rc.get(k)]
checa(not dif, f"regras idênticas {('diferem: ' + ', '.join(dif)) if dif else ''}")

print("8. Versão citada nos documentos")
checa(f"guia v{versao}" in ler(os.path.join(RAIZ, "README.md")), f"README cita a v{versao}")
checa(f"guia v{versao}" in ler(os.path.join(RAIZ, "docs/historico-robo-trade.md")), f"histórico cita a v{versao}")

print()
for a in avisos:
    print("  AVISO", a)
print(f"\nRESULTADO: {len(falhas)} falha(s), {len(avisos)} aviso(s)")
sys.exit(1 if falhas else 0)
