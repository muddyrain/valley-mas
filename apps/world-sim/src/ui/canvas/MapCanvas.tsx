import { Application, Container, Graphics, Text as PixiText, Rectangle } from 'pixi.js';
import { useEffect, useRef, useState } from 'react';
import type { MapData, Province } from '@/core/map';
import { findProvinceAt, TERRAIN_COLOR, TERRAIN_KINDS, TERRAIN_LABEL } from '@/core/map';
import {
  buildAdminDistanceState,
  buildFrontPressureState,
  type FrontPressureOverlaySegment,
  getFrontPressureOverlaySegments,
  getSettlementSiegeOverlayRegions,
  getStrategicValueOverlayRegions,
  getWarStatusOverlaySegments,
  type SettlementSiegeOverlayRegion,
  type StrategicValueOverlayRegion,
  type WarStatusOverlaySegment,
} from '@/core/sim';
import type { FactionId, FactionSummary, RegionId, SettlementSummary, WarSummary } from '@/shared/types';
import { useWorldSimStore } from '@/state';
import { type BorderLayerChunkTracker, createBorderLayerChunkTracker } from './borderRenderCache';
import { computeFactionLabelAnchors } from './labelLayout';
import styles from './MapCanvas.module.css';
import { createOwnerLayerChunkTracker, type OwnerLayerChunkTracker } from './ownerRenderCache';

const MIN_SCALE = 0.4;
const MAX_SCALE = 6;
const ZOOM_FACTOR = 1.15;
const CLICK_PIXEL_THRESHOLD = 4;
/** 占领过渡时长（毫秒）。约等于 sim tick 间隔，让"势力扩张"看起来是流动的色块。 */
const OWNER_TRANSITION_MS = 600;
const DIVINE_FEEDBACK_MS = 720;
const OWNER_CHUNK_SIZE = 384;
const BORDER_CHUNK_SIZE = 384;

/** 一个州的 owner 颜色动画状态（颜色与不透明度同时插值）。 */
interface OwnerAnimState {
  fromColor: number;
  toColor: number;
  fromAlpha: number;
  toAlpha: number;
  start: number;
  dur: number;
}

type SettlementStabilityOverlayMode = ReturnType<
  typeof useWorldSimStore.getState
>['settlementStabilityOverlayMode'];
type DivineFeedbackState = ReturnType<typeof useWorldSimStore.getState>['divineFeedback'];

interface RenderRefs {
  app: Application;
  world: Container;
  baseLayer: Graphics;
  ownerLayer: Container;
  borderLayer: Container;
  strategicValueLayer: Graphics;
  adminDistanceLayer: Graphics;
  settlementStabilityLayer: Graphics;
  frontPressureLayer: Graphics;
  warStatusLayer: Graphics;
  siegeProgressLayer: Graphics;
  highlightLayer: Graphics;
  divineFeedbackLayer: Graphics;
  /** 势力名标签层（Text 容器，跟随 world 一起缩放） */
  labelLayer: Container;
  /** 首都金色菱形标记层（Graphics 容器，介于 owner 与 label 之间） */
  markerLayer: Container;
  currentMap: MapData | null;
  /** 当前正在动画的州。key=regionId 数字 */
  ownerAnims: Map<number, OwnerAnimState>;
  /** 当前已经显示出来的颜色/alpha，作为下一次插值的起点 */
  displayedOwner: Map<number, { color: number; alpha: number }>;
  ownerChunkGraphics: Map<number, Graphics>;
  borderChunkGraphics: Map<number, Graphics>;
  /** 每势力一个 Text 实例，复用并按首都/版图重心定位 */
  factionLabels: Map<number, PixiText>;
  /** 每势力一个 Graphics（金色菱形首都标记） */
  factionCapitalMarkers: Map<number, Graphics>;
  /** owner layer chunk cache; only dirty chunks redraw when ownership changes. */
  ownerChunkTracker: OwnerLayerChunkTracker;
  borderChunkTracker: BorderLayerChunkTracker;
  /** 用户是否主动平移/缩放过相机。未动过时，容器尺寸变化可继续自动 fit。 */
  cameraTouched: boolean;
}

/**
 * Phase 2 地图画布。
 *
 * 渲染层：
 * - baseLayer：所有 Province polygon 填充（合并到一个 Graphics 减少 drawcall）
 * - borderLayer：所有 BorderEdge 描边
 * - highlightLayer：仅画 hovered / selected 两个州的高亮轮廓
 *
 * 相机层：
 * - world Container 承担 pan/zoom，根容器只放底色与 world
 *
 * 交互层（DOM 事件，避免与 Pixi event system 双绑）：
 * - pointerdown/move/up：拖拽平移
 * - wheel：以鼠标位置为锚点的缩放
 * - 未拖拽情况下 pointerup 视为点击 → 命中 Province → setSelectedRegion
 * - pointermove 持续命中 → setHoveredRegion
 */
