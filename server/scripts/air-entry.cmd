@echo off
setlocal

set "SERVER_DIR=%~dp0.."
set "TTS_SCRIPT=%SERVER_DIR%\..\apps\f5-tts\scripts\start_local_api.cmd"
set "SERVER_BIN=%SERVER_DIR%\tmp\main.exe"
set "TTS_PORT=7860"
set "LOG_FILE=%SERVER_DIR%\tmp\air-entry.log"

if not exist "%SERVER_DIR%\tmp" mkdir "%SERVER_DIR%\tmp" >nul 2>nul
echo [%date% %time%] air-entry start >> "%LOG_FILE%"

powershell -NoProfile -Command "if ((Test-NetConnection 127.0.0.1 -Port %TTS_PORT% -WarningAction SilentlyContinue).TcpTestSucceeded) { exit 0 } else { exit 1 }" >nul 2>nul
if errorlevel 1 (
  echo [%date% %time%] tts port %TTS_PORT% closed >> "%LOG_FILE%"
  if exist "%TTS_SCRIPT%" (
    echo [air] f5-tts not detected on 127.0.0.1:%TTS_PORT%, starting...
    echo [%date% %time%] trying start script: %TTS_SCRIPT% >> "%LOG_FILE%"
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%TTS_SCRIPT%' -WindowStyle Minimized" >nul 2>nul
    echo [%date% %time%] start command issued, errorlevel=%ERRORLEVEL% >> "%LOG_FILE%"
  ) else (
    echo [air] f5-tts start script not found: %TTS_SCRIPT%
    echo [%date% %time%] missing script: %TTS_SCRIPT% >> "%LOG_FILE%"
  )
 ) else (
  echo [%date% %time%] tts port %TTS_PORT% already open >> "%LOG_FILE%"
)

if not exist "%SERVER_BIN%" (
  echo [air] server binary not found: %SERVER_BIN%
  exit /b 1
)

call "%SERVER_BIN%"
set "EXIT_CODE=%ERRORLEVEL%"
endlocal & exit /b %EXIT_CODE%
