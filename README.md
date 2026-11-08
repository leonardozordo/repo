# Robô de trade — kit do agente

Kit para configurar o Claude Code como agente do robô de trade no PC de casa (Windows). O robô em si (Python, pasta `trade-automatizado`) não está neste repositório.

| Caminho | O que é |
|---|---|
| `pasta-do-robo/` | tudo o que vai para dentro da pasta `trade-automatizado` |
| `pasta-do-robo/CONFIGURAR-AGENTE.md` | guia v1.3 que o Claude Code segue, fase a fase |
| `pasta-do-robo/.claude/` | permissões e rotinas (`/revisao-diaria`, `/atualizar-eventos`) |
| `pasta-do-robo/kit-fase0/` | seção "Agente" para o `CLAUDE.md` e eventos de nov/2026 a jan/2027 |
| `docs/historico-robo-trade.md` | histórico e decisões do projeto |
| `ferramentas/validar_kit.py` | conferência automática do kit, para sessões do Claude Code (precisa de `jsonschema` e `pyyaml`) |

## Como usar
1. No app da Binance, confira se a conta abre posição de futuros (seção 14 do guia).
2. Copie o conteúdo de `pasta-do-robo/` para dentro de `trade-automatizado`. Se baixou em `.zip`, antes de extrair: botão direito > Propriedades > Desbloquear.
3. Dê dois cliques em `abrir_agente.bat` e peça: "Leia o arquivo CONFIGURAR-AGENTE.md inteiro e execute a Fase 0."

As ordens saem só do robô, pela API da Binance. O Claude não opera a corretora pelo Chrome.
