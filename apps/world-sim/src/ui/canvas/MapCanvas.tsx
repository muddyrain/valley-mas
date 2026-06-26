import { Application, Container, Graphics, Text as PixiText, Rectangle } from 'pixi.js';
import { useEffect, useRef, useState } from 'react';
import type { MapData, Province } from '@/core/map';
import { findProvinceAt, TERRAIN_COLOR, TERRAIN_KINDS, TERRAIN_LABEL } from '@/core/map';
import {
  buildFrontPressureState,
  type FrontPressureOverlaySegment,
  getFrontPressureOverlaySegments,
} from '@/core/sim';
import type { FactionId, FactionSummary, RegionId } from '@/shared/types';
import { useWorldSimStore } from '@/state';
import styles from './MapCanvas.module.css';

const MIN_SCALE = 0.4;
const MAX_SCALE = 6;
const ZOOM_FACTOR = 1.15;
const CLICK_PIXEL_THRESHOLD = 4;
/** 占领过渡时长（毫秒）。约等于 sim tick 间隔，让"势力扩张"看起来是流动的色块。 */
const OWNER_TRANSITION_MS = 600;

/** 一个州的 owner 颜色动画状态（颜色与不透明度同时插值）。 */
interface OwnerAnimState {
  fromColor: number;
  toColor: number;
  fromAlpha: number;
  toAlpha: number;
  start: number;
  dur: number;
}

interface RenderRefs {
  app: Application;
  world: Container;
  baseLayer: Graphics;
  ownerLayer: Graphics;
  borderLayer: Graphics;
  frontPressureLayer: Graphics;
  highlightLayer: Graphics;
  /** 势力名标签层（Text 容器，跟随 world 一起缩放） */
  labelLayer: Container;
  /** 首都金色菱形标记层（Graphics 容器，介于 owner 与 label 之间） */
  markerLayer: Container;
  currentMap: MapData | null;
  /** 当前正在动画的州。key=regionId 数字 */
  ownerAnims: Map<number, OwnerAnimState>;
  /** 当前已经显示出来的颜色/alpha，作为下一次插值的起点 */
  displayedOwner: Map<number, { color: number; alpha: number }>;
  /** 每势力一个 Text 实例，复用并按首都/版图重心定位 */
  factionLabels: Map<number, PixiText>;
  /** 每势力一个 Graphics（金色菱形首都标记） */
  factionCapitalMarkers: Map<number, Graphics>;
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
    const ownerLayer = new Graphics();
    const borderLayer = new Graphics();
    const frontPressureLayer = new Graphics();
    const highlightLayer = new Graphics();
    const labelLayer = new Container();
    const markerLayer = new Container();
    labelLayer.eventMode = 'none';
    markerLayer.eventMode = 'none';

    world.addChild(baseLayer);
    world.addChild(ownerLayer);
    world.addChild(borderLayer);
    world.addChild(frontPressureLayer);
    world.addChild(highlightLayer);
    world.addChild(markerLayer);
    world.addChild(labelLayer);

