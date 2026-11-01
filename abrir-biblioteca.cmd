@echo off
rem Abre a Biblioteca de Jogos: banco, API e pagina, cada um numa janela.
rem Para encerrar, feche as tres janelas (ou Ctrl+C em cada uma).
cd /d "%~dp0"
start "Biblioteca - Banco (deixe aberto)" cmd /k npm run db:embedded
timeout /t 5 /nobreak >nul
start "Biblioteca - API (deixe aberto)" cmd /k npm run dev:server
start "Biblioteca - Pagina (deixe aberto)" cmd /k npm run dev:client -- --open
