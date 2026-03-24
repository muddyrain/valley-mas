from __future__ import annotations

import base64
import os
import re
import threading
import time
import uuid
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf
from cached_path import cached_path
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from f5_tts.infer.utils_infer import infer_process, load_model, load_vocoder, preprocess_ref_audio_text
from f5_tts.model import DiT

APP_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = APP_ROOT / "outputs"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

BASE_REF = APP_ROOT / "src" / "f5_tts" / "infer" / "examples" / "basic"
VOICE_PRESETS: dict[str, dict[str, str]] = {
    "yier": {
        "ref_audio": str(BASE_REF / "yier.wav"),
        "ref_text": "\u5927\u5bb6\u597d\uff0c\u6211\u53eb\u4e00\u4e8c\uff0c\u542c\u8bf4\u5927\u5bb6\u90fd\u5728\u95ee\u6211\u4e3a\u4ec0\u4e48\u53eb\u4e00\u4e8c\uff0c\u4e0b\u9762\u6211\u6765\u4ecb\u7ecd\u4e00\u4e0b\u6211\u7684\u6765\u5386\u5427\u3002",
    },
    "bubu": {
        "ref_audio": str(BASE_REF / "bubu.wav"),
        "ref_text": "\u5927\u5bb6\u597d\uff0c\u6211\u53eb\u5e03\u5e03\uff0c\u4e0a\u4e2a\u89c6\u9891\u4e00\u4e8c\u5b9d\u505a\u4e86\u81ea\u6211\u4ecb\u7ecd\uff0c\u6211\u4e5f\u7ed9\u5927\u5bb6\u505a\u4e2a\u81ea\u6211\u4ecb\u7ecd\u5427\u3002",
    },
}

MODEL_CFG = dict(dim=1024, depth=22, heads=16, ff_mult=2, text_dim=512, conv_layers=4)
MODEL_CKPT = "hf://SWivid/F5-TTS/F5TTS_v1_Base/model_1250000.safetensors"
VOCAB_ZH = APP_ROOT / "data" / "vocab.txt"
VOCAB_FILE = str(VOCAB_ZH) if VOCAB_ZH.exists() else ""
NFE_STEP = int(os.environ.get("F5_TTS_NFE_STEP", "32"))
CROSS_FADE_SEC = float(os.environ.get("F5_TTS_CROSS_FADE_SEC", "0.20"))
CHINESE_SPEED_MAX = float(os.environ.get("F5_TTS_CHINESE_SPEED_MAX", "1.12"))
OUTPUT_KEEP_SEC = int(os.environ.get("F5_TTS_OUTPUT_KEEP_SEC", str(24 * 3600)))
OUTPUT_MAX_FILES = int(os.environ.get("F5_TTS_OUTPUT_MAX_FILES", "200"))
OUTPUT_CLEANUP_ENABLED = os.environ.get("F5_TTS_OUTPUT_CLEANUP", "0").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}

_RUNTIME_LOCK = threading.Lock()
_REF_LOCK = threading.Lock()
_INFER_LOCK = threading.Lock()
_TASK_LOCK = threading.Lock()
_OUTPUT_CLEAN_LOCK = threading.Lock()
_EMA_MODEL = None
_VOCODER = None
_READY_REF_BY_VOICE: dict[str, tuple[str, str]] = {}
_TASKS: dict[str, dict[str, Any]] = {}
_TASK_KEEP_SEC = int(os.environ.get("F5_TTS_TASK_KEEP_SEC", "3600"))
_HAS_CJK_RE = re.compile(r"[\u4e00-\u9fff]")


class SynthesizeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    voiceId: str = Field(min_length=1)
    speed: float = 1.0
    emotion: str = "neutral"


app = FastAPI(title="Local F5-TTS API", version="1.3.0")


def env_flag(name: str, default: str = "0") -> bool:
    return os.environ.get(name, default).strip().lower() in {"1", "true", "yes", "on"}


def normalize_text(raw: str) -> str:
    text = " ".join(raw.strip().split())
    if not text:
        return text
    if len(text) <= 3 and not text.endswith((".", "。", "!", "！", "?", "？")):
        text = text + "。"
    return text


