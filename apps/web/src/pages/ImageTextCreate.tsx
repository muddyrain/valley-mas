import { ArrowLeft, Check, ChevronLeftCircle, ChevronRightCircle, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { type Category, createPost, getCategories } from '@/api/blog';
import { uploadResource } from '@/api/resource';
import bubuImage from '@/assets/bubu.jpeg';
import yierImage from '@/assets/yier.jpeg';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/useAuthStore';

type Stage = 'write' | 'pick';
type TemplateKey = 'paper' | 'quote' | 'ink' | 'mint' | 'sunset' | 'grid';
type PartnerKey = 'yier' | 'bubu';

type Template = {
  key: TemplateKey;
  name: string;
  cardClass: string;
  textClass: string;
  fontFamily: string;
  lineHeight: string;
  charsPerPage: number;
};

const TEMPLATES: Template[] = [
  {
    key: 'paper',
    name: '奶油纸感',
    cardClass: 'bg-[#f8f5eb] border-[#e1d7bc]',
    textClass: 'text-[#4e4537]',
    fontFamily: '"STSong", "Songti SC", serif',
    lineHeight: '1.58',
    charsPerPage: 58,
  },
  {
    key: 'quote',
    name: '引言卡',
    cardClass: 'bg-white border-[#d8d8df] shadow-[inset_0_0_0_1px_rgba(84,84,92,.06)]',
    textClass: 'text-[#3e3b3f]',
    fontFamily: '"STKaiti", "KaiTi", serif',
    lineHeight: '1.65',
    charsPerPage: 54,
  },
  {
    key: 'ink',
    name: '墨色手账',
    cardClass:
      'bg-[#f1efe8] border-[#d6d0c2] bg-[linear-gradient(180deg,transparent_96%,rgba(77,63,52,.15)_96%)] bg-[size:100%_38px]',
    textClass: 'text-[#3e352d]',
    fontFamily: '"FangSong", "STFangsong", serif',
    lineHeight: '1.72',
    charsPerPage: 52,
  },
  {
    key: 'mint',
    name: '薄荷书摘',
    cardClass: 'bg-[#edf8f2] border-[#c8ead7]',
    textClass: 'text-[#2f5b45]',
    fontFamily: '"YouYuan", "STHeiti", sans-serif',
    lineHeight: '1.6',
    charsPerPage: 56,
  },
  {
    key: 'sunset',
    name: '黄昏海报',
    cardClass: 'bg-[linear-gradient(180deg,#fff7ea_0%,#f5ead8_100%)] border-[#e5ceb3]',
    textClass: 'text-[#5c3a2b]',
    fontFamily: '"Hiragino Sans GB", "Microsoft YaHei", sans-serif',
    lineHeight: '1.55',
    charsPerPage: 60,
  },
  {
    key: 'grid',
    name: '网格杂志',
    cardClass:
      'bg-[#f6f7f9] border-[#dadde5] bg-[linear-gradient(90deg,rgba(120,130,160,.12)_1px,transparent_1px),linear-gradient(rgba(120,130,160,.12)_1px,transparent_1px)] bg-[size:22px_22px]',
    textClass: 'text-[#313848]',
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    lineHeight: '1.55',
    charsPerPage: 60,
  },
];

const PARTNERS: Record<PartnerKey, { name: string; avatar: string }> = {
  yier: { name: '一二', avatar: yierImage },
  bubu: { name: '布布', avatar: bubuImage },
};

const EMOJIS = ['😀', '🥹', '😎', '🔥', '🌈', '🍀', '✨', '💡', '💬', '🎉', '🌙', '❤️'];

const CARD_CANVAS_WIDTH = 1080;
const CARD_CANVAS_HEIGHT = 1680;

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image load failed'));
    image.src = source;
  });
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

function wrapTextByWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
) {
  const chars = text.replace(/\s+/g, '').split('');
  const lines: string[] = [];
  let current = '';

  chars.forEach((char) => {
    const candidate = current + char;
    if (ctx.measureText(candidate).width > maxWidth) {
      if (current) lines.push(current);
      current = char;
    } else {
      current = candidate;
    }
  });

  if (current) lines.push(current);

  if (lines.length <= maxLines) return lines;
  const sliced = lines.slice(0, maxLines);
  const last = sliced[maxLines - 1];
  sliced[maxLines - 1] = last.length > 1 ? `${last.slice(0, -1)}…` : `${last}…`;
  return sliced;
}

async function renderCardToBlob(
  pageText: string,
  template: Template,
  partner: PartnerKey,
  stickerEmoji: string,
) {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_CANVAS_WIDTH;
  canvas.height = CARD_CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas init failed');

  const cardX = 70;
  const cardY = 70;
  const cardWidth = CARD_CANVAS_WIDTH - 140;
  const cardHeight = CARD_CANVAS_HEIGHT - 140;

  const gradient = ctx.createLinearGradient(0, 0, 0, CARD_CANVAS_HEIGHT);
  switch (template.key) {
    case 'mint':
      gradient.addColorStop(0, '#f3fbf6');
      gradient.addColorStop(1, '#dff4e7');
      break;
    case 'sunset':
      gradient.addColorStop(0, '#fff7ea');
      gradient.addColorStop(1, '#f3e6d3');
      break;
    case 'grid':
      gradient.addColorStop(0, '#f7f9fd');
      gradient.addColorStop(1, '#eceff6');
      break;
    case 'ink':
      gradient.addColorStop(0, '#f5f2eb');
      gradient.addColorStop(1, '#ede7d8');
      break;
    case 'quote':
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(1, '#f6f4f2');
      break;
    default:
      gradient.addColorStop(0, '#faf6ea');
      gradient.addColorStop(1, '#f2ecd9');
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_CANVAS_WIDTH, CARD_CANVAS_HEIGHT);

  drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 48);
  ctx.fillStyle = '#f8f5eb';
  ctx.fill();
  ctx.strokeStyle = '#e2d7bf';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (template.key === 'grid') {
    ctx.save();
    drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 48);
    ctx.clip();
    ctx.strokeStyle = 'rgba(120,130,160,0.12)';
    ctx.lineWidth = 1;
    for (let x = cardX; x < cardX + cardWidth; x += 42) {
      ctx.beginPath();
      ctx.moveTo(x, cardY);
      ctx.lineTo(x, cardY + cardHeight);
      ctx.stroke();
    }
    for (let y = cardY; y < cardY + cardHeight; y += 42) {
      ctx.beginPath();
      ctx.moveTo(cardX, y);
      ctx.lineTo(cardX + cardWidth, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  const dateText = new Date().toLocaleDateString('zh-CN');
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.font = `36px "Microsoft YaHei", sans-serif`;
  ctx.fillText(dateText, cardX + 40, cardY + 55);

  if (template.key === 'quote') {
    ctx.fillStyle = '#ddd3be';
    ctx.font = `bold 140px serif`;
    ctx.fillText('“', cardX + 42, cardY + 220);
  }

  const cleanText = pageText.replace(/\s+/g, '');
  let textSize = 92;
  if (cleanText.length > 55) textSize = 72;
  if (cleanText.length > 80) textSize = 62;
  if (cleanText.length > 120) textSize = 54;

  ctx.fillStyle = '#4e4537';
  ctx.font = `${textSize}px ${template.fontFamily}, "Microsoft YaHei", sans-serif`;
  const textStartX = cardX + 56;
  const textStartY = cardY + 300;
  const textMaxWidth = cardWidth - 110;
  const maxLines = 10;
  const lines = wrapTextByWidth(ctx, pageText, textMaxWidth, maxLines);
  const lineHeight = textSize * 1.28;
  lines.forEach((line, index) => {
    ctx.fillText(line, textStartX, textStartY + index * lineHeight);
  });

  ctx.font = `98px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  ctx.fillText(stickerEmoji, cardX + cardWidth - 165, cardY + 120);

  const avatar = await loadImage(PARTNERS[partner].avatar);
  const avatarSize = 130;
  const avatarX = cardX + cardWidth - avatarSize - 42;
  const avatarY = cardY + cardHeight - avatarSize - 42;
  drawRoundedRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 20);
  ctx.save();
  ctx.clip();
  ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
  ctx.restore();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), 'image/png', 0.95);
  });
  if (!blob) throw new Error('生成图片失败');

  return blob;
}

function normalizeText(input: string) {
  return input.replace(/\r\n/g, '\n').trim();
}

function extractTitle(text: string) {
  const line = text.split('\n').find((x) => x.trim());
  if (!line) return '图文卡片';
  return line.length > 22 ? `${line.slice(0, 22)}...` : line;
}

function paginateContent(text: string, maxPerPage: number, maxPages = 5) {
  const normalized = normalizeText(text);
  if (!normalized) return ['写点什么吧'];

  const pages: string[] = [];
  const blocks = normalized
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
  let current = '';

  const pushCurrent = () => {
    if (current.trim()) pages.push(current.trim());
    current = '';
  };

  for (const block of blocks) {
    if (pages.length >= maxPages) break;

    if (block.length > maxPerPage) {
      let start = 0;
      while (start < block.length && pages.length < maxPages) {
        const piece = block.slice(start, start + maxPerPage);
        if ((current + piece).length > maxPerPage) {
          pushCurrent();
          if (pages.length >= maxPages) break;
          current = piece;
        } else {
          current = current ? `${current}\n${piece}` : piece;
        }
        start += maxPerPage;
      }
      continue;
    }

    const next = current ? `${current}\n${block}` : block;
    if (next.length > maxPerPage) {
      pushCurrent();
      if (pages.length >= maxPages) break;
      current = block;
    } else {
      current = next;
    }
  }

  if (pages.length < maxPages) pushCurrent();

  if (pages.length > maxPages) return pages.slice(0, maxPages);
  return pages;
}

function CardPreview({
  pageText,
  template,
  partner,
  stickerEmoji,
  compact = false,
}: {
  pageText: string;
  template: Template;
  partner: PartnerKey;
  stickerEmoji: string;
  compact?: boolean;
}) {
  const compactText = pageText.replace(/\s+/g, '').slice(0, 34);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${template.cardClass} ${
        compact ? 'h-[190px] w-[132px] p-3' : 'h-[720px] w-[460px] p-6'
      }`}
    >
      <div className="absolute left-5 top-4 text-xs text-black/35">
        {new Date().toLocaleDateString('zh-CN')}
      </div>

      {template.key === 'quote' && (
        <div
          className={`absolute ${compact ? 'left-3 top-5 text-xl' : 'left-7 top-12 text-6xl'} font-black text-[#dfd7c8]`}
        >
          “
        </div>
      )}

      <div
        className={`relative z-10 ${template.textClass} ${
          compact
            ? 'mt-10 overflow-hidden whitespace-normal break-all text-[11px] leading-5'
            : 'mt-24 whitespace-pre-wrap text-[42px] font-semibold'
        }`}
        style={{ fontFamily: template.fontFamily, lineHeight: template.lineHeight }}
      >
        {compact ? compactText : pageText}
      </div>

      <div className={`absolute ${compact ? 'right-3 top-3 text-sm' : 'right-7 top-8 text-4xl'}`}>
        {stickerEmoji}
      </div>

      <div
        className={`absolute ${compact ? 'bottom-2 right-2 h-7 w-7' : 'bottom-6 right-6 h-18 w-18'} overflow-hidden rounded-xl border border-black/10 bg-white`}
      >
        <img
          src={PARTNERS[partner].avatar}
          alt={PARTNERS[partner].name}
          className="h-full w-full object-cover"
        />
      </div>
    </div>
  );
}

