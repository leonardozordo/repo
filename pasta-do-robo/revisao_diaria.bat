@echo off
rem Revisao diaria das 22h, opcao B da secao 11 do guia, sem perguntas.
rem So leitura, e escrita apenas em resultados\revisao. Teste uma vez antes de agendar.
rem Agendada do jeito padrao, abre uma janela enquanto roda. Para ficar oculta, veja a secao 11.1.
cd /d "%~dp0"
if not exist "logs" mkdir "logs"
if not exist "resultados\revisao" mkdir "resultados\revisao"
echo ==== %date% %time% ====>> "logs\revisao.log"
claude -p "Faca a revisao diaria seguindo o arquivo .claude/skills/revisao-diaria/SKILL.md e grave o resultado em resultados/revisao/" --permission-mode dontAsk --allowedTools "Read" "Grep" "Glob" "Skill(revisao-diaria)" "Bash(py -3 robo/simulador.py status)" "PowerShell(py -3 robo/simulador.py status)" "Edit(resultados/revisao/**)" "Write(resultados/revisao/**)" >> "logs\revisao.log" 2>&1
