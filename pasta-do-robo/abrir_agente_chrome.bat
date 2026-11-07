@echo off
rem Abre o Claude Code com o Chrome ligado. SO PARA CONSULTA, secao 8 do guia:
rem perfil "Agente" do Chrome, sem login na Binance. As ordens saem so do robo, pela API.
cd /d "%~dp0"
where claude >nul 2>nul
if errorlevel 1 (
  echo Claude Code nao encontrado. Instale pelo site code.claude.com e tente de novo.
  pause
  exit /b 1
)
claude --chrome
