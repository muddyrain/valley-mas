import { useCallback, useEffect, useRef } from 'react';
import { getMusicTrack } from '../music/catalog';
import { useMusicStore } from '../store/musicStore';

export default function MusicRuntime() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const isSwitchingSourceRef = useRef(false);
  const sourceSwitchIdRef = useRef(0);
  const progressUpdateRef = useRef({ second: -1, time: 0 });
  const currentTrackId = useMusicStore((s) => s.currentTrackId);
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const volume = useMusicStore((s) => s.volume);
  const repeat = useMusicStore((s) => s.repeat);
  const seekSeconds = useMusicStore((s) => s.seekSeconds);
  const seekRequestId = useMusicStore((s) => s.seekRequestId);
  const setPlaying = useMusicStore((s) => s.setPlaying);
  const setBuffering = useMusicStore((s) => s.setBuffering);
  const setProgress = useMusicStore((s) => s.setProgress);
  const setDuration = useMusicStore((s) => s.setDuration);
  const setError = useMusicStore((s) => s.setError);
  const nextTrack = useMusicStore((s) => s.nextTrack);
  const loadAudiusTrending = useMusicStore((s) => s.loadAudiusTrending);

  useEffect(() => {
    void loadAudiusTrending();
  }, [loadAudiusTrending]);

  const requestPlay = useCallback(
    (audio: HTMLAudioElement) => {
      setBuffering(true);
      void audio.play().catch(() => {
        if (!useMusicStore.getState().isPlaying) return;
        setError('播放被浏览器拦截');
        setBuffering(false);
        setPlaying(false);
      });
    },
    [setBuffering, setError, setPlaying],
  );

  const commitProgress = useCallback(
    (value: number) => {
      let nextProgress = 0;
      if (Number.isFinite(value)) nextProgress = value;
      let now = Date.now();
      if (typeof performance !== 'undefined') now = performance.now();
      const second = Math.floor(nextProgress);
      const previous = progressUpdateRef.current;
      if (now - previous.time < 250 && second === previous.second) return;
      progressUpdateRef.current = { second, time: now };
      setProgress(nextProgress);
    },
    [setProgress],
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const track = getMusicTrack(currentTrackId);
    const sourceSwitchId = sourceSwitchIdRef.current + 1;
    sourceSwitchIdRef.current = sourceSwitchId;
    isSwitchingSourceRef.current = true;
    if (!audio.paused) audio.pause();
    setProgress(0);
    setDuration(0);

    if (!track.audioUrl) {
      audio.removeAttribute('src');
      audio.load();
      isSwitchingSourceRef.current = false;
      setBuffering(false);
      setPlaying(false);
      setError('当前曲目无法直接播放');
      return;
    }

    audio.src = track.audioUrl;
    audio.load();
    setError(null);

    if (useMusicStore.getState().isPlaying) {
      setBuffering(true);
      requestPlay(audio);
    }
    window.setTimeout(() => {
      if (sourceSwitchIdRef.current === sourceSwitchId) isSwitchingSourceRef.current = false;
    }, 0);
  }, [currentTrackId, requestPlay, setBuffering, setDuration, setError, setPlaying, setProgress]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isSwitchingSourceRef.current) return;

    if (isPlaying && audio.paused) {
      requestPlay(audio);
      return;
    }

    if (!isPlaying) {
      setBuffering(false);
      if (!audio.paused) audio.pause();
    }
  }, [isPlaying, requestPlay, setBuffering]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || seekRequestId === 0) return;
    audio.currentTime = Math.max(0, seekSeconds);
  }, [seekRequestId, seekSeconds]);

  return (
    <audio
      ref={audioRef}
      preload="metadata"
      onLoadStart={() => {
        if (useMusicStore.getState().isPlaying) setBuffering(true);
      }}
      onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
      onTimeUpdate={(event) => commitProgress(event.currentTarget.currentTime)}
      onWaiting={() => {
        if (useMusicStore.getState().isPlaying) setBuffering(true);
      }}
      onStalled={() => {
        if (useMusicStore.getState().isPlaying) setBuffering(true);
      }}
      onCanPlay={() => setBuffering(false)}
      onPlaying={() => {
        if (!useMusicStore.getState().isPlaying) setPlaying(true);
        setBuffering(false);
        setError(null);
      }}
      onPause={() => {
        if (!useMusicStore.getState().isPlaying) setBuffering(false);
      }}
      onEnded={(event) => {
        setBuffering(false);
        if (repeat === 'one') {
          event.currentTarget.currentTime = 0;
          setBuffering(true);
          void event.currentTarget.play();
          return;
        }
        nextTrack(repeat === 'all');
      }}
      onError={() => {
        setBuffering(false);
        setError('音频暂不可用');
        setPlaying(false);
      }}
    >
      <track kind="captions" />
    </audio>
  );
}
