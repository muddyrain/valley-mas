import type { MusicTrack } from '../music/catalog';

const AUDIUS_API_BASE_URL = import.meta.env.VITE_AUDIUS_API_BASE_URL || 'https://api.audius.co/v1';
const AUDIUS_API_BEARER_TOKEN = import.meta.env.VITE_AUDIUS_API_BEARER_TOKEN || '';

interface AudiusTrendingResponse {
  data?: AudiusTrack[];
}

interface AudiusTrack {
  id: string;
  title: string;
  genre?: string | null;
  mood?: string | null;
  duration?: number | null;
  permalink?: string | null;
  license?: string | null;
  is_streamable?: boolean;
  artwork?: {
    '150x150'?: string;
    '480x480'?: string;
    '1000x1000'?: string;
  } | null;
  stream?: {
    url?: string;
  } | null;
  user?: {
    handle?: string;
    name?: string;
  } | null;
}

export async function fetchAudiusTrendingTracks(limit = 12): Promise<MusicTrack[]> {
  const url = new URL(`${AUDIUS_API_BASE_URL}/tracks/trending`);
  url.searchParams.set('limit', String(limit));

  const response = await fetch(url, {
    headers: AUDIUS_API_BEARER_TOKEN
      ? {
          Authorization: `Bearer ${AUDIUS_API_BEARER_TOKEN}`,
        }
      : undefined,
  });

  if (!response.ok) {
    throw new Error(`Audius 获取失败：${response.status}`);
  }

  const payload = (await response.json()) as AudiusTrendingResponse;
  return (payload.data ?? [])
    .filter((track) => track.is_streamable !== false && Boolean(track.stream?.url))
    .map(mapAudiusTrack);
}

function mapAudiusTrack(track: AudiusTrack): MusicTrack {
  const artist = track.user?.name || track.user?.handle || 'Audius Artist';
  const coverUrl = track.artwork?.['480x480'] || track.artwork?.['1000x1000'] || '/icons/music.png';

  return {
    id: `audius-${track.id}`,
    provider: 'direct',
    playlistId: 'audius-trending',
    title: track.title,
    artist,
    source: 'Audius',
    mood: track.genre || track.mood || 'Trending',
    coverUrl,
    audioUrl: track.stream?.url,
    externalUrl: track.permalink ? `https://audius.co${track.permalink}` : 'https://audius.co',
    license: track.license || 'Audius artist upload',
  };
}
