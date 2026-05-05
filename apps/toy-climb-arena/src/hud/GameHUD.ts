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
  description: string;
}

interface MenuEntry {
  label: () => string;
  action: () => void;
  primary: boolean;
}

const FONT_FAMILY = '"Nunito", "Fredoka One", "Segoe UI", system-ui, sans-serif';
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
    if (v) {
      this.canvas.style.pointerEvents = 'none';
    } else {
      this.canvas.style.pointerEvents = 'auto';
    }
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
        label: () => this.startLabel(),
        action: () => this.cbs.onResume(),
        primary: true,
      },
      {
        label: () => '↺  重新开始',
        action: () => this.cbs.onReset(),
        primary: false,
      },
      {
        label: () => this.audioLabel(),
        action: () => this.cbs.onAudioToggle(),
        primary: false,
      },
      {
        label: () => this.fullscreenLabel(),
        action: () => this.cbs.onFullscreen(),
        primary: false,
      },
    ];
  }

  private startLabel(): string {
    if (this._hasEntered) return '▶  继续游戏';
    return '▶  开始游戏';
  }

  private audioLabel(): string {
    if (this._audioEnabled) return '♪  音效: 开';
    return '♪  音效: 关';
  }

  private fullscreenLabel(): string {
    if (this._fullscreen) return '⛶  全屏: 开';
    return '⛶  全屏: 关';
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
        const entry = this.entries[i];
        if (entry) entry.action();
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
      if (found >= 0 || foundChar >= 0) {
        this.canvas.style.cursor = 'pointer';
      } else {
        this.canvas.style.cursor = 'default';
      }
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
    if (this.W < 64 || this.H < 64) {
      this.menuRects = [];
      this.charCardRects = [];
      return;
    }
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
    ctx.fillStyle = 'rgba(10, 15, 30, 0.58)';
    ctx.fillRect(0, 0, W, H);

    let selected: CharacterOption | null = null;
    if (this._charOptions.length > 0) {
      const indexedOption = this._charOptions[this._charIdx];
      const firstOption = this._charOptions[0];
      if (indexedOption) {
        selected = indexedOption;
      } else if (firstOption) {
        selected = firstOption;
      }
    }

    let panelMaxWidth = 660;
    let ph = 680;
    if (W >= 1040) {
      panelMaxWidth = 940;
      ph = 600;
    }
    const pw = Math.min(panelMaxWidth, W - 24);
    const px = (W - pw) / 2;
    const py = Math.max(12, (H - ph) / 2);
    const headerH = 96;
    const contentY = py + headerH + 12;
    const isWide = W >= 1040;
    const leftX = px + 16;
    let leftW = pw - 32;
    let rightW = pw - 32;
    let rightX = leftX;
    if (isWide) {
      leftW = 340;
      rightW = pw - leftW - 28;
      rightX = leftX + leftW + 12;
    }

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    this.rrect(px + 5, py + 7, pw - 10, ph, 24);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.36)';
    ctx.shadowBlur = 34;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = C.whiteM;
    this.rrect(px, py, pw, ph, 24);
    ctx.fill();
    ctx.restore();

    const banner = ctx.createLinearGradient(px, py, px + pw, py);
    banner.addColorStop(0, '#F97316');
    banner.addColorStop(0.5, '#FBBF24');
    banner.addColorStop(1, '#4ADE80');
    ctx.fillStyle = banner;
    this.rrect(px, py, pw, 10, 24);
    ctx.fill();
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1.5;
    this.rrect(px, py, pw, ph, 24);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = C.orange;
    ctx.font = FONT_TITLE;
    ctx.fillText('角色选择台', px + 22, py + 44);
    ctx.fillStyle = C.textHint;
    ctx.font = FONT_SUBTITLE;
    let subtitle = '先选一个玩具人偶，再开始攀爬';
    if (this._hasEntered) {
      subtitle = '暂停中，先换一个更顺手的主角';
    }
    ctx.fillText(subtitle, px + 22, py + 66);

    const bestTxt = `🏆 ${this.fmtHeight(s.bestHeight)}  ·  ⏱ ${this.fmtTime(s.elapsedMs)}`;
    ctx.fillStyle = C.textMid;
    ctx.font = FONT_HINT;
    ctx.textAlign = 'right';
    ctx.fillText(bestTxt, px + pw - 22, py + 44);
    ctx.textAlign = 'left';

    let selectedId = 'toyhero';
    let selectedName = '未选择';
    let selectedDesc = '暂无角色信息';
    if (selected) {
      selectedId = selected.id;
      selectedName = selected.name;
      selectedDesc = selected.description;
    }
    const accent = this.getCharacterPalette(selectedId);

    // 左侧角色展示
    const previewH = isWide ? 176 : 150;
    if (isWide) {
      this.rrect(leftX, contentY, leftW, previewH, 22);
      ctx.fillStyle = 'rgba(255,251,245,0.96)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(251,146,60,0.26)';
      ctx.stroke();
      this.drawCharacterPortrait(ctx, leftX + 16, contentY + 14, leftW - 32, 104, selectedId);
      ctx.fillStyle = C.orange;
      ctx.font = 'bold 26px "Nunito", sans-serif';
      ctx.fillText(selectedName, leftX + 16, contentY + 134);
      ctx.fillStyle = C.textMid;
      ctx.font = `600 12px ${FONT_FAMILY}`;
      this.drawWrappedText(ctx, selectedDesc, leftX + 16, contentY + 156, leftW - 32, 16, 1);
      const statY = contentY + previewH + 14;
      const statW = (leftW - 12) / 2;
      const statH = 64;
      this.chip(leftX, statY, statW, statH, accent.primary);
      this.chip(leftX + statW + 12, statY, statW, statH, accent.secondary);
      ctx.fillStyle = C.textMid;
      ctx.font = `600 11px ${FONT_FAMILY}`;
      ctx.fillText('默认主角', leftX + 18, statY + 24);
      ctx.fillText('角色数量', leftX + statW + 30, statY + 24);
      ctx.fillStyle = accent.primary;
      ctx.font = `bold 20px ${FONT_FAMILY}`;
      ctx.fillText(selectedName, leftX + 18, statY + 48);
      ctx.fillText(`${this._charOptions.length}`, leftX + statW + 30, statY + 48);
    } else {
      this.rrect(leftX, contentY, rightW, previewH, 22);
      ctx.fillStyle = 'rgba(255,251,245,0.96)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(251,146,60,0.26)';
      ctx.stroke();
      this.drawCharacterPortrait(ctx, leftX + 12, contentY + 12, rightW - 24, 90, selectedId);
      ctx.fillStyle = C.orange;
      ctx.font = 'bold 22px "Nunito", sans-serif';
      ctx.fillText(selectedName, leftX + 14, contentY + 108);
      ctx.fillStyle = C.textMid;
      ctx.font = `600 11px ${FONT_FAMILY}`;
      this.drawWrappedText(ctx, selectedDesc, leftX + 14, contentY + 128, rightW - 28, 15, 1);
    }

    // 角色卡片与按钮区布局
    this.charCardRects = [];
    const cardRows = Math.ceil(this._charOptions.length / 2);
    const buttonRows = Math.ceil(this.entries.length / 2);
    const cardGap = isWide ? 10 : 8;
    const columns = 2;
    const cardsW = rightW;
    const cardW = Math.floor((cardsW - cardGap * (columns - 1)) / columns);
    const cardH = isWide ? 60 : 54;
    const buttonItemH = isWide ? 44 : 40;
    const buttonItemGap = isWide ? 10 : 8;
    const buttonGap = 10;
    let cardAreaY = contentY + previewH + 18;
    let buttonGridX = leftX;
    let buttonGridY = cardAreaY + cardRows * (cardH + cardGap) + 16;
    if (isWide) {
      buttonGridX = rightX;
      buttonGridY = contentY + 8;
      cardAreaY = buttonGridY + buttonRows * (buttonItemH + buttonItemGap) + 16;
    }
    for (let i = 0; i < this._charOptions.length; i += 1) {
      const opt = this._charOptions[i];
      if (!opt) continue;
      const column = i % columns;
      const row = Math.floor(i / columns);
      const cx = rightX + column * (cardW + cardGap);
      const cy = cardAreaY + row * (cardH + cardGap);
      this.charCardRects.push({ x: cx, y: cy, w: cardW, h: cardH });
      const selectedCard = this._charIdx === i;
      const hovered = this.hoveredCharIdx === i;
      const palette = this.getCharacterPalette(opt.id);

      ctx.save();
      if (selectedCard) {
        ctx.shadowColor = 'rgba(249,115,22,0.38)';
        ctx.shadowBlur = 14;
        ctx.fillStyle = 'rgba(255,237,213,0.96)';
      } else if (hovered) {
        ctx.shadowColor = 'rgba(0,0,0,0.08)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = 'rgba(255,251,235,0.94)';
      } else {
        ctx.shadowColor = 'rgba(0,0,0,0.08)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = 'rgba(249,250,251,0.93)';
      }
      this.rrect(cx, cy, cardW, cardH, 16);
      ctx.fill();
      ctx.restore();
      if (selectedCard) {
        ctx.strokeStyle = palette.primary;
        ctx.lineWidth = 2.4;
      } else if (hovered) {
        ctx.strokeStyle = palette.secondary;
        ctx.lineWidth = 1.4;
      } else {
        ctx.strokeStyle = C.border;
        ctx.lineWidth = 1.4;
      }
      this.rrect(cx, cy, cardW, cardH, 16);
      ctx.stroke();
      this.drawMiniAvatar(ctx, cx + 10, cy + 9, 50, 50, opt.id, selectedCard);
      if (selectedCard) {
        ctx.fillStyle = C.orange;
      } else {
        ctx.fillStyle = C.text;
      }
      ctx.font = `700 13px ${FONT_FAMILY}`;
      ctx.fillText(opt.name, cx + 68, cy + 24);
      ctx.fillStyle = C.textMid;
      ctx.font = `600 10px ${FONT_FAMILY}`;
      this.drawWrappedText(ctx, opt.description, cx + 68, cy + 40, cardW - 78, 14, 2);
      if (selectedCard) {
        ctx.fillStyle = palette.primary;
        ctx.font = `bold 12px ${FONT_FAMILY}`;
        ctx.fillText('当前选择', cx + cardW - 66, cy + 24);
      }
      if (hovered) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        this.rrect(cx + cardW - 16, cy + 10, 6, 6, 3);
        ctx.fill();
      }
    }

    // 控制按钮
    this.menuRects = [];
    let buttonW = Math.floor((pw - 40 - buttonGap) / 2);
    if (isWide) {
      buttonW = Math.floor((rightW - buttonGap) / 2);
    }
    for (let i = 0; i < this.entries.length; i += 1) {
      const entry = this.entries[i];
      if (!entry) continue;
      const column = i % 2;
      const row = Math.floor(i / 2);
      const ix = buttonGridX + column * (buttonW + buttonGap);
      const iw = buttonW;
      const iy = buttonGridY + row * (buttonItemH + buttonItemGap);
      this.menuRects.push({ x: ix, y: iy, w: iw, h: buttonItemH });
      const hot = this.hoveredIdx === i;

      ctx.save();
      if (entry.primary) {
        if (hot) {
          ctx.shadowColor = 'rgba(249,115,22,0.55)';
          ctx.shadowBlur = isWide ? 18 : 16;
        } else {
          ctx.shadowColor = 'rgba(249,115,22,0.28)';
          ctx.shadowBlur = isWide ? 10 : 8;
        }
        ctx.shadowOffsetY = 4;
        const gBtn = ctx.createLinearGradient(ix, iy, ix, iy + buttonItemH);
        if (hot) {
          gBtn.addColorStop(0, '#FB923C');
          gBtn.addColorStop(1, '#FBBF24');
        } else {
          gBtn.addColorStop(0, '#F97316');
          gBtn.addColorStop(1, '#FB923C');
        }
        ctx.fillStyle = gBtn;
      } else {
        ctx.shadowColor = 'rgba(0,0,0,0.06)';
        ctx.shadowBlur = 8;
        if (hot) {
          ctx.fillStyle = 'rgba(255,237,213,0.92)';
        } else {
          ctx.fillStyle = 'rgba(248,250,252,0.95)';
        }
      }
      this.rrect(ix, iy, iw, buttonItemH, 16);
      ctx.fill();
      ctx.restore();

      if (entry.primary) {
        ctx.strokeStyle = 'rgba(180,83,9,0.42)';
        ctx.lineWidth = 2;
      } else if (hot) {
        ctx.strokeStyle = C.orange;
        ctx.lineWidth = 1.4;
      } else {
        ctx.strokeStyle = C.border;
        ctx.lineWidth = 1.4;
      }
      this.rrect(ix, iy + 1, iw, buttonItemH, 16);
      ctx.stroke();
      if (entry.primary) {
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${isWide ? 15 : 13}px ${FONT_FAMILY}`;
      } else if (hot) {
        ctx.fillStyle = C.orange;
        ctx.font = `600 ${isWide ? 14 : 12}px ${FONT_FAMILY}`;
      } else {
        ctx.fillStyle = C.text;
        ctx.font = `600 ${isWide ? 14 : 12}px ${FONT_FAMILY}`;
      }
      ctx.textAlign = 'center';
      ctx.fillText(entry.label(), ix + iw / 2, iy + buttonItemH / 2 + 5);
      ctx.textAlign = 'left';
    }

    const footTxt = `🏆 ${this.fmtHeight(s.bestHeight)}  ·  ⏱ ${this.fmtTime(s.elapsedMs)}`;
    ctx.font = `600 11px ${FONT_FAMILY}`;
    const ftw = ctx.measureText(footTxt).width + 24;
    const ftx = px + (pw - ftw) / 2;
    ctx.fillStyle = 'rgba(203,213,225,0.35)';
    this.rrect(ftx, py + ph - 34, ftw, 24, 12);
    ctx.fill();
    ctx.fillStyle = C.textMid;
    ctx.textAlign = 'center';
    ctx.fillText(footTxt, px + pw / 2, py + ph - 18);
    ctx.textAlign = 'left';
  }

  // ── 绘图工具 ─────────────────────────────────────────────────────────────
  /** 玩具感 chip 卡片，accent 为左侧彩色竖条颜色（可选） */
  private getCharacterPalette(characterId: string): {
    primary: string;
    secondary: string;
    accent: string;
  } {
    switch (characterId) {
      case 'toyhero':
        return { primary: '#F97316', secondary: '#FBBF24', accent: '#4ADE80' };
      case 'woodendoll':
        return { primary: '#B45309', secondary: '#F59E0B', accent: '#60A5FA' };
      case 'panda':
        return { primary: '#111827', secondary: '#F8FAFC', accent: '#22C55E' };
      case 'frog':
        return { primary: '#22C55E', secondary: '#A3E635', accent: '#0EA5E9' };
      case 'cat':
        return { primary: '#FB923C', secondary: '#FCD34D', accent: '#A78BFA' };
      case 'peach':
        return { primary: '#F472B6', secondary: '#FDE68A', accent: '#60A5FA' };
      case 'daisy':
        return { primary: '#F59E0B', secondary: '#86EFAC', accent: '#A78BFA' };
      default:
        return { primary: C.orange, secondary: C.yellow, accent: C.green };
    }
  }

  private drawCharacterPortrait(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    characterId: string,
  ): void {
    const p = this.getCharacterPalette(characterId);
    ctx.save();
    const glow = ctx.createLinearGradient(x, y, x + w, y + h);
    glow.addColorStop(0, 'rgba(255,255,255,0.96)');
    glow.addColorStop(1, 'rgba(255,248,231,0.96)');
    ctx.fillStyle = glow;
    this.rrect(x, y, w, h, 20);
    ctx.fill();

    ctx.translate(x + w / 2, y + h / 2 + 2);
    ctx.fillStyle = 'rgba(251,146,60,0.12)';
    ctx.beginPath();
    ctx.arc(0, 36, w * 0.22, 0, Math.PI * 2);
    ctx.fill();

    if (characterId === 'toyhero') {
      ctx.fillStyle = p.secondary;
      ctx.beginPath();
      ctx.ellipse(0, 22, 74, 28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2563EB';
      ctx.beginPath();
      ctx.arc(0, -6, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F7D6A5';
      ctx.beginPath();
      ctx.arc(0, -16, 23, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7C2D12';
      ctx.beginPath();
      ctx.arc(0, -31, 28, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(-50, -18, 100, 8);
      ctx.fillStyle = '#22D3EE';
      ctx.beginPath();
      ctx.arc(-18, -28, 7, 0, Math.PI * 2);
      ctx.arc(18, -28, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(-8, 8, 16, 40);
      ctx.fillStyle = '#7C3F1D';
      ctx.fillRect(-42, 32, 20, 34);
      ctx.fillRect(22, 32, 20, 34);
      ctx.fillStyle = '#FEF3C7';
      ctx.fillRect(-55, 1, 18, 28);
      ctx.fillRect(37, 1, 18, 28);
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(-10, -14, 3, 0, Math.PI * 2);
      ctx.arc(10, -14, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = p.primary;
      ctx.beginPath();
      ctx.arc(0, 8, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.accent;
      ctx.beginPath();
      ctx.arc(0, -20, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.arc(-12, -20, 6, 0, Math.PI * 2);
      ctx.arc(12, -20, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawMiniAvatar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    characterId: string,
    selected: boolean,
  ): void {
    const p = this.getCharacterPalette(characterId);
    ctx.save();
    const bg = ctx.createLinearGradient(x, y, x + w, y + h);
    bg.addColorStop(0, selected ? 'rgba(255,237,213,0.96)' : 'rgba(255,255,255,0.9)');
    bg.addColorStop(1, selected ? 'rgba(254,215,170,0.9)' : 'rgba(255,251,235,0.86)');
    ctx.fillStyle = bg;
    this.rrect(x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = selected ? p.primary : 'rgba(203,213,225,0.85)';
    ctx.lineWidth = 1.2;
    this.rrect(x, y, w, h, 14);
    ctx.stroke();
    ctx.translate(x + w / 2, y + h / 2);
    if (characterId === 'toyhero') {
      ctx.fillStyle = '#2563EB';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F7D6A5';
      ctx.beginPath();
      ctx.arc(0, -7, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7C2D12';
      ctx.fillRect(-11, -12, 22, 4);
      ctx.fillStyle = '#22D3EE';
      ctx.fillRect(-11, -7, 4, 4);
      ctx.fillRect(7, -7, 4, 4);
    } else {
      ctx.fillStyle = p.primary;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.accent;
      ctx.beginPath();
      ctx.arc(0, -7, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawWrappedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    maxLines: number,
  ): void {
    if (!text) return;
    const words = text.split('');
    let line = '';
    const lines: string[] = [];
    for (const ch of words) {
      const candidate = line + ch;
      if (ctx.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = ch;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    const clipped = lines.slice(0, maxLines);
    clipped.forEach((row, index) => {
      let output = row;
      if (index === maxLines - 1 && lines.length > maxLines) {
        while (ctx.measureText(`${output}…`).width > maxWidth && output.length > 0) {
          output = output.slice(0, -1);
        }
        output = `${output}…`;
      }
      ctx.fillText(output, x, y + index * lineHeight);
    });
  }

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
