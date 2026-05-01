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
  onCycleCharacter: () => void;
  onAudioToggle: () => void;
  onFullscreen: () => void;
}

interface MenuEntry {
  label: () => string;
  action: () => void;
  primary?: boolean;
}

const FONT_FAMILY = '"Nunito", "Fredoka One", "Segoe UI", system-ui, sans-serif';
const FONT_BODY = `600 13px ${FONT_FAMILY}`;
const FONT_LABEL = `bold 16px ${FONT_FAMILY}`;
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
  private _characterLabel = '';
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
  private menuRects: Array<{ x: number; y: number; w: number; h: number }> = [];
  private entries: MenuEntry[] = [];

  constructor(
    private readonly cbs: GameHUDCallbacks,
    init: { characterLabel: string; audioEnabled: boolean },
  ) {
    this._characterLabel = init.characterLabel;
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
  setCharacterLabel(v: string): void {
    this._characterLabel = v;
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
        label: () => `👤  角色: ${this._characterLabel}  ›`,
        action: () => this.cbs.onCycleCharacter(),
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
    let found = -1;
    for (let i = 0; i < this.menuRects.length; i++) {
      const r = this.menuRects[i];
      if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        found = i;
        break;
      }
    }
    if (found !== this.hoveredIdx) {
      this.hoveredIdx = found;
      this.canvas.style.cursor = found >= 0 ? 'pointer' : 'default';
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
    const LW = 168,
      LH = 58;
    this.chip(14, 14, LW, LH, C.orange);
    // 高度大字
    ctx.fillStyle = C.orange;
    ctx.font = FONT_TITLE;
    ctx.fillText(this.fmtHeight(s.currentHeight), 48, 38);
    // 小图标背景圆
    ctx.save();
    ctx.fillStyle = 'rgba(249,115,22,0.15)';
    ctx.beginPath();
    ctx.arc(32, 30, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🧱', 32, 35);
    ctx.textAlign = 'left';
    // 计时 + 最高
    ctx.fillStyle = C.textMid;
    ctx.font = FONT_HINT;
    ctx.fillText(`⏱ ${this.fmtTime(s.elapsedMs)}`, 22, 56);
    ctx.fillStyle = C.purple;
    const bestTxt = `▲${this.fmtHeight(s.bestHeight)}`;
    ctx.fillText(bestTxt, LW - ctx.measureText(bestTxt).width - 8, 56);

    // ── 右上：进度卡片 ──
    const pw = 200,
      ph = 58;
    const px = W - pw - 14;
    this.chip(px, 14, pw, ph, C.blueD);
    // 进度百分比
    const pct = Math.round(s.progress * 100);
    ctx.fillStyle = C.blueD;
    ctx.font = FONT_LABEL;
    ctx.textAlign = 'right';
    ctx.fillText(`${pct}%`, px + pw - 12, 37);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.textMid;
    ctx.font = FONT_SUBTITLE;
    ctx.fillText('🎯 进度', px + 12, 34);
    // 进度条（14px 高，彩虹渐变）
    const tx = px + 12,
      ty = 42,
      tw = pw - 24;
    ctx.fillStyle = 'rgba(148,163,184,0.28)';
    this.rrect(tx, ty, tw, 11, 5.5);
    ctx.fill();
    const fw = tw * Math.max(0, Math.min(1, s.progress));
    if (fw > 0) {
      const gBar = ctx.createLinearGradient(tx, 0, tx + tw, 0);
      gBar.addColorStop(0, '#60A5FA');
      gBar.addColorStop(0.5, '#A78BFA');
      gBar.addColorStop(1, '#F97316');
      ctx.fillStyle = gBar;
      this.rrect(tx, ty, fw, 11, 5.5);
      ctx.fill();
    }

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
      const stars = ['⭐', '✨', '🌟'];
      ctx.font = '18px sans-serif';
      ctx.fillText(stars[0]!, bx + 24, by + 38);
      ctx.fillText(stars[1]!, bx + bw - 28, by + 38);
      ctx.fillText(stars[2]!, W / 2, by + 18);
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
    const FOOTER_H = 48;
    const PAD_V = 18;
    const pw = Math.min(308, W - 40);
    const ph = HEADER_H + this.entries.length * (ITEM_H + ITEM_GAP) - ITEM_GAP + PAD_V + FOOTER_H;
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

    // 菜单项
    this.menuRects = [];
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      if (!entry) continue;
      const ix = px + 14;
      const iy = py + HEADER_H + i * (ITEM_H + ITEM_GAP);
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
    const footY = py + HEADER_H + this.entries.length * (ITEM_H + ITEM_GAP) + PAD_V / 2 + 4;
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
