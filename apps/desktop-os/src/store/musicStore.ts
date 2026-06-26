import { create } from 'zustand';
import { fetchAudiusTrendingTracks } from '../api/audius';
import {
  DEFAULT_MUSIC_PLAYLIST_ID,
  DEFAULT_MUSIC_TRACK_ID,
  getAllMusicTracks,
  getMusicPlaylist,
  getMusicTrack,
  getPlaylistTracks,
  PLAYABLE_MUSIC_TRACKS,
  registerRuntimeMusicTracks,
} from '../music/catalog';

interface MusicStore {
  runtimeEnabled: boolean;
  currentTrackId: string;
  playlistId: string;
  queueIds: string[];
  isPlaying: boolean;
  isBuffering: boolean;
  progress: number;
  duration: number;
  volume: number;
  repeat: 'off' | 'one' | 'all';
  shuffle: boolean;
  error: string | null;
  isLoadingAudius: boolean;
  audiusError: string | null;
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
  activateRuntime: () => void;
  setPlaying: (value: boolean) => void;
  setBuffering: (value: boolean) => void;
  setProgress: (value: number) => void;
  setDuration: (value: number) => void;
  seek: (value: number) => void;
  setVolume: (value: number) => void;
  setRepeat: (value: 'off' | 'one' | 'all') => void;
  toggleShuffle: () => void;
  setError: (message: string | null) => void;
  loadAudiusTrending: () => Promise<void>;
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
  runtimeEnabled: false,
  currentTrackId: DEFAULT_MUSIC_TRACK_ID,
  playlistId: DEFAULT_MUSIC_PLAYLIST_ID,
  queueIds: getPlayableQueue(DEFAULT_MUSIC_PLAYLIST_ID),
  isPlaying: false,
  isBuffering: false,
  progress: 0,
  duration: 0,
  volume: 0.78,
  repeat: 'all',
  shuffle: false,
  error: null,
  isLoadingAudius: false,
  audiusError: null,
  lyricsEnabled: true,
  lyricsOffset: 0,
  seekSeconds: 0,
  seekRequestId: 0,
  selectPlaylist: (playlistId, autoplay = false) =>
    set((state) => {
      const playlist = getMusicPlaylist(playlistId);
      const queueIds = getPlayableQueue(playlist.id);
      const currentTrackId = queueIds[0] ?? state.currentTrackId;
      const hasAudio = Boolean(getMusicTrack(currentTrackId).audioUrl);
      return {
        playlistId: playlist.id,
        queueIds,
        currentTrackId,
        runtimeEnabled: state.runtimeEnabled || (autoplay && hasAudio),
        isPlaying: autoplay && hasAudio,
        isBuffering: autoplay && hasAudio,
        progress: 0,
        duration: 0,
        error: hasAudio ? null : '当前曲目无法直接播放',
      };
    }),
  selectTrack: (trackId, autoplay = true) =>
    set((state) => {
      const track = getMusicTrack(trackId);
      const playlistId = getTrackPlaylist(track.id);
      const queueIds =
        state.playlistId === playlistId ? state.queueIds : getPlayableQueue(playlistId);
      const hasAudio = Boolean(track.audioUrl);
      return {
        currentTrackId: track.id,
        playlistId,
        queueIds,
        runtimeEnabled: state.runtimeEnabled || (autoplay && hasAudio),
        isPlaying: autoplay && hasAudio,
        isBuffering: autoplay && hasAudio,
        progress: 0,
        duration: 0,
        error: hasAudio ? null : '当前曲目无法直接播放',
      };
    }),
  play: () =>
    set((state) => {
      const hasAudio = Boolean(getMusicTrack(state.currentTrackId).audioUrl);
      return {
        runtimeEnabled: true,
        isPlaying: hasAudio,
        isBuffering: hasAudio,
        error: hasAudio ? null : '当前曲目无法直接播放',
      };
    }),
  pause: () => set({ isPlaying: false, isBuffering: false }),
  togglePlay: () =>
    set((state) => {
      const hasAudio = Boolean(getMusicTrack(state.currentTrackId).audioUrl);
      const shouldPlay = !state.isPlaying && hasAudio;
      return {
        runtimeEnabled: true,
        isPlaying: shouldPlay,
        isBuffering: shouldPlay,
        error: !state.isPlaying && !hasAudio ? '当前曲目无法直接播放' : null,
      };
    }),
  nextTrack: (autoplay = true) =>
    set((state) => {
      const nextTrackId = getAdjacentTrackId(state, 1);
      const hasAudio = Boolean(getMusicTrack(nextTrackId).audioUrl);
      return {
        currentTrackId: nextTrackId,
        playlistId: getTrackPlaylist(nextTrackId),
        runtimeEnabled: state.runtimeEnabled || (autoplay && hasAudio),
        isPlaying: autoplay && hasAudio,
        isBuffering: autoplay && hasAudio,
        progress: 0,
        duration: nextTrackId === state.currentTrackId ? state.duration : 0,
        error: hasAudio ? null : '当前曲目无法直接播放',
      };
    }),
  previousTrack: (autoplay = true) =>
    set((state) => {
      const previousTrackId =
        state.progress > 4 ? state.currentTrackId : getAdjacentTrackId(state, -1);
      const hasAudio = Boolean(getMusicTrack(previousTrackId).audioUrl);
      return {
        currentTrackId: previousTrackId,
        playlistId: getTrackPlaylist(previousTrackId),
        runtimeEnabled: state.runtimeEnabled || (autoplay && hasAudio),
        isPlaying: autoplay && hasAudio,
        isBuffering: autoplay && hasAudio,
        progress: 0,
        duration: previousTrackId === state.currentTrackId ? state.duration : 0,
        seekSeconds: 0,
        seekRequestId: state.seekRequestId + 1,
        error: hasAudio ? null : '当前曲目无法直接播放',
      };
    }),
  activateRuntime: () => set({ runtimeEnabled: true }),
  setPlaying: (value) =>
    set((state) => ({ isPlaying: value, isBuffering: value ? state.isBuffering : false })),
  setBuffering: (value) => set({ isBuffering: value }),
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
  setError: (message) =>
    set((state) => ({
      error: message,
      isBuffering: message ? false : state.isBuffering,
    })),
  loadAudiusTrending: async () => {
    const current = useMusicStore.getState();
    if (!current.runtimeEnabled || current.isLoadingAudius) return;

    set({ isLoadingAudius: true, audiusError: null });
    try {
      const tracks = await fetchAudiusTrendingTracks(16);
      registerRuntimeMusicTracks(tracks);
      set((state) => {
        if (state.playlistId !== 'audius-trending') {
          return { isLoadingAudius: false, audiusError: null };
        }

        const queueIds = getPlayableQueue('audius-trending');
        return {
          isLoadingAudius: false,
          audiusError: null,
          queueIds,
          currentTrackId: queueIds[0] ?? state.currentTrackId,
          progress: 0,
          duration: 0,
        };
      });
    } catch (error) {
      set({
        isLoadingAudius: false,
        audiusError: error instanceof Error ? error.message : 'Audius 获取失败',
      });
    }
  },
  toggleLyrics: () => set((state) => ({ lyricsEnabled: !state.lyricsEnabled })),
  setLyricsOffset: (value) => set({ lyricsOffset: value }),
}));

export function getCurrentMusicSnapshot() {
  const state = useMusicStore.getState();
  return {
    state,
    track:
      getAllMusicTracks().find((track) => track.id === state.currentTrackId) ??
      getMusicTrack(DEFAULT_MUSIC_TRACK_ID),
  };
}
