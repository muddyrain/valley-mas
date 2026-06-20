import {
  LoaderCircle,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useDelayedFlag } from '../hooks/useDelayedFlag';
import {
  getMusicPlaylist,
  getMusicProviderLabel,
  getMusicTrack,
  getPlaylistTracks,
  MUSIC_PLAYLISTS,
} from '../music/catalog';
import { formatDuration, getActiveLyricIndex, parseLyrics } from '../music/lyrics';
import { useMusicStore } from '../store/musicStore';
import './DockAppWindows.css';

export default function MusicWindow() {
  const currentTrackId = useMusicStore((s) => s.currentTrackId);
  const playlistId = useMusicStore((s) => s.playlistId);
  const queueIds = useMusicStore((s) => s.queueIds);
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const isBuffering = useMusicStore((s) => s.isBuffering);
  const progress = useMusicStore((s) => s.progress);
  const duration = useMusicStore((s) => s.duration);
  const volume = useMusicStore((s) => s.volume);
  const repeat = useMusicStore((s) => s.repeat);
  const shuffle = useMusicStore((s) => s.shuffle);
  const error = useMusicStore((s) => s.error);
  const isLoadingAudius = useMusicStore((s) => s.isLoadingAudius);
  const audiusError = useMusicStore((s) => s.audiusError);
  const lyricsEnabled = useMusicStore((s) => s.lyricsEnabled);
  const lyricsOffset = useMusicStore((s) => s.lyricsOffset);
  const selectPlaylist = useMusicStore((s) => s.selectPlaylist);
  const selectTrack = useMusicStore((s) => s.selectTrack);
  const togglePlay = useMusicStore((s) => s.togglePlay);
  const nextTrack = useMusicStore((s) => s.nextTrack);
  const previousTrack = useMusicStore((s) => s.previousTrack);
  const seek = useMusicStore((s) => s.seek);
  const setVolume = useMusicStore((s) => s.setVolume);
  const setRepeat = useMusicStore((s) => s.setRepeat);
  const toggleShuffle = useMusicStore((s) => s.toggleShuffle);
  const loadAudiusTrending = useMusicStore((s) => s.loadAudiusTrending);
  const toggleLyrics = useMusicStore((s) => s.toggleLyrics);
  const setLyricsOffset = useMusicStore((s) => s.setLyricsOffset);
  const activateRuntime = useMusicStore((s) => s.activateRuntime);

  useEffect(() => {
    activateRuntime();
  }, [activateRuntime]);

  const selectedPlaylist = getMusicPlaylist(playlistId);
  const currentTrack = getMusicTrack(currentTrackId);
  const queueTracks = queueIds.map(getMusicTrack);
  const showBuffering = useDelayedFlag(isBuffering);
  const lyrics = useMemo(() => parseLyrics(currentTrack.lyrics), [currentTrack.lyrics]);
  const activeLyricIndex = getActiveLyricIndex(lyrics, progress, lyricsOffset);
  const progressMax = Math.max(duration, 1);

  return (
    <div className="dock-app-window music-window">
      <header className="music-window__header">
        <div>
          <div className="dock-app-window__eyebrow">音乐</div>
          <h2>Plush Radio</h2>
          <p>桌面常驻的氛围播放器。</p>
        </div>
        <span className="dock-app-window__badge">
          {showBuffering ? '加载中' : isPlaying ? '播放中' : '待播放'}
        </span>
      </header>

      <div className="music-window__layout music-window__layout--v2">
        <aside className="music-window__library" aria-label="播放列表">
          {MUSIC_PLAYLISTS.map((playlist) => {
            const tracks = getPlaylistTracks(playlist.id);
            return (
              <button
                type="button"
                key={playlist.id}
                className={`music-playlist ${playlist.id === selectedPlaylist.id ? 'is-active' : ''}`}
                onClick={() => {
                  selectPlaylist(playlist.id, false);
                  if (playlist.id === 'audius-trending') void loadAudiusTrending();
                }}
              >
                <img src={playlist.coverUrl} alt="" />
                <span>
                  <strong>{playlist.title}</strong>
                  <em>
                    {playlist.id === 'audius-trending' && isLoadingAudius
                      ? '加载中'
                      : `${tracks.length} 首`}
                  </em>
                  <small>{playlist.description}</small>
                </span>
              </button>
            );
          })}
        </aside>

        <main className="music-window__player music-window__player--v2">
          <section className="music-window__now music-window__now--v2">
            <img className="music-window__cover" src={currentTrack.coverUrl} alt="" />
            <div className="music-window__meta">
              <div className="music-window__provider">
                {getMusicProviderLabel(currentTrack.provider)}
              </div>
              <h3>{currentTrack.title}</h3>
              <p>{currentTrack.artist}</p>
              <span>
                {currentTrack.source} · {currentTrack.mood}
              </span>
              <small>{currentTrack.license}</small>
            </div>
          </section>

          <section className="music-window__transport" aria-label="播放控制">
            <input
              type="range"
              min="0"
              max={progressMax}
              step="1"
              value={Math.min(progress, progressMax)}
              onChange={(event) => seek(Number(event.currentTarget.value))}
              aria-label="播放进度"
            />
            <div className="music-window__time">
              <span>{formatDuration(progress)}</span>
              <span className={showBuffering ? 'is-loading' : ''}>
                {showBuffering ? (
                  <>
                    <LoaderCircle className="music-window__loading-icon" aria-hidden />
                    加载中
                  </>
                ) : (
                  formatDuration(duration)
                )}
              </span>
            </div>
            <div className="music-window__controls">
              <button
                type="button"
                onClick={toggleShuffle}
                className={shuffle ? 'is-active' : ''}
                aria-label={shuffle ? '关闭随机' : '随机播放'}
                title={shuffle ? '关闭随机' : '随机播放'}
              >
                <Shuffle className="music-window__control-icon" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => previousTrack(true)}
                aria-label="上一首"
                title="上一首"
              >
                <SkipBack className="music-window__control-icon" aria-hidden />
              </button>
              <button
                type="button"
                className="is-primary"
                onClick={togglePlay}
                aria-label={showBuffering ? '加载中' : isPlaying ? '暂停' : '播放'}
                title={showBuffering ? '加载中' : isPlaying ? '暂停' : '播放'}
              >
                {showBuffering ? (
                  <LoaderCircle className="music-window__control-icon is-spinning" aria-hidden />
                ) : isPlaying ? (
                  <Pause className="music-window__control-icon" aria-hidden />
                ) : (
                  <Play className="music-window__control-icon" aria-hidden />
                )}
              </button>
              <button
                type="button"
                onClick={() => nextTrack(true)}
                aria-label="下一首"
                title="下一首"
              >
                <SkipForward className="music-window__control-icon" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() =>
                  setRepeat(repeat === 'all' ? 'one' : repeat === 'one' ? 'off' : 'all')
                }
                className={repeat !== 'off' ? 'is-active' : ''}
                aria-label={
                  repeat === 'one' ? '单曲循环' : repeat === 'all' ? '列表循环' : '顺序播放'
                }
                title={repeat === 'one' ? '单曲循环' : repeat === 'all' ? '列表循环' : '顺序播放'}
              >
                {repeat === 'one' ? (
                  <Repeat1 className="music-window__control-icon" aria-hidden />
                ) : (
                  <Repeat className="music-window__control-icon" aria-hidden />
                )}
              </button>
            </div>
            <label className="music-window__volume">
              <span>音量</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(event) => setVolume(Number(event.currentTarget.value))}
              />
            </label>
            {error ? <span className="music-window__error">{error}</span> : null}
          </section>

          <section className="music-window__lower">
            <div className="music-window__queue">
              <header>
                <strong>{selectedPlaylist.title}</strong>
                <span>{queueTracks.length} 首</span>
              </header>
              <div className="music-window__queue-list">
                {queueTracks.length > 0 ? (
                  queueTracks.map((track) => (
                    <button
                      type="button"
                      key={track.id}
                      className={`music-window__track ${track.id === currentTrack.id ? 'is-active' : ''}`}
                      onClick={() => selectTrack(track.id, true)}
                    >
                      <img src={track.coverUrl} alt="" />
                      <span>
                        <strong>{track.title}</strong>
                        <em>{track.artist}</em>
                      </span>
                      <small>{track.mood}</small>
                    </button>
                  ))
                ) : (
                  <div className="music-window__queue-empty">
                    {isLoadingAudius ? '正在加载 Audius' : audiusError || '暂无可播放曲目'}
                    {selectedPlaylist.id === 'audius-trending' ? (
                      <button type="button" onClick={() => void loadAudiusTrending()}>
                        重试
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            </div>

            <div className="music-window__lyrics">
              <header>
                <strong>歌词</strong>
                <button
                  type="button"
                  className={lyricsEnabled ? 'is-active' : ''}
                  onClick={toggleLyrics}
                >
                  {lyricsEnabled ? '显示中' : '已关闭'}
                </button>
              </header>
              <div className="music-window__lyric-offset">
                <button type="button" onClick={() => setLyricsOffset(lyricsOffset - 0.5)}>
                  -0.5s
                </button>
                <span>{lyricsOffset.toFixed(1)}s</span>
                <button type="button" onClick={() => setLyricsOffset(lyricsOffset + 0.5)}>
                  +0.5s
                </button>
              </div>
              <div className="music-window__lyric-lines">
                {lyricsEnabled && lyrics.length > 0 ? (
                  lyrics.map((line, index) => (
                    <div
                      key={`${line.time}-${line.text}`}
                      className={index === activeLyricIndex ? 'is-active' : ''}
                    >
                      {line.text}
                    </div>
                  ))
                ) : (
                  <div className="music-window__lyric-empty">
                    {lyricsEnabled ? '暂无歌词' : '歌词已关闭'}
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