def apply_emotion_tuning(emotion_raw: str, speed: float) -> tuple[float, float, float, float]:
    # Returns: speed, cfg_strength, sway_sampling_coef, cross_fade_sec
    emotion = (emotion_raw or "neutral").strip().lower()
    cfg_strength = 2.0
    sway_sampling_coef = -1.0
    cross_fade_sec = CROSS_FADE_SEC

    if emotion == "calm":
        speed *= 0.96
        cross_fade_sec = max(cross_fade_sec, 0.22)
    elif emotion == "happy":
        speed *= 1.03
        cross_fade_sec = max(cross_fade_sec, 0.22)
    elif emotion == "sad":
        speed *= 0.94
        cross_fade_sec = max(cross_fade_sec, 0.26)
    elif emotion == "excited":
        speed *= 1.06
        cross_fade_sec = max(cross_fade_sec, 0.20)

    return speed, cfg_strength, sway_sampling_coef, cross_fade_sec


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


def get_ready_reference(voice_id: str, preset: dict[str, str], ref_audio: Path) -> tuple[str, str]:
    cached = _READY_REF_BY_VOICE.get(voice_id)
    if cached is not None:
        return cached

    with _REF_LOCK:
        cached = _READY_REF_BY_VOICE.get(voice_id)
        if cached is not None:
            return cached
        ready = preprocess_ref_audio_text(str(ref_audio), preset["ref_text"])
        _READY_REF_BY_VOICE[voice_id] = ready
        return ready


def upsert_task(task_id: str, **fields: Any) -> dict[str, Any]:
    with _TASK_LOCK:
        task = _TASKS.get(task_id, {"taskId": task_id})
        task.update(fields)
        task["updatedAt"] = int(time.time())
        _TASKS[task_id] = task
        return dict(task)


def get_task(task_id: str) -> dict[str, Any] | None:
    with _TASK_LOCK:
        task = _TASKS.get(task_id)
        if task is None:
            return None
        return dict(task)


def cleanup_old_tasks() -> None:
    now = int(time.time())
    with _TASK_LOCK:
        stale = [k for k, v in _TASKS.items() if now - int(v.get("updatedAt", now)) > _TASK_KEEP_SEC]
        for key in stale:
            _TASKS.pop(key, None)


def cleanup_output_files() -> None:
    if not OUTPUT_CLEANUP_ENABLED:
        return

    # Keep outputs bounded by both age and count to avoid unbounded disk growth.
    if OUTPUT_KEEP_SEC <= 0 and OUTPUT_MAX_FILES <= 0:
        return

    with _OUTPUT_CLEAN_LOCK:
        try:
            wav_files = [p for p in OUTPUT_DIR.glob("*.wav") if p.is_file()]
        except Exception:
            return

        if not wav_files:
            return

        now = time.time()
        for path in wav_files:
            if OUTPUT_KEEP_SEC > 0 and now - path.stat().st_mtime > OUTPUT_KEEP_SEC:
                try:
                    path.unlink(missing_ok=True)
                except Exception:
                    pass

        if OUTPUT_MAX_FILES <= 0:
            return

        try:
            current = sorted(
                [p for p in OUTPUT_DIR.glob("*.wav") if p.is_file()],
                key=lambda p: p.stat().st_mtime,
                reverse=True,
            )
        except Exception:
            return

        for old in current[OUTPUT_MAX_FILES:]:
            try:
                old.unlink(missing_ok=True)
            except Exception:
                pass


def make_audio_response(task_id: str, output_file: str, output_path: Path, sample_rate: int) -> dict[str, Any]:
    response: dict[str, Any] = {
        "taskId": task_id,
        "audioUrl": f"http://127.0.0.1:7860/audio/{output_file}",
        "durationSec": 0,
        "sampleRate": int(sample_rate),
        "format": "wav",
    }
    if env_flag("F5_TTS_RETURN_BASE64", "1"):
        audio_bytes = output_path.read_bytes()
        response["audioBase64"] = base64.b64encode(audio_bytes).decode("ascii")
    return response


