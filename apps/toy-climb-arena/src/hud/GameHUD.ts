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

const FONT_BODY = '600 13px "Segoe UI", system-ui, sans-serif';
const FONT_LABEL = 'bold 15px "Segoe UI", system-ui, sans-serif';
const FONT_TITLE = 'bold 26px "Segoe UI", system-ui, sans-serif';
const FONT_SUBTITLE = '600 12px "Segoe UI", system-ui, sans-serif';
const FONT_HINT = '12px "Segoe UI", system-ui, sans-serif';

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

    // 左上：高度 + 计时
    this.chip(14, 14, 152, 44);
    ctx.fillStyle = '#f97316';
    ctx.font = FONT_LABEL;
    ctx.fillText(`🧱 ${this.fmtHeight(s.currentHeight)}`, 26, 33);
    ctx.fillStyle = '#64748b';
    ctx.font = FONT_HINT;
    ctx.fillText(`⏱ ${this.fmtTime(s.elapsedMs)}  最高 ${this.fmtHeight(s.bestHeight)}`, 26, 50);

    // 右上：进度
    const pw = 188;
    const px = W - pw - 14;
    this.chip(px, 14, pw, 44);
    ctx.fillStyle = '#0f172a';
    ctx.font = FONT_SUBTITLE;
    ctx.fillText('🎯 进度', px + 12, 30);
    ctx.fillStyle = '#f97316';
    ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
    const pctTxt = `${Math.round(s.progress * 100)}%`;
    ctx.fillText(pctTxt, px + pw - ctx.measureText(pctTxt).width - 12, 30);

    // 进度条
    const tx = px + 12;
    const ty = 36;
    const tw = pw - 24;
    ctx.fillStyle = 'rgba(203,213,225,0.5)';
    this.rrect(tx, ty, tw, 10, 5);
    ctx.fill();
    const fw = tw * Math.max(0, Math.min(1, s.progress));
    if (fw > 0) {
      const g = ctx.createLinearGradient(tx, 0, tx + fw, 0);
      g.addColorStop(0, '#fb923c');
      g.addColorStop(1, '#facc15');
      ctx.fillStyle = g;
      this.rrect(tx, ty, fw, 10, 5);
      ctx.fill();
    }

    // 通关 banner
    if (s.goalReached) {
      const bw = 300;
      const bh = 70;
      const bx = (W - bw) / 2;
      const by = H / 2 - bh / 2 - 36;
      ctx.save();
      ctx.shadowColor = 'rgba(217,119,6,0.35)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 6;
      ctx.fillStyle = 'rgba(255,251,235,0.97)';
      this.rrect(bx, by, bw, bh, 18);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(251,191,36,0.85)';
      ctx.lineWidth = 3;
      this.rrect(bx, by, bw, bh, 18);
      ctx.stroke();
      ctx.fillStyle = '#d97706';
      ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🎉 登顶成功！', W / 2, by + 28);
      ctx.fillStyle = '#92400e';
      ctx.font = FONT_HINT;
      ctx.fillText(`按 P 查看结算`, W / 2, by + 52);
      ctx.textAlign = 'left';
    }

    // 底部提示
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '11px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('WASD 移动 · 空格 跳跃 · Shift 冲刺 · P 菜单', 14, H - 12);
  }

  // ── 菜单层（暂停/开始时）────────────────────────────────────────────────
  private drawMenu(): void {
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;
    const s = this._stats;

    // 背景遮罩
    ctx.fillStyle = 'rgba(10, 15, 30, 0.52)';
    ctx.fillRect(0, 0, W, H);

    // 面板尺寸
    const ITEM_H = 44;
    const ITEM_GAP = 8;
    const HEADER_H = 96;
    const FOOTER_H = 40;
    const PAD_V = 18;
    const pw = Math.min(300, W - 40);
    const ph = HEADER_H + this.entries.length * (ITEM_H + ITEM_GAP) - ITEM_GAP + PAD_V + FOOTER_H;
    const px = (W - pw) / 2;
    const py = Math.max(16, (H - ph) / 2);

    // 面板阴影 + 背景
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 48;
    ctx.shadowOffsetY = 16;
    ctx.fillStyle = 'rgba(255,252,245,0.98)';
    this.rrect(px, py, pw, ph, 22);
    ctx.fill();
    ctx.restore();

    // 面板边框
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2.5;
    this.rrect(px, py, pw, ph, 22);
    ctx.stroke();

    // 底部立体线（积木感）
    ctx.strokeStyle = 'rgba(0,0,0,0.10)';
    ctx.lineWidth = 5;
    this.rrect(px + 3, py + 5, pw - 6, ph, 22);
    ctx.stroke();

    // 标题
    ctx.fillStyle = '#f97316';
    ctx.font = FONT_TITLE;
    ctx.textAlign = 'center';
    ctx.fillText('🧱 积木攀登', px + pw / 2, py + 38);

    // 副标题
    ctx.fillStyle = '#64748b';
    ctx.font = FONT_SUBTITLE;
    ctx.fillText(this._hasEntered ? '游戏已暂停' : '选择角色，点击开始', px + pw / 2, py + 62);
    ctx.textAlign = 'left';

    // 分隔线
    ctx.strokeStyle = 'rgba(203,213,225,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 18, py + HEADER_H - 6);
    ctx.lineTo(px + pw - 18, py + HEADER_H - 6);
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
        // 主按钮：橙色渐变
        ctx.save();
        ctx.shadowColor = hot ? 'rgba(249,115,22,0.55)' : 'rgba(249,115,22,0.28)';
        ctx.shadowBlur = hot ? 16 : 8;
        ctx.shadowOffsetY = hot ? 4 : 2;
        const g = ctx.createLinearGradient(ix, iy, ix + iw, iy);
        g.addColorStop(0, hot ? '#ea580c' : '#f97316');
        g.addColorStop(1, hot ? '#ca8a04' : '#fb923c');
        ctx.fillStyle = g;
        this.rrect(ix, iy, iw, ITEM_H, 12);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#fff';
        ctx.font = FONT_BODY;
        ctx.textAlign = 'center';
        ctx.fillText(entry.label(), ix + iw / 2, iy + ITEM_H / 2 + 5);
        ctx.textAlign = 'left';
      } else {
        // 次级按钮：白底带边框
        ctx.fillStyle = hot ? 'rgba(255,237,213,0.95)' : 'rgba(248,250,252,0.95)';
        ctx.strokeStyle = hot ? 'rgba(249,115,22,0.55)' : 'rgba(203,213,225,0.75)';
        ctx.lineWidth = hot ? 2 : 1.5;
        this.rrect(ix, iy, iw, ITEM_H, 12);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = hot ? '#f97316' : '#334155';
        ctx.font = FONT_BODY;
        ctx.textAlign = 'center';
        ctx.fillText(entry.label(), ix + iw / 2, iy + ITEM_H / 2 + 5);
        ctx.textAlign = 'left';
      }
    }

    // 页脚：最高记录
    const footY = py + HEADER_H + this.entries.length * (ITEM_H + ITEM_GAP) + PAD_V / 2;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `🏆 最高 ${this.fmtHeight(s.bestHeight)}  ·  ⏱ ${this.fmtTime(s.elapsedMs)}`,
      px + pw / 2,
      footY + 20,
    );
    ctx.textAlign = 'left';
  }

  // ── 绘图工具 ─────────────────────────────────────────────────────────────
  /** 白色磨砂 chip */
  private chip(x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.12)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    this.rrect(x, y, w, h, 12);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    ctx.lineWidth = 2;
    this.rrect(x, y, w, h, 12);
    ctx.stroke();
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
