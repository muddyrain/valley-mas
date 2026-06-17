// 资产 PNG 还没接入时（M3.5/M6 之前）的兜底占位图：
// 按稀有度调底色 + 中央 emoji，避免裂图。

const RARITY_BG: Record<string, string> = {
  N: '#e2e8f0',
  R: '#bae6fd',
  SR: '#ddd6fe',
  SSR: '#fde68a',
};

const RARITY_EMOJI: Record<string, string> = {
  N: '🌱',
  R: '🌿',
  SR: '🌸',
  SSR: '🌟',
};

export function plantFallbackDataUrl(rarity: string): string {
  const bg = RARITY_BG[rarity] ?? RARITY_BG.N;
  const emoji = RARITY_EMOJI[rarity] ?? RARITY_EMOJI.N;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="16" fill="${bg}"/><text x="60" y="78" font-size="56" text-anchor="middle">${emoji}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
