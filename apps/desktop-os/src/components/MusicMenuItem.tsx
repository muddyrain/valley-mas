import { LoaderCircle, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { type MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { getDefaultWindowOptions } from '../apps/desktopApps';
import { useDelayedFlag } from '../hooks/useDelayedFlag';
import { getMusicTrack } from '../music/catalog';
import { formatDuration, getActiveLyricIndex, parseLyrics } from '../music/lyrics';
import { useMusicStore } from '../store/musicStore';
import { useWindowStore } from '../store/windowStore';
import { shouldRunMusicRuntime } from './runtimeGatePolicy';

export default function MusicMenuItemGate() {
  const runtimeEnabled = useMusicStore((s) => s.runtimeEnabled);
  const isMusicWindowRunning = useWindowStore((s) => s.runningAppIds.includes('music'));
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const isBuffering = useMusicStore((s) => s.isBuffering);
  const togglePlay = useMusicStore((s) => s.togglePlay);

  if (!shouldRunMusicRuntime({ runtimeEnabled, isMusicWindowRunning, isPlaying, isBuffering })) {
    return (
      <button
        type="button"
        className="menu-music__icon-btn menu-music__idle"
        onClick={(event) => {
          event.stopPropagation();
          togglePlay();
        }}
        aria-label="播放音乐"
        title="播放音乐"
      >
        <Play className="menu-music__icon" aria-hidden />
      </button>
    );
  }

  return <MusicMenuItemActive />;
}

function MusicMenuItemActive() {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const restoreOrFocus = useWindowStore((s) => s.restoreOrFocus);
  const currentTrackId = useMusicStore((s) => s.currentTrackId);
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const isBuffering = useMusicStore((s) => s.isBuffering);
  const progress = useMusicStore((s) => s.progress);
  const duration = useMusicStore((s) => s.duration);
  const volume = useMusicStore((s) => s.volume);
  const error = useMusicStore((s) => s.error);
  const lyricsEnabled = useMusicStore((s) => s.lyricsEnabled);
  const lyricsOffset = useMusicStore((s) => s.lyricsOffset);
  const togglePlay = useMusicStore((s) => s.togglePlay);
  const nextTrack = useMusicStore((s) => s.nextTrack);
  const previousTrack = useMusicStore((s) => s.previousTrack);
  const seek = useMusicStore((s) => s.seek);
  const setVolume = useMusicStore((s) => s.setVolume);
  const toggleLyrics = useMusicStore((s) => s.toggleLyrics);

  const track = getMusicTrack(currentTrackId);
  const showBuffering = useDelayedFlag(isBuffering);
  const lyrics = useMemo(() => parseLyrics(track.lyrics), [track.lyrics]);
  const activeLyricIndex = getActiveLyricIndex(lyrics, progress, lyricsOffset);
  const activeLyric = lyrics[activeLyricIndex]?.text ?? (track.lyrics ? '准备播放' : '暂无歌词');
  const footerStatus = error || (showBuffering ? '加载中' : track.license);

  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setIsOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  function openMusicApp(event: MouseEvent) {
    event.stopPropagation();
    restoreOrFocus('music', getDefaultWindowOptions('music'));
    setIsOpen(false);
  }

  return (
    <div ref={rootRef} className="menu-music" onPointerDown={(event) => event.stopPropagation()}>
      <button
        type="button"
        className={`menu-music__trigger ${isOpen ? 'is-active' : ''}`}
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        title={track.title}
      >
        <img src={track.coverUrl} alt="" />
        <span className="menu-music__trigger-text">
          <strong>{track.title}</strong>
          <span>{showBuffering ? '加载中' : isPlaying ? '播放中' : track.mood}</span>
        </span>
      </button>
      <button
        type="button"
        className="menu-music__icon-btn"
        onClick={(event) => {
          event.stopPropagation();
          togglePlay();
        }}
        aria-label={isPlaying ? '暂停' : '播放'}
      >
        {showBuffering ? (
          <LoaderCircle className="menu-music__icon is-spinning" aria-hidden />
        ) : isPlaying ? (
          <Pause className="menu-music__icon" aria-hidden />
        ) : (
          <Play className="menu-music__icon" aria-hidden />
        )}
      </button>
      <button
        type="button"
        className="menu-music__icon-btn"
        onClick={(event) => {
          event.stopPropagation();
          nextTrack(true);
        }}
        aria-label="下一首"
      >
        <SkipForward className="menu-music__icon" aria-hidden />
      </button>

      {isOpen ? (
        <div className="menu-music-panel" role="dialog" aria-label="音乐播放器">
          <div className="menu-music-panel__now">
            <img src={track.coverUrl} alt="" />
            <div>
              <strong>{track.title}</strong>
              <span>{track.artist}</span>
              <em>{track.source}</em>
            </div>
          </div>

          <div className="menu-music-panel__progress">
            <input
              type="range"
              min="0"
              max={Math.max(duration, 1)}
              step="1"
              value={Math.min(progress, Math.max(duration, 1))}
              onChange={(event) => seek(Number(event.currentTarget.value))}
              aria-label="播放进度"
            />
            <div>
              <span>{formatDuration(progress)}</span>
              <span>{formatDuration(duration)}</span>
            </div>
          </div>

          <div className="menu-music-panel__controls">
            <button
              type="button"
              onClick={() => previousTrack(true)}
              aria-label="上一首"
              title="上一首"
            >
              <SkipBack className="menu-music-panel__button-icon" aria-hidden />
            </button>
            <button
              type="button"
              className="is-primary"
              onClick={togglePlay}
              aria-label={showBuffering ? '加载中' : isPlaying ? '暂停' : '播放'}
              title={showBuffering ? '加载中' : isPlaying ? '暂停' : '播放'}
            >
              {showBuffering ? (
                <LoaderCircle className="menu-music-panel__button-icon is-spinning" aria-hidden />
              ) : isPlaying ? (
                <Pause className="menu-music-panel__button-icon" aria-hidden />
              ) : (
                <Play className="menu-music-panel__button-icon" aria-hidden />
              )}
            </button>
            <button
              type="button"
              onClick={() => nextTrack(true)}
              aria-label="下一首"
              title="下一首"
            >
              <SkipForward className="menu-music-panel__button-icon" aria-hidden />
            </button>
          </div>

          <div className="menu-music-panel__volume">
            <span>音量</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(event) => setVolume(Number(event.currentTarget.value))}
              aria-label="音量"
            />
          </div>

          <button
            type="button"
            className={`menu-music-panel__lyric ${lyricsEnabled ? 'is-active' : ''}`}
            onClick={toggleLyrics}
          >
            {lyricsEnabled ? activeLyric : '歌词已关闭'}
          </button>

          <div className="menu-music-panel__footer">
            <span>{footerStatus}</span>
            <button type="button" onClick={openMusicApp}>
              打开音乐
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
