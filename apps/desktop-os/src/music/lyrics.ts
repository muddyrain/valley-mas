export interface LyricLine {
  time: number;
  text: string;
}

const LRC_TIME_RE = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?\]/g;

export function parseLyrics(value?: string) {
  if (!value) return [];

  const lines: LyricLine[] = [];
  for (const rawLine of value.split('\n')) {
    const matches = [...rawLine.matchAll(LRC_TIME_RE)];
    if (matches.length === 0) continue;

    const text = rawLine.replace(LRC_TIME_RE, '').trim();
    for (const match of matches) {
      const minutes = Number(match[1] ?? 0);
      const seconds = Number(match[2] ?? 0);
      const fraction = Number((match[3] ?? '0').padEnd(2, '0')) / 100;
      lines.push({
        time: minutes * 60 + seconds + fraction,
        text,
      });
    }
  }

  return lines.sort((a, b) => a.time - b.time);
}

export function getActiveLyricIndex(lines: LyricLine[], progress: number, offset: number) {
  const currentTime = progress + offset;
  let activeIndex = -1;

  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].time <= currentTime) activeIndex = index;
    else break;
  }

  return activeIndex;
}

export function formatDuration(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0:00';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
