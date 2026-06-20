import { create } from 'zustand';
import {
  DEFAULT_MUSIC_PLAYLIST_ID,
  DEFAULT_MUSIC_TRACK_ID,
  getMusicPlaylist,
  getMusicTrack,
  getPlaylistTracks,
  MUSIC_TRACKS,
  PLAYABLE_MUSIC_TRACKS,
} from '../music/catalog';

interface MusicStore {
  currentTrackId: string;
  playlistId: string;
  queueIds: string[];
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  repeat: 'off' | 'one' | 'all';
  shuffle: boolean;
  error: string | null;
  lyricsEnabled: boolean;
  lyricsOffset: number;
  seekSeconds: number;
  seekRequestId: number;
  selectPlaylist: (playlistId: string, autoplay?: boolean) => void;
  selectTrack: (trackId: string, autoplay?: boolean) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  nextTrack: (autoplay?: boolean) => void;
  previousTrack: (autoplay?: boolean) => void;
  setPlaying: (value: boolean) => void;
  setProgress: (value: number) => void;
  setDuration: (value: number) => void;
  seek: (value: number) => void;
  setVolume: (value: number) => void;
  setRepeat: (value: 'off' | 'one' | 'all') => void;
  toggleShuffle: () => void;
  setError: (message: string | null) => void;
  toggleLyrics: () => void;
  setLyricsOffset: (value: number) => void;
}

function getPlayableQueue(playlistId: string) {
  const tracks = getPlaylistTracks(playlistId);
  return tracks.length > 0
    ? tracks.map((track) => track.id)
    : PLAYABLE_MUSIC_TRACKS.map((track) => track.id);
}

function getTrackPlaylist(trackId: string) {
  return getMusicTrack(trackId).playlistId || DEFAULT_MUSIC_PLAYLIST_ID;
}

function getAdjacentTrackId(state: MusicStore, direction: 1 | -1) {
  const queueIds =
    state.queueIds.length > 0 ? state.queueIds : PLAYABLE_MUSIC_TRACKS.map((track) => track.id);
  const currentIndex = Math.max(0, queueIds.indexOf(state.currentTrackId));

  if (state.shuffle && direction === 1 && queueIds.length > 1) {
    const nextPool = queueIds.filter((trackId) => trackId !== state.currentTrackId);
    return nextPool[Math.floor(Math.random() * nextPool.length)];
  }

  const nextIndex = currentIndex + direction;
  if (nextIndex >= 0 && nextIndex < queueIds.length) return queueIds[nextIndex];
  if (state.repeat === 'all' || direction === -1) {
    return queueIds[(nextIndex + queueIds.length) % queueIds.length];
  }
  return state.currentTrackId;
}

export const useMusicStore = create<MusicStore>((set) => ({
  currentTrackId: DEFAULT_MUSIC_TRACK_ID,
  playlistId: DEFAULT_MUSIC_PLAYLIST_ID,
  queueIds: getPlayableQueue(DEFAULT_MUSIC_PLAYLIST_ID),
  isPlaying: false,
  progress: 0,
  duration: 0,
  volume: 0.78,
  repeat: 'all',
  shuffle: false,
  error: null,
  lyricsEnabled: true,
  lyricsOffset: 0,
  seekSeconds: 0,
  seekRequestId: 0,
  selectPlaylist: (playlistId, autoplay = false) =>
    set(() => {
      const playlist = getMusicPlaylist(playlistId);
      const queueIds = getPlayableQueue(playlist.id);
      const currentTrackId = queueIds[0] ?? DEFAULT_MUSIC_TRACK_ID;
      return {
        playlistId: playlist.id,
        queueIds,
        currentTrackId,
        isPlaying: autoplay,
        progress: 0,
        duration: 0,
        error: null,
      };
    }),
  selectTrack: (trackId, autoplay = true) =>
    set((state) => {
      const track = getMusicTrack(trackId);
      const playlistId = getTrackPlaylist(track.id);
      const queueIds =
        state.playlistId === playlistId ? state.queueIds : getPlayableQueue(playlistId);
      return {
        currentTrackId: track.id,
        playlistId,
        queueIds,
        isPlaying: autoplay,
        progress: 0,
        duration: 0,
        error: null,
      };
    }),
  play: () =>
    set((state) => ({
      isPlaying: Boolean(getMusicTrack(state.currentTrackId).audioUrl),
      error: getMusicTrack(state.currentTrackId).audioUrl ? null : '当前曲目无法直接播放',
    })),
  pause: () => set({ isPlaying: false }),
  togglePlay: () =>
    set((state) => ({
      isPlaying: !state.isPlaying && Boolean(getMusicTrack(state.currentTrackId).audioUrl),
      error:
        !state.isPlaying && !getMusicTrack(state.currentTrackId).audioUrl
          ? '当前曲目无法直接播放'
          : null,
    })),
  nextTrack: (autoplay = true) =>
    set((state) => {
      const nextTrackId = getAdjacentTrackId(state, 1);
      return {
        currentTrackId: nextTrackId,
        playlistId: getTrackPlaylist(nextTrackId),
        isPlaying: autoplay,
        progress: 0,
        duration: nextTrackId === state.currentTrackId ? state.duration : 0,
        error: null,
      };
    }),
  previousTrack: (autoplay = true) =>
    set((state) => {
      const previousTrackId =
        state.progress > 4 ? state.currentTrackId : getAdjacentTrackId(state, -1);
      return {
        currentTrackId: previousTrackId,
        playlistId: getTrackPlaylist(previousTrackId),
        isPlaying: autoplay,
        progress: 0,
        duration: previousTrackId === state.currentTrackId ? state.duration : 0,
        seekSeconds: 0,
        seekRequestId: state.seekRequestId + 1,
        error: null,
      };
    }),
  setPlaying: (value) => set({ isPlaying: value }),
  setProgress: (value) => set({ progress: value }),
  setDuration: (value) => set({ duration: Number.isFinite(value) ? value : 0 }),
  seek: (value) =>
    set((state) => ({
      progress: value,
      seekSeconds: value,
      seekRequestId: state.seekRequestId + 1,
    })),
  setVolume: (value) => set({ volume: Math.min(1, Math.max(0, value)) }),
  setRepeat: (value) => set({ repeat: value }),
  toggleShuffle: () => set((state) => ({ shuffle: !state.shuffle })),
  setError: (message) => set({ error: message }),
  toggleLyrics: () => set((state) => ({ lyricsEnabled: !state.lyricsEnabled })),
  setLyricsOffset: (value) => set({ lyricsOffset: value }),
}));

export function getCurrentMusicSnapshot() {
  const state = useMusicStore.getState();
  return {
    state,
    track: MUSIC_TRACKS.find((track) => track.id === state.currentTrackId) ?? MUSIC_TRACKS[0],
  };
}
