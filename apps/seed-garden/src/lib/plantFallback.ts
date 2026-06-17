// 资产 PNG 还没接入时（M3.5/M6 之前）的兜底占位图：
// 按稀有度调底色 + 中央 emoji，避免裂图。
// 提供两种形态：
// 1) plantFallbackDataUrl：SVG dataURL，直接喂给 <img src> 简单场景使用。
// 2) plantFallbackBg / plantFallbackEmoji：用于 React DOM 内联渲染，
//    避免 html2canvas / modern-screenshot 在截图时丢失 SVG 内 emoji 字体。

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

export function plantFallbackBg(rarity: string): string {
  return RARITY_BG[rarity] ?? RARITY_BG.N;
}

export function plantFallbackEmoji(rarity: string): string {
  return RARITY_EMOJI[rarity] ?? RARITY_EMOJI.N;
}

export function plantFallbackDataUrl(rarity: string): string {
  const bg = plantFallbackBg(rarity);
  const emoji = plantFallbackEmoji(rarity);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="16" fill="${bg}"/><text x="60" y="78" font-size="56" text-anchor="middle">${emoji}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
