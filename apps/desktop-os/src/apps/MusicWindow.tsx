import { useMemo } from 'react';
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
  const progress = useMusicStore((s) => s.progress);
  const duration = useMusicStore((s) => s.duration);
  const volume = useMusicStore((s) => s.volume);
  const repeat = useMusicStore((s) => s.repeat);
  const shuffle = useMusicStore((s) => s.shuffle);
  const error = useMusicStore((s) => s.error);
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
  const toggleLyrics = useMusicStore((s) => s.toggleLyrics);
  const setLyricsOffset = useMusicStore((s) => s.setLyricsOffset);

  const selectedPlaylist = getMusicPlaylist(playlistId);
  const currentTrack = getMusicTrack(currentTrackId);
  const queueTracks = queueIds.map(getMusicTrack);
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
        <span className="dock-app-window__badge">{isPlaying ? '播放中' : '待播放'}</span>
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
                onClick={() => selectPlaylist(playlist.id, false)}
              >
                <img src={playlist.coverUrl} alt="" />
                <span>
                  <strong>{playlist.title}</strong>
                  <em>{tracks.length} 首</em>
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
              <span>{formatDuration(duration)}</span>
            </div>
            <div className="music-window__controls">
              <button type="button" onClick={toggleShuffle} className={shuffle ? 'is-active' : ''}>
                随机
              </button>
              <button type="button" onClick={() => previousTrack(true)}>
                上一首
              </button>
              <button type="button" className="is-primary" onClick={togglePlay}>
                {isPlaying ? '暂停' : '播放'}
              </button>
              <button type="button" onClick={() => nextTrack(true)}>
                下一首
              </button>
              <button
                type="button"
                onClick={() =>
                  setRepeat(repeat === 'all' ? 'one' : repeat === 'one' ? 'off' : 'all')
                }
                className={repeat !== 'off' ? 'is-active' : ''}
              >
                {repeat === 'one' ? '单曲' : repeat === 'all' ? '循环' : '顺序'}
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
                {queueTracks.map((track) => (
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
                ))}
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
