@echo off
setlocal
cd /d "%~dp0"
echo Launching current workspace build...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1" -Mode run
if errorlevel 1 pause
endlocal
