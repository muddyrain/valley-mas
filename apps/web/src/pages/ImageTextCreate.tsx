import {
  ArrowLeft,
  Check,
  ChevronLeftCircle,
  ChevronRightCircle,
  LayoutTemplate,
  PencilLine,
  Plus,
  Send,
  SmilePlus,
  Sparkles,
  Trash2,
  Type,
  WandSparkles,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  createPost,
  type Group,
  getAdminGroups,
  getAdminPostDetail,
  updatePost,
  uploadImageTextAsset,
} from '@/api/blog';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/useAuthStore';

type TemplateKey = 'paper' | 'quote' | 'ink' | 'mint' | 'sunset' | 'grid';
type BackgroundStyle = 'lined' | 'dots' | 'plain';
type AccentStyle = 'none' | 'marker' | 'bubble' | 'underline';
type LayoutStyle = 'center' | 'top';
type PreviewVariant = 'full' | 'template' | 'thumb';

type Template = {
  key: TemplateKey;
  name: string;
  accent: string;
  sampleText: string;
  background: BackgroundStyle;
  accentStyle: AccentStyle;
  layout: LayoutStyle;
  frameClass: string;
  textClass: string;
  fontFamily: string;
  showDate?: boolean;
};

type ImageTextPayload = {
  templateKey?: string;
  stickerEmoji?: string;
  images?: string[];
  pages?: Array<
    | string
    | {
        text?: string;
        imageUrl?: string;
        imageKey?: string;
        highlightText?: string;
        highlightStart?: number;
        highlightEnd?: number;
        fontSize?: number;
        highlightFontSize?: number;
        textStyles?: Array<{
          start?: number;
          end?: number;
          fontSize?: number;
        }>;
      }
  >;
  generatedAt?: string;
};

type TextStyleRange = {
  start: number;
  end: number;
  fontSize: number;
};

type EditorPage = {
  text: string;
  highlightStart: number | null;
  highlightEnd: number | null;
  fontSize: number;
  highlightFontSize: number;
  textStyles: TextStyleRange[];
};

type TextSegment = {
  text: string;
  highlight: boolean;
  fontSize: number;
};

const DEFAULT_FONT_SIZE = 40;
const DEFAULT_HIGHLIGHT_FONT_SIZE = 84;
const FONT_SIZE_OPTIONS = [24, 28, 32, 36, 40, 44, 48, 56];

const TEMPLATES: Template[] = [
  {
    key: 'paper',
    name: '备忘录横线',
    accent: '像小红书便签那样的大字居中排版',
    sampleText: '28岁男生准备\n3月底带着5万块\n勇闯澳洲 why',
    background: 'lined',
    accentStyle: 'marker',
    layout: 'center',
    frameClass: 'border-[#efe6d7] bg-[#fffdfa]',
    textClass: 'text-[#2f2f33]',
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    showDate: true,
  },
  {
    key: 'quote',
    name: '波点金句',
    accent: '留白很多，适合一句话冲击感',
    sampleText: '我发现程序员跟\n中医师简直是\n无缝对接！',
    background: 'dots',
    accentStyle: 'bubble',
    layout: 'center',
    frameClass: 'border-[#ece8f4] bg-[#fffefe]',
    textClass: 'text-[#241d22]',
    fontFamily: '"STSong", "Songti SC", serif',
  },
  {
    key: 'ink',
    name: '留白黑字',
    accent: '极简大字海报，适合观点表达',
    sampleText: '杭州有没有\n晚上七八点能\n下班的大厂\n开发岗位？？',
    background: 'plain',
    accentStyle: 'none',
    layout: 'center',
    frameClass: 'border-[#ebe7dc] bg-[#fcfaf4]',
    textClass: 'text-[#262626]',
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
  },
  {
    key: 'mint',
    name: '居中大字',
    accent: '适合短句、提问和情绪表达',
    sampleText: '慢慢来也是一种\n很厉害的节奏',
    background: 'plain',
    accentStyle: 'underline',
    layout: 'center',
    frameClass: 'border-[#efe9dc] bg-[#f9f6ec]',
    textClass: 'text-[#303133]',
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
  },
  {
    key: 'sunset',
    name: '奶油金句',
    accent: '更柔和的情绪卡片效果',
    sampleText: '真正的松弛感\n不是躺平\n而是心里不慌',
    background: 'plain',
    accentStyle: 'marker',
    layout: 'center',
    frameClass: 'border-[#f2ddca] bg-[linear-gradient(180deg,#fffaf3_0%,#f9efdd_100%)]',
    textClass: 'text-[#3f332f]',
    fontFamily: '"Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  },
  {
    key: 'grid',
    name: '清单攻略',
    accent: '更适合信息量稍高的图文页',
    sampleText: '面试前先准备\n1. 项目亮点\n2. 自我介绍\n3. 问答清单',
    background: 'dots',
    accentStyle: 'none',
    layout: 'top',
    frameClass: 'border-[#e3e6ef] bg-[#fbfcff]',
    textClass: 'text-[#2f3a4d]',
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
  },
];

const EMOJIS = ['✨', '🌷', '🫶', '🥰', '📚', '☁️', '🍀', '🎀', '🌸', '🌈', '📝', '💡'];
const CARD_CANVAS_WIDTH = 1080;
const CARD_CANVAS_HEIGHT = 1680;
const CANVAS_FONT_SCALE = 3;

function createEditorPage(text = ''): EditorPage {
  return {
    text,
    highlightStart: null,
    highlightEnd: null,
    fontSize: DEFAULT_FONT_SIZE,
    highlightFontSize: DEFAULT_HIGHLIGHT_FONT_SIZE,
    textStyles: [],
  };
}

function normalizeText(input: string) {
  return input.replace(/\r\n/g, '\n').trim();
}

function normalizePageText(input: string) {
  return input.replace(/\r\n/g, '\n');
}

function extractTitle(text: string) {
  const line = text.split('\n').find((item) => item.trim());
  if (!line) return '未命名图文';
  return line.length > 22 ? `${line.slice(0, 22)}...` : line;
}

function parseImageTextPayload(raw?: string) {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ImageTextPayload;
  } catch {
    return null;
  }
}

