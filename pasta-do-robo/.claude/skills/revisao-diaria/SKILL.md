---
name: revisao-diaria
description: Revisão diária do robô de trade (seção 11.1 do CONFIGURAR-AGENTE.md). Use quando o Leonardo pedir a revisão do dia, perguntar "como está o robô hoje?" ou na tarefa agendada das 22h.
allowed-tools: Read, Grep, Glob, Bash(py -3 robo/simulador.py status), PowerShell(py -3 robo/simulador.py status), Edit(resultados/revisao/**)
---

# Revisão diária

Só leitura. Não rode nenhum outro comando e não mexa em código, configuração, tarefas agendadas ou ordens. Se algo exigir ação, anote no item 6 e pare.

## O que ler
1. A saída de `py -3 robo/simulador.py status`.
2. `logs/simulacao.log`: erros e avisos das últimas 24 horas.
3. `resultados/simulacao/`: saldo, operações e alertas de cada carteira.
4. Se existirem, `resultados/papel/`, `resultados/teste/` e `resultados/real/`: `estado.json`, `operacoes.csv`, `alertas.md` e `diario.md`.
5. `resultados/backtest/metricas.json`: operações por semana e resultado médio esperados.
6. `robo/eventos.csv`: eventos das próximas 48 horas.

Arquivo que não existir: diga que não existe e siga.

## O que entregar (curto, em tabelas, linguagem simples)
1. Saldo e resultado do dia de cada carteira (e da conta real, quando houver).
2. Operações do dia: par, sentido, motivo da entrada, como saiu e resultado em US$ e em R (1R é quanto se perde quando o stop é atingido).
3. Alertas, erros e travas acionadas. Linha obrigatória: "Posição sem stop: nenhuma". Se houver alguma, ela vai no topo, em destaque.
4. Comparação com o teste no histórico: operações por semana e resultado médio.
5. Eventos econômicos das próximas 48 horas, no horário de Brasília.
6. O que o Leonardo precisa fazer (ou "nada").

Alerta sempre no formato: o que aconteceu → o que o robô fez → o que o Leonardo precisa fazer. Nunca prometer lucro.

Grave em `resultados/revisao/AAAA-MM-DD.md` (data de hoje, horário de Brasília). Se o arquivo já existir, acrescente uma seção com a hora.
