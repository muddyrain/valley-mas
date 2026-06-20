export type MusicProvider = 'direct' | 'embed' | 'external';

export interface MusicTrack {
  id: string;
  provider: MusicProvider;
  playlistId: string;
  title: string;
  artist: string;
  source: string;
  mood: string;
  coverUrl: string;
  audioUrl?: string;
  embedUrl?: string;
  externalUrl?: string;
  license: string;
  lyrics?: string;
}

export interface MusicPlaylist {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  trackIds: string[];
}

const MORNING_LYRICS = `[00:00.00]云慢慢亮起来
[00:15.00]把桌面调成柔和的光
[00:31.00]今天先从一首歌开始
[00:48.00]慢一点也没有关系
[01:06.00]让心跳跟上窗外的风
[01:24.00]Plush Radio keeps playing`;

const FOCUS_LYRICS = `[00:00.00]把杂音放远
[00:18.00]只留下键盘和呼吸
[00:36.00]一行一行往前走
[00:54.00]想法会自己排好队
[01:12.00]Focus mode is on`;

const RAIN_LYRICS = `[00:00.00]雨声贴着窗沿
[00:20.00]房间安静下来
[00:40.00]纸页、屏幕、热茶
[01:00.00]都在同一个节拍里
[01:20.00]Rainy desk, steady mind`;

const CREATOR_LYRICS = `[00:00.00]留一点空白给灵感
[00:16.00]让旋律绕过手边的草稿
[00:34.00]新的想法会轻轻落下
[00:52.00]像一张还没保存的便签
[01:10.00]Keep making`;

export const MUSIC_TRACKS: MusicTrack[] = [
  {
    id: 'morning-desk',
    provider: 'direct',
    playlistId: 'plush-radio',
    title: 'Morning Desk',
    artist: 'SoundHelix',
    source: 'SoundHelix Audio Examples',
    mood: '晨间桌面',
    coverUrl: '/icons/music.png',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    externalUrl: 'https://www.soundhelix.com/audio-examples',
    license: 'Public audio example',
    lyrics: MORNING_LYRICS,
  },
  {
    id: 'soft-window',
    provider: 'direct',
    playlistId: 'plush-radio',
    title: 'Soft Window',
    artist: 'SoundHelix',
    source: 'SoundHelix Audio Examples',
    mood: '轻快',
    coverUrl: '/icons/music.png',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    externalUrl: 'https://www.soundhelix.com/audio-examples',
    license: 'Public audio example',
    lyrics: MORNING_LYRICS,
  },
  {
    id: 'garden-tabs',
    provider: 'direct',
    playlistId: 'plush-radio',
    title: 'Garden Tabs',
    artist: 'SoundHelix',
    source: 'SoundHelix Audio Examples',
    mood: '浏览',
    coverUrl: '/icons/music.png',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    externalUrl: 'https://www.soundhelix.com/audio-examples',
    license: 'Public audio example',
    lyrics: MORNING_LYRICS,
  },
  {
    id: 'quiet-buffer',
    provider: 'direct',
    playlistId: 'focus',
    title: 'Quiet Buffer',
    artist: 'SoundHelix',
    source: 'SoundHelix Audio Examples',
    mood: '专注',
    coverUrl: '/icons/notes.png',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    externalUrl: 'https://www.soundhelix.com/audio-examples',
    license: 'Public audio example',
    lyrics: FOCUS_LYRICS,
  },
  {
    id: 'deep-work',
    provider: 'direct',
    playlistId: 'focus',
    title: 'Deep Work',
    artist: 'SoundHelix',
    source: 'SoundHelix Audio Examples',
    mood: '长时段',
    coverUrl: '/icons/clock.png',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    externalUrl: 'https://www.soundhelix.com/audio-examples',
    license: 'Public audio example',
    lyrics: FOCUS_LYRICS,
  },
  {
    id: 'writing-loop',
    provider: 'direct',
    playlistId: 'focus',
    title: 'Writing Loop',
    artist: 'SoundHelix',
    source: 'SoundHelix Audio Examples',
    mood: '写作',
    coverUrl: '/icons/notes.png',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    externalUrl: 'https://www.soundhelix.com/audio-examples',
    license: 'Public audio example',
    lyrics: FOCUS_LYRICS,
  },
  {
    id: 'rainy-desk',
    provider: 'direct',
    playlistId: 'rainy-desk',
    title: 'Rainy Desk',
    artist: 'SoundHelix',
    source: 'SoundHelix Audio Examples',
    mood: '雨天',
    coverUrl: '/icons/weather.png',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
    externalUrl: 'https://www.soundhelix.com/audio-examples',
    license: 'Public audio example',
    lyrics: RAIN_LYRICS,
  },
  {
    id: 'window-rain',
    provider: 'direct',
    playlistId: 'rainy-desk',
    title: 'Window Rain',
    artist: 'SoundHelix',
    source: 'SoundHelix Audio Examples',
    mood: '安静',
    coverUrl: '/icons/weather.png',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
    externalUrl: 'https://www.soundhelix.com/audio-examples',
    license: 'Public audio example',
    lyrics: RAIN_LYRICS,
  },
  {
    id: 'creator-spark',
    provider: 'direct',
    playlistId: 'creator-picks',
    title: 'Creator Spark',
    artist: 'SoundHelix',
    source: 'SoundHelix Audio Examples',
    mood: '灵感',
    coverUrl: '/icons/favorites-star.png',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',
    externalUrl: 'https://www.soundhelix.com/audio-examples',
    license: 'Public audio example',
    lyrics: CREATOR_LYRICS,
  },
  {
    id: 'draft-night',
    provider: 'direct',
    playlistId: 'creator-picks',
    title: 'Draft Night',
    artist: 'SoundHelix',
    source: 'SoundHelix Audio Examples',
    mood: '创作',
    coverUrl: '/icons/favorites-star.png',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3',
    externalUrl: 'https://www.soundhelix.com/audio-examples',
    license: 'Public audio example',
    lyrics: CREATOR_LYRICS,
  },
];

