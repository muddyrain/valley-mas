# 本地 F5-TTS 接入说明（Windows）

## 目录
- F5-TTS 主项目：`apps/f5-tts`
- 本地 API 包装：`apps/f5-tts/local_api/server.py`
- 安装脚本：`apps/f5-tts/scripts/setup_windows.cmd`
- 启动脚本：`apps/f5-tts/scripts/start_local_api.cmd`

## 1) 初始化本地环境（只需一次）
在仓库根目录执行：

```bat
cd apps\f5-tts
scripts\setup_windows.cmd
```

> 说明：
> - 默认安装 CPU 版 `torch`。如果你有 NVIDIA GPU，建议先按官方 CUDA 版本安装对应 torch/torchaudio，再执行 `pip install -e .`。
> - 如已通过 `winget` 安装 FFmpeg，请重开一个终端后再启动脚本，确保新 PATH 生效。

## 2) 启动本地 F5-TTS API

```bat
cd apps\f5-tts
scripts\start_local_api.cmd
```

启动成功后会监听：
- `http://127.0.0.1:7860/health`
- `http://127.0.0.1:7860/synthesize`
- `http://127.0.0.1:7860/audio/{filename}`

## 3) server 侧配置
在 `server/.env` 中配置：

```env
TTS_BASE_URL=http://127.0.0.1:7860
TTS_UPSTREAM_PATH=/synthesize
TTS_OUTPUT_DIR=./data/tts
TTS_TIMEOUT_SEC=600
TTS_API_KEY=
```

修改后重启 `server`。

## 4) voiceId 说明
当前包装层支持：
- `bubu-soft-female`
- `bubu-clear-male`
- `bubu-kid-energy`

## 5) 常见问题
- `502 connectex refused`：本地 F5-TTS API 没启动。
- `inference failed`：通常是 Python 依赖未安装完整，先重新执行 `setup_windows.cmd`。
- 首次生成较慢：模型会先加载/下载缓存，CPU 模式可能需要 3-15 分钟。
- 如果长时间无输出：优先看启动 API 的控制台是否有报错，确认 `server/.env` 的 `TTS_TIMEOUT_SEC` 至少为 `600`。
