import { useEffect, useRef } from 'react';
import { getMusicTrack } from '../music/catalog';
import { useMusicStore } from '../store/musicStore';

export default function MusicRuntime() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const currentTrackId = useMusicStore((s) => s.currentTrackId);
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const volume = useMusicStore((s) => s.volume);
  const repeat = useMusicStore((s) => s.repeat);
  const seekSeconds = useMusicStore((s) => s.seekSeconds);
  const seekRequestId = useMusicStore((s) => s.seekRequestId);
  const setPlaying = useMusicStore((s) => s.setPlaying);
  const setProgress = useMusicStore((s) => s.setProgress);
  const setDuration = useMusicStore((s) => s.setDuration);
  const setError = useMusicStore((s) => s.setError);
  const nextTrack = useMusicStore((s) => s.nextTrack);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const track = getMusicTrack(currentTrackId);
    audio.pause();
    setProgress(0);
    setDuration(0);

    if (!track.audioUrl) {
      audio.removeAttribute('src');
      audio.load();
      setPlaying(false);
      setError('当前曲目无法直接播放');
      return;
    }

    audio.src = track.audioUrl;
    audio.load();
    setError(null);

    if (useMusicStore.getState().isPlaying) {
      void audio.play().catch(() => {
        setError('播放被浏览器拦截');
        setPlaying(false);
      });
    }
  }, [currentTrackId, setDuration, setError, setPlaying, setProgress]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying && audio.paused) {
      void audio.play().catch(() => {
        setError('播放被浏览器拦截');
        setPlaying(false);
      });
      return;
    }

    if (!isPlaying && !audio.paused) audio.pause();
  }, [isPlaying, setError, setPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || seekRequestId === 0) return;
    audio.currentTime = Math.max(0, seekSeconds);
  }, [seekRequestId, seekSeconds]);

  return (
    <audio
      ref={audioRef}
      preload="metadata"
      onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
      onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)}
      onPlay={() => {
        setError(null);
        setPlaying(true);
      }}
      onPause={() => setPlaying(false)}
      onEnded={(event) => {
        if (repeat === 'one') {
          event.currentTarget.currentTime = 0;
          void event.currentTarget.play();
          return;
        }
        nextTrack(repeat === 'all');
      }}
      onError={() => {
        setError('音频暂不可用');
        setPlaying(false);
      }}
    >
      <track kind="captions" />
    </audio>
  );
}
