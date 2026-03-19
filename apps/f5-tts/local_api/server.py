from __future__ import annotations

import os
import threading
import uuid
from pathlib import Path
from typing import Any

from cached_path import cached_path
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
import soundfile as sf

from f5_tts.infer.utils_infer import infer_process, load_model, load_vocoder, preprocess_ref_audio_text
from f5_tts.model import DiT

APP_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = APP_ROOT / "outputs"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

BASE_REF = APP_ROOT / "src" / "f5_tts" / "infer" / "examples" / "basic"
# 自定义音色目录：将你的 mp3/wav 放到 apps/f5-tts/data/ 下
CUSTOM_VOICE_DIR = APP_ROOT / "data"
VOICE_PRESETS: dict[str, dict[str, str]] = {
    "bubu": {
        # 👇 换成你自己的音频文件，ref_text 填写音频中说的文字内容
        "ref_audio": str(BASE_REF / "bubu.wav"),
        "ref_text": "大家好，我叫布布，上个视频一二宝做了自我介绍，我也给大家做个自我介绍吧。",
    },
}

MODEL_CFG = dict(dim=1024, depth=22, heads=16, ff_mult=2, text_dim=512, conv_layers=4)
# 使用支持中文的模型和词表（中英双语社区微调版）
# 模型来自: https://huggingface.co/SWivid/F5-TTS
MODEL_CKPT = "hf://SWivid/F5-TTS/F5TTS_v1_Base/model_1250000.safetensors"
# 中文 vocab：包含中文字符的词表文件路径（需手动下载放到 data/ 目录下）
# 下载地址: https://huggingface.co/datasets/amphion/multilingual_text_to_speech/resolve/main/F5TTS/vocab_zh.txt
VOCAB_ZH = APP_ROOT / "data" / "vocab.txt"
# 如果有中文词表就用，否则 fallback 到默认英文词表（中文会乱码）
VOCAB_FILE = str(VOCAB_ZH) if VOCAB_ZH.exists() else ""
# NFE_STEP: 推理步数，越高质量越好，速度越慢
# 8  = 极速但音质很差（噪声明显）
# 16 = 快速，质量一般
# 32 = 推荐，质量与速度平衡（官方默认）
# 64 = 最高质量，较慢
NFE_STEP = int(os.environ.get("F5_TTS_NFE_STEP", "32"))

_RUNTIME_LOCK = threading.Lock()
_INFER_LOCK = threading.Lock()
_EMA_MODEL = None
_VOCODER = None


class SynthesizeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    voiceId: str = Field(min_length=1)
    speed: float = 1.0


app = FastAPI(title="Local F5-TTS API", version="1.1.0")


def ensure_runtime_loaded() -> None:
    global _EMA_MODEL, _VOCODER
    if _EMA_MODEL is not None and _VOCODER is not None:
        return

    with _RUNTIME_LOCK:
        if _EMA_MODEL is not None and _VOCODER is not None:
            return

        ckpt_path = str(cached_path(MODEL_CKPT))
        _VOCODER = load_vocoder()
        _EMA_MODEL = load_model(DiT, MODEL_CFG, ckpt_path, vocab_file=VOCAB_FILE)


@app.on_event("startup")
def warmup_runtime() -> None:
    # Warm up in background so first request does not pay full cold-start penalty.
    threading.Thread(target=ensure_runtime_loaded, daemon=True).start()


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "modelLoaded": _EMA_MODEL is not None}


@app.post("/synthesize")
def synthesize(payload: SynthesizeRequest) -> dict[str, Any]:
    preset = VOICE_PRESETS.get(payload.voiceId)
    if not preset:
        raise HTTPException(status_code=400, detail="unknown voiceId")

    ref_audio = Path(preset["ref_audio"])
    if not ref_audio.exists():
        raise HTTPException(status_code=500, detail=f"reference audio missing: {ref_audio}")

    ensure_runtime_loaded()

    speed = max(0.7, min(1.4, float(payload.speed or 1.0)))
    task_id = f"f5-{uuid.uuid4().hex[:12]}"
    output_file = f"{task_id}.wav"
    output_path = OUTPUT_DIR / output_file

    try:
        text = payload.text.strip()
        if len(text) <= 3 and not text.endswith((".", "。", "!", "！", "?", "？")):
            text = text + "。"
        ref_audio_ready, ref_text_ready = preprocess_ref_audio_text(str(ref_audio), preset["ref_text"])
        with _INFER_LOCK:
            final_wave, final_sample_rate, _ = infer_process(
                ref_audio_ready,
                ref_text_ready,
                text,
                _EMA_MODEL,
                _VOCODER,
                nfe_step=NFE_STEP,
                speed=speed,
                show_info=lambda *_args, **_kwargs: None,
            )
        sf.write(str(output_path), final_wave, final_sample_rate)
    except Exception as exc:
        detail = str(exc).strip()
        if len(detail) > 500:
            detail = detail[:500]
        raise HTTPException(status_code=500, detail=f"inference failed: {detail}") from exc

    if not output_path.exists():
        raise HTTPException(status_code=500, detail="audio file not generated")

    return {
        "taskId": task_id,
        "audioUrl": f"http://127.0.0.1:7860/audio/{output_file}",
        "durationSec": 0,
        "sampleRate": 24000,
        "format": "wav",
    }


@app.get("/audio/{filename}")
def audio(filename: str) -> FileResponse:
    safe = Path(filename).name
    path = OUTPUT_DIR / safe
    if not path.exists():
        raise HTTPException(status_code=404, detail="audio not found")
    return FileResponse(path=str(path), media_type="audio/wav", filename=safe)
