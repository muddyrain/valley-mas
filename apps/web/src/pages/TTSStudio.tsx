import { Download, Loader2, Mic2, PlayCircle, Sparkles, Trash2, Volume2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { synthesizeTtsAsync, TTS_VOICE_PRESETS, type TtsProgressResult } from '@/api/tts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const MAX_TEXT_LENGTH = 240;
const MAX_SSE_TIME_MS = 10 * 60 * 1000;
const HISTORY_KEY = 'tts_history_v1';
const MAX_HISTORY_ITEMS = 20;

type TtsHistoryItem = {
  id: string;
  taskId: string;
  text: string;
  voiceId: string;
  voiceName: string;
  speed: number;
  audioUrl: string;
  createdAt: number;
};

function resolveSseUrl(taskId: string): string {
  const base = import.meta.env.VITE_API_BASE_URL || '/api/v1';
  return `${base}/public/tts/progress/stream/${encodeURIComponent(taskId)}`;
}

function loadHistory(): TtsHistoryItem[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TtsHistoryItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && item.audioUrl && item.text).slice(0, MAX_HISTORY_ITEMS);
  } catch {
    return [];
  }
}

function saveHistory(items: TtsHistoryItem[]): void {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS)));
  } catch {
    // ignore storage error
  }
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', { hour12: false });
}

const minSpeed = 0.7;
const maxSpeed = 1.4;

export default function TTSStudio() {
  const [text, setText] = useState('');
  const [voiceId, setVoiceId] = useState(TTS_VOICE_PRESETS[0]?.id || '');
  const [speed, setSpeed] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [lastTaskId, setLastTaskId] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('等待开始');
  const [history, setHistory] = useState<TtsHistoryItem[]>(() => loadHistory());

  const charCount = text.trim().length;
  const estimatedSec = useMemo(
    () => Math.max(1, Math.ceil(charCount / 4 / speed)),
    [charCount, speed],
  );
  const selectedVoice = useMemo(
    () => TTS_VOICE_PRESETS.find((voice) => voice.id === voiceId) || TTS_VOICE_PRESETS[0],
    [voiceId],
  );

  const appendHistory = (item: Omit<TtsHistoryItem, 'id' | 'createdAt'>) => {
    setHistory((prev) => {
      const nextItem: TtsHistoryItem = {
        id: `${item.taskId}-${Date.now()}`,
        createdAt: Date.now(),
        ...item,
      };
      const next = [nextItem, ...prev.filter((x) => x.taskId !== item.taskId)].slice(
        0,
        MAX_HISTORY_ITEMS,
      );
      saveHistory(next);
      return next;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    saveHistory([]);
    toast.success('历史记录已清空');
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

      const submit = await synthesizeTtsAsync({ text: trimmed, voiceId, speed });
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

        eventSource.addEventListener('done', (event) => {
          try {
            const status = JSON.parse((event as MessageEvent).data) as TtsProgressResult;
            applyProgress(status);
            if (status.status === 'completed' && status.audioUrl) {
              setAudioUrl(status.audioUrl);
              setProgress(100);
              setProgressText('已完成');
              appendHistory({
                taskId: submit.taskId,
                text: trimmed,
                voiceId,
                voiceName: selectedVoice?.name || voiceId,
                speed,
                audioUrl: status.audioUrl,
              });
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
    <div className="min-h-[calc(100vh-4rem)] bg-linear-to-b from-sky-50 via-white to-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-2xl border border-sky-100 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
            <Sparkles className="h-3.5 w-3.5" />
            TTS v1
          </div>
          <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">一二布布在线语音合成</h1>
          <p className="mt-3 max-w-3xl text-slate-600">支持本地模型合成、实时进度和历史对比。</p>
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
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 mb-2">音色预设</label>
                <select
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none ring-sky-500 focus:ring-2 mt-2"
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
                  className="mt-2"
                  type="number"
                  min={selectedVoice?.speedRange?.[0] || minSpeed}
                  max={selectedVoice?.speedRange?.[1] || maxSpeed}
                  step={0.05}
                  value={speed}
                  onChange={(event) => setSpeed(Number(event.target.value))}
                  onBlur={() => {
                    if (speed < (selectedVoice?.speedRange?.[0] || minSpeed)) {
                      setSpeed(selectedVoice?.speedRange?.[0] || minSpeed);
                    } else if (speed > (selectedVoice?.speedRange?.[1] || maxSpeed)) {
                      setSpeed(selectedVoice?.speedRange?.[1] || maxSpeed);
                    }
                  }}
                />
                <p className="text-xs text-slate-500">
                  推荐范围 {selectedVoice?.speedRange?.[0]} - {selectedVoice?.speedRange?.[1]}
                </p>
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
              <CardTitle className="text-lg">生成历史（可对比）</CardTitle>
              <Button
                variant="outline"
                className="gap-2"
                onClick={clearHistory}
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
                        音色：{item.voiceName} | 语速：{item.speed} | 任务号：{item.taskId}
                      </span>
                    </div>
                    <p className="mb-3 line-clamp-3 text-sm text-slate-700">{item.text}</p>
                    <audio className="w-full" controls src={item.audioUrl}>
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
                      <a href={item.audioUrl} download={`tts-${item.taskId}.wav`}>
                        <Button variant="outline" className="gap-2">
                          <Download className="h-4 w-4" />
                          下载
                        </Button>
                      </a>
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
