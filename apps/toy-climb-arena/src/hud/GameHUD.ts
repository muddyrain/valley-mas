/**
 * GameHUD — 纯 Canvas 2D 游戏内界面
 *
 * 绘制两层 UI：
 *  • HUD 层（游戏进行中）：左上高度/计时 chip，右上进度条，底部按键提示，通关 banner
 *  • 菜单层（暂停/开始时）：半透明遮罩 + 游戏风格的暂停菜单卡片，支持鼠标悬停/点击
 *
 * 纯 Canvas，无任何 React/HTML 依赖。
 */

import type { ClimberRunStats } from '../types';

export interface GameHUDCallbacks {
  onResume: () => void;
  onReset: () => void;
  /** 点击某个角色卡时调用，传入角色索引 */
  onSelectCharacter: (idx: number) => void;
  onAudioToggle: () => void;
  onFullscreen: () => void;
}

export interface CharacterOption {
  id: string;
  name: string;
  description?: string;
}

interface MenuEntry {
  label: () => string;
  action: () => void;
  primary?: boolean;
}

const FONT_FAMILY = '"Nunito", "Fredoka One", "Segoe UI", system-ui, sans-serif';
const FONT_BODY = `600 13px ${FONT_FAMILY}`;
const FONT_TITLE = `bold 28px ${FONT_FAMILY}`;
const FONT_SUBTITLE = `600 12px ${FONT_FAMILY}`;
const FONT_HINT = `12px ${FONT_FAMILY}`;

/** 调色板 */
const C = {
  orange: '#F97316',
  orangeD: '#EA580C',
  yellow: '#FBBF24',
  blue: '#60A5FA',
  blueD: '#3B82F6',
  purple: '#A78BFA',
  green: '#4ADE80',
  white: 'rgba(255,255,255,0.96)',
  whiteM: 'rgba(255,252,245,0.97)',
  glass: 'rgba(255,255,255,0.22)',
  shadow: 'rgba(0,0,0,0.13)',
  text: '#1E293B',
  textMid: '#475569',
  textHint: '#94A3B8',
  border: 'rgba(203,213,225,0.6)',
} as const;

export class GameHUD {
  /** 覆盖在 WebGL canvas 上的 2D 画布 */
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private rafId = 0;
  private disposed = false;
  private lastDpr = 0;

  // ── 外部状态 ──────────────────────────────────────────────────────────────
  private _locked = false;
  private _hasEntered = false;
  private _audioEnabled = true;
  private _fullscreen = false;
  private _charOptions: CharacterOption[] = [];
  private _charIdx = 0;
  private _stats: ClimberRunStats = {
    elapsedMs: 0,
    currentHeight: 0,
    bestHeight: 0,
    progress: 0,
    goalReached: false,
    goalReachedAtMs: null,
  };

  // ── 菜单交互 ──────────────────────────────────────────────────────────────
  private hoveredIdx = -1;
  private hoveredCharIdx = -1;
  private menuRects: Array<{ x: number; y: number; w: number; h: number }> = [];
  private charCardRects: Array<{ x: number; y: number; w: number; h: number }> = [];
  private entries: MenuEntry[] = [];

  constructor(
    private readonly cbs: GameHUDCallbacks,
    init: { audioEnabled: boolean },
  ) {
    this._audioEnabled = init.audioEnabled;
    this._audioEnabled = init.audioEnabled;

    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = [
      'position:absolute',
      'inset:0',
      'width:100%',
      'height:100%',
      'z-index:3',
    ].join(';');
    // 初始无指针事件，菜单显示时打开
    this.canvas.style.pointerEvents = 'none';

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;

    this.buildEntries();
    this.attachListeners();
    this.tick();
  }

  // ── 状态 setter ─────────────────────────────────────────────────────────
  setPointerLocked(v: boolean): void {
    this._locked = v;
    this.canvas.style.pointerEvents = v ? 'none' : 'auto';
  }
  setHasEntered(v: boolean): void {
    this._hasEntered = v;
  }
  setAudioEnabled(v: boolean): void {
    this._audioEnabled = v;
  }
  setFullscreen(v: boolean): void {
    this._fullscreen = v;
  }
  setCharOptions(opts: CharacterOption[], idx: number): void {
    this._charOptions = opts;
    this._charIdx = idx;
  }
  updateStats(s: ClimberRunStats): void {
    this._stats = s;
  }