    app
      .init({
        background: '#0a0d12',
        resizeTo: host,
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
          frontPressureLayer,
          highlightLayer,
          labelLayer,
          markerLayer,
          currentMap: null,
          ownerAnims: new Map(),
          displayedOwner: new Map(),
          factionLabels: new Map(),
          factionCapitalMarkers: new Map(),
        };
        // 把动画推进挂在 Pixi 自带的 ticker 上：有 anim 时才重画 ownerLayer
        app.ticker.add(() => {
          const r = refs.current;
          if (!r || r.ownerAnims.size === 0) return;
          const map = r.currentMap;
          if (!map) return;
          tickOwnerAnims(r, performance.now());
          redrawOwnerLayer(r, map, []);
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
    drawBaseAndBorders(r, map, factions);
    fitMapToView(r, map);
    r.currentMap = map;
    // 地图整体替换 → 重置动画状态、瞬切 owner，避免从老地图色淡入到新地图色
    r.ownerAnims.clear();
    r.displayedOwner.clear();
    drawOwnerOverlay(r, map, factions, { animate: false });
    drawFrontPressureOverlay(r, map, factions, frontPressureOverlayVisible);
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
    drawFrontPressureOverlay(r, map, factions, frontPressureOverlayVisible);
    drawHighlight(r, map, hoveredRegionId, selectedRegionId, factions, selectedFactionId);
  }, [ready, factions]);

  /* -------- 前线压力开关变化时仅重绘 overlay 层 -------- */
  useEffect(() => {
    const r = refs.current;
    if (!ready || !r || !map) return;
    drawFrontPressureOverlay(r, map, factions, frontPressureOverlayVisible);
  }, [ready, map, factions, frontPressureOverlayVisible]);

  /* -------- Hover/Select 变化时仅重绘 highlight 层 -------- */
  useEffect(() => {
    const r = refs.current;
    if (!ready || !r || !map) return;
    drawHighlight(r, map, hoveredRegionId, selectedRegionId, factions, selectedFactionId);
  }, [ready, map, hoveredRegionId, selectedRegionId, factions, selectedFactionId]);

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
      // 海洋州不参与点击
      if (id != null && map.provinces[id as unknown as number]?.terrain === 'ocean') {
        setSelectedRegion(null);
        return;
      }
      const current = useWorldSimStore.getState().selectedRegionId;
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

  /* -------- 视口尺寸变化时维持 fit（仅当无明显手动平移/缩放） -------- */
  useEffect(() => {
    if (!ready) return;
    const r = refs.current;
    if (!r) return;
    const onResize = () => {
      if (r.currentMap) {
        // 不强制重置用户视角，只保证地图仍在视口内：用 hitArea 跟随尺寸更新
        r.app.stage.hitArea = new Rectangle(0, 0, r.app.renderer.width, r.app.renderer.height);
      }
    };
    r.app.renderer.on('resize', onResize);
    return () => {
      r.app.renderer.off('resize', onResize);
    };
  }, [ready]);

  // 当容器尺寸变化时，手动触发 resize 以确保 PixiJS 适应新的容器大小
  useEffect(() => {
    if (!ready) return;
    const r = refs.current;
    if (!r) return;

    if (!hostRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      const host = hostRef.current;
      if (!host) return;
      r.app.renderer.resize(host.clientWidth, host.clientHeight);
    });

    resizeObserver.observe(hostRef.current);

    return () => {
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
  const { borderLayer } = refs;
  borderLayer.clear();

  const colorByFaction = new Map<FactionId, number>();
  for (const f of factions) {
    colorByFaction.set(f.id, parseHex(f.colorHex));
  }

  const outerColor = 0x0a0d12;
  const noOwnerColor = 0x2a3548;

  for (const edge of map.borders) {
    const isOuter = edge.right == null;
    let strokeWidth: number;
    let strokeColor: number;
    let strokeAlpha: number;

    if (isOuter) {
      strokeWidth = 1.8;
      strokeColor = outerColor;
      strokeAlpha = 0.95;
    } else {
      const leftOwner = map.provinces[edge.left as unknown as number]?.ownerFactionId ?? null;
      const rightOwner = map.provinces[edge.right as unknown as number]?.ownerFactionId ?? null;
      // 同势力内部：完全跳过
      if (leftOwner != null && rightOwner != null && leftOwner === rightOwner) continue;
      if (leftOwner == null && rightOwner == null) {
        // 双边无主：保留细网格线
        strokeWidth = 0.5;
        strokeColor = noOwnerColor;
        strokeAlpha = 0.5;
      } else {
        // 跨势力 / 半占领：EU4 风格加粗暗色边线
        const refOwner = leftOwner ?? rightOwner;
        const ownerColor = refOwner != null ? (colorByFaction.get(refOwner) ?? 0x1f2a3a) : 0x1f2a3a;
        strokeWidth = 1.6;
        strokeColor = darkenColor(ownerColor, 0.55);
        strokeAlpha = 0.92;
      }
    }

    borderLayer.moveTo(edge.a.x, edge.a.y).lineTo(edge.b.x, edge.b.y);
    borderLayer.stroke({ width: strokeWidth, color: strokeColor, alpha: strokeAlpha });
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
    if (province.ownerFactionId !== faction.id) continue;
    const color = parseHex(faction.colorHex);
    highlightLayer.poly(toFlatPolygon(province.polygon)).stroke({ width: 2.4, color, alpha: 1 });
  }
}

function drawOwnerOverlay(
  refs: RenderRefs,
  map: MapData,
  factions: FactionSummary[],
  options: { animate: boolean },
) {
  if (factions.length === 0) {
    refs.ownerLayer.clear();
    refs.ownerAnims.clear();
    refs.displayedOwner.clear();
    redrawOwnerLayer(refs, map, factions);
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
    const ownerId = province.ownerFactionId;
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

  redrawOwnerLayer(refs, map, factions);
  drawFactionLabels(refs, map, factions);
}

/** 按 displayedOwner 当前值整层重画。borderLayer 已经为每条边画过线，
 *  这里 ownerLayer 只填色，避免再描一圈深色 stroke 把势力色压暗、产生"棕黑色奇怪边框"。 */
function redrawOwnerLayer(refs: RenderRefs, map: MapData, _factions: FactionSummary[]) {
  const { ownerLayer } = refs;
  ownerLayer.clear();
  if (map.provinces.length === 0) return;

  for (const province of map.provinces) {
    if (province.polygon.length < 3) continue;
    const idNum = province.id as unknown as number;
    const cur = refs.displayedOwner.get(idNum);
    if (!cur || cur.alpha <= 0) continue;
    ownerLayer.poly(toFlatPolygon(province.polygon)).fill({ color: cur.color, alpha: cur.alpha });
  }
}

/** 推进 ownerAnims；返回是否仍有进行中的动画。 */
function tickOwnerAnims(refs: RenderRefs, now: number): boolean {
  if (refs.ownerAnims.size === 0) return false;
  const finished: number[] = [];
  for (const [id, anim] of refs.ownerAnims) {
    const t = Math.min(1, (now - anim.start) / anim.dur);
    const eased = easeOutCubic(t);
    const color = lerpColor(anim.fromColor, anim.toColor, eased);
    const alpha = anim.fromAlpha + (anim.toAlpha - anim.fromAlpha) * eased;
    refs.displayedOwner.set(id, { color, alpha });
    if (t >= 1) finished.push(id);
  }
  for (const id of finished) refs.ownerAnims.delete(id);
  return refs.ownerAnims.size > 0;
}

function drawFactionLabels(refs: RenderRefs, map: MapData, factions: FactionSummary[]) {
  const { labelLayer, factionLabels, markerLayer, factionCapitalMarkers } = refs;

  // 1) 仍然按 region 归属聚合一遍，作为 centroidRegionId 缺失时的兜底
  const aggregate = new Map<number, { sx: number; sy: number; n: number }>();
  for (const province of map.provinces) {
    if (province.ownerFactionId == null) continue;
    const key = province.ownerFactionId as unknown as number;
    const acc = aggregate.get(key);
    if (acc) {
      acc.sx += province.centroid.x;
      acc.sy += province.centroid.y;
      acc.n += 1;
    } else {
      aggregate.set(key, { sx: province.centroid.x, sy: province.centroid.y, n: 1 });
    }
  }

  const stillUsedLabels = new Set<number>();
  const stillUsedMarkers = new Set<number>();

  for (const f of factions) {
    const key = f.id as unknown as number;
    const owned = aggregate.get(key);
    // regions === 0 / 没有任何州 → 视为灭国，不画标签也不画首都
    if (!owned || owned.n === 0) continue;

    // 标签钉位：优先 centroidRegionId（领土重心州的中心），否则用聚合 centroid
    let labelX = owned.sx / owned.n;
    let labelY = owned.sy / owned.n;
    if (f.centroidRegionId != null) {
      const p = map.provinces[f.centroidRegionId as unknown as number];
      if (p && p.ownerFactionId === f.id) {
        labelX = p.centroid.x;
        labelY = p.centroid.y;
      }
    }

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
    text.position.set(labelX, labelY);
    // 让 label 在地图缩放下保持视觉大小可读：对 world.scale 取倒数缩放
    const worldScale = refs.world.scale.x || 1;
    const labelScale = 1 / Math.max(worldScale, 0.5);
    text.scale.set(labelScale);

    // 首都金色菱形：钉在 capitalRegionId 上，落空时用 centroid 替代
    let capX: number | null = null;
    let capY: number | null = null;
    if (f.capitalRegionId != null) {
      const p = map.provinces[f.capitalRegionId as unknown as number];
      if (p && p.ownerFactionId === f.id) {
        capX = p.centroid.x;
        capY = p.centroid.y;
      }
    }
    if (capX == null || capY == null) {
      capX = labelX;
      capY = labelY;
    }

    stillUsedMarkers.add(key);
    let marker = factionCapitalMarkers.get(key);
    if (!marker) {
      marker = new Graphics();
      marker.eventMode = 'none';
      markerLayer.addChild(marker);
      factionCapitalMarkers.set(key, marker);
    }
    drawCapitalDiamond(marker);
    marker.position.set(capX, capY);
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
  const vw = app.renderer.width;
  const vh = app.renderer.height;
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
