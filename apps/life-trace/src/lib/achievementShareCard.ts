import { achievementCategoryLabels, achievementRarityLabels } from '@/lib/achievements';
import type { Achievement } from '@/types';

export type AchievementShareRender = (achievement: Achievement) => Promise<Blob>;

type AchievementShareOptions = {
  render?: AchievementShareRender;
};

const cardWidth = 1080;
const cardHeight = 1440;

export function getAchievementShareFilename(achievement: Pick<Achievement, 'code'>) {
  const safeCode = achievement.code.replace(/_/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
  return `life-trace-achievement-${safeCode || 'badge'}.png`;
}

export async function createAchievementShareCardFile(
  achievement: Achievement,
  options: AchievementShareOptions = {},
) {
  const render = options.render ?? renderAchievementShareCard;
  const blob = await render(achievement);
  if (!blob || blob.type.toLowerCase() !== 'image/png') {
    throw new Error('分享卡生成失败，请稍后再试');
  }
  return new File([blob], getAchievementShareFilename(achievement), { type: 'image/png' });
}

export async function shareAchievementCard(achievement: Achievement) {
  const file = await createAchievementShareCardFile(achievement);
  const shareData = {
    title: `Life Trace 成就：${achievement.title}`,
    text: achievement.aiComment || achievement.description,
    files: [file],
  };

  if (navigator.canShare?.(shareData)) {
    await navigator.share(shareData);
    return 'shared';
  }

  downloadAchievementShareCard(file);
  return 'downloaded';
}

export async function renderAchievementShareCard(achievement: Achievement): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('分享卡生成失败，请稍后再试');
  }

  const svg = buildAchievementShareSvg(achievement);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = cardWidth;
    canvas.height = cardHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('分享卡生成失败，请稍后再试');
    }
    context.drawImage(image, 0, 0, cardWidth, cardHeight);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) {
      throw new Error('分享卡生成失败，请稍后再试');
    }
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function downloadAchievementShareCard(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('分享卡生成失败，请稍后再试'));
    image.src = url;
  });
}

function buildAchievementShareSvg(achievement: Achievement) {
  const unlockedAt = formatShareUnlockedAt(achievement.unlockedAt);
  const category = achievementCategoryLabels[achievement.category];
  const rarity = achievementRarityLabels[achievement.rarity];
  const comment = achievement.aiComment?.trim();
  const titleLines = wrapSvgText(achievement.title, 14, 2);
  const descriptionLines = wrapSvgText(achievement.description, 22, 3);
  const commentLines = comment ? wrapSvgText(comment, 20, 3) : [];

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#08111f"/>
      <stop offset="48%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#1f2937"/>
    </linearGradient>
    <linearGradient id="line" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#06b6d4" stop-opacity="0"/>
      <stop offset="50%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#06b6d4" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1440" fill="url(#bg)"/>
  <circle cx="850" cy="180" r="210" fill="#06b6d4" opacity="0.08"/>
  <circle cx="160" cy="1190" r="260" fill="#f59e0b" opacity="0.08"/>
  <rect x="78" y="86" width="924" height="1268" rx="42" fill="#020617" opacity="0.58" stroke="#334155"/>
  <rect x="138" y="150" width="804" height="2" fill="url(#line)"/>
  <text x="138" y="230" fill="#67e8f9" font-size="34" font-weight="700" font-family="Arial, sans-serif">Life Trace</text>
  <text x="138" y="284" fill="#94a3b8" font-size="26" font-family="Arial, sans-serif">生活成就已解锁</text>
  <rect x="138" y="372" width="168" height="168" rx="42" fill="#f59e0b" opacity="0.16" stroke="#f59e0b" stroke-opacity="0.45"/>
  <text x="222" y="480" text-anchor="middle" fill="#fbbf24" font-size="74" font-weight="800" font-family="Arial, sans-serif">★</text>
  ${titleLines.map((line, index) => `<text x="138" y="${650 + index * 82}" fill="#f8fafc" font-size="68" font-weight="800" font-family="Arial, sans-serif">${escapeSvg(line)}</text>`).join('')}
  ${descriptionLines.map((line, index) => `<text x="138" y="${840 + index * 44}" fill="#cbd5e1" font-size="32" font-family="Arial, sans-serif">${escapeSvg(line)}</text>`).join('')}
  <rect x="138" y="1000" width="248" height="64" rx="32" fill="#06b6d4" opacity="0.14"/>
  <text x="262" y="1042" text-anchor="middle" fill="#67e8f9" font-size="28" font-weight="700" font-family="Arial, sans-serif">${escapeSvg(category)} · ${escapeSvg(rarity)}</text>
  <text x="138" y="1128" fill="#94a3b8" font-size="28" font-family="Arial, sans-serif">${escapeSvg(unlockedAt)}</text>
  ${
    commentLines.length > 0
      ? `<rect x="138" y="1174" width="804" height="118" rx="28" fill="#ffffff" opacity="0.06"/>
  ${commentLines.map((line, index) => `<text x="178" y="${1230 + index * 38}" fill="#e2e8f0" font-size="30" font-family="Arial, sans-serif">${escapeSvg(line)}</text>`).join('')}`
      : ''
  }
</svg>`;
}

function wrapSvgText(value: string, maxChars: number, maxLines: number) {
  const chars = Array.from(value.trim());
  const lines: string[] = [];
  for (let index = 0; index < chars.length && lines.length < maxLines; index += maxChars) {
    lines.push(chars.slice(index, index + maxChars).join(''));
  }
  if (chars.length > maxChars * maxLines && lines.length > 0) {
    lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, -1)}…`;
  }
  return lines;
}

function formatShareUnlockedAt(value?: string) {
  if (!value) {
    return '刚刚解锁';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '刚刚解锁';
  }
  return `${date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })} 解锁`;
}

function escapeSvg(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
