@echo off
setlocal

cd /d %~dp0\..

if not exist .venv (
  py -3.11 -m venv .venv
)

call .venv\Scripts\activate
python -m pip install -U pip

REM Install PyTorch first (CPU default). If you have NVIDIA CUDA, replace with cu12x wheel command.
pip install torch torchaudio

REM Install F5-TTS and local API runtime
pip install -e .
pip install fastapi "uvicorn[standard]" soundfile

echo Setup complete.
endlocal
