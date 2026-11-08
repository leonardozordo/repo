# Robô de trade — histórico e decisões

Atualizado em 08/11/2026 (guia v1.3)

## Objetivo
Agente autônomo que lê gráficos e indicadores e abre e fecha operações de cripto na Binance sozinho. Todo o desenvolvimento fica centralizado neste projeto.

## Decisões do Leonardo
| Tema | Decisão |
|---|---|
| Capital de teste | US$ 200 por 30 dias |
| Pares | BTC, ETH e SOL (contra USDT) |
| Mercado | Futuros perpétuos, alavancagem de até 5x definida pela análise |
| Sentido | Comprado e vendido: o robô opera os dois lados (02/10) |
| Frequência | Análise a cada 1 hora |
| Entrada | Só quando a soma dos indicadores for positiva; o robô calcula risco/retorno, stop e alvo |
| Quantidade mínima da Binance | Aceita risco de até 2% do saldo quando o mínimo exigir (30/09) |
| Execução | Autônoma, pela linha de comando |
| Onde roda | PC de casa, com o app da Binance, o app do Claude e o Claude Code (30/09) |
| Acompanhamento | Revisão diária do Claude às 22h, com resumo (30/09) |
| Validação | Antes do dinheiro real, simulação de hora em hora por 10 dias |

## Onde está cada coisa
| O quê | Onde |
|---|---|
| Pacote do robô (v4.1) | arquivo trade-automatizado.zip, enviado na conversa do projeto em 02/10 |
| Código, atalhos e resultados no PC de casa | pasta trade-automatizado, extraída do zip |
| Guia para o Claude Code configurar o agente (v1.3) | kit-agente.zip (versão de 08/11) e GitHub `leonardozordo/repo`, ramo `claude/wizardly-lovelace-910v9b`, pasta `pasta-do-robo/` (repositório público); na pasta do robô: CONFIGURAR-AGENTE.md |
| Kit do agente (permissões, seção "Agente" do CLAUDE.md, eventos, rotinas, atalhos) | mesmo kit; vai para dentro da pasta trade-automatizado |
| Lógica dos trades em linguagem simples | este projeto: claude/logica-do-robo.md (cópia na pasta: LOGICA-DO-ROBO.md) |
| Regras completas (v4.1), com o racional | este projeto: claude/regras-robo-v4.md (cópia na pasta: REGRAS-v4.md) |
| Como usar | LEIA-ME.md na pasta; CLAUDE.md orienta o Claude Code |