function normalizeTemplateKey(value?: string): TemplateKey {
  return TEMPLATES.some((template) => template.key === value) ? (value as TemplateKey) : 'paper';
}

function getHighlightRange(page: EditorPage) {
  if (page.highlightStart == null || page.highlightEnd == null) return null;
  const start = Math.max(0, Math.min(page.highlightStart, page.highlightEnd));
  const end = Math.max(0, Math.max(page.highlightStart, page.highlightEnd));
  if (start === end) return null;
  if (end > page.text.length) return null;
  return { start, end };
}

function getHighlightedText(page: EditorPage) {
  const range = getHighlightRange(page);
  if (!range) return '';
  return page.text.slice(range.start, range.end);
}

function restoreHighlightRange(
  text: string,
  highlightStart?: number,
  highlightEnd?: number,
  highlightText?: string,
) {
  if (
    typeof highlightStart === 'number' &&
    typeof highlightEnd === 'number' &&
    highlightStart >= 0 &&
    highlightEnd > highlightStart &&
    highlightEnd <= text.length
  ) {
    return { highlightStart, highlightEnd };
  }

  if (highlightText) {
    const index = text.indexOf(highlightText);
    if (index >= 0) {
      return {
        highlightStart: index,
        highlightEnd: index + highlightText.length,
      };
    }
  }

  return {
    highlightStart: null,
    highlightEnd: null,
  };
}

function normalizeTextStyles(
  text: string,
  textStyles?: Array<{ start?: number; end?: number; fontSize?: number }>,
) {
  if (!textStyles?.length) return [];
  return textStyles
    .filter(
      (item): item is Required<Pick<TextStyleRange, 'start' | 'end' | 'fontSize'>> =>
        typeof item.start === 'number' &&
        typeof item.end === 'number' &&
        typeof item.fontSize === 'number',
    )
    .map((item) => ({
      start: Math.max(0, item.start),
      end: Math.min(text.length, item.end),
      fontSize: item.fontSize,
    }))
    .filter((item) => item.end > item.start)
    .sort((a, b) => a.start - b.start);
}

function getSegmentFontSize(page: EditorPage, start: number, end: number) {
  const styled = page.textStyles.find((item) => item.start <= start && item.end >= end);
  return styled?.fontSize || page.fontSize;
}

function scaleFontSize(size: number, variant: PreviewVariant) {
  const scaled = Math.round(size * getVariantScale(variant));
  if (variant === 'full') return scaled;
  return Math.max(scaled, 9);
}

function getCanvasRenderFontSize(size: number) {
  return Math.round(size * CANVAS_FONT_SCALE);
}

function tokenizeLine(line: string, lineStart: number, page: EditorPage): TextSegment[] {
  const range = getHighlightRange(page);
  const lineEnd = lineStart + line.length;
  const boundaries = new Set<number>([0, line.length]);

  if (range) {
    boundaries.add(Math.max(0, Math.min(line.length, range.start - lineStart)));
    boundaries.add(Math.max(0, Math.min(line.length, range.end - lineStart)));
  }

  page.textStyles.forEach((item) => {
    if (item.end <= lineStart || item.start >= lineEnd) return;
    boundaries.add(Math.max(0, item.start - lineStart));
    boundaries.add(Math.min(line.length, item.end - lineStart));
  });

  const sorted = [...boundaries].sort((a, b) => a - b);
  const result: TextSegment[] = [];

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const start = sorted[index];
    const end = sorted[index + 1];
    if (end <= start) continue;
    const text = line.slice(start, end);
    if (!text) continue;
    const absoluteStart = lineStart + start;
    const absoluteEnd = lineStart + end;
    result.push({
      text,
      highlight: !!range && absoluteStart >= range.start && absoluteEnd <= range.end,
      fontSize: getSegmentFontSize(page, absoluteStart, absoluteEnd),
    });
  }

  return result.length ? result : [{ text: line, highlight: false, fontSize: page.fontSize }];
}