def run_synthesize(payload: SynthesizeRequest, task_id: str, report=None) -> dict[str, Any]:
    def step(progress: int, message: str) -> None:
        if report is not None:
            report(progress, message)

    preset = VOICE_PRESETS.get(payload.voiceId)
    if not preset:
        raise HTTPException(status_code=400, detail="unknown voiceId")

    ref_audio = Path(preset["ref_audio"])
    if not ref_audio.exists():
        raise HTTPException(status_code=500, detail=f"reference audio missing: {ref_audio}")

    step(5, "validating")
    ensure_runtime_loaded()

    speed = max(0.7, min(1.4, float(payload.speed or 1.0)))
    speed, cfg_strength, sway_sampling_coef, cross_fade_sec = apply_emotion_tuning(payload.emotion, speed)
    output_file = f"{task_id}.wav"
    output_path = OUTPUT_DIR / output_file

    text = normalize_text(payload.text)
    if not text:
        raise HTTPException(status_code=400, detail="text is empty after normalization")

    if _HAS_CJK_RE.search(text):
        speed = min(speed, CHINESE_SPEED_MAX)
    speed = max(0.7, min(1.4, speed))

    step(25, "preparing reference")
    ref_audio_ready, ref_text_ready = get_ready_reference(payload.voiceId, preset, ref_audio)

    step(55, "running inference")
    with _INFER_LOCK:
        final_wave, final_sample_rate, _ = infer_process(
            ref_audio_ready,
            ref_text_ready,
            text,
            _EMA_MODEL,
            _VOCODER,
            nfe_step=NFE_STEP,
            speed=speed,
            cfg_strength=cfg_strength,
            sway_sampling_coef=sway_sampling_coef,
            cross_fade_duration=cross_fade_sec,
            show_info=lambda *_args, **_kwargs: None,
        )

    step(92, "writing audio")
    peak = float(np.max(np.abs(final_wave))) if len(final_wave) > 0 else 0.0
    if peak > 0.98:
        final_wave = final_wave * (0.92 / peak)
    final_wave = np.clip(final_wave, -0.98, 0.98)
    sf.write(str(output_path), final_wave, final_sample_rate)
    if not output_path.exists():
        raise HTTPException(status_code=500, detail="audio file not generated")
    cleanup_output_files()

    step(100, "completed")
    return make_audio_response(task_id=task_id, output_file=output_file, output_path=output_path, sample_rate=int(final_sample_rate))


def synthesize_task_worker(task_id: str, payload: SynthesizeRequest) -> None:
    try:
        upsert_task(task_id, status="running", progress=10, message="queued")

        def report(progress: int, message: str) -> None:
            upsert_task(task_id, status="running", progress=progress, message=message)

        result = run_synthesize(payload, task_id=task_id, report=report)
        upsert_task(task_id, status="completed", progress=100, message="completed", **result)
    except HTTPException as exc:
        upsert_task(task_id, status="failed", progress=100, message=str(exc.detail), error=str(exc.detail))
    except Exception as exc:
        detail = str(exc).strip()
        if len(detail) > 500:
            detail = detail[:500]
        upsert_task(task_id, status="failed", progress=100, message=detail, error=detail)


@app.on_event("startup")
def warmup_runtime() -> None:
    cleanup_old_tasks()
    cleanup_output_files()
    if env_flag("F5_TTS_EAGER_LOAD", "1"):
        ensure_runtime_loaded()
        return
    threading.Thread(target=ensure_runtime_loaded, daemon=True).start()


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "modelLoaded": _EMA_MODEL is not None}


@app.post("/synthesize")
def synthesize(payload: SynthesizeRequest) -> dict[str, Any]:
    task_id = f"f5-{uuid.uuid4().hex[:12]}"
    return run_synthesize(payload, task_id=task_id)


@app.post("/synthesize/async")
def synthesize_async(payload: SynthesizeRequest) -> dict[str, Any]:
    task_id = f"f5-{uuid.uuid4().hex[:12]}"
    upsert_task(task_id, status="queued", progress=0, message="queued")
    threading.Thread(target=synthesize_task_worker, args=(task_id, payload), daemon=True).start()
    return {
        "taskId": task_id,
        "status": "queued",
        "progress": 0,
        "message": "queued",
    }


@app.get("/task/{task_id}")
def task_status(task_id: str) -> dict[str, Any]:
    task = get_task(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="task not found")
    return task


@app.get("/audio/{filename}")
def audio(filename: str) -> FileResponse:
    safe = Path(filename).name
    path = OUTPUT_DIR / safe
    if not path.exists():
        raise HTTPException(status_code=404, detail="audio not found")
    return FileResponse(path=str(path), media_type="audio/wav", filename=safe)