export default function ImageTextCreate() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  const [stage, setStage] = useState<Stage>('write');
  const [text, setText] = useState('');
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const [partner, setPartner] = useState<PartnerKey>('yier');
  const [stickerEmoji, setStickerEmoji] = useState<string>('✨');
  const [templateKey, setTemplateKey] = useState<TemplateKey>('paper');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [generatedPages, setGeneratedPages] = useState<string[]>([]);
  const [activePage, setActivePage] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    getCategories()
      .then((list) => {
        setCategories(list || []);
        if (list?.[0]?.id) setCategoryId(list[0].id);
      })
      .catch(() => {
        toast.error('加载分类失败');
      });
  }, [isAuthenticated, navigate]);

  const canCreate = user?.role === 'creator' || user?.role === 'admin';
  const selectedTemplate = useMemo(
    () => TEMPLATES.find((item) => item.key === templateKey) || TEMPLATES[0],
    [templateKey],
  );

  useEffect(() => {
    if (stage === 'pick') {
      const pages = paginateContent(text, selectedTemplate.charsPerPage, 5);
      setGeneratedPages(pages);
      setActivePage(0);
    }
  }, [stage, text, selectedTemplate]);

  if (!isAuthenticated) return null;

  if (!canCreate) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          当前账号不是创作者，无法发布图文。
        </div>
      </div>
    );
  }

  const onGenerate = () => {
    const value = normalizeText(text);
    if (!value) {
      toast.error('先输入文字再生成卡片');
      return;
    }
    setStage('pick');
  };

  const insertEmoji = (emoji: string) => {
    const el = textRef.current;
    if (!el) {
      setText((prev) => `${prev}${emoji}`);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = `${text.slice(0, start)}${emoji}${text.slice(end)}`;
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + emoji.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const goPrevPage = () => {
    if (generatedPages.length <= 1) return;
    setActivePage((prev) => (prev - 1 + generatedPages.length) % generatedPages.length);
  };

  const goNextPage = () => {
    if (generatedPages.length <= 1) return;
    setActivePage((prev) => (prev + 1) % generatedPages.length);
  };

  const onPublish = async () => {
    const value = normalizeText(text);
    if (!value) {
      toast.error('请输入文本内容');
      return;
    }
    if (!categoryId) {
      toast.error('发布前请选择分类');
      return;
    }

    const pages = paginateContent(value, selectedTemplate.charsPerPage, 5);
    const title = extractTitle(value);

    try {
      setSubmitting(true);
      const uploadedImageUrls: string[] = [];
      for (let index = 0; index < pages.length; index += 1) {
        const page = pages[index];
        const imageBlob = await renderCardToBlob(page, selectedTemplate, partner, stickerEmoji);
        const formData = new FormData();
        formData.append(
          'file',
          new File([imageBlob], `image-text-${Date.now()}-${index + 1}.png`, { type: 'image/png' }),
        );
        formData.append('type', 'wallpaper');
        formData.append('title', `${title} 第${index + 1}页`);
        formData.append('description', `图文卡片第 ${index + 1} 页`);
        const uploadResp = await uploadResource(formData);
        const imageUrl = uploadResp?.resource?.url;
        if (!imageUrl) {
          throw new Error('上传图文图片失败');
        }
        uploadedImageUrls.push(imageUrl);
      }

      const markdownImages = uploadedImageUrls
        .map((url, index) => `![图文第${index + 1}页](${url})`)
        .join('\n\n');
      await createPost({
        title,
        postType: 'image_text',
        templateKey: '',
        templateData: '',
        content: markdownImages,
        excerpt: pages[0]?.slice(0, 120) || title,
        cover: uploadedImageUrls[0],
        categoryId,
        status: 'published',
        publishNow: true,
      });

      toast.success('图文发布成功');
      navigate('/blog');
    } catch {
      toast.error('发布失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f5f6f8] px-4 py-6 md:px-8">
      <div className="mx-auto max-w-[1380px] rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (stage === 'pick' ? setStage('write') : navigate(-1))}
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> {stage === 'pick' ? '返回写字' : '返回'}
            </Button>
            <h1 className="text-lg font-semibold text-slate-900">图文创作</h1>
          </div>

          {stage === 'pick' ? (
            <div className="flex items-center gap-3">
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-200"
              >
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    发布分类：{item.name}
                  </option>
                ))}
              </select>
              <Button onClick={onPublish} disabled={submitting} className="rounded-xl px-6">
                {submitting ? '发布中...' : '发布图文'}
              </Button>
            </div>
          ) : (
            <Button onClick={onGenerate} className="rounded-xl px-6">
              <Sparkles className="mr-2 h-4 w-4" /> 生成图片
            </Button>
          )}
        </div>

        {stage === 'write' ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-[#fafaf7] p-5">
            <textarea
              ref={textRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="写点什么吧\n今天的心情\n后续的计划\n什么都可以"
              rows={14}
              className="w-full resize-none rounded-xl border border-slate-300 bg-white p-4 text-lg leading-8 outline-none focus:ring-2 focus:ring-violet-200"
            />

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <select
                value={partner}
                onChange={(e) => setPartner(e.target.value as PartnerKey)}
                className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-violet-200"
              >
                <option value="yier">形象：一二</option>
                <option value="bubu">形象：布布</option>
              </select>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                自动分页：最多 5 页，超出将截断
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-2 text-sm text-slate-600">插入表情</div>
              <div className="flex flex-wrap gap-2">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => insertEmoji(emoji)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xl transition hover:border-violet-300 hover:bg-violet-50"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
            <div className="rounded-2xl border border-slate-200 bg-[#f7f7f8] p-6">
              <div className="mx-auto flex w-fit items-center gap-4">
                {generatedPages.length > 1 && (
                  <button
                    type="button"
                    onClick={goPrevPage}
                    className="text-slate-400 transition hover:text-slate-700"
                  >
                    <ChevronLeftCircle className="h-9 w-9" />
                  </button>
                )}
                <CardPreview
                  pageText={generatedPages[activePage] || '暂无内容'}
                  template={selectedTemplate}
                  partner={partner}
                  stickerEmoji={stickerEmoji}
                />
                {generatedPages.length > 1 && (
                  <button
                    type="button"
                    onClick={goNextPage}
                    className="text-slate-400 transition hover:text-slate-700"
                  >
                    <ChevronRightCircle className="h-9 w-9" />
                  </button>
                )}
              </div>

              {generatedPages.length > 1 && (
                <>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    {generatedPages.map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setActivePage(index)}
                        className={`h-2.5 rounded-full transition ${
                          activePage === index ? 'w-7 bg-violet-500' : 'w-2.5 bg-slate-300'
                        }`}
                        aria-label={`page-${index + 1}`}
                      />
                    ))}
                  </div>
                  <div className="mt-2 text-center text-xs text-slate-500">
                    {activePage + 1}/{generatedPages.length}
                  </div>
                </>
              )}
            </div>

            <aside className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-3 text-sm font-medium text-slate-700">选择卡片模板</div>
              <div className="mb-4">
                <div className="mb-2 text-xs text-slate-500">选择卡片表情贴纸</div>
                <div className="flex flex-wrap gap-2">
                  {EMOJIS.map((emoji) => (
                    <button
                      key={`sticker-${emoji}`}
                      type="button"
                      onClick={() => setStickerEmoji(emoji)}
                      className={`rounded-lg border px-2 py-1 text-xl transition ${
                        stickerEmoji === emoji
                          ? 'border-violet-500 bg-violet-50'
                          : 'border-slate-200 bg-white hover:border-violet-300'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {TEMPLATES.map((tpl) => {
                  const active = tpl.key === templateKey;
                  return (
                    <button
                      key={tpl.key}
                      type="button"
                      onClick={() => setTemplateKey(tpl.key)}
                      className={`relative rounded-xl border p-2 text-left transition ${
                        active
                          ? 'border-violet-500 ring-2 ring-violet-200'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <CardPreview
                        pageText={generatedPages[0] || '卡片预览'}
                        template={tpl}
                        partner={partner}
                        stickerEmoji={stickerEmoji}
                        compact
                      />
                      <div className="mt-1 truncate text-center text-xs text-slate-600">
                        {tpl.name}
                      </div>
                      {active && (
                        <Check className="absolute right-2 top-2 h-4 w-4 rounded-full bg-white p-0.5 text-violet-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
