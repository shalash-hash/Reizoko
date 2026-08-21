@echo off
cd /d "%~dp0"
set BROWSER=none
pnpm.cmd tauri:dev