## Histórico
- Prompt evoluiu da v1 à v3: regras de risco, nota de 0 a 10, dois modelos de entrada (recuo na alta e rompimento), cálculo de stop e alvos com taxas, travas de perda. A v3 era para US$ 200 à vista.
- Existe o MCP oficial da Binance (Claude Code e Claude Desktop), mas ele pede confirmação a cada ordem, ou seja, é semiautomático. Decisão: robô 100% automático.
- A Binance não oferece futuros a residentes no Brasil. O Leonardo decidiu operar futuros mesmo assim e assume o risco de bloqueio da conta.
- O ambiente onde o Claude roda código (nuvem e máquina virtual do app) bloqueia a Binance. Solução: o robô roda direto no Windows, pelo Agendador de Tarefas.
- 29/09/2026: robô v4 programado em Python puro (só precisa do Python instalado). O mesmo motor roda o teste no histórico e a simulação ao vivo.
- Testes automáticos aprovados: o robô não usa informação do futuro; a simulação hora a hora (inclusive com 10h de computador desligado) dá exatamente o mesmo resultado que a rodada contínua; em mercado aleatório ele não inventa lucro; as contas de stop, alvos e tamanho conferem.
- Alavancagem: com risco de 0,75% a 1% por operação, a alavancagem necessária fica em geral entre 1x e 2x. Os 5x são só o teto.
- 30/09/2026: v4.1. Quando a quantidade mínima da Binance fica acima do tamanho calculado, o robô usa o mínimo se o risco ficar em até 2% do saldo; acima disso, ignora o sinal. Teste automático incluído (5 testes aprovados).
- 30/09/2026: instalação muda do notebook do trabalho para o PC de casa. A cópia no notebook do trabalho (v4) não será usada.
- 02/10/2026: documento da lógica dos trades criado (linguagem simples, com exemplos conferidos no próprio robô).
- 02/10/2026: a estratégia principal opera comprado e vendido. A carteira principal da simulação passa a ser "Comprado e vendido"; "Só comprado" fica apenas como comparação.
- 07/11/2026: criado o guia CONFIGURAR-AGENTE.md para o Claude Code no PC de casa: 6 fases com critérios de passagem (preparar o PC, teste no histórico, simulação de 10 dias, envio de ordens no ambiente de demonstração, liberação do real só pelo Leonardo, 30 dias com US$ 200), especificação do envio de ordens, Chrome, permissões e revisões.
- 07/11/2026: o Leonardo pediu um agente que operasse pelo Chrome. O guia mantém as ordens saindo do robô pela conexão oficial da Binance (API), com stop guardado na própria Binance; o Chrome fica só para consulta, num perfil separado sem login na Binance. O Claude não clica em comprar ou vender em corretora.
- Mudança da Binance a considerar: desde 09/12/2025, stops de futuros vão pelo endereço de ordens condicionais (/fapi/v1/algoOrder); o endereço comum devolve erro -4120. O ambiente de demonstração usa chave criada em demo.binance.com.
- 07/11/2026 (sessão do Claude Code na nuvem): o Leonardo pediu de novo o agente operando a Binance pelo Chrome. Mantida a decisão anterior. Além dos motivos do guia, a extensão Claude in Chrome trata corretoras como sites de alto risco.
- 07/11/2026: notícias de outubro de 2026 indicam que a Binance restringiu produtos no Brasil a partir de 27/10, previu migrar os clientes para a Binance Brasil até 29/10 e não oferece futuros a residentes (Lei 6.385/1976). Há relatos de posições de futuros em "somente reduzir" e de uma conta internacional separada (entidade de Abu Dhabi) para elegíveis. O risco de bloqueio assumido em 29/09 pode já ter virado bloqueio. Sem confirmação oficial: o Leonardo confere no app.
- 07/11/2026: guia v1.1 e kit do agente: item de futuros na Fase 0, permissões reforçadas (e o aviso de que não são um cofre), seção "Agente" para o CLAUDE.md, eventos de 10/11/2026 a 13/01/2027, rotinas /revisao-diaria e /atualizar-eventos, atalhos abrir_agente.bat, abrir_agente_chrome.bat e revisao_diaria.bat. Montado na nuvem, sem acesso ao PC nem à Binance: nada foi testado no Windows.
- 07/11/2026: kit enviado ao GitHub (`leonardozordo/repo`, ramo `claude/wizardly-lovelace-910v9b`). O repositório é público; recomendação: torná-lo privado.
- 08/11/2026: revisão do kit (guia v1.2). Corrigido: a revisão diária agendada do jeito padrão abre uma janela e não manda aviso (o guia agora diz isso e mostra como ocultar); o atalho e a rotina da revisão passam a liberar a gravação do arquivo; regras do guia e da seção "Agente" iguais entre si; detalhes da conta internacional da Binance (por iniciativa própria, só derivativos, chave criada nela); stop com closePosition sem quantity nem reduceOnly; mudanças em .claude pedem confirmação. Datas de dezembro conferidas de novo. As duas rotinas foram reconhecidas pelo próprio Claude Code na sessão da nuvem.
- 08/11/2026 (segunda revisão, guia v1.3): operador e guardião precisam ser agendados sem janela (uma janela a cada 5 minutos atrapalha e pode roubar o foco), e o agendamento aos 40 segundos exige PowerShell ou XML; reinício automático do Windows Update entrou na Fase 0; identificadores das ordens limitados a 32 caracteres simples; mais comandos que listam variáveis bloqueados; atalhos com `call`; arquivo de eventos renomeado (vai até janeiro de 2027); confirmado que o Brasil não terá horário de verão em 2026/2027. A conferência automática do kit ficou guardada em ferramentas/validar_kit.py.

## Status
Aguardando o Leonardo: (1) confirmar no app se a conta abre posição de futuros; (2) copiar o kit (v1.3) para a pasta do robô e rodar a Fase 0 com o Claude Code.

## Próximos passos
1. [Leonardo] Abrir o app da Binance > Futuros e ver se consegue abrir posição. Se não, escolher entre as opções da seção 14 do guia antes de seguir.
2. [Leonardo] Desbloquear o kit-agente.zip (Propriedades > Desbloquear), extrair na pasta trade-automatizado, dar dois cliques em abrir_agente.bat e pedir a Fase 0.
3. [Claude Code] Fases 0 a 3 do guia, parando ao fim de cada uma para aprovação do Leonardo.
4. [Leonardo] Fase 4 (liberação do dinheiro real), só se as fases anteriores passarem.
5. [Claude] Revisão diária das 22h: opção A pelo app, se o recurso de pasta do PC estiver disponível; senão, opção B (revisao_diaria.bat no Agendador).
6. [Leonardo] Tornar privado o repositório `leonardozordo/repo` (Settings > General > Danger Zone > Change repository visibility).
