import { Download, Loader2, Mic2, PlayCircle, Sparkles, Trash2, Volume2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  synthesizeTtsAsync,
  TTS_VOICE_PRESETS,
  type TtsEmotion,
  type TtsProgressResult,
} from '@/api/tts';
import bubuAvatar from '@/assets/bubu.jpeg';
import yierAvatar from '@/assets/yier.jpeg';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const MAX_TEXT_LENGTH = 240;
const MAX_SSE_TIME_MS = 10 * 60 * 1000;
const HISTORY_KEY = 'tts_history_v2';
const MAX_HISTORY_ITEMS = 20;
const DB_NAME = 'tts_history_audio_db';
const DB_STORE = 'audio_blobs';
const TTS_EMOTION_OPTIONS: Array<{ value: TtsEmotion; label: string; hint: string }> = [
  { value: 'neutral', label: '自然', hint: '平稳自然，适合通用旁白' },
  { value: 'calm', label: '平静', hint: '更柔和，适合治愈风格' },
  { value: 'happy', label: '开心', hint: '更轻快，适合种草推荐' },
  { value: 'sad', label: '低沉', hint: '更慢更柔，适合故事情节' },
  { value: 'excited', label: '激昂', hint: '更有张力，适合宣传口播' },
];
const VOICE_THEME: Record<
  string,
  {
    mascot: string;
    intro: string;
    bubble: string;
    avatar: string;
  }
> = {
  yier: {
    mascot: '一二 · 白熊',
    intro: '轻甜清亮，适合可爱口播、日常解说',
    bubble: 'from-[#f4effa] via-[#fff7fb] to-white',
    avatar: yierAvatar,
  },
  bubu: {
    mascot: '布布 · 棕熊',
    intro: '温暖厚实，适合故事叙述、陪伴感场景',
    bubble: 'from-[#f4ecfb] via-[#fff7ef] to-white',
    avatar: bubuAvatar,
  },
};

type TtsHistoryMeta = {
  id: string;
  taskId: string;
  text: string;
  voiceId: string;
  voiceName: string;
  speed: number;
  emotion: TtsEmotion;
  audioUrl: string;
  localAudioId?: string;
  createdAt: number;
};

type TtsHistoryItem = TtsHistoryMeta & {
  playUrl: string;
};

function resolveSseUrl(taskId: string): string {
  const base = import.meta.env.VITE_API_BASE_URL || '/api/v1';
  return `${base}/public/tts/progress/stream/${encodeURIComponent(taskId)}`;
}

function loadHistoryMeta(): TtsHistoryMeta[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Partial<TtsHistoryMeta>>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item?.taskId && item.text && item.audioUrl)
      .map((item) => ({
        id: String(item.id || `${item.taskId}-${Date.now()}`),
        taskId: String(item.taskId),
        text: String(item.text),
        voiceId: String(item.voiceId || ''),
        voiceName: String(item.voiceName || item.voiceId || ''),
        speed: Number(item.speed || 1),
        emotion: (item.emotion as TtsEmotion) || 'neutral',
        audioUrl: String(item.audioUrl),
        localAudioId: item.localAudioId ? String(item.localAudioId) : undefined,
        createdAt: Number(item.createdAt || Date.now()),
      }))
      .slice(0, MAX_HISTORY_ITEMS);
  } catch {
    return [];
  }
}

function saveHistoryMeta(items: TtsHistoryMeta[]): void {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS)));
  } catch {
    // ignore storage error
  }
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', { hour12: false });
}

function openAudioDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putAudioBlob(id: string, blob: Blob): Promise<void> {
  const db = await openAudioDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function getAudioBlob(id: string): Promise<Blob | null> {
  const db = await openAudioDb();
  const result = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(id);
    req.onsuccess = () => resolve((req.result as Blob | undefined) || null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

async function deleteAudioBlob(id: string): Promise<void> {
  const db = await openAudioDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function fetchAudioBlob(audioUrl: string): Promise<Blob> {
  const resp = await fetch(audioUrl, { credentials: 'include' });
  if (!resp.ok) {
    throw new Error(`音频下载失败: ${resp.status}`);
  }
  return resp.blob();
}

async function hydrateHistory(meta: TtsHistoryMeta[]): Promise<TtsHistoryItem[]> {
  const items: TtsHistoryItem[] = [];
  for (const m of meta) {
    let playUrl = m.audioUrl;
    if (m.localAudioId) {
      try {
        const blob = await getAudioBlob(m.localAudioId);
        if (blob) {
          playUrl = URL.createObjectURL(blob);
        }
      } catch {
        // fallback to remote url
      }
    }
    items.push({ ...m, playUrl });
  }
  return items;
}

export default function TTSStudio() {
  const [text, setText] = useState('');
  const [voiceId, setVoiceId] = useState(TTS_VOICE_PRESETS[0]?.id || '');
  const [speed, setSpeed] = useState(1);
  const [emotion, setEmotion] = useState<TtsEmotion>('neutral');
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [lastTaskId, setLastTaskId] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('等待开始');
  const [history, setHistory] = useState<TtsHistoryItem[]>([]);
  const blobUrlRef = useRef<string[]>([]);

  const charCount = text.trim().length;
  const estimatedSec = useMemo(
    () => Math.max(1, Math.ceil(charCount / 4 / speed)),
    [charCount, speed],
  );
  const selectedVoice = useMemo(
    () => TTS_VOICE_PRESETS.find((voice) => voice.id === voiceId) || TTS_VOICE_PRESETS[0],
    [voiceId],
  );
  const activeTheme = useMemo(
    () => VOICE_THEME[voiceId] || VOICE_THEME[TTS_VOICE_PRESETS[0]?.id || 'yier'],
    [voiceId],
  );
  const selectedEmotion = useMemo(
    () => TTS_EMOTION_OPTIONS.find((item) => item.value === emotion) || TTS_EMOTION_OPTIONS[0],
    [emotion],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      const meta = loadHistoryMeta();
      const hydrated = await hydrateHistory(meta);
      if (!alive) {
        for (const item of hydrated) {
          if (item.playUrl.startsWith('blob:')) URL.revokeObjectURL(item.playUrl);
        }
        return;
      }
      blobUrlRef.current = hydrated
        .filter((x) => x.playUrl.startsWith('blob:'))
        .map((x) => x.playUrl);
      setHistory(hydrated);
    })();

    return () => {
      alive = false;
      for (const url of blobUrlRef.current) {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      }
      blobUrlRef.current = [];
    };
  }, []);

  const appendHistory = async (params: {
    taskId: string;
    text: string;
    voiceId: string;
    voiceName: string;
    speed: number;
    emotion: TtsEmotion;
    audioUrl: string;
  }) => {
    const localAudioId = `${params.taskId}-${Date.now()}`;
    const audioBlob = await fetchAudioBlob(params.audioUrl);
    await putAudioBlob(localAudioId, audioBlob);
    const playUrl = URL.createObjectURL(audioBlob);

    setHistory((prev) => {
      const nextMeta: TtsHistoryMeta = {
        id: `${params.taskId}-${Date.now()}`,
        taskId: params.taskId,
        text: params.text,
        voiceId: params.voiceId,
        voiceName: params.voiceName,
        speed: params.speed,
        emotion: params.emotion,
        audioUrl: params.audioUrl,
        localAudioId,
        createdAt: Date.now(),
      };

      const dedup = prev.filter((x) => x.taskId !== params.taskId);
      const next: TtsHistoryItem[] = [{ ...nextMeta, playUrl }, ...dedup].slice(
        0,
        MAX_HISTORY_ITEMS,
      );

      // revoke dropped blob urls
      for (const dropped of dedup.slice(MAX_HISTORY_ITEMS - 1)) {
        if (dropped.playUrl.startsWith('blob:')) URL.revokeObjectURL(dropped.playUrl);
      }

      blobUrlRef.current = next.filter((x) => x.playUrl.startsWith('blob:')).map((x) => x.playUrl);
      saveHistoryMeta(next.map(({ playUrl: _playUrl, ...rest }) => rest));
      return next;
    });

    setAudioUrl(playUrl);
  };

  const clearHistory = async () => {
    const meta = loadHistoryMeta();
    await Promise.all(
      meta
        .filter((x) => !!x.localAudioId)
        .map(async (x) => {
          if (!x.localAudioId) return;
          try {
            await deleteAudioBlob(x.localAudioId);
          } catch {
            // ignore
          }
        }),
    );

    for (const url of blobUrlRef.current) {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    }
    blobUrlRef.current = [];
    saveHistoryMeta([]);
    setHistory([]);
    toast.success('历史记录已清空');
  };

  const deleteHistoryItem = async (item: TtsHistoryItem) => {
    if (item.localAudioId) {
      try {
        await deleteAudioBlob(item.localAudioId);
      } catch {
        // ignore
      }
    }

    if (item.playUrl.startsWith('blob:')) {
      URL.revokeObjectURL(item.playUrl);
    }

    setHistory((prev) => {
      const next = prev.filter((x) => x.id !== item.id);
      blobUrlRef.current = next.filter((x) => x.playUrl.startsWith('blob:')).map((x) => x.playUrl);
      saveHistoryMeta(next.map(({ playUrl: _playUrl, ...rest }) => rest));
      return next;
    });

    if (audioUrl === item.playUrl) {
      setAudioUrl('');
    }
    toast.success('已删除该历史条目');
  };

  const handleGenerate = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      toast.error('请输入要合成的文本');
      return;
    }
    if (trimmed.length > MAX_TEXT_LENGTH) {
      toast.error(`文本超出限制，最大 ${MAX_TEXT_LENGTH} 字`);
      return;
    }

    try {
      setIsGenerating(true);
      setAudioUrl('');
      setProgress(0);
      setProgressText('已提交任务');

      const submit = await synthesizeTtsAsync({ text: trimmed, voiceId, speed, emotion });
      setLastTaskId(submit.taskId);
      setProgress(submit.progress ?? 0);
      setProgressText(submit.message || '排队中');

      await new Promise<void>((resolve, reject) => {
        const streamUrl = resolveSseUrl(submit.taskId);
        const eventSource = new EventSource(streamUrl);
        const timeoutId = window.setTimeout(() => {
          eventSource.close();
          reject(new Error('生成超时，请稍后重试'));
        }, MAX_SSE_TIME_MS);

        const closeAll = () => {
          window.clearTimeout(timeoutId);
          eventSource.close();
        };

        const applyProgress = (status: TtsProgressResult) => {
          const p = Math.max(0, Math.min(100, Number(status.progress || 0)));
          setProgress(p);
          setProgressText(status.message || status.status || '处理中');
        };

        eventSource.addEventListener('progress', (event) => {
          try {
            const status = JSON.parse((event as MessageEvent).data) as TtsProgressResult;
            applyProgress(status);
          } catch {
            // keep streaming
          }
        });

        eventSource.addEventListener('done', async (event) => {
          try {
            const status = JSON.parse((event as MessageEvent).data) as TtsProgressResult;
            applyProgress(status);
            if (status.status === 'completed' && status.audioUrl) {
              await appendHistory({
                taskId: submit.taskId,
                text: trimmed,
                voiceId,
                voiceName: selectedVoice?.name || voiceId,
                speed,
                emotion,
                audioUrl: status.audioUrl,
              });
              setProgress(100);
              setProgressText('已完成');
              toast.success('语音已生成');
              closeAll();
              resolve();
              return;
            }
            closeAll();
            reject(new Error(status.message || '生成失败'));
          } catch {
            closeAll();
            reject(new Error('进度流解析失败'));
          }
        });

        eventSource.addEventListener('error', (event) => {
          try {
            const status = JSON.parse((event as MessageEvent).data) as TtsProgressResult;
            applyProgress(status);
            closeAll();
            reject(new Error(status.message || '生成失败'));
            return;
          } catch {
            closeAll();
            reject(new Error('进度连接异常，请重试'));
          }
        });
      });
    } catch (error) {
      console.error('TTS generation failed:', error);
      const msg = error instanceof Error ? error.message : '生成失败，请稍后重试';
      toast.error(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top,#eee3f8_0%,#fdf7ff_28%,#fff9f2_62%,#ffffff_100%)]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-3xl border border-[#e7dff2] bg-white/95 p-6 shadow-[0_10px_30px_rgba(90,56,126,0.12)] backdrop-blur sm:p-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#ede2fb] px-3 py-1 text-xs font-medium text-[#5b3d78]">
            <Sparkles className="h-3.5 w-3.5" />
            一二 & 布布 TTS Studio
          </div>
          <h1 className="text-3xl font-bold text-[#3a2330] sm:text-4xl">一二布布在线语音合成</h1>
          <p className="mt-3 max-w-3xl text-[#6d5669]">
            白熊一二偏清亮，棕熊布布偏温暖，支持实时进度和历史对比。
          </p>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {TTS_VOICE_PRESETS.map((voice) => {
              const theme = VOICE_THEME[voice.id] || VOICE_THEME.yier;
              const active = voice.id === voiceId;
              return (
                <button
                  key={voice.id}
                  type="button"
                  className={`rounded-2xl border p-3 text-left transition ${
                    active
                      ? 'border-[#5b3d78] bg-white shadow-[0_8px_20px_rgba(91,61,120,0.16)]'
                      : 'border-[#eadff4] bg-white/80 hover:border-[#cfbde7]'
                  }`}
                  onClick={() => setVoiceId(voice.id)}
                >
                  <div className={`rounded-xl bg-gradient-to-r ${theme.bubble} p-3`}>
                    <p className="text-sm font-semibold text-[#4a2d44]">{theme.mascot}</p>
                    <p className="mt-1 text-xs text-[#6d5669]">{theme.intro}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mic2 className="h-5 w-5 text-sky-600" />
                文本输入
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                className="h-64 w-full resize-y rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none ring-sky-500 transition focus:ring-2"
                placeholder="输入要合成的内容，比如口播文案、通知播报、短视频解说。"
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>预计时长约 {estimatedSec} 秒</span>
                <span>
                  {charCount}/{MAX_TEXT_LENGTH}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Volume2 className="h-5 w-5 text-sky-600" />
                合成设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div
                className={`rounded-2xl border border-[#eadff4] bg-gradient-to-br ${activeTheme.bubble} p-4`}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={activeTheme.avatar}
                    alt={activeTheme.mascot}
                    className="h-14 w-14 rounded-full border-2 border-[#5b3d78]/30 object-cover"
                  />
                  <div>
                    <p className="text-sm font-semibold text-[#4a2d44]">{activeTheme.mascot}</p>
                    <p className="text-xs text-[#6d5669]">{selectedVoice?.style}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">音色预设</label>
                <select
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none ring-sky-500 focus:ring-2"
                  value={voiceId}
                  onChange={(event) => setVoiceId(event.target.value)}
                >
                  {TTS_VOICE_PRESETS.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500">{selectedVoice?.style}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">语速倍率</label>
                <Input
                  type="number"
                  min={selectedVoice?.speedRange?.[0] || 0.8}
                  max={selectedVoice?.speedRange?.[1] || 1.2}
                  step={0.05}
                  value={speed}
                  onChange={(event) => setSpeed(Number(event.target.value))}
                />
                <p className="text-xs text-slate-500">
                  推荐范围 {selectedVoice?.speedRange?.[0]} - {selectedVoice?.speedRange?.[1]}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">情绪语气</label>
                <select
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none ring-sky-500 focus:ring-2"
                  value={emotion}
                  onChange={(event) => setEmotion(event.target.value as TtsEmotion)}
                >
                  {TTS_EMOTION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500">{selectedEmotion.hint}</p>
              </div>

              <Button className="w-full gap-2" onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="h-4 w-4" />
                )}
                {isGenerating ? '正在生成...' : '生成语音'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {isGenerating ? (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">任务进度</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-sky-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{progressText}</span>
                  <span>{progress}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">当前结果</CardTitle>
          </CardHeader>
          <CardContent>
            {!audioUrl ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                生成完成后会在这里显示播放器和下载入口。
              </div>
            ) : (
              <div className="space-y-4">
                <audio className="w-full" controls src={audioUrl}>
                  <track kind="captions" />
                </audio>
                <div className="flex flex-wrap items-center gap-3">
                  <a href={audioUrl} download={`tts-${lastTaskId || Date.now()}.wav`}>
                    <Button variant="outline" className="gap-2">
                      <Download className="h-4 w-4" />
                      下载音频
                    </Button>
                  </a>
                  <span className="text-xs text-slate-500">任务号：{lastTaskId || '-'}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg">生成历史（本地持久化）</CardTitle>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => void clearHistory()}
                disabled={!history.length}
              >
                <Trash2 className="h-4 w-4" />
                清空历史
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!history.length ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                还没有历史记录，先生成一条语音试试。
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <span>{formatTime(item.createdAt)}</span>
                      <span>
                        音色：{item.voiceName} | 语速：{item.speed} | 情绪：
                        {TTS_EMOTION_OPTIONS.find((x) => x.value === item.emotion)?.label || '自然'}{' '}
                        | 任务号：{item.taskId}
                      </span>
                    </div>
                    <p className="mb-3 line-clamp-3 text-sm text-slate-700">{item.text}</p>
                    <audio className="w-full" controls src={item.playUrl}>
                      <track kind="captions" />
                    </audio>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => setText(item.text)}
                      >
                        回填文本
                      </Button>
                      <a href={item.playUrl} download={`tts-${item.taskId}.wav`}>
                        <Button variant="outline" className="gap-2">
                          <Download className="h-4 w-4" />
                          下载
                        </Button>
                      </a>
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => void deleteHistoryItem(item)}
                      >
                        <Trash2 className="h-4 w-4" />
                        删除
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
