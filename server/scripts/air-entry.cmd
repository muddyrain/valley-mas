@echo off
setlocal

set "SERVER_DIR=%~dp0.."
set "SERVER_BIN=%SERVER_DIR%\tmp\main.exe"
set "LOG_FILE=%SERVER_DIR%\tmp\air-entry.log"

if not exist "%SERVER_DIR%\tmp" mkdir "%SERVER_DIR%\tmp" >nul 2>nul
echo [%date% %time%] air-entry start >> "%LOG_FILE%"

if not exist "%SERVER_BIN%" (
  echo [air] server binary not found: %SERVER_BIN%
  exit /b 1
)

call "%SERVER_BIN%"
set "EXIT_CODE=%ERRORLEVEL%"
endlocal & exit /b %EXIT_CODE%
