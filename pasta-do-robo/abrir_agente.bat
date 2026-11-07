@echo off
rem Abre o Claude Code (o agente) ja na pasta do robo.
cd /d "%~dp0"
where claude >nul 2>nul
if errorlevel 1 (
  echo Claude Code nao encontrado. Instale pelo site code.claude.com e tente de novo.
  pause
  exit /b 1
)
claude
