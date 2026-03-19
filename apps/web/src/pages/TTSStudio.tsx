import { Download, Loader2, Mic2, PlayCircle, Sparkles, Volume2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { synthesizeTts, TTS_VOICE_PRESETS } from '@/api/tts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const MAX_TEXT_LENGTH = 240;

export default function TTSStudio() {
  const [text, setText] = useState('');
  const [voiceId, setVoiceId] = useState(TTS_VOICE_PRESETS[0]?.id || '');
  const [speed, setSpeed] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [lastTaskId, setLastTaskId] = useState('');
  const [usingBrowserSpeech, setUsingBrowserSpeech] = useState(false);

  const charCount = text.trim().length;
  const estimatedSec = useMemo(
    () => Math.max(1, Math.ceil(charCount / 4 / speed)),
    [charCount, speed],
  );
  const selectedVoice = useMemo(
    () => TTS_VOICE_PRESETS.find((voice) => voice.id === voiceId) || TTS_VOICE_PRESETS[0],
    [voiceId],
  );

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast.error('请输入要合成的文本');
      return;
    }
    if (text.length > MAX_TEXT_LENGTH) {
      toast.error(`文本超出限制，最多 ${MAX_TEXT_LENGTH} 字`);
      return;
    }

    try {
      setIsGenerating(true);
      const result = await synthesizeTts({
        text: text.trim(),
        voiceId,
        speed,
      });

      if (result.mode === 'browser') {
        setUsingBrowserSpeech(true);
        setAudioUrl('');
        speakWithBrowserTts(text.trim(), speed);
      } else {
        setUsingBrowserSpeech(false);
        setAudioUrl(result.audioUrl);
      }
      setLastTaskId(result.taskId);
      toast.success('语音已生成，可直接试听和下载');
    } catch (error) {
      console.error('TTS generation failed:', error);
      toast.error('生成失败，请稍后重试');
    } finally {
      setIsGenerating(false);
    }
  };

  const speakWithBrowserTts = (speakText: string, rate: number) => {
    if (!('speechSynthesis' in window)) {
      toast.error('当前浏览器不支持语音合成，请切换到 Chrome/Edge');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(speakText);
    const voices = window.speechSynthesis.getVoices();
    const zhVoice =
      voices.find((voice) => voice.lang.toLowerCase().includes('zh-cn')) ||
      voices.find((voice) => voice.lang.toLowerCase().startsWith('zh')) ||
      null;
    if (zhVoice) utterance.voice = zhVoice;
    utterance.rate = Math.max(0.7, Math.min(1.4, rate));
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-sky-50 via-white to-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-2xl border border-sky-100 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
            <Sparkles className="h-3.5 w-3.5" />
            TTS v1
          </div>
          <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">一二布布 在线语音合成</h1>
          <p className="mt-3 max-w-3xl text-slate-600">
            当前版本先支持默认音色文本转语音，不需要提前上传音色。后续 v2 可升级为参考音频克隆。
          </p>
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
                placeholder="在这里输入要合成的内容，比如产品介绍、短视频旁白或通知播报。"
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

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">输出结果</CardTitle>
          </CardHeader>
          <CardContent>
            {!audioUrl ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                {usingBrowserSpeech
                  ? '当前为浏览器人声预览模式：已直接播报文本，待后端接入后可导出真实音频文件。'
                  : '生成后会在这里显示播放器和下载入口'}
              </div>
            ) : (
              <div className="space-y-4">
                <audio className="w-full" controls src={audioUrl}>
                  <track kind="captions" />
                </audio>
                <div className="flex flex-wrap items-center gap-3">
                  <a href={audioUrl} download={`bubu-tts-${lastTaskId || Date.now()}.wav`}>
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
      </div>
    </div>
  );
}
