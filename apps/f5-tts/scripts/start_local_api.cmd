@echo off
setlocal

cd /d %~dp0\..

if not exist .venv\Scripts\python.exe (
  echo Missing virtual env. Run scripts\setup_windows.cmd first.
  exit /b 1
)

call .venv\Scripts\activate
set PYTHON_EXE=%cd%\.venv\Scripts\python.exe
set FFMPEG_LINKS=%LOCALAPPDATA%\Microsoft\WinGet\Links
if exist "%FFMPEG_LINKS%\ffmpeg.exe" set "PATH=%FFMPEG_LINKS%;%PATH%"

uvicorn local_api.server:app --host 127.0.0.1 --port 7860

endlocal