export const MUSIC_PLAYLISTS: MusicPlaylist[] = [
  {
    id: 'plush-radio',
    title: 'Plush Radio',
    description: '轻快、干净，适合打开桌面后的第一段背景音乐。',
    coverUrl: '/icons/music.png',
    trackIds: ['morning-desk', 'soft-window', 'garden-tabs'],
  },
  {
    id: 'focus',
    title: 'Focus',
    description: '写作、整理资源和长时间停留时使用。',
    coverUrl: '/icons/notes.png',
    trackIds: ['quiet-buffer', 'deep-work', 'writing-loop'],
  },
  {
    id: 'rainy-desk',
    title: 'Rainy Desk',
    description: '更慢的桌面氛围，适合留一点雨天的安静感。',
    coverUrl: '/icons/weather.png',
    trackIds: ['rainy-desk', 'window-rain'],
  },
  {
    id: 'creator-picks',
    title: 'Creator Picks',
    description: '给创作、整理草稿和灵感收集留的播放组。',
    coverUrl: '/icons/favorites-star.png',
    trackIds: ['creator-spark', 'draft-night'],
  },
];

export const PLAYABLE_MUSIC_TRACKS = MUSIC_TRACKS.filter((track) => track.audioUrl);
export const DEFAULT_MUSIC_TRACK_ID = PLAYABLE_MUSIC_TRACKS[0]?.id ?? MUSIC_TRACKS[0].id;
export const DEFAULT_MUSIC_PLAYLIST_ID = MUSIC_TRACKS[0].playlistId;

export function getMusicTrack(id: string) {
  return MUSIC_TRACKS.find((track) => track.id === id) ?? MUSIC_TRACKS[0];
}

export function getMusicPlaylist(id: string) {
  return MUSIC_PLAYLISTS.find((playlist) => playlist.id === id) ?? MUSIC_PLAYLISTS[0];
}

export function getPlaylistTracks(playlistId: string) {
  const playlist = getMusicPlaylist(playlistId);
  return playlist.trackIds.map(getMusicTrack).filter((track) => track.audioUrl);
}

export function getMusicProviderLabel(provider: MusicProvider) {
  switch (provider) {
    case 'direct':
      return '音频直链';
    case 'embed':
      return '嵌入播放';
    case 'external':
      return '外部平台';
  }
}