function buildDisplayLines(
  page: EditorPage,
  template: Template,
  variant: PreviewVariant,
): TextSegment[][] {
  const compact = variant !== 'full';
  const normalized = page.text.replace(/\r\n/g, '\n');
  if (!normalized.trim()) return [[{ text: '', highlight: false, fontSize: page.fontSize }]];

  const maxCharsPerLine = compact
    ? template.layout === 'top'
      ? 9
      : 8
    : template.layout === 'top'
      ? 13
      : 11;
  const maxLines = compact ? 5 : template.layout === 'top' ? 8 : 6;
  const lines: TextSegment[][] = [];
  let cursor = 0;

  normalized.split('\n').forEach((sourceLine) => {
    const lineStart = cursor;
    cursor += sourceLine.length + 1;
    if (!sourceLine.trim()) return;

    const tokens = tokenizeLine(sourceLine, lineStart, page);
    let current: TextSegment[] = [];
    let currentLength = 0;

    const pushCurrent = () => {
      if (current.length) lines.push(current);
      current = [];
      currentLength = 0;
    };

    tokens.forEach((token) => {
      if (token.highlight) {
        if (currentLength > 0 && currentLength + token.text.length > maxCharsPerLine) {
          pushCurrent();
        }
        current.push(token);
        currentLength += token.text.length;
        return;
      }

      let rest = token.text;
      while (rest) {
        const space = maxCharsPerLine - currentLength;
        if (space <= 0) {
          pushCurrent();
          continue;
        }
        if (rest.length <= space) {
          current.push({ text: rest, highlight: false, fontSize: token.fontSize });
          currentLength += rest.length;
          rest = '';
        } else {
          current.push({ text: rest.slice(0, space), highlight: false, fontSize: token.fontSize });
          currentLength += space;
          pushCurrent();
          rest = rest.slice(space);
        }
      }
    });

    pushCurrent();
  });

  return lines.slice(0, maxLines);
}

function getVariantScale(variant: PreviewVariant) {
  if (variant === 'template') return 0.18;
  if (variant === 'thumb') return 0.14;
  return 1;
}

function getBaseFontSize(page: EditorPage, variant: PreviewVariant) {
  const size = Math.round(page.fontSize * getVariantScale(variant));
  if (variant === 'full') return size;
  return Math.max(size, 9);
}