export function MapCanvas() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const refs = useRef<RenderRefs | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const map = useWorldSimStore((s) => s.map);
  const factions = useWorldSimStore((s) => s.factions);
  const hoveredRegionId = useWorldSimStore((s) => s.hoveredRegionId);
  const selectedRegionId = useWorldSimStore((s) => s.selectedRegionId);
  const selectedFactionId = useWorldSimStore((s) => s.selectedFactionId);
  const frontPressureOverlayVisible = useWorldSimStore((s) => s.frontPressureOverlayVisible);
  const adminDistanceOverlayVisible = useWorldSimStore((s) => s.adminDistanceOverlayVisible);
  const strategicValueOverlayVisible = useWorldSimStore((s) => s.strategicValueOverlayVisible);
  const warStatusOverlayVisible = useWorldSimStore((s) => s.warStatusOverlayVisible);
  const siegeProgressOverlayVisible = useWorldSimStore((s) => s.siegeProgressOverlayVisible);
  const settlementStabilityOverlayMode = useWorldSimStore((s) => s.settlementStabilityOverlayMode);
  const settlements = useWorldSimStore((s) => s.settlements);
  const activeWars = useWorldSimStore((s) => s.activeWars);
  const divineFeedback = useWorldSimStore((s) => s.divineFeedback);
  const setHoveredRegion = useWorldSimStore((s) => s.setHoveredRegion);
  const setSelectedRegion = useWorldSimStore((s) => s.setSelectedRegion);
  const tick = useWorldSimStore((s) => s.tick);

  /* -------- 初始化 Pixi & 监听 -------- */
  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

    const app = new Application();
    const world = new Container();
    const baseLayer = new Graphics();
    const ownerLayer = new Container();
    const borderLayer = new Container();
    const strategicValueLayer = new Graphics();
    const adminDistanceLayer = new Graphics();
    const settlementStabilityLayer = new Graphics();
    const frontPressureLayer = new Graphics();
    const warStatusLayer = new Graphics();
    const siegeProgressLayer = new Graphics();
    const highlightLayer = new Graphics();
    const divineFeedbackLayer = new Graphics();
    const labelLayer = new Container();
    const markerLayer = new Container();
    const initialSize = getHostCssSize(host) ?? { width: 1, height: 1 };
    labelLayer.eventMode = 'none';
    markerLayer.eventMode = 'none';
    ownerLayer.eventMode = 'none';
    borderLayer.eventMode = 'none';

    world.addChild(baseLayer);
    world.addChild(ownerLayer);
    world.addChild(strategicValueLayer);
    world.addChild(borderLayer);
    world.addChild(adminDistanceLayer);
    world.addChild(settlementStabilityLayer);
    world.addChild(frontPressureLayer);
    world.addChild(warStatusLayer);
        world.addChild(siegeProgressLayer);
        world.addChild(highlightLayer);
        world.addChild(divineFeedbackLayer);
    world.addChild(markerLayer);
    world.addChild(labelLayer);

    app
      .init({
        background: '#0a0d12',
        width: initialSize.width,
        height: initialSize.height,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
      })
      .then(() => {
        if (cancelled) {
          app.destroy(true, { children: true });
          return;
        }
        host.appendChild(app.canvas);
        app.stage.addChild(world);
        // 主舞台不接 Pixi event，DOM 事件更稳
        app.stage.eventMode = 'none';
        refs.current = {
          app,
          world,
          baseLayer,
          ownerLayer,
          borderLayer,
          strategicValueLayer,
          adminDistanceLayer,
          settlementStabilityLayer,
          frontPressureLayer,
          warStatusLayer,
          siegeProgressLayer,
          highlightLayer,
          divineFeedbackLayer,
          labelLayer,
          markerLayer,
          currentMap: null,
          ownerAnims: new Map(),
          displayedOwner: new Map(),
          ownerChunkGraphics: new Map(),
          borderChunkGraphics: new Map(),
          factionLabels: new Map(),
          factionCapitalMarkers: new Map(),
          ownerChunkTracker: createOwnerLayerChunkTracker({ chunkSize: OWNER_CHUNK_SIZE }),
          borderChunkTracker: createBorderLayerChunkTracker({ chunkSize: BORDER_CHUNK_SIZE }),
          cameraTouched: false,
        };
        syncViewportSize(refs.current, host, { fitMapWhenPristine: false });
        // 把动画推进挂在 Pixi 自带的 ticker 上：有 anim 时才重画 ownerLayer
        app.ticker.add(() => {
          const r = refs.current;
          if (!r || r.ownerAnims.size === 0) return;
          const map = r.currentMap;
          if (!map) return;
          const animatedRegionIds = tickOwnerAnims(r, performance.now());
          redrawOwnerLayer(r, map, [], r.ownerChunkTracker.getChunkIdsForRegions(animatedRegionIds));
        });
        setReady(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      });

    return () => {
      cancelled = true;
      refs.current = null;
      try {
        app.destroy(true, { children: true });
      } catch {
        // 销毁异常不影响 React 卸载
      }
    };
  }, []);

  /* -------- 地图变化时重绘 base/border 并自适应 fit -------- */
  // biome-ignore lint/correctness/useExhaustiveDependencies: hovered/selected/factions 由下方独立 effect 处理，避免地图替换时多次重绘
  useEffect(() => {
    const r = refs.current;
    if (!ready || !r || !map) return;
    r.borderChunkTracker.reset();
    clearBorderChunks(r);
    drawBaseAndBorders(r, map, factions);
    fitMapToView(r, map);
    r.cameraTouched = false;
    r.currentMap = map;
    // 地图整体替换 → 重置动画状态、瞬切 owner，避免从老地图色淡入到新地图色
    r.ownerAnims.clear();
    r.displayedOwner.clear();
    r.ownerChunkTracker.reset();
    clearOwnerChunks(r);
    drawOwnerOverlay(r, map, factions, { animate: false });
    drawStrategicValueOverlay(r, map, strategicValueOverlayVisible);
    drawAdminDistanceOverlay(r, map, factions, settlements, selectedFactionId, adminDistanceOverlayVisible);
    drawSettlementStabilityOverlay(
      r,
      map,
      settlements,
      selectedFactionId,
      settlementStabilityOverlayMode,
    );
    drawFrontPressureOverlay(r, map, factions, frontPressureOverlayVisible);
    drawWarStatusOverlay(r, map, activeWars, warStatusOverlayVisible);
    drawSiegeProgressOverlay(r, map, activeWars, selectedFactionId, siegeProgressOverlayVisible);
    drawHighlight(r, map, hoveredRegionId, selectedRegionId, factions, selectedFactionId);
  }, [ready, map]);

  /* -------- factions 变化时仅重绘势力色叠加层与高亮层 -------- */
  // biome-ignore lint/correctness/useExhaustiveDependencies: map/hovered/selected 已由其他 effect 重绘；这里只对 factions 引用变化响应
  useEffect(() => {
    const r = refs.current;
    if (!ready || !r || !map) return;
    // sim 推进 / 编辑涂抹 / 回放重建：都通过 factions+map.provinces 的归属变化触发到这里。
    // 动画开关：
    //   - replay 重建（rebuildWorldUpToCursor）→ 跳跃式快速重绘，不动画，避免反向插值假象
    //   - 其他常规 tick / 编辑 → 600ms ease-out 缓动占领
    const replayMode = useWorldSimStore.getState().replayMode;
    drawOwnerOverlay(r, map, factions, { animate: replayMode !== 'replaying' });
    redrawBorders(r, map, factions);
    drawStrategicValueOverlay(r, map, strategicValueOverlayVisible);
    drawAdminDistanceOverlay(r, map, factions, settlements, selectedFactionId, adminDistanceOverlayVisible);
    drawSettlementStabilityOverlay(
      r,
      map,
      settlements,
      selectedFactionId,
      settlementStabilityOverlayMode,
    );
    drawFrontPressureOverlay(r, map, factions, frontPressureOverlayVisible);
    drawWarStatusOverlay(r, map, activeWars, warStatusOverlayVisible);
    drawSiegeProgressOverlay(r, map, activeWars, selectedFactionId, siegeProgressOverlayVisible);
    drawHighlight(r, map, hoveredRegionId, selectedRegionId, factions, selectedFactionId);
  }, [
    ready,
    factions,
    settlements,
    selectedFactionId,
    strategicValueOverlayVisible,
    adminDistanceOverlayVisible,
    settlementStabilityOverlayMode,
    activeWars,
    warStatusOverlayVisible,
    siegeProgressOverlayVisible,
  ]);

  /* -------- Overlay 开关变化时仅重绘 overlay 层 -------- */
  useEffect(() => {
    const r = refs.current;
    if (!ready || !r || !map) return;
    drawStrategicValueOverlay(r, map, strategicValueOverlayVisible);
    drawAdminDistanceOverlay(r, map, factions, settlements, selectedFactionId, adminDistanceOverlayVisible);
    drawSettlementStabilityOverlay(
      r,
      map,
      settlements,
      selectedFactionId,
      settlementStabilityOverlayMode,
    );
    drawFrontPressureOverlay(r, map, factions, frontPressureOverlayVisible);
    drawWarStatusOverlay(r, map, activeWars, warStatusOverlayVisible);
    drawSiegeProgressOverlay(r, map, activeWars, selectedFactionId, siegeProgressOverlayVisible);
  }, [
    ready,
    map,
    factions,
    settlements,
    selectedFactionId,
    strategicValueOverlayVisible,
    adminDistanceOverlayVisible,
    settlementStabilityOverlayMode,
    frontPressureOverlayVisible,
    activeWars,
    warStatusOverlayVisible,
    siegeProgressOverlayVisible,
  ]);

  /* -------- Hover/Select 变化时仅重绘 highlight 层 -------- */
  useEffect(() => {
    const r = refs.current;
    if (!ready || !r || !map) return;
    drawHighlight(r, map, hoveredRegionId, selectedRegionId, factions, selectedFactionId);
  }, [ready, map, hoveredRegionId, selectedRegionId, factions, selectedFactionId]);

  useEffect(() => {
    const r = refs.current;
    if (!ready || !r || !map) return;
    drawDivineFeedback(r, map, divineFeedback);
    if (!divineFeedback) return;
    const sequence = divineFeedback.sequence;
    const timer = window.setTimeout(() => {
      const current = useWorldSimStore.getState().divineFeedback;
      if (current?.sequence !== sequence) return;
      refs.current?.divineFeedbackLayer.clear();
    }, DIVINE_FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [ready, map, divineFeedback]);

  /* -------- DOM 事件：拖拽 / 缩放 / 点击 / 悬停 -------- */
  useEffect(() => {
    const host = hostRef.current;
    if (!ready || !host) return;

    let dragging = false;
    let dragMoved = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragStartWorldX = 0;
    let dragStartWorldY = 0;
    let activePointerId: number | null = null;
    /**
     * pointerdown 时记录的"操作意图"。simulation 模式下任意键都是 pan；
     * edit 模式下左键 / 中键是 paint，右键是 pan，便于用户右手握鼠标双手协作。
     */
    let activeIntent: 'pan' | 'paint' | null = null;
    /** edit 模式下记录最近一次涂抹过的州，避免拖拽时同一州被重复涂多次 */
    let lastPaintedRegion: number | null = null;

    const screenToWorld = (clientX: number, clientY: number): { x: number; y: number } | null => {
      const r = refs.current;
      if (!r) return null;
      const rect = host.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      const scale = r.world.scale.x || 1;
      return {
        x: (sx - r.world.position.x) / scale,
        y: (sy - r.world.position.y) / scale,
      };
    };

    const paintAtClient = (clientX: number, clientY: number) => {
      const r = refs.current;
      const map = r?.currentMap;
      if (!r || !map) return;
      const w = screenToWorld(clientX, clientY);
      if (!w) return;
      if (w.x < 0 || w.y < 0 || w.x > map.meta.bounds.width || w.y > map.meta.bounds.height) return;
      const id = findProvinceAt(map, w.x, w.y);
      if (id == null) return;
      const idNum = id as unknown as number;
      if (lastPaintedRegion === idNum) return;
      lastPaintedRegion = idNum;
      useWorldSimStore.getState().applyEditAt(id);
    };

    const onPointerDown = (e: PointerEvent) => {
      const r = refs.current;
      if (!r) return;
      const state = useWorldSimStore.getState();
      const isEdit = state.worldMode === 'edit';

      if (isEdit && e.button === 0) {
        // 左键 = 涂抹
        e.preventDefault();
        activePointerId = e.pointerId;
        activeIntent = 'paint';
        lastPaintedRegion = null;
        host.setPointerCapture(e.pointerId);
        useWorldSimStore.getState().beginPaint();
        paintAtClient(e.clientX, e.clientY);
        return;
      }

      // 其他情况都视为 pan（simulation 模式 + 任何键，或 edit 模式 + 右键）
      if (e.button !== 0 && !isEdit) return;
      dragging = true;
      dragMoved = false;
      activePointerId = e.pointerId;
      activeIntent = 'pan';
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragStartWorldX = r.world.position.x;
      dragStartWorldY = r.world.position.y;
      host.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      const r = refs.current;
      if (!r) return;

      if (activeIntent === 'paint' && e.pointerId === activePointerId) {
        paintAtClient(e.clientX, e.clientY);
        return;
      }

      if (activeIntent === 'pan' && dragging && e.pointerId === activePointerId) {
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        if (!dragMoved && Math.abs(dx) + Math.abs(dy) > CLICK_PIXEL_THRESHOLD) {
          dragMoved = true;
        }
        if (dx !== 0 || dy !== 0) {
          r.cameraTouched = true;
        }
        r.world.position.set(dragStartWorldX + dx, dragStartWorldY + dy);
        return;
      }

      // 仅在没拖拽时做 hover 命中
      const map = r.currentMap;
      if (!map) return;
      const w = screenToWorld(e.clientX, e.clientY);
      if (!w) return;
      // 边界外不命中
      if (w.x < 0 || w.y < 0 || w.x > map.meta.bounds.width || w.y > map.meta.bounds.height) {
        if (useWorldSimStore.getState().hoveredRegionId !== null) {
          setHoveredRegion(null);
        }
        return;
      }
      const id = findProvinceAt(map, w.x, w.y);
      // 海洋州不参与 hover
      const hoveredId =
        id != null && map.provinces[id as unknown as number]?.terrain === 'ocean' ? null : id;
      const current = useWorldSimStore.getState().hoveredRegionId;
      if (hoveredId !== current) {
        setHoveredRegion(hoveredId);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== activePointerId) return;
      const intent = activeIntent;
      const wasDragging = dragging;
      const moved = dragMoved;
      dragging = false;
      dragMoved = false;
      activePointerId = null;
      activeIntent = null;
      lastPaintedRegion = null;
      try {
        host.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }

      if (intent === 'paint') {
        useWorldSimStore.getState().endPaint();
        return;
      }

      if (intent !== 'pan') return;
      if (!wasDragging || moved) return;

      // 视为点击：命中 → 选中（再次点击同一州取消）
      const r = refs.current;
      const map = r?.currentMap;
      if (!r || !map) return;
      const w = screenToWorld(e.clientX, e.clientY);
      if (!w) return;
      if (w.x < 0 || w.y < 0 || w.x > map.meta.bounds.width || w.y > map.meta.bounds.height) {
        setSelectedRegion(null);
        return;
      }
      const id = findProvinceAt(map, w.x, w.y);
      if (id == null) {
        setSelectedRegion(null);
        return;
      }
      // 海洋州不参与点击
      if (map.provinces[id as unknown as number]?.terrain === 'ocean') {
        setSelectedRegion(null);
        return;
      }
      const state = useWorldSimStore.getState();
      const current = state.selectedRegionId;
      setSelectedRegion(current === id ? null : id);
    };

    const onPointerLeave = () => {
      if (useWorldSimStore.getState().hoveredRegionId !== null) {
        setHoveredRegion(null);
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = refs.current;
      if (!r) return;
      const rect = host.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const oldScale = r.world.scale.x || 1;
      const factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
      const newScale = clamp(oldScale * factor, MIN_SCALE, MAX_SCALE);
      if (newScale === oldScale) return;
      const wx = (mx - r.world.position.x) / oldScale;
      const wy = (my - r.world.position.y) / oldScale;
      r.world.scale.set(newScale);
      r.world.position.set(mx - wx * newScale, my - wy * newScale);
      r.cameraTouched = true;
      syncLabelScale(r);
    };

    const onContextMenu = (e: MouseEvent) => {
      // edit 模式下右键仅用于 pan，不弹原生菜单
      if (useWorldSimStore.getState().worldMode === 'edit') {
        e.preventDefault();
      }
    };

    host.addEventListener('pointerdown', onPointerDown);
    host.addEventListener('pointermove', onPointerMove);
    host.addEventListener('pointerup', onPointerUp);
    host.addEventListener('pointerleave', onPointerLeave);
    host.addEventListener('wheel', onWheel, { passive: false });
    host.addEventListener('contextmenu', onContextMenu);

    return () => {
      host.removeEventListener('pointerdown', onPointerDown);
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerup', onPointerUp);
      host.removeEventListener('pointerleave', onPointerLeave);
      host.removeEventListener('wheel', onWheel);
      host.removeEventListener('contextmenu', onContextMenu);
    };
  }, [ready, setHoveredRegion, setSelectedRegion]);

  // 当容器尺寸变化时，手动触发 resize。Pixi 的 resizeTo 只监听 window resize，
  // 不覆盖 HUD 展开/收起这类纯布局变化，所以这里以宿主元素尺寸为唯一来源。
  useEffect(() => {
    if (!ready) return;
    if (!refs.current || !hostRef.current) return;

    let frameId: number | null = null;
    const scheduleResize = () => {
      if (frameId != null) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        frameId = null;
        const r = refs.current;
        if (!r) return;
        syncViewportSize(r, hostRef.current, { fitMapWhenPristine: true });
      });
    };

    scheduleResize();
    const resizeObserver = new ResizeObserver(scheduleResize);
    resizeObserver.observe(hostRef.current);
    window.addEventListener('resize', scheduleResize);

    return () => {
      if (frameId != null) cancelAnimationFrame(frameId);
      window.removeEventListener('resize', scheduleResize);
      resizeObserver.disconnect();
    };
  }, [ready]);

  return (
    <div className={styles.root}>
      <div ref={hostRef} className={styles.canvasHost} />
      {!ready && !error && <div className={styles.statusOverlay}>初始化渲染中…</div>}
      {error && <div className={styles.errorOverlay}>渲染初始化失败：{error}</div>}
      <div className={styles.tickBadge}>tick {tick}</div>
      {map && (
        <div className={styles.hudBadge}>
          {map.meta.provinceCount} 州 · {map.borders.length} 边
        </div>
      )}
      {map && (
        <div className={styles.legend}>
          {TERRAIN_KINDS.map((kind) => (
            <span key={kind} className={styles.legendItem}>
              <span
                className={styles.legendSwatch}
                style={{ background: hexToCss(TERRAIN_COLOR[kind]) }}
              />
              {TERRAIN_LABEL[kind]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 渲染辅助                                                            */
/* ------------------------------------------------------------------ */

function syncViewportSize(
  r: RenderRefs,
  host: HTMLDivElement | null,
  options: { fitMapWhenPristine: boolean },
) {
  if (!host) return;
  const size = getHostCssSize(host);
  if (!size) return;

  const sizeChanged = r.app.screen.width !== size.width || r.app.screen.height !== size.height;
  if (sizeChanged) {
    r.app.renderer.resize(size.width, size.height);
  }

  r.app.stage.hitArea = new Rectangle(0, 0, size.width, size.height);
  if (options.fitMapWhenPristine && !r.cameraTouched && r.currentMap) {
    fitMapToView(r, r.currentMap);
    syncLabelScale(r);
  }
  if (sizeChanged) {
    r.app.render();
  }
}

function getHostCssSize(host: HTMLDivElement): { width: number; height: number } | null {
  const rect = host.getBoundingClientRect();
  const width = Math.floor(rect.width || host.clientWidth);
  const height = Math.floor(rect.height || host.clientHeight);
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

function syncLabelScale(refs: RenderRefs) {
  const worldScale = refs.world.scale.x || 1;
  const labelScale = 1 / Math.max(worldScale, 0.5);
  for (const text of refs.factionLabels.values()) {
    text.scale.set(labelScale);
  }
  for (const marker of refs.factionCapitalMarkers.values()) {
    marker.scale.set(labelScale);
  }
}

function drawBaseAndBorders(refs: RenderRefs, map: MapData, factions: FactionSummary[]) {
  const { baseLayer } = refs;
  baseLayer.clear();

  // base：每个 province polygon 上色
  for (const province of map.provinces) {
    if (province.polygon.length < 3) continue;
    const color = provinceFillColor(province);
    baseLayer.poly(toFlatPolygon(province.polygon)).fill({ color, alpha: 1 });
  }
  // 给每个 polygon 描一层非常细的内描边，省得相邻区块之间在缩小时融成一团
  for (const province of map.provinces) {
    if (province.polygon.length < 3) continue;
    baseLayer
      .poly(toFlatPolygon(province.polygon))
      .stroke({ width: 0.5, color: 0x0a0d12, alpha: 0.55 });
  }

  // borderLayer 在 redrawBorders 中按 owner 关系刷新：同势力内部边不画，跨势力 / 无主边 / 外边界正常画
  redrawBorders(refs, map, factions);
}

/** 按当前 ownership 重画 borderLayer：
 *  - 外边界（right == null）始终画
 *  - 同势力内部边：跳过，让势力内部融合成大色块
 *  - 跨势力 / 一边无主一边有主：画 EU4 风格的暗色加粗描边，宽度 1.6，
 *    用其中一方势力色 darken 后的暗调，让"邻国之间的国境线"明显
 *  - 双边都无主：画一根更细更暗的内部网格线 */
function redrawBorders(refs: RenderRefs, map: MapData, factions: FactionSummary[]) {
  const chunkUpdate = refs.borderChunkTracker.update(map, factions);
  if (!chunkUpdate.changed) return;

  const colorByFaction = new Map<FactionId, number>();
  for (const f of factions) {
    colorByFaction.set(f.id, parseHex(f.colorHex));
  }

  for (const chunkId of chunkUpdate.dirtyChunkIds) {
    const chunk = getBorderChunkGraphics(refs, chunkId);
    chunk.clear();
    for (const edgeId of refs.borderChunkTracker.getEdgeIdsForChunk(chunkId)) {
      drawBorderEdge(chunk, map, edgeId, colorByFaction);
    }
  }
}

function drawBorderEdge(
  layer: Graphics,
  map: MapData,
  edgeId: number,
  colorByFaction: ReadonlyMap<FactionId, number>,
) {
  const edge = map.borders[edgeId];
  if (!edge) return;
  const isOuter = edge.right == null;
  let strokeWidth: number;
  let strokeColor: number;
  let strokeAlpha: number;

  if (isOuter) {
    // 地图外边界始终绘制，保证陆地轮廓清晰。
    strokeWidth = 1.8;
    strokeColor = 0x0a0d12;
    strokeAlpha = 0.95;
  } else {
    const leftProvince = map.provinces[edge.left as unknown as number];
    const rightProvince = edge.right == null ? null : map.provinces[edge.right as unknown as number];
    const leftOwner = provinceDrawableOwner(leftProvince);
    const rightOwner = rightProvince == null ? null : provinceDrawableOwner(rightProvince);
    // 同势力内部边界不绘制，让同一势力领土融合成完整色块。
    if (leftOwner != null && rightOwner != null && leftOwner === rightOwner) return;
    if (leftOwner == null && rightOwner == null) {
      // 双边无主保留细网格线，避免无主地完全失去州界。
      strokeWidth = 0.5;
      strokeColor = 0x2a3548;
      strokeAlpha = 0.5;
    } else {
      // 跨势力或半占领边界使用势力色加深后的粗线。
      const refOwner = leftOwner ?? rightOwner;
      const ownerColor = refOwner != null ? (colorByFaction.get(refOwner) ?? 0x1f2a3a) : 0x1f2a3a;
      strokeWidth = 1.6;
      strokeColor = darkenColor(ownerColor, 0.55);
      strokeAlpha = 0.92;
    }
  }

  layer.moveTo(edge.a.x, edge.a.y).lineTo(edge.b.x, edge.b.y);
  layer.stroke({ width: strokeWidth, color: strokeColor, alpha: strokeAlpha });
}

function drawAdminDistanceOverlay(
  refs: RenderRefs,
  map: MapData,
  factions: FactionSummary[],
  settlements: SettlementSummary[],
  selectedFactionId: FactionId | null,
  visible: boolean,
) {
  const { adminDistanceLayer } = refs;
  adminDistanceLayer.clear();
  if (!visible) return;

  const liveFactions = factions.filter((f) => (f.regions ?? 0) > 0);
  if (liveFactions.length === 0) return;
  const liveFactionIds = new Set(liveFactions.map((f) => f.id));
  const state = buildAdminDistanceState({ map, factions: liveFactions, settlements });

  for (const province of map.provinces) {
    if (province.polygon.length < 3 || province.terrain === 'ocean') continue;
    const owner = province.ownerFactionId;
    if (owner == null || !liveFactionIds.has(owner)) continue;
    if (selectedFactionId != null && owner !== selectedFactionId) continue;

    const distance = state.distanceByFaction.get(owner)?.get(province.id as unknown as number);
    if (distance == null) continue;
    const intensity = clamp((distance - 4) / 14, 0, 1);
    if (intensity <= 0.02) continue;

    adminDistanceLayer.poly(toFlatPolygon(province.polygon)).fill({
      color: 0xff6b4a,
      alpha: 0.08 + intensity * 0.34,
    });
  }
}

function drawStrategicValueOverlay(refs: RenderRefs, map: MapData, visible: boolean) {
  const { strategicValueLayer } = refs;
  strategicValueLayer.clear();
  if (!visible) return;

  const regions = getStrategicValueOverlayRegions(map);
  drawStrategicValueRegions(strategicValueLayer, map, regions);
}

function drawStrategicValueRegions(
  layer: Graphics,
  map: MapData,
  regions: StrategicValueOverlayRegion[],
) {
  for (const region of regions) {
    const province = map.provinces[region.regionId as unknown as number];
    if (!province || province.polygon.length < 3) continue;
    const intensity = clamp(region.strategicValue, 0, 1);
    layer.poly(toFlatPolygon(province.polygon)).fill({
      color: lerpColor(0x2c6fd6, 0xf2c94c, intensity),
      alpha: 0.1 + intensity * 0.28,
    });
  }
}

function drawSettlementStabilityOverlay(
  refs: RenderRefs,
  map: MapData,
  settlements: readonly SettlementSummary[],
  selectedFactionId: FactionId | null,
  mode: SettlementStabilityOverlayMode,
) {
  const { settlementStabilityLayer } = refs;
  settlementStabilityLayer.clear();
  if (mode === 'none' || settlements.length === 0) return;

  for (const settlement of settlements) {
    if (selectedFactionId != null && settlement.factionId !== selectedFactionId) continue;
    const province = map.provinces[settlement.regionId as unknown as number];
    if (!province || province.polygon.length < 3 || province.terrain === 'ocean') continue;
    if (province.ownerFactionId !== settlement.factionId) continue;

    const intensity =
      mode === 'loyalty'
        ? clamp((0.82 - settlement.loyalty) / 0.6, 0, 1)
        : clamp(Math.max(settlement.unrest, settlement.revoltProgress * 0.85), 0, 1);
    if (intensity <= 0.03) continue;

    settlementStabilityLayer.poly(toFlatPolygon(province.polygon)).fill({
      color: mode === 'loyalty' ? 0xff5656 : 0xffa13d,
      alpha: 0.12 + intensity * 0.42,
    });
    settlementStabilityLayer.poly(toFlatPolygon(province.polygon)).stroke({
      width: 1.4 + intensity * 1.8,
      color: mode === 'loyalty' ? 0xffd0d0 : 0xffd166,
      alpha: 0.18 + intensity * 0.42,
    });
  }
}

function drawFrontPressureOverlay(
  refs: RenderRefs,
  map: MapData,
  factions: FactionSummary[],
  visible: boolean,
) {
  const { frontPressureLayer } = refs;
  frontPressureLayer.clear();
  if (!visible) return;

  const liveFactions = factions.filter((f) => (f.regions ?? 0) > 0);
  if (liveFactions.length === 0) return;

  const state = buildFrontPressureState({
    map,
    factions: liveFactions.map((f) => ({
      id: f.id,
      regions: f.regions ?? 0,
      centroidRegionId: f.centroidRegionId ?? f.capitalRegionId,
    })),
    ownedTargetPreference: 0,
  });
  const segments = getFrontPressureOverlaySegments({ map, state });
  drawFrontPressureSegments(frontPressureLayer, segments);
}

function drawFrontPressureSegments(layer: Graphics, segments: FrontPressureOverlaySegment[]) {
  for (const segment of segments) {
    const alpha = 0.2 + segment.intensity * 0.55;
    layer.moveTo(segment.a.x, segment.a.y).lineTo(segment.b.x, segment.b.y);
    layer.stroke({
      width: segment.width,
      color: 0xffd166,
      alpha,
    });
  }
}

function drawWarStatusOverlay(
  refs: RenderRefs,
  map: MapData,
  activeWars: readonly WarSummary[],
  visible: boolean,
) {
  const { warStatusLayer } = refs;
  warStatusLayer.clear();
  if (!visible || activeWars.length === 0) return;

  const segments = getWarStatusOverlaySegments({ map, wars: activeWars });
  drawWarStatusSegments(warStatusLayer, segments);
}

function drawWarStatusSegments(layer: Graphics, segments: WarStatusOverlaySegment[]) {
  for (const segment of segments) {
    const active = segment.status === 'active';
    const color = active ? 0xff5a5f : 0x7aa2ff;
    const alpha = active ? 0.62 + segment.fatigue * 0.26 : 0.48;
    layer.moveTo(segment.a.x, segment.a.y).lineTo(segment.b.x, segment.b.y);
    layer.stroke({
      width: segment.width,
      color,
      alpha,
    });
  }
}

function drawSiegeProgressOverlay(
  refs: RenderRefs,
  map: MapData,
  activeWars: readonly WarSummary[],
  selectedFactionId: FactionId | null,
  visible: boolean,
) {
  const { siegeProgressLayer } = refs;
  siegeProgressLayer.clear();
  if (!visible || activeWars.length === 0) return;

  const regions = getSettlementSiegeOverlayRegions({
    map,
    wars: activeWars,
    selectedFactionId,
  });
  drawSiegeProgressRegions(siegeProgressLayer, map, regions);
}

function drawSiegeProgressRegions(
  layer: Graphics,
  map: MapData,
  regions: SettlementSiegeOverlayRegion[],
) {
  for (const region of regions) {
    const province = map.provinces[region.regionId as unknown as number];
    if (!province || province.polygon.length < 3) continue;
    const intensity = clamp(region.progress, 0, 1);
    layer.poly(toFlatPolygon(province.polygon)).fill({
      color: 0xff4f3d,
      alpha: 0.12 + intensity * 0.36,
    });
    layer.poly(toFlatPolygon(province.polygon)).stroke({
      width: 1.8 + intensity * 2.2,
      color: 0xffd166,
      alpha: 0.36 + intensity * 0.48,
    });
  }
}

function drawHighlight(
  refs: RenderRefs,
  map: MapData,
  hoveredId: RegionId | null,
  selectedId: RegionId | null,
  factions: FactionSummary[],
  selectedFactionId: FactionId | null,
) {
  const { highlightLayer } = refs;
  highlightLayer.clear();

  if (hoveredId != null && hoveredId !== selectedId) {
    const province = map.provinces[hoveredId];
    if (province && province.polygon.length >= 3) {
      highlightLayer
        .poly(toFlatPolygon(province.polygon))
        .fill({ color: 0xffffff, alpha: 0.08 })
        .stroke({ width: 1.2, color: 0xc7d6ec, alpha: 0.85 });
    }
  }

  if (selectedId != null) {
    const province = map.provinces[selectedId];
    if (province && province.polygon.length >= 3) {
      highlightLayer
        .poly(toFlatPolygon(province.polygon))
        .fill({ color: 0xf6c453, alpha: 0.18 })
        .stroke({ width: 2, color: 0xf6c453, alpha: 1 });
    }
  }

  // 出生地：用势力色描边突出。当某势力被选中，仅突出该势力出生地；
  // 否则全部出生地都画一道描边，方便录制时一眼分辨各家根据地。
  // 注意：出生地一旦被其他势力占领（ownerFactionId 已变），就不再画描边，
  // 否则会出现"绿色描边的黄州"这种"原主已亡，标记还在"的诡异现象。
  for (const faction of factions) {
    if (faction.birthRegionId == null) continue;
    if (selectedFactionId != null && selectedFactionId !== faction.id) continue;
    const province = map.provinces[faction.birthRegionId as unknown as number];
    if (!province || province.polygon.length < 3) continue;
    if (province.terrain === 'ocean') continue;
    if (province.ownerFactionId !== faction.id) continue;
    const color = parseHex(faction.colorHex);
    highlightLayer.poly(toFlatPolygon(province.polygon)).stroke({ width: 2.4, color, alpha: 1 });
  }
}

function drawDivineFeedback(refs: RenderRefs, map: MapData, feedback: DivineFeedbackState): void {
  const { divineFeedbackLayer } = refs;
  divineFeedbackLayer.clear();
  if (!feedback) return;
  const province = map.provinces[feedback.regionId as unknown as number];
  if (!province || province.terrain === 'ocean' || province.polygon.length < 3) return;
  const color =
    feedback.tool === 'freeze-war'
      ? 0x7db7ff
      : feedback.tool === 'terraform-region'
        ? 0x7fd879
        : 0xf6c453;
  divineFeedbackLayer
    .poly(toFlatPolygon(province.polygon))
    .fill({ color, alpha: 0.2 })
    .stroke({ width: 3, color, alpha: 0.95 });
}

function drawOwnerOverlay(
  refs: RenderRefs,
  map: MapData,
  factions: FactionSummary[],
  options: { animate: boolean },
) {
  const chunkUpdate = refs.ownerChunkTracker.update(map, factions);
  if (!chunkUpdate.changed) return;

  if (factions.length === 0) {
    clearOwnerChunks(refs);
    refs.ownerAnims.clear();
    refs.displayedOwner.clear();
    drawFactionLabels(refs, map, factions);
    return;
  }

  const colorByFaction = new Map<FactionId, number>();
  for (const f of factions) {
    colorByFaction.set(f.id, parseHex(f.colorHex));
  }

  const now = performance.now();
  // EU4 视觉：半透明势力染色（地形仍可透出），跨势力描边在 borderLayer 单独画
  const targetAlpha = 0.78;

  for (const province of map.provinces) {
    if (province.polygon.length < 3) continue;
    const idNum = province.id as unknown as number;
    const ownerId = provinceDrawableOwner(province);
    const targetColor = ownerId == null ? 0x000000 : (colorByFaction.get(ownerId) ?? 0x000000);
    const targetA = ownerId == null ? 0 : targetAlpha;

    const displayed = refs.displayedOwner.get(idNum);
    const fromColor = displayed?.color ?? targetColor;
    const fromAlpha = displayed?.alpha ?? 0;

    if (fromColor === targetColor && fromAlpha === targetA) {
      // 状态没变，且 displayed 已经就位，不必重启动画
      if (!displayed) {
        refs.displayedOwner.set(idNum, { color: targetColor, alpha: targetA });
      }
      refs.ownerAnims.delete(idNum);
      continue;
    }

    if (options.animate) {
      refs.ownerAnims.set(idNum, {
        fromColor,
        toColor: targetColor,
        fromAlpha,
        toAlpha: targetA,
        start: now,
        dur: OWNER_TRANSITION_MS,
      });
    } else {
      refs.ownerAnims.delete(idNum);
      refs.displayedOwner.set(idNum, { color: targetColor, alpha: targetA });
    }
  }

  redrawOwnerLayer(refs, map, factions, chunkUpdate.dirtyChunkIds);
  drawFactionLabels(refs, map, factions);
}

/** 按 displayedOwner 当前值整层重画。borderLayer 已经为每条边画过线，
 *  这里 ownerLayer 只填色，避免再描一圈深色 stroke 把势力色压暗、产生"棕黑色奇怪边框"。 */
function redrawOwnerLayer(
  refs: RenderRefs,
  map: MapData,
  _factions: FactionSummary[],
  chunkIds: readonly number[] = refs.ownerChunkTracker.getAllChunkIds(),
) {
  if (map.provinces.length === 0) return;

  for (const chunkId of chunkIds) {
    const chunk = getOwnerChunkGraphics(refs, chunkId);
    chunk.clear();
    const regionIds = refs.ownerChunkTracker.getRegionIdsForChunk(chunkId);
    for (const regionId of regionIds) {
      const province = map.provinces[regionId];
      if (!province || province.polygon.length < 3) continue;
      const cur = refs.displayedOwner.get(regionId);
      if (!cur || cur.alpha <= 0) continue;
      chunk.poly(toFlatPolygon(province.polygon)).fill({ color: cur.color, alpha: cur.alpha });
    }
  }
}

function getOwnerChunkGraphics(refs: RenderRefs, chunkId: number): Graphics {
  const existing = refs.ownerChunkGraphics.get(chunkId);
  if (existing) return existing;
  const next = new Graphics();
  next.eventMode = 'none';
  refs.ownerLayer.addChild(next);
  refs.ownerChunkGraphics.set(chunkId, next);
  return next;
}

function clearOwnerChunks(refs: RenderRefs): void {
  for (const chunk of refs.ownerChunkGraphics.values()) {
    refs.ownerLayer.removeChild(chunk);
    chunk.destroy();
  }
  refs.ownerChunkGraphics.clear();
}

function getBorderChunkGraphics(refs: RenderRefs, chunkId: number): Graphics {
  const existing = refs.borderChunkGraphics.get(chunkId);
  if (existing) return existing;
  const next = new Graphics();
  next.eventMode = 'none';
  refs.borderLayer.addChild(next);
  refs.borderChunkGraphics.set(chunkId, next);
  return next;
}

function clearBorderChunks(refs: RenderRefs): void {
  for (const chunk of refs.borderChunkGraphics.values()) {
    refs.borderLayer.removeChild(chunk);
    chunk.destroy();
  }
  refs.borderChunkGraphics.clear();
}

/** 推进 ownerAnims；返回是否仍有进行中的动画。 */
function tickOwnerAnims(refs: RenderRefs, now: number): number[] {
  if (refs.ownerAnims.size === 0) return [];
  const animatedRegionIds: number[] = [];
  const finished: number[] = [];
  for (const [id, anim] of refs.ownerAnims) {
    const t = Math.min(1, (now - anim.start) / anim.dur);
    const eased = easeOutCubic(t);
    const color = lerpColor(anim.fromColor, anim.toColor, eased);
    const alpha = anim.fromAlpha + (anim.toAlpha - anim.fromAlpha) * eased;
    refs.displayedOwner.set(id, { color, alpha });
    animatedRegionIds.push(id);
    if (t >= 1) finished.push(id);
  }
  for (const id of finished) refs.ownerAnims.delete(id);
  return animatedRegionIds;
}

function drawFactionLabels(refs: RenderRefs, map: MapData, factions: FactionSummary[]) {
  const { labelLayer, factionLabels, markerLayer, factionCapitalMarkers } = refs;
  // 标签定位优先走势力已维护的重心/首都锚点，避免每次版图变化都全图聚合。
  const factionsById = new Map(factions.map((faction) => [faction.id as unknown as number, faction]));
  const anchors = computeFactionLabelAnchors(map, factions);

  const stillUsedLabels = new Set<number>();
  const stillUsedMarkers = new Set<number>();

  for (const anchor of anchors) {
    const key = anchor.factionId as unknown as number;
    const f = factionsById.get(key);
    if (!f) continue;
    // regions 为 0 或锚点完全失效的势力不会出现在 anchors 中，视为灭国不绘制标签。

    // 让 label 在地图缩放下保持视觉大小可读：对 world.scale 取倒数缩放
    const worldScale = refs.world.scale.x || 1;
    const labelScale = 1 / Math.max(worldScale, 0.5);
    if (!isRebelFaction(f)) {
      stillUsedLabels.add(key);
      let text = factionLabels.get(key);
      const labelText = factionLabelText(f);
      if (!text) {
        text = new PixiText({
          text: labelText,
          style: {
            // EU4 风格 serif：优先 Garamond / Times，没有再 fallback 系统中文
            fontFamily: 'Garamond, "Times New Roman", "STSong", "Songti SC", serif',
            fontSize: 16,
            fontWeight: '700',
            fontStyle: 'italic',
            letterSpacing: 1.5,
            fill: 0xf6e7c1,
            stroke: { color: 0x0a0d12, width: 4, join: 'round' },
            align: 'center',
          },
        });
        text.eventMode = 'none';
        text.anchor.set(0.5, 0.5);
        labelLayer.addChild(text);
        factionLabels.set(key, text);
      } else if (text.text !== labelText) {
        text.text = labelText;
      }
      text.position.set(anchor.labelX, anchor.labelY);
      text.scale.set(labelScale);
    }

    // 首都金色菱形钉在 capitalRegionId 上；首都失效时由锚点函数回退到标签位置。
    stillUsedMarkers.add(key);
    let marker = factionCapitalMarkers.get(key);
    if (!marker) {
      marker = new Graphics();
      marker.eventMode = 'none';
      markerLayer.addChild(marker);
      factionCapitalMarkers.set(key, marker);
    }
    drawCapitalDiamond(marker);
    marker.position.set(anchor.capitalX, anchor.capitalY);
    marker.scale.set(labelScale);
  }

  // 清理灭国势力的 label / 首都 marker
  for (const [key, text] of factionLabels) {
    if (!stillUsedLabels.has(key)) {
      labelLayer.removeChild(text);
      text.destroy();
      factionLabels.delete(key);
    }
  }
  for (const [key, marker] of factionCapitalMarkers) {
    if (!stillUsedMarkers.has(key)) {
      markerLayer.removeChild(marker);
      marker.destroy();
      factionCapitalMarkers.delete(key);
    }
  }
}

/** EU4 风格首都标记：金色菱形 + 暗色描边，画在以 (0,0) 为中心的局部坐标。 */
function drawCapitalDiamond(g: Graphics): void {
  g.clear();
  // 菱形顶点
  const r = 6;
  g.moveTo(0, -r).lineTo(r, 0).lineTo(0, r).lineTo(-r, 0).closePath();
  g.fill({ color: 0xf6c453, alpha: 1 });
  g.stroke({ width: 1.4, color: 0x4a2c0a, alpha: 1 });
}

function factionLabelText(f: FactionSummary): string {
  if (f.leader && f.leader !== f.name) return `${f.name} · ${f.leader}`;
  return f.name;
}

function isRebelFaction(f: FactionSummary): boolean {
  return f.name.endsWith('义军') || f.leader.endsWith('首领');
}

/** ease-out cubic：开头快、收尾慢，让占领看起来"扑过去再缓缓贴住"。 */
function easeOutCubic(t: number): number {
  const c = 1 - t;
  return 1 - c * c * c;
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bch = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bch;
}

/** 把颜色按比例向黑色靠拢，t∈[0,1]：0=原色，1=纯黑。EU4 边线常用 0.5~0.6。 */
function darkenColor(hex: number, t: number): number {
  const r = Math.round(((hex >> 16) & 0xff) * (1 - t));
  const g = Math.round(((hex >> 8) & 0xff) * (1 - t));
  const b = Math.round((hex & 0xff) * (1 - t));
  return (r << 16) | (g << 8) | b;
}

function fitMapToView(refs: RenderRefs, map: MapData) {
  const { app, world } = refs;
  const vw = app.screen.width;
  const vh = app.screen.height;
  if (vw <= 0 || vh <= 0) return;
  const mw = map.meta.bounds.width;
  const mh = map.meta.bounds.height;
  const scale = Math.min(vw / mw, vh / mh) * 0.95;
  world.scale.set(scale);
  world.position.set((vw - mw * scale) / 2, (vh - mh * scale) / 2);
}

function provinceFillColor(province: Province): number {
  // Phase 3：直接按地形上色；后续势力着色将作为附加层叠加
  return TERRAIN_COLOR[province.terrain];
}

function provinceDrawableOwner(province: Province | null | undefined): FactionId | null {
  if (!province || province.terrain === 'ocean') return null;
  return province.ownerFactionId ?? null;
}

function toFlatPolygon(polygon: Array<{ x: number; y: number }>): number[] {
  const out = new Array<number>(polygon.length * 2);
  for (let i = 0; i < polygon.length; i++) {
    out[i * 2] = polygon[i].x;
    out[i * 2 + 1] = polygon[i].y;
  }
  return out;
}

function clamp(v: number, lo: number, hi: number): number {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

function parseHex(hex: string): number {
  const s = hex.startsWith('#') ? hex.slice(1) : hex;
  const v = parseInt(s, 16);
  return Number.isFinite(v) ? v : 0xffffff;
}