  // ── 内部构建菜单 ────────────────────────────────────────────────────────
  private buildEntries(): void {
    this.entries = [
      {
        label: () => (this._hasEntered ? '▶  继续游戏' : '▶  开始游戏'),
        action: () => this.cbs.onResume(),
        primary: true,
      },
      {
        label: () => '↺  重新开始',
        action: () => this.cbs.onReset(),
      },
      {
        label: () => `♪  音效: ${this._audioEnabled ? '开' : '关'}`,
        action: () => this.cbs.onAudioToggle(),
      },
      {
        label: () => `⛶  全屏: ${this._fullscreen ? '开' : '关'}`,
        action: () => this.cbs.onFullscreen(),
      },
    ];
  }

  // ── 事件监听 ────────────────────────────────────────────────────────────
  private attachListeners(): void {
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredIdx = -1;
    });
  }

  private handleClick(e: MouseEvent): void {
    if (this._locked) return;
    const { offsetX: x, offsetY: y } = e;
    // 角色卡点击
    for (let i = 0; i < this.charCardRects.length; i++) {
      const r = this.charCardRects[i];
      if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        this._charIdx = i;
        this.cbs.onSelectCharacter(i);
        return;
      }
    }
    for (let i = 0; i < this.menuRects.length; i++) {
      const r = this.menuRects[i];
      if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        this.entries[i]?.action();
        return;
      }
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    if (this._locked) return;
    const { offsetX: x, offsetY: y } = e;
    // 角色卡悬停
    let foundChar = -1;
    for (let i = 0; i < this.charCardRects.length; i++) {
      const r = this.charCardRects[i];
      if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        foundChar = i;
        break;
      }
    }
    this.hoveredCharIdx = foundChar;

    let found = -1;
    for (let i = 0; i < this.menuRects.length; i++) {
      const r = this.menuRects[i];
      if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        found = i;
        break;
      }
    }
    if (found !== this.hoveredIdx || foundChar >= 0) {
      this.hoveredIdx = found;
      this.canvas.style.cursor = found >= 0 || foundChar >= 0 ? 'pointer' : 'default';
    }
  }

  // ── 渲染循环 ────────────────────────────────────────────────────────────
  private tick = (): void => {
    if (this.disposed) return;
    this.draw();
    this.rafId = requestAnimationFrame(this.tick);
  };

  private syncSize(): void {
    const cv = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth;
    const H = cv.clientHeight;
    if (
      cv.width !== Math.round(W * dpr) ||
      cv.height !== Math.round(H * dpr) ||
      dpr !== this.lastDpr
    ) {
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      this.lastDpr = dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  private get W(): number {
    return this.canvas.clientWidth;
  }
  private get H(): number {
    return this.canvas.clientHeight;
  }

  draw(): void {
    this.syncSize();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    if (this._locked) {
      this.drawHUD();
    } else {
      this.drawMenu();
    }
  }

  // ── HUD 层（游戏进行中）──────────────────────────────────────────────────
  private drawHUD(): void {
    const ctx = this.ctx;
    const s = this._stats;
    const W = this.W;
    const H = this.H;

    // ── 左上：高度卡片 ──
    const LW = 176,
      LH = 64;
    this.chip(14, 14, LW, LH, C.orange);
    // 小图标背景圆
    ctx.save();
    ctx.fillStyle = 'rgba(249,115,22,0.15)';
    ctx.beginPath();
    ctx.arc(36, 37, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🧱', 36, 43);
    ctx.textAlign = 'left';
    // 高度大字
    ctx.fillStyle = C.orange;
    ctx.font = FONT_TITLE;
    ctx.fillText(this.fmtHeight(s.currentHeight), 60, 45);
    // 计时 + 最高（第二行）
    ctx.fillStyle = C.textMid;
    ctx.font = FONT_HINT;
    ctx.fillText(`⏱ ${this.fmtTime(s.elapsedMs)}`, 22, 65);
    ctx.fillStyle = C.purple;
    const bestTxt = `▲${this.fmtHeight(s.bestHeight)}`;
    ctx.fillText(bestTxt, LW - ctx.measureText(bestTxt).width - 10, 65);

    // ── 通关 banner ──
    if (s.goalReached) {
      const bw = 340,
        bh = 90;
      const bx = (W - bw) / 2;
      const by = H / 2 - bh / 2 - 40;
      ctx.save();
      ctx.shadowColor = 'rgba(217,119,6,0.5)';
      ctx.shadowBlur = 32;
      ctx.shadowOffsetY = 8;
      // 金色渐变背景
      const gBan = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
      gBan.addColorStop(0, 'rgba(255,251,235,0.98)');
      gBan.addColorStop(0.5, 'rgba(254,243,199,0.99)');
      gBan.addColorStop(1, 'rgba(255,237,213,0.98)');
      ctx.fillStyle = gBan;
      this.rrect(bx, by, bw, bh, 22);
      ctx.fill();
      ctx.restore();
      // 金色边框
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 3;
      this.rrect(bx, by, bw, bh, 22);
      ctx.stroke();
      // 顶部彩带
      const gTop = ctx.createLinearGradient(bx, by, bx + bw, by);
      gTop.addColorStop(0, '#F97316');
      gTop.addColorStop(0.5, '#FBBF24');
      gTop.addColorStop(1, '#4ADE80');
      ctx.save();
      ctx.fillStyle = gTop;
      this.rrect(bx, by, bw, 5, 22);
      ctx.fill();
      ctx.restore();
      // 主文字
      ctx.fillStyle = '#D97706';
      ctx.font = `bold 26px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText('🎉 登顶成功！🎊', W / 2, by + 42);
      ctx.fillStyle = '#92400e';
      ctx.font = `600 13px ${FONT_FAMILY}`;
      ctx.fillText('太厉害了！按 P 查看战绩', W / 2, by + 66);
      // 星星装饰
      ctx.font = '18px sans-serif';
      ctx.fillText('⭐', bx + 24, by + 38);
      ctx.fillText('✨', bx + bw - 28, by + 38);
      ctx.fillText('🌟', W / 2, by + 18);
      ctx.textAlign = 'left';
    }

    // ── 底部提示条 ──
    const hintTxt = 'WASD 移动 · 空格 跳跃 · Shift 冲刺 · P 菜单';
    ctx.font = `11px ${FONT_FAMILY}`;
    const hintW = ctx.measureText(hintTxt).width + 24;
    const hintX = (W - hintW) / 2;
    const hintY = H - 28;
    ctx.fillStyle = 'rgba(15,23,42,0.38)';
    this.rrect(hintX, hintY, hintW, 20, 10);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.textAlign = 'center';
    ctx.fillText(hintTxt, W / 2, hintY + 14);
    ctx.textAlign = 'left';
  }

  // ── 菜单层（暂停/开始时）────────────────────────────────────────────────
  private drawMenu(): void {
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;
    const s = this._stats;

    // 背景遮罩（带径向亮斑）
    ctx.fillStyle = 'rgba(10, 15, 30, 0.58)';
    ctx.fillRect(0, 0, W, H);

    // 面板尺寸
    const ITEM_H = 48;
    const ITEM_GAP = 9;
    const HEADER_H = 102;
    const CARD_AREA_H = this._charOptions.length > 0 ? 96 : 0;
    const FOOTER_H = 48;
    const PAD_V = 18;
    const pw = Math.min(308, W - 40);
    const ph =
      HEADER_H +
      CARD_AREA_H +
      (CARD_AREA_H > 0 ? 10 : 0) +
      this.entries.length * (ITEM_H + ITEM_GAP) -
      ITEM_GAP +
      PAD_V +
      FOOTER_H;
    const px = (W - pw) / 2;
    const py = Math.max(16, (H - ph) / 2);

    // 积木底部阴影（立体感）
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    this.rrect(px + 4, py + 6, pw - 8, ph, 22);
    ctx.fill();
    ctx.restore();

    // 面板主体
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.36)';
    ctx.shadowBlur = 36;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = C.whiteM;
    this.rrect(px, py, pw, ph, 22);
    ctx.fill();
    ctx.restore();

    // 顶部彩带（橙→黄→绿）
    ctx.save();
    const gStripe = ctx.createLinearGradient(px, py, px + pw, py);
    gStripe.addColorStop(0, '#F97316');
    gStripe.addColorStop(0.45, '#FBBF24');
    gStripe.addColorStop(1, '#4ADE80');
    ctx.fillStyle = gStripe;
    this.rrect(px, py, pw, 10, 22);
    ctx.fill();
    ctx.restore();

    // 面板边框
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1.5;
    this.rrect(px, py, pw, ph, 22);
    ctx.stroke();

    // 标题 emoji
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🧱', px + pw / 2, py + 52);

    // 标题文字（橙色）
    ctx.fillStyle = C.orange;
    ctx.font = FONT_TITLE;
    ctx.fillText('积木攀登', px + pw / 2, py + 80);

    // 副标题
    ctx.fillStyle = C.textHint;
    ctx.font = FONT_SUBTITLE;
    ctx.fillText(this._hasEntered ? '⏸ 游戏已暂停' : '选择角色，准备出发！', px + pw / 2, py + 98);
    ctx.textAlign = 'left';

    // 分隔线
    ctx.strokeStyle = 'rgba(203,213,225,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 20, py + HEADER_H);
    ctx.lineTo(px + pw - 20, py + HEADER_H);
    ctx.stroke();

    // 角色选择卡片区
    this.charCardRects = [];
    if (this._charOptions.length > 0) {
      const cardPad = 10;
      const cardGap = 8;
      const cardCount = this._charOptions.length;
      const cardW = (pw - cardPad * 2 - cardGap * (cardCount - 1)) / cardCount;
      const cardH = 76;
      const cardY = py + HEADER_H + 10;
      const EMOJIS = ['🪆', '👸', '🌼', '🔮'];
      for (let i = 0; i < cardCount; i++) {
        const opt = this._charOptions[i];
        if (!opt) continue;
        const cx = px + cardPad + i * (cardW + cardGap);
        this.charCardRects.push({ x: cx, y: cardY, w: cardW, h: cardH });
        const selected = this._charIdx === i;
        const hovered = this.hoveredCharIdx === i;

        // 卡片背景
        ctx.save();
        ctx.shadowColor = selected ? 'rgba(249,115,22,0.4)' : 'rgba(0,0,0,0.08)';
        ctx.shadowBlur = selected ? 16 : 8;
        ctx.fillStyle = selected
          ? 'rgba(255,237,213,0.95)'
          : hovered
            ? 'rgba(254,249,195,0.9)'
            : 'rgba(248,250,252,0.92)';
        this.rrect(cx, cardY, cardW, cardH, 14);
        ctx.fill();
        ctx.restore();

        // 边框
        ctx.strokeStyle = selected ? C.orange : hovered ? '#FCD34D' : C.border;
        ctx.lineWidth = selected ? 2.5 : 1.5;
        this.rrect(cx, cardY, cardW, cardH, 14);
        ctx.stroke();

        // Emoji 头像
        const emoji = EMOJIS[i] ?? '🎮';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(emoji, cx + cardW / 2, cardY + 34);

        // 角色名字
        ctx.fillStyle = selected ? C.orange : C.text;
        ctx.font = `600 11px ${FONT_FAMILY}`;
        ctx.fillText(opt.name, cx + cardW / 2, cardY + 56);

        // 选中打勾
        if (selected) {
          ctx.fillStyle = C.orange;
          ctx.font = `bold 11px ${FONT_FAMILY}`;
          ctx.fillText('✓', cx + cardW / 2, cardY + 70);
        }
        ctx.textAlign = 'left';
      }
    }

    // 菜单项起始 y（角色卡之后留间距）
    const menuStartY = py + HEADER_H + CARD_AREA_H + (CARD_AREA_H > 0 ? 10 : 0);

    // 菜单项
    this.menuRects = [];
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      if (!entry) continue;
      const ix = px + 14;
      const iy = menuStartY + i * (ITEM_H + ITEM_GAP);
      const iw = pw - 28;
      this.menuRects.push({ x: ix, y: iy, w: iw, h: ITEM_H });
      const hot = this.hoveredIdx === i;

      if (entry.primary) {
        // 主按钮：橙→黄渐变 + 发光阴影
        ctx.save();
        ctx.shadowColor = hot ? 'rgba(249,115,22,0.6)' : 'rgba(249,115,22,0.3)';
        ctx.shadowBlur = hot ? 20 : 10;
        ctx.shadowOffsetY = hot ? 5 : 3;
        const gBtn = ctx.createLinearGradient(ix, iy, ix, iy + ITEM_H);
        gBtn.addColorStop(0, hot ? '#FB923C' : '#F97316');
        gBtn.addColorStop(1, hot ? '#FBBF24' : '#FB923C');
        ctx.fillStyle = gBtn;
        this.rrect(ix, iy, iw, ITEM_H, 16);
        ctx.fill();
        ctx.restore();
        // 底部立体边（积木感）
        ctx.strokeStyle = 'rgba(180,83,9,0.45)';
        ctx.lineWidth = 2;
        this.rrect(ix, iy + 2, iw, ITEM_H, 16);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = `bold 15px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.fillText(entry.label(), ix + iw / 2, iy + ITEM_H / 2 + 6);
        ctx.textAlign = 'left';
      } else {
        // 次级按钮
        ctx.fillStyle = hot ? 'rgba(255,237,213,0.9)' : 'rgba(248,250,252,0.9)';
        ctx.strokeStyle = hot ? C.orange : C.border;
        ctx.lineWidth = hot ? 2 : 1.5;
        this.rrect(ix, iy, iw, ITEM_H, 16);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = hot ? C.orange : C.text;
        ctx.font = `600 14px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.fillText(entry.label(), ix + iw / 2, iy + ITEM_H / 2 + 6);
        ctx.textAlign = 'left';
      }
    }

    // 页脚：战绩徽章
    const footY = menuStartY + this.entries.length * (ITEM_H + ITEM_GAP) + PAD_V / 2 + 4;
    const footTxt = `🏆 ${this.fmtHeight(s.bestHeight)}  ·  ⏱ ${this.fmtTime(s.elapsedMs)}`;
    ctx.font = `600 11px ${FONT_FAMILY}`;
    const ftw = ctx.measureText(footTxt).width + 24;
    const ftx = px + (pw - ftw) / 2;
    ctx.fillStyle = 'rgba(203,213,225,0.35)';
    this.rrect(ftx, footY, ftw, 24, 12);
    ctx.fill();
    ctx.fillStyle = C.textMid;
    ctx.textAlign = 'center';
    ctx.fillText(footTxt, px + pw / 2, footY + 16);
    ctx.textAlign = 'left';
  }

  // ── 绘图工具 ─────────────────────────────────────────────────────────────
  /** 玩具感 chip 卡片，accent 为左侧彩色竖条颜色（可选） */
  private chip(x: number, y: number, w: number, h: number, accent?: string): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.14)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = C.whiteM;
    this.rrect(x, y, w, h, 14);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1.5;
    this.rrect(x, y, w, h, 14);
    ctx.stroke();
    if (accent) {
      ctx.save();
      ctx.fillStyle = accent;
      this.rrect(x + 1, y + 8, 4, h - 16, 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /** 圆角矩形路径（不 fill/stroke，由调用方决定） */
  private rrect(x: number, y: number, w: number, h: number, r: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  private fmtHeight(y: number): string {
    return `${Math.max(0, y).toFixed(1)} m`;
  }

  private fmtTime(ms: number): string {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
  }
}
