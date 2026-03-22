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
set F5_TTS_EAGER_LOAD=1
set F5_TTS_RETURN_BASE64=1
set F5_TTS_CROSS_FADE_SEC=0.20
set F5_TTS_CHINESE_SPEED_MAX=1.12

uvicorn local_api.server:app --host 127.0.0.1 --port 7860

endlocal