function getSegmentPreviewFontSize(segment: TextSegment, variant: PreviewVariant) {
  return scaleFontSize(segment.fontSize, variant);
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawBackground(ctx: CanvasRenderingContext2D, template: Template) {
  if (template.background === 'lined') {
    ctx.strokeStyle = 'rgba(212,216,224,0.55)';
    for (let y = 210; y < CARD_CANVAS_HEIGHT - 120; y += 118) {
      ctx.beginPath();
      ctx.moveTo(60, y);
      ctx.lineTo(CARD_CANVAS_WIDTH - 60, y);
      ctx.stroke();
    }
    return;
  }

  if (template.background === 'dots') {
    ctx.fillStyle = 'rgba(156,163,175,0.55)';
    for (let x = 36; x < CARD_CANVAS_WIDTH; x += 64) {
      for (let y = 36; y < CARD_CANVAS_HEIGHT; y += 64) {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawAccent(
  ctx: CanvasRenderingContext2D,
  template: Template,
  x: number,
  baselineY: number,
  width: number,
  index: number,
  disableTemplateAccent: boolean,
) {
  void ctx;
  void template;
  void x;
  void baselineY;
  void width;
  void index;
  void disableTemplateAccent;
}

function getCanvasFont(template: Template, size: number) {
  return `${size}px ${template.fontFamily}, "Microsoft YaHei", sans-serif`;
}

function measureSegments(
  ctx: CanvasRenderingContext2D,
  template: Template,
  segments: TextSegment[],
) {
  let width = 0;
  segments.forEach((segment) => {
    ctx.font = getCanvasFont(template, getCanvasRenderFontSize(segment.fontSize));
    width += ctx.measureText(segment.text).width;
  });
  return width;
}

function getLineHeight(segments: TextSegment[]) {
  const maxFontSize = segments.reduce((max, segment) => Math.max(max, segment.fontSize), 0);
  return getCanvasRenderFontSize(maxFontSize) * 1.34;
}
async function renderCardToBlob(page: EditorPage, template: Template, stickerEmoji: string) {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_CANVAS_WIDTH;
  canvas.height = CARD_CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas not supported');

  ctx.fillStyle = '#fffdfa';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (template.key === 'mint') {
    ctx.fillStyle = '#f9f6ec';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (template.key === 'ink') {
    ctx.fillStyle = '#fcfaf4';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (template.key === 'sunset') {
    const gradient = ctx.createLinearGradient(0, 0, 0, CARD_CANVAS_HEIGHT);
    gradient.addColorStop(0, '#fffaf3');
    gradient.addColorStop(1, '#f9efdd');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  drawBackground(ctx, template);

  const lines = buildDisplayLines(page, template, 'full');
  const lineHeights = lines.map((segments) => getLineHeight(segments));
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle =
    template.key === 'grid' ? '#2f3a4d' : template.key === 'sunset' ? '#3f332f' : '#2f2f33';

  if (template.showDate) {
    ctx.fillStyle = '#d7a911';
    ctx.font = '62px "Helvetica Neue", sans-serif';
    ctx.fillText('Notes', 96, 100);
    ctx.fillStyle =
      template.key === 'grid' ? '#2f3a4d' : template.key === 'sunset' ? '#3f332f' : '#2f2f33';
  }

  const contentHeight = lineHeights.reduce((sum, height) => sum + height, 0);
  const startY = template.layout === 'top' ? 244 : (CARD_CANVAS_HEIGHT - contentHeight) / 2 + 80;
  const hasCustomHighlight = !!getHighlightedText(page);
  let yCursor = startY;

  lines.forEach((segments, index) => {
    const totalWidth = measureSegments(ctx, template, segments);
    const x = template.layout === 'top' ? 110 : (CARD_CANVAS_WIDTH - totalWidth) / 2;
    const lineHeight = lineHeights[index];
    const lineFontSize = getCanvasRenderFontSize(
      segments.reduce((max, segment) => Math.max(max, segment.fontSize), page.fontSize),
    );
    const baselineY = yCursor + lineFontSize;

    drawAccent(ctx, template, x, baselineY, totalWidth, index, hasCustomHighlight);

    let currentX = x;
    segments.forEach((segment) => {
      const renderFontSize = getCanvasRenderFontSize(segment.fontSize);
      ctx.font = getCanvasFont(template, renderFontSize);
      const width = ctx.measureText(segment.text).width;
      if (segment.highlight) {
        ctx.fillStyle = 'rgba(236,184,255,0.72)';
        drawRoundedRect(
          ctx,
          currentX - 24,
          baselineY - renderFontSize + 24,
          width + 48,
          renderFontSize * 0.92,
          36,
        );
        ctx.fill();
        ctx.fillStyle =
          template.key === 'grid' ? '#2f3a4d' : template.key === 'sunset' ? '#3f332f' : '#2f2f33';
      }
      ctx.fillText(segment.text, currentX, baselineY);
      currentX += width;
    });
    yCursor += lineHeight;
  });

  ctx.font = '112px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
  if (template.key === 'paper') {
    ctx.fillText(stickerEmoji, CARD_CANVAS_WIDTH / 2 - 56, CARD_CANVAS_HEIGHT - 150);
  } else {
    ctx.fillText(stickerEmoji, CARD_CANVAS_WIDTH - 180, 160);
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), 'image/png', 0.95);
  });
  if (!blob) throw new Error('generate image failed');
  return blob;
}

function cardBackgroundClass(template: Template) {
  if (template.background === 'lined') {
    return 'bg-[linear-gradient(180deg,#fffdfa_0%,#fffdfa_100%),repeating-linear-gradient(180deg,transparent_0,transparent_58px,rgba(212,216,224,0.65)_58px,rgba(212,216,224,0.65)_60px)]';
  }
  if (template.background === 'dots') {
    return 'bg-[radial-gradient(circle,rgba(156,163,175,0.55)_1.4px,transparent_1.6px)] bg-[length:28px_28px]';
  }
  return '';
}

function lineAccentClass(template: Template, index: number, hasCustomHighlight: boolean) {
  void template;
  void index;
  void hasCustomHighlight;
  return '';
}

function samplePage(text: string): EditorPage {
  return createEditorPage(text);
}

function CardPreview({
  page,
  template,
  stickerEmoji,
  variant = 'full',
}: {
  page: EditorPage;
  template: Template;
  stickerEmoji: string;
  variant?: PreviewVariant;
}) {
  const isCompact = variant !== 'full';
  const isTemplate = variant === 'template';
  const lines = buildDisplayLines(page, template, variant);
  const compactWidth = isTemplate ? 'w-[118px]' : 'w-[88px]';
  const compactInsetX = isTemplate ? 'inset-x-3.5' : 'inset-x-2.5';
  const compactTop =
    template.layout === 'top'
      ? isTemplate
        ? 'top-[4.25rem]'
        : 'top-11'
      : 'top-1/2 -translate-y-1/2';
  const baseFontSize = getBaseFontSize(page, variant);
  const hasCustomHighlight = !!getHighlightedText(page);

  return (
    <div
      className={`relative aspect-[3/5] overflow-hidden rounded-[30px] border ${template.frameClass} ${cardBackgroundClass(template)} ${isCompact ? compactWidth : 'w-full max-w-[390px]'} shadow-[0_18px_46px_rgba(15,23,42,0.08)]`}
    >
      {template.showDate ? (
        <div
          className={`absolute left-5 top-4 ${isCompact ? (isTemplate ? 'text-[9px]' : 'text-[7px]') : 'text-[20px]'} font-medium text-[#d7a911]`}
        >
          Notes
        </div>
      ) : null}

      <div
        className={`absolute ${isCompact ? compactInsetX : 'inset-x-6'} ${template.layout === 'top' ? (isCompact ? compactTop : 'top-28') : 'top-1/2 -translate-y-1/2'} flex flex-col ${template.layout === 'top' ? 'items-start' : 'items-center'} ${isCompact ? (isTemplate ? 'gap-2' : 'gap-1') : 'gap-3'} ${template.textClass}`}
        style={{ fontFamily: template.fontFamily, fontSize: `${baseFontSize}px`, lineHeight: 1.3 }}
      >
        {lines.map((segments, index) => (
          <div
            key={index}
            className={template.layout === 'top' ? 'text-left' : 'text-center'}
            style={{
              lineHeight: `${Math.max(...segments.map((segment) => getSegmentPreviewFontSize(segment, variant))) * 1.25}px`,
            }}
          >
            {segments.map((segment, segmentIndex) => (
              <span
                key={`${segment.text}-${segmentIndex}`}
                className={
                  segment.highlight
                    ? 'rounded-full bg-fuchsia-200/70 px-2 py-1 inline-block'
                    : lineAccentClass(template, index, hasCustomHighlight)
                }
                style={{ fontSize: `${getSegmentPreviewFontSize(segment, variant)}px` }}
              >
                {segment.text}
              </span>
            ))}
          </div>
        ))}
      </div>

      <div
        className={`absolute ${template.key === 'paper' ? (isCompact ? `bottom-4 left-1/2 -translate-x-1/2 ${isTemplate ? 'text-base' : 'text-xs'}` : 'bottom-12 left-1/2 -translate-x-1/2 text-4xl') : isCompact ? `${isTemplate ? 'right-3 top-3 text-base' : 'right-2 top-2 text-xs'}` : 'right-6 top-5 text-3xl'}`}
      >
        {stickerEmoji}
      </div>
    </div>
  );
}

function RenderedCardPreview({
  page,
  template,
  stickerEmoji,
  variant = 'full',
}: {
  page: EditorPage;
  template: Template;
  stickerEmoji: string;
  variant?: 'full' | 'thumb';
}) {
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    let active = true;
    let objectUrl = '';

    const renderPreview = async () => {
      try {
        const blob = await renderCardToBlob(page, template, stickerEmoji);
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      } catch {
        if (active) {
          setPreviewUrl('');
        }
      }
    };

    void renderPreview();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [page, stickerEmoji, template]);

  const widthClass = variant === 'thumb' ? 'w-[88px]' : 'w-full max-w-[390px]';

  return (
    <div
      className={`relative aspect-[3/5] overflow-hidden rounded-[30px] border ${template.frameClass} ${widthClass} bg-white shadow-[0_18px_46px_rgba(15,23,42,0.08)]`}
    >
      {previewUrl ? (
        <img src={previewUrl} alt="图文渲染预览" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-slate-50 text-xs text-slate-400">
          预览生成中...
        </div>
      )}
    </div>
  );
}

function TemplatePill({
  template,
  active,
  stickerEmoji,
  onSelect,
}: {
  template: Template;
  active: boolean;
  stickerEmoji: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-[208px] shrink-0 rounded-[22px] border p-2.5 text-left transition ${active ? 'border-orange-300 bg-orange-50/80 shadow-sm ring-2 ring-orange-100' : 'border-slate-200 bg-white hover:border-orange-200'}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-slate-900">{template.name}</div>
          <div className="text-xs text-slate-500">{template.accent}</div>
        </div>
        {active ? <Check className="h-4 w-4 text-orange-500" /> : null}
      </div>
      <div className="flex justify-center rounded-[18px] bg-slate-50/70 py-1">
        <CardPreview
          page={samplePage(template.sampleText)}
          template={template}
          stickerEmoji={stickerEmoji}
          variant="template"
        />
      </div>
    </button>
  );
}
export default function ImageTextCreate() {
  const navigate = useNavigate();
  const { id: editingId } = useParams<{ id?: string }>();
  const { user, isAuthenticated } = useAuthStore();
  const isEditMode = Boolean(editingId);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [pages, setPages] = useState<EditorPage[]>([createEditorPage()]);
  const [stickerEmoji, setStickerEmoji] = useState('✨');
  const [templateKey, setTemplateKey] = useState<TemplateKey>('paper');
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingPost, setLoadingPost] = useState(false);
  const [activePage, setActivePage] = useState(0);

  const canCreate = user?.role === 'creator' || user?.role === 'admin';
  const selectedTemplate = useMemo(
    () => TEMPLATES.find((item) => item.key === templateKey) || TEMPLATES[0],
    [templateKey],
  );
  const livePages = useMemo(() => (pages.length ? pages : [createEditorPage()]), [pages]);
  const totalChars = useMemo(
    () => pages.reduce((sum, page) => sum + page.text.replace(/\s+/g, '').length, 0),
    [pages],
  );
  const currentPage = livePages[activePage] ?? createEditorPage();
  const currentHighlightText = getHighlightedText(currentPage);

  useEffect(() => {
    setActivePage((prev) => Math.min(prev, Math.max(livePages.length - 1, 0)));
  }, [livePages.length]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    void getAdminGroups()
      .then((list) => {
        setGroups(list || []);
        if (!editingId && list?.[0]?.id) {
          setGroupId(list[0].id);
        }
      })
      .catch(() => {
        toast.error('分组加载失败，请稍后再试');
      });
  }, [editingId, isAuthenticated, navigate]);

  useEffect(() => {
    if (!editingId) return;

    const loadPost = async () => {
      try {
        setLoadingPost(true);
        const detail = await getAdminPostDetail(editingId);
        if (detail.postType !== 'image_text') {
          toast.error('这篇内容不是图文创作');
          navigate('/my-space');
          return;
        }

        const payload = parseImageTextPayload(detail.imageTextData || detail.templateData);
        const restoredPages =
          payload?.pages
            ?.map((item) => {
              if (typeof item === 'string') return createEditorPage(item);
              const text = item?.text || '';
              const restoredHighlight = restoreHighlightRange(
                text,
                item?.highlightStart,
                item?.highlightEnd,
                item?.highlightText,
              );
              return {
                text,
                ...restoredHighlight,
                fontSize: item?.fontSize || DEFAULT_FONT_SIZE,
                highlightFontSize: item?.highlightFontSize || DEFAULT_HIGHLIGHT_FONT_SIZE,
                textStyles: normalizeTextStyles(text, item?.textStyles),
              } satisfies EditorPage;
            })
            .filter((item) => item.text.trim()) || [];

        setPages(
          restoredPages.length
            ? restoredPages
            : [createEditorPage(detail.excerpt || detail.title || '')],
        );
        setStickerEmoji(payload?.stickerEmoji || '✨');
        setTemplateKey(normalizeTemplateKey(payload?.templateKey));
        setGroupId(detail.groupId || '');
        setActivePage(0);
      } catch {
        toast.error('图文内容加载失败');
        navigate('/my-space');
      } finally {
        setLoadingPost(false);
      }
    };

    void loadPost();
  }, [editingId, navigate]);

  if (!isAuthenticated) return null;

  if (!canCreate) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          当前账号暂不支持图文创作，请切换到创作者账号后再试。
        </div>
      </div>
    );
  }

  const updateCurrentPage = (patch: Partial<EditorPage>) => {
    setPages((prev) =>
      prev.map((page, index) => (index === activePage ? { ...page, ...patch } : page)),
    );
  };

  const updateCurrentPageText = (text: string) => {
    setPages((prev) =>
      prev.map((page, index) =>
        index === activePage
          ? {
              ...page,
              text,
              highlightStart: null,
              highlightEnd: null,
              textStyles: [],
            }
          : page,
      ),
    );
  };

  const addPage = () => {
    if (pages.length >= 9) {
      toast.error('最多先支持 9 页图文');
      return;
    }
    setPages((prev) => {
      const next = [...prev];
      next.splice(activePage + 1, 0, createEditorPage());
      return next;
    });
    setActivePage((prev) => prev + 1);
  };

  const removePage = () => {
    if (pages.length <= 1) {
      setPages([createEditorPage()]);
      setActivePage(0);
      return;
    }
    setPages((prev) => prev.filter((_, index) => index !== activePage));
    setActivePage((prev) => Math.max(prev - 1, 0));
  };

  const applyHighlightSelection = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;

    if (start === end) {
      toast.error('先在内容里选中一段想高亮的文字');
      return;
    }

    const selectedText = currentPage.text.slice(start, end);
    if (!selectedText.trim()) {
      toast.error('高亮内容不能只选空白');
      return;
    }
    if (selectedText.includes('\n')) {
      toast.error('高亮暂不支持跨行，请只选同一行里的内容');
      return;
    }
    if (selectedText.length > 12) {
      toast.error('高亮内容尽量短一些，这样成片会更好看');
      return;
    }

    updateCurrentPage({ highlightStart: start, highlightEnd: end });
  };

  const clearHighlightSelection = () => {
    updateCurrentPage({ highlightStart: null, highlightEnd: null });
  };

  const applySelectionFontSize = (fontSize: number) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    if (start === end) {
      toast.error('先选中一段文字，再设置局部字号');
      return;
    }

    const selectedText = currentPage.text.slice(start, end);
    if (!selectedText.trim()) {
      toast.error('局部字号不能只作用在空白上');
      return;
    }
    if (selectedText.includes('\n')) {
      toast.error('局部字号暂不支持跨行，请只选同一行里的内容');
      return;
    }

    const nextStyles = currentPage.textStyles
      .filter((item) => item.end <= start || item.start >= end)
      .concat({ start, end, fontSize })
      .sort((a, b) => a.start - b.start);

    updateCurrentPage({ textStyles: nextStyles });
  };

  const clearSelectionFontSize = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    if (start === end) {
      toast.error('先选中一段文字，再清除局部字号');
      return;
    }

    updateCurrentPage({
      textStyles: currentPage.textStyles.filter((item) => item.end <= start || item.start >= end),
    });
  };

  const onPublish = async () => {
    const pagesToPublish = pages
      .map((page) => {
        const normalizedPageText = normalizePageText(page.text);
        return {
          ...page,
          text: normalizedPageText,
          highlightStart: getHighlightRange({ ...page, text: normalizedPageText })?.start ?? null,
          highlightEnd: getHighlightRange({ ...page, text: normalizedPageText })?.end ?? null,
          textStyles: normalizeTextStyles(normalizedPageText, page.textStyles),
        };
      })
      .filter((page) => page.text.trim());

    if (!pagesToPublish.length) {
      toast.error('至少先写一页内容再发布');
      return;
    }
    if (!groupId && groups.length > 0) {
      toast.error('请选择一个分组');
      return;
    }

    const title = extractTitle(pagesToPublish[0].text);

    try {
      setSubmitting(true);
      const uploadedImageUrls: string[] = [];
      const uploadedImageKeys: string[] = [];

      for (let index = 0; index < pagesToPublish.length; index += 1) {
        const imageBlob = await renderCardToBlob(
          pagesToPublish[index],
          selectedTemplate,
          stickerEmoji,
        );
        const formData = new FormData();
        formData.append(
          'file',
          new File([imageBlob], `image-text-${Date.now()}-${index + 1}.png`, { type: 'image/png' }),
        );
        const uploadResp = await uploadImageTextAsset(formData);
        if (!uploadResp?.url || !uploadResp?.key) {
          throw new Error('upload image failed');
        }
        uploadedImageUrls.push(uploadResp.url);
        uploadedImageKeys.push(uploadResp.key);
      }

      const markdownImages = uploadedImageUrls
        .map((url, index) => `![图文第${index + 1}页](${url})`)
        .join('\n\n');

      const payload = {
        title,
        postType: 'image_text' as const,
        templateKey: '',
        templateData: '',
        imageTextData: {
          templateKey,
          stickerEmoji,
          images: uploadedImageUrls,
          pages: pagesToPublish.map((page, index) => ({
            text: page.text,
            highlightText:
              page.highlightStart != null && page.highlightEnd != null
                ? page.text.slice(page.highlightStart, page.highlightEnd)
                : '',
            highlightStart: page.highlightStart ?? undefined,
            highlightEnd: page.highlightEnd ?? undefined,
            fontSize: page.fontSize,
            highlightFontSize: page.highlightFontSize,
            textStyles: page.textStyles,
            imageUrl: uploadedImageUrls[index],
            imageKey: uploadedImageKeys[index],
          })),
          generatedAt: new Date().toISOString(),
        },
        content: markdownImages,
        excerpt: normalizeText(pagesToPublish[0]?.text || '').slice(0, 120) || title,
        cover: uploadedImageUrls[0],
        groupId: groupId || undefined,
        status: 'published' as const,
        publishNow: true,
      };

      if (isEditMode && editingId) {
        await updatePost(editingId, payload);
        toast.success('图文已更新');
      } else {
        await createPost(payload);
        toast.success('图文已发布');
      }

      navigate('/my-space');
    } catch {
      toast.error(isEditMode ? '图文更新失败，请稍后重试' : '图文发布失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (isEditMode && loadingPost) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[#f7f3ee] px-4 py-6 md:px-8">
        <div className="mx-auto max-w-[1460px] rounded-[30px] border border-orange-200/80 bg-white/90 p-8">
          <div className="text-sm text-slate-500">图文内容加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top,#fff6ec_0%,#f7f2ec_45%,#f5f1ec_100%)] px-4 py-6 md:px-8">
      <div className="mx-auto max-w-[1460px] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-orange-200/70 bg-white/85 px-5 py-4 shadow-[0_18px_48px_rgba(196,119,59,0.08)] backdrop-blur">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="rounded-xl">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                {isEditMode ? '编辑图文' : '创建图文'}
              </h1>
              <p className="text-sm text-slate-500">
                现在由你手动控制每一页内容、高亮片段和字号，模板只负责版式风格。
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-200"
            >
              <option value="">选择分组（可选）</option>
              {groups.map((item) => (
                <option key={item.id} value={item.id}>
                  所属分组：{item.name}
                </option>
              ))}
            </select>
            <Button
              onClick={onPublish}
              disabled={submitting}
              className="rounded-xl bg-orange-500 hover:bg-orange-600"
            >
              <Send className="mr-2 h-4 w-4" />
              {submitting
                ? isEditMode
                  ? '更新中...'
                  : '发布中...'
                : isEditMode
                  ? '更新图文'
                  : '发布图文'}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_520px]">
          <section className="rounded-[30px] border border-orange-200/70 bg-white/92 p-5 shadow-[0_18px_48px_rgba(196,119,59,0.08)] backdrop-blur">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">
                  <PencilLine className="h-3.5 w-3.5" />
                  内容编辑区
                </div>
                <h2 className="mt-3 text-lg font-semibold text-slate-900">
                  每一页内容、重点和字号都由你自己决定
                </h2>
                <p className="text-sm text-slate-500">
                  先在文本框里选中一小段内容，你可以给它设高亮，也可以单独调大或调小字号，让每一页重点更清晰。
                </p>
              </div>

              <div className="grid min-w-[220px] grid-cols-2 gap-2 text-sm">
                <div className="rounded-2xl bg-slate-50 px-3 py-2 text-slate-600">
                  字数 {totalChars}
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-2 text-slate-600">
                  页数 {livePages.length}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <div className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <SmilePlus className="h-4 w-4 text-orange-500" />
                  贴纸氛围
                </div>
                <div className="flex flex-wrap gap-2">
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setStickerEmoji(emoji)}
                      className={`rounded-2xl border px-3 py-2 text-xl transition ${stickerEmoji === emoji ? 'border-orange-300 bg-orange-50 shadow-sm' : 'border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/60'}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-orange-100 bg-orange-50/60 px-4 py-3">
              <div className="text-sm text-slate-600">当前编辑：第 {activePage + 1} 页</div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPage}
                  className="rounded-xl"
                >
                  <Plus className="mr-1 h-4 w-4" />
                  新增一页
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={removePage}
                  className="rounded-xl text-rose-600 hover:text-rose-700"
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  删除当前页
                </Button>
              </div>
            </div>

            <div className="mb-4 grid gap-4 lg:grid-cols-3">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4 lg:col-span-2">
                <div className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <WandSparkles className="h-4 w-4 text-orange-500" />
                  手动高亮
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={applyHighlightSelection}
                    className="rounded-xl"
                  >
                    设为高亮
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearHighlightSelection}
                    className="rounded-xl"
                  >
                    清除高亮
                  </Button>
                  <div className="rounded-xl bg-white px-3 py-2 text-sm text-slate-600">
                    {currentHighlightText
                      ? `当前高亮：${currentHighlightText}`
                      : '当前还没有高亮内容'}
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  建议一次只高亮同一行里的短句，避免跨行后影响观感。
                </p>
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
                <div className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Type className="h-4 w-4 text-orange-500" />
                  正文字号
                </div>
                <div className="flex flex-wrap gap-2">
                  {FONT_SIZE_OPTIONS.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => updateCurrentPage({ fontSize: size })}
                      className={`rounded-xl border px-3 py-2 text-sm transition ${currentPage.fontSize === size ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white hover:border-orange-200'}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mb-4 rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
              <div className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <Type className="h-4 w-4 text-orange-500" />
                选中文字字号
              </div>
              <div className="flex flex-wrap gap-2">
                {FONT_SIZE_OPTIONS.map((size) => (
                  <button
                    key={`range-${size}`}
                    type="button"
                    onClick={() => applySelectionFontSize(size)}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm transition hover:border-orange-200 hover:bg-orange-50/60"
                  >
                    {size}
                  </button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearSelectionFontSize}
                  className="h-11 rounded-xl border-slate-200 px-3 text-sm hover:border-orange-200 hover:bg-orange-50/60"
                >
                  恢复默认字号
                </Button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                同样先选中文字再设置。当前页已设置 {currentPage.textStyles.length} 段局部字号。
              </p>
            </div>

            <textarea
              ref={textareaRef}
              value={currentPage.text}
              onChange={(e) => updateCurrentPageText(e.target.value)}
              placeholder="写点什么..."
              rows={13}
              className="min-h-[320px] w-full resize-none rounded-[26px] border border-orange-100 bg-[#fffdf9] p-5 text-base leading-7 text-slate-800 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </section>

          <section className="rounded-[30px] border border-orange-200/70 bg-white/92 p-5 shadow-[0_18px_48px_rgba(196,119,59,0.08)] backdrop-blur xl:sticky xl:top-6 xl:self-start">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  实时预览
                </div>
                <h2 className="mt-3 text-lg font-semibold text-slate-900">实时图文预览</h2>
                <p className="text-sm text-slate-500">
                  当前页的手动高亮和字号都会立刻反映到右侧成片效果里。
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                第 {activePage + 1} / {livePages.length} 页
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[124px_minmax(0,1fr)]">
              <div className="order-2 flex gap-2 overflow-x-auto pb-1 lg:order-1 lg:max-h-[700px] lg:flex-col">
                {livePages.map((page, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setActivePage(index)}
                    className={`shrink-0 rounded-[20px] border px-2 py-3 transition ${activePage === index ? 'border-orange-300 bg-orange-50 shadow-sm' : 'border-slate-200 bg-white hover:border-orange-200'}`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <RenderedCardPreview
                        page={page}
                        template={selectedTemplate}
                        stickerEmoji={stickerEmoji}
                        variant="thumb"
                      />
                      <div className="text-center text-[11px] text-slate-500">P{index + 1}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="order-1 lg:order-2">
                <div className="relative mx-auto flex w-full max-w-[420px] items-center justify-center rounded-[34px] border border-slate-200 bg-[linear-gradient(180deg,#fffaf4_0%,#f8f0e7_100%)] px-10 py-4 shadow-[0_22px_58px_rgba(15,23,42,0.12)] sm:px-12">
                  {livePages.length > 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setActivePage((prev) => (prev - 1 + livePages.length) % livePages.length)
                      }
                      className="absolute left-2 top-1/2 z-10 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                    >
                      <ChevronLeftCircle className="h-9 w-9" />
                    </button>
                  ) : null}

                  <RenderedCardPreview
                    page={currentPage}
                    template={selectedTemplate}
                    stickerEmoji={stickerEmoji}
                  />

                  {livePages.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setActivePage((prev) => (prev + 1) % livePages.length)}
                      className="absolute right-2 top-1/2 z-10 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                    >
                      <ChevronRightCircle className="h-9 w-9" />
                    </button>
                  ) : null}
                </div>

                <div className="mt-5 rounded-[24px] border border-orange-100 bg-orange-50/70 p-4">
                  <div className="mb-2 text-sm font-medium text-slate-800">当前图文参数</div>
                  <div className="grid gap-2 text-sm text-slate-600">
                    <div className="flex items-center justify-between">
                      <span>模板风格</span>
                      <span>{selectedTemplate.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>当前贴纸</span>
                      <span>{stickerEmoji}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>当前高亮</span>
                      <span>{currentHighlightText || '未设置'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>正文字号</span>
                      <span>{currentPage.fontSize}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>局部字号</span>
                      <span>{currentPage.textStyles.length} 段</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-[30px] border border-orange-200/70 bg-white/90 p-5 shadow-[0_18px_48px_rgba(196,119,59,0.08)] backdrop-blur">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
            <LayoutTemplate className="h-4 w-4 text-orange-500" />
            图文模板
          </div>
          <p className="mb-4 text-sm text-slate-500">
            模板放到底部后，样例卡能保留更稳定的比例和阅读感。
          </p>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {TEMPLATES.map((template) => (
              <TemplatePill
                key={template.key}
                template={template}
                active={template.key === templateKey}
                stickerEmoji={stickerEmoji}
                onSelect={() => setTemplateKey(template.key)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
