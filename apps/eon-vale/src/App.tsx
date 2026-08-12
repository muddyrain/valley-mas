import {
  Bug,
  ChevronRight,
  Crown,
  Download,
  Gauge,
  Globe2,
  Menu,
  Pause,
  PawPrint,
  Play,
  RotateCcw,
  Save,
  Settings,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ProceduralAudio } from './audio/ProceduralAudio';
import {
  EonValeEngine,
  type ResourceHoverInfo,
  type RuntimeMetrics,
  type WorldClick,
} from './render/EonValeEngine';
import type { Inspection, WorldRenderSnapshot } from './render/renderTypes';
import type { WorldViewLevel } from './render/strategicView';
import {
  EntityKind,
  GodPower,
  type MapTool,
  type WorldPreset,
  type WorldSettings,
} from './shared/gameTypes';
import {
  createIndexedDbSaveStorage,
  createSaveRepository,
  type SaveRepository,
  type StoredWorldSave,
} from './simulation/persistence/saveSlots';
import { resolvePlaybackShortcut } from './simulation/rules/playbackShortcuts';
import { SIMULATION_SPEEDS } from './simulation/rules/runtimeRules';
import { WORLD_LAW_CATALOG, WORLD_LAW_UI_IDS } from './simulation/rules/worldLawCatalog';
import { EcologyPanel } from './ui/EcologyPanel';
import { InspectorPanel } from './ui/InspectorPanel';
import { PerformancePanel } from './ui/PerformancePanel';
import { PopulationPanel } from './ui/PopulationPanel';
import { ToolDock } from './ui/ToolDock';
import { SimulationWorkerClient } from './worker/SimulationWorkerClient';

const SPEED_OPTIONS = SIMULATION_SPEEDS;
const WORLD_SIZES = [128, 256, 384] as const;

const EMPTY_METRICS: RuntimeMetrics = {
  fps: 0,
  frameP95Ms: 0,
  drawCalls: 0,
  triangles: 0,
  longTasks: 0,
  tickMs: 0,
  averageTickMs: 0,
  pathQueue: 0,
  completedPaths: 0,
};

function createSeed(): string {
  return `EON-${Math.floor(Date.now() / 1_000)
    .toString(36)
    .toUpperCase()}`;
}

function downloadSave(encoded: string, seed: string): void {
  const blob = new Blob([encoded], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `eon-vale-${seed.toLowerCase().replace(/[^a-z0-9-]+/g, '-')}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function saveCaption(save: StoredWorldSave | null): string {
  if (!save) return '空';
  return `${save.seed} · 第 ${save.year} 年 · ${save.population} 人`;
}

function toolRadius(tool: MapTool | null, power: GodPower | null): number {
  if (
    power === GodPower.Rain ||
    power === GodPower.Blessing ||
    power === GodPower.Heal ||
    power === GodPower.Growth ||
    power === GodPower.Purify ||
    power === GodPower.Fertility
  )
    return 5;
  if (
    power === GodPower.Meteor ||
    power === GodPower.Tornado ||
    power === GodPower.Plague ||
    power === GodPower.Earthquake
  )
    return 3;
  if (power) return 2;
  if (tool?.startsWith('spawn-')) return 1;
  return tool ? 2 : 1;
}

function spawnKind(tool: MapTool): EntityKind | null {
  if (tool === 'spawn-human') return EntityKind.Human;
  if (tool === 'spawn-chicken') return EntityKind.Chicken;
  if (tool === 'spawn-sheep') return EntityKind.Sheep;
  if (tool === 'spawn-cow') return EntityKind.Cow;
  if (tool === 'spawn-deer') return EntityKind.Deer;
  if (tool === 'spawn-wolf') return EntityKind.Wolf;
  if (tool === 'spawn-bear') return EntityKind.Bear;
  if (tool === 'spawn-fish') return EntityKind.Fish;
  return null;
}

function spawnCount(kind: EntityKind): number {
  if (kind === EntityKind.Human) return 4;
  if (kind === EntityKind.Chicken || kind === EntityKind.Sheep || kind === EntityKind.Deer)
    return 6;
  if (kind === EntityKind.Cow) return 4;
  if (kind === EntityKind.Wolf) return 3;
  if (kind === EntityKind.Fish) return 6;
  return 1;
}

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<ProceduralAudio | null>(null);
  const workerRef = useRef<SimulationWorkerClient | null>(null);
  const engineRef = useRef<EonValeEngine | null>(null);
  const activeToolRef = useRef<MapTool | null>(null);
  const activePowerRef = useRef<GodPower | null>(null);
  const [seed, setSeed] = useState(createSeed);
  const seedRef = useRef(seed);
  const [snapshot, setSnapshot] = useState<WorldRenderSnapshot | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [activeTool, setActiveTool] = useState<MapTool | null>(null);
  const [activePower, setActivePower] = useState<GodPower | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEED_OPTIONS)[number]>(1);
  const [metrics, setMetrics] = useState(EMPTY_METRICS);
  const [showMetrics, setShowMetrics] = useState(false);
  const [showNewWorld, setShowNewWorld] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [draftSeed, setDraftSeed] = useState(seed);
  const [worldSize, setWorldSize] = useState<(typeof WORLD_SIZES)[number]>(256);
  const worldSizeRef = useRef<(typeof WORLD_SIZES)[number]>(256);
  const [draftWorldSize, setDraftWorldSize] = useState<(typeof WORLD_SIZES)[number]>(256);
  const [worldPreset, setWorldPreset] = useState<WorldPreset>('archipelago');
  const worldPresetRef = useRef<WorldPreset>('archipelago');
  const [draftWorldPreset, setDraftWorldPreset] = useState<WorldPreset>('archipelago');
  const [quality, setQuality] = useState<WorldSettings['quality']>('high');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [overlay, setOverlay] = useState<WorldSettings['overlay']>('none');
  const [notice, setNotice] = useState<{ level: 'info' | 'error'; message: string } | null>(null);
  const [stressPopulation, setStressPopulation] = useState<number | null>(null);
  const stressPopulationRef = useRef<number | null>(null);
  const [viewLevel, setViewLevel] = useState<WorldViewLevel>('world');
  const [chronicleOpen, setChronicleOpen] = useState(false);
  const [populationOpen, setPopulationOpen] = useState(false);
  const [ecologyOpen, setEcologyOpen] = useState(false);
  const [resourceHover, setResourceHover] = useState<ResourceHoverInfo | null>(null);
  const clickHandlerRef = useRef<(click: WorldClick) => void>(() => undefined);
  const snapshotRef = useRef<WorldRenderSnapshot | null>(null);
  const saveRepositoryRef = useRef<SaveRepository | null>(null);
  const saveIntentRef = useRef<
    { kind: 'manual'; slot: 1 | 2 | 3 } | { kind: 'auto' } | { kind: 'export' }
  >({ kind: 'manual', slot: 1 });
  const [manualSaves, setManualSaves] = useState<Array<StoredWorldSave | null>>([null, null, null]);
  const [autoSaves, setAutoSaves] = useState<StoredWorldSave[]>([]);

  activeToolRef.current = activeTool;
  activePowerRef.current = activePower;
  seedRef.current = seed;
  worldSizeRef.current = worldSize;
  worldPresetRef.current = worldPreset;
  snapshotRef.current = snapshot;
  stressPopulationRef.current = stressPopulation;

  clickHandlerRef.current = (click) => {
    const worker = workerRef.current;
    if (!worker) return;
    const power = activePowerRef.current;
    const tool = activeToolRef.current;
    if (power) {
      const radius = toolRadius(null, power);
      engineRef.current?.playGodEffect(power, click.cell, radius);
      worker.useGodPower(power, click.cell, radius);
      audioRef.current?.play(
        power === GodPower.Fire || power === GodPower.Meteor || power === GodPower.Plague
          ? 'danger'
          : 'power',
      );
      return;
    }
    if (tool) {
      const kind = spawnKind(tool);
      if (kind !== null) worker.spawn(kind, click.cell, spawnCount(kind));
      else worker.editMap(tool, click.cell, toolRadius(tool, null));
      audioRef.current?.play('create');
      return;
    }
    if (click.entityId !== undefined) {
      setPopulationOpen(false);
      setEcologyOpen(false);
      engineRef.current?.setSelection({ kind: 'entity', id: click.entityId });
      worker.inspect('entity', click.entityId);
    } else if (click.resourceNodeId !== undefined) {
      setPopulationOpen(false);
      setEcologyOpen(false);
      engineRef.current?.setSelection({ kind: 'resource', id: click.resourceNodeId });
      setInspection(null);
    } else if (click.buildingId !== undefined && click.villageId !== undefined) {
      setPopulationOpen(false);
      setEcologyOpen(false);
      engineRef.current?.setSelection({ kind: 'building', id: click.buildingId });
      worker.inspect('village', click.villageId);
    } else if (click.villageId !== undefined) {
      setPopulationOpen(false);
      setEcologyOpen(false);
      engineRef.current?.setSelection({ kind: 'village', id: click.villageId });
      worker.inspect('village', click.villageId);
    } else {
      engineRef.current?.setSelection(null);
      setInspection(null);
    }
    audioRef.current?.play('select');
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const saveRepository = createSaveRepository(createIndexedDbSaveStorage());
    saveRepositoryRef.current = saveRepository;
    void Promise.all([saveRepository.listManuals(), saveRepository.listAutos()])
      .then(([manuals, autos]) => {
        setManualSaves(manuals);
        setAutoSaves(autos);
      })
      .catch(() => setNotice({ level: 'error', message: '无法读取世界档案' }));
    const engine = new EonValeEngine(canvas, {
      onMetrics: (next) => {
        setMetrics(next);
        window.__EON_METRICS__ = {
          ...next,
          population: Number(canvas.dataset.population ?? 0),
          userAgent: navigator.userAgent,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          devicePixelRatio: window.devicePixelRatio,
        };
      },
      onWorldClick: (click) => clickHandlerRef.current(click),
      onViewLevelChange: setViewLevel,
      onResourceHover: setResourceHover,
    });
    const worker = new SimulationWorkerClient({
      onReady: (mode, _population, readySeed) => {
        if (mode !== 'world') return;
        setSeed(readySeed);
        setDraftSeed(readySeed);
      },
      onStressSnapshot: (next) => engine.pushSnapshot(next),
      onWorldSnapshot: (next) => {
        engine.pushSnapshot(next);
        setSnapshot(next);
      },
      onMap: (map) => {
        engine.setWorldMap(map);
        if (WORLD_SIZES.includes(map.size as (typeof WORLD_SIZES)[number])) {
          setWorldSize(map.size as (typeof WORLD_SIZES)[number]);
        }
        setWorldPreset(map.preset);
      },
      onMapDelta: (delta) => engine.applyWorldMapDelta(delta),
      onResources: (resources) => engine.setResourceNodes(resources),
      onInspection: setInspection,
      onSave: async (encoded) => {
        const current = snapshotRef.current;
        const summary = {
          seed: seedRef.current,
          year: current?.year ?? 1,
          population: current?.stats.humans ?? current?.population ?? 0,
        };
        const intent = saveIntentRef.current;
        try {
          if (intent.kind === 'manual') {
            await saveRepository.writeManual(intent.slot, encoded, summary);
            setManualSaves(await saveRepository.listManuals());
            setNotice({ level: 'info', message: `世界已保存到档案 ${intent.slot}` });
          } else if (intent.kind === 'auto') {
            await saveRepository.writeAuto(encoded, summary);
            setAutoSaves(await saveRepository.listAutos());
            setNotice({ level: 'info', message: '自动存档完成' });
          } else {
            downloadSave(encoded, summary.seed);
            setNotice({ level: 'info', message: '世界档案已导出' });
          }
        } catch {
          setNotice({ level: 'error', message: '存储空间不足，原存档未更改' });
        }
      },
      onNotice: (level, message) => setNotice({ level, message }),
    });
    engineRef.current = engine;
    workerRef.current = worker;
    const audio = new ProceduralAudio();
    audioRef.current = audio;
    const unlockAudio = () => void audio.unlock();
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    engine.start();
    const query = new URLSearchParams(window.location.search);
    const stress = Number(query.get('stress'));
    const worldStress = Number(query.get('worldStress'));
    const stressMapSize = Number(query.get('mapSize'));
    if ([100, 500, 1_000].includes(stress)) {
      setStressPopulation(stress);
      worker.initializeStress(stress, `browser-stress-${stress}`);
    } else if (worldStress === 1_000 && stressMapSize === 384) {
      worker.initializeWorld('browser-complete-world', 1_000, 384, 'continent');
    } else {
      worker.initializeWorld(seedRef.current, 72, worldSizeRef.current, worldPresetRef.current);
    }
    const autosaveTimer = window.setInterval(() => {
      if (stressPopulationRef.current) return;
      saveIntentRef.current = { kind: 'auto' };
      worker.requestSave();
    }, 120_000);
    return () => {
      window.clearInterval(autosaveTimer);
      worker.dispose();
      engine.dispose();
      window.removeEventListener('pointerdown', unlockAudio);
      audio.dispose();
      workerRef.current = null;
      engineRef.current = null;
      audioRef.current = null;
      saveRepositoryRef.current = null;
    };
  }, []);

  useEffect(() => {
    workerRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    workerRef.current?.setSpeed(speed);
  }, [speed]);

  useEffect(() => {
    const renderGameToText = () => {
      const currentStats = snapshot && snapshot.stats;
      return JSON.stringify({
        coordinateSystem: 'world origin is top-left; +x points right; +z points down',
        tick: (snapshot && snapshot.tick) || 0,
        year: (snapshot && snapshot.year) || 1,
        population: (currentStats && currentStats.humans) || (snapshot && snapshot.population) || 0,
        animals: (currentStats && currentStats.animals) || 0,
        villages: (currentStats && currentStats.villages) || 0,
        kingdoms: (currentStats && currentStats.kingdoms) || 0,
        playback: { paused, speed },
        viewLevel,
      });
    };
    window.render_game_to_text = renderGameToText;
    return () => {
      if (window.render_game_to_text === renderGameToText) delete window.render_game_to_text;
    };
  }, [paused, snapshot, speed, viewLevel]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const action = resolvePlaybackShortcut({
        key: event.key,
        code: event.code,
        repeat: event.repeat,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        targetTagName: target ? target.tagName : undefined,
        targetIsContentEditable: Boolean(target && target.isContentEditable),
        dialogOpen: showNewWorld || showSettings,
      });
      if (!action) return;
      event.preventDefault();
      if (action.type === 'toggle-pause') setPaused((current) => !current);
      else setSpeed(action.speed);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showNewWorld, showSettings]);

  useEffect(() => {
    engineRef.current?.setBrush(
      toolRadius(activeTool, activePower),
      Boolean(activeTool || activePower),
    );
  }, [activeTool, activePower]);

  useEffect(() => {
    engineRef.current?.setQuality(quality);
  }, [quality]);

  useEffect(() => {
    engineRef.current?.setOverlay(overlay);
  }, [overlay]);

  useEffect(() => {
    audioRef.current?.setEnabled(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 2_800);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const beginNewWorld = () => {
    const nextSeed = draftSeed.trim() || createSeed();
    setSeed(nextSeed);
    setWorldSize(draftWorldSize);
    setWorldPreset(draftWorldPreset);
    setSnapshot(null);
    setInspection(null);
    engineRef.current?.setSelection(null);
    setChronicleOpen(false);
    setPopulationOpen(false);
    setEcologyOpen(false);
    setStressPopulation(null);
    setPaused(false);
    workerRef.current?.initializeWorld(
      nextSeed,
      draftWorldPreset === 'ocean' ? 0 : 72,
      draftWorldSize,
      draftWorldPreset,
    );
    audioRef.current?.play('create');
    setShowNewWorld(false);
    setNotice({ level: 'info', message: '新世界正在苏醒' });
  };

  const loadStoredWorld = (save: StoredWorldSave | null) => {
    if (!save) {
      setNotice({ level: 'error', message: '还没有可载入的世界' });
      return;
    }
    setStressPopulation(null);
    setInspection(null);
    engineRef.current?.setSelection(null);
    setChronicleOpen(false);
    setPopulationOpen(false);
    setEcologyOpen(false);
    engineRef.current?.returnToWorld();
    workerRef.current?.loadSave(save.encoded);
    setSeed(save.seed);
    setDraftSeed(save.seed);
    setShowNewWorld(false);
  };

  const saveManual = (slot: 1 | 2 | 3) => {
    saveIntentRef.current = { kind: 'manual', slot };
    workerRef.current?.requestSave();
  };

  const exportWorld = () => {
    saveIntentRef.current = { kind: 'export' };
    workerRef.current?.requestSave();
  };

  const importWorld = async (file: File | undefined) => {
    if (!file) return;
    try {
      const encoded = await file.text();
      workerRef.current?.loadSave(encoded);
      setShowNewWorld(false);
    } catch {
      setNotice({ level: 'error', message: '无法读取世界档案' });
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  };

  const startStress = (population: number) => {
    setStressPopulation(population);
    setSnapshot(null);
    setInspection(null);
    engineRef.current?.setSelection(null);
    setChronicleOpen(false);
    setPopulationOpen(false);
    setEcologyOpen(false);
    engineRef.current?.returnToWorld();
    setShowMetrics(true);
    workerRef.current?.initializeStress(population, `browser-stress-${population}`);
    setShowSettings(false);
  };

  const stats = snapshot?.stats ?? {
    year: 1,
    humans: stressPopulation ?? 0,
    animals: 0,
    villages: 0,
    kingdoms: 0,
    wars: 0,
    populationTrend: 0,
  };

  return (
    <main className="app-shell">
      <canvas ref={canvasRef} className="world-canvas" aria-label="纪元谷像素世界" />
      {resourceHover && (
        <div
          className="resource-hover-card"
          style={{ left: resourceHover.screenX + 14, top: resourceHover.screenY + 14 }}
          data-testid="resource-hover"
        >
          <strong>{resourceHover.name}</strong>
          <span>{resourceHover.stage}</span>
          <small>余量 {resourceHover.amount}</small>
        </div>
      )}

      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">EV</span>
          <span>
            <strong>Eon Vale</strong>
            <small>纪元谷 · A Living World Sandbox</small>
          </span>
        </div>
        <div
          className="world-stats"
          role="group"
          aria-label="世界状态"
          data-kingdoms={stats.kingdoms}
          data-wars={stats.wars}
        >
          <span>
            <small>纪年</small>
            <b>{stats.year}</b>
          </span>
          <button
            type="button"
            className="population-stat"
            data-testid="population-stat"
            aria-expanded={populationOpen}
            onClick={() => {
              setPopulationOpen((value) => !value);
              setEcologyOpen(false);
              setChronicleOpen(false);
              setInspection(null);
              engineRef.current?.setSelection(null);
            }}
          >
            <small>人口</small>
            <b>
              {stats.humans}
              {stats.populationTrend > 0 && <TrendingUp size={11} />}
              {stats.populationTrend < 0 && <TrendingDown size={11} />}
            </b>
          </button>
          <button
            type="button"
            className="ecology-stat"
            data-testid="ecology-stat"
            aria-expanded={ecologyOpen}
            onClick={() => {
              setEcologyOpen((value) => !value);
              setPopulationOpen(false);
              setChronicleOpen(false);
              setInspection(null);
              engineRef.current?.setSelection(null);
            }}
          >
            <small>动物</small>
            <b>
              <PawPrint size={11} />
              {stats.animals}
            </b>
          </button>
          <span>
            <small>村庄</small>
            <b>{stats.villages}</b>
          </span>
          <span>
            <small>王国</small>
            <b>{stats.kingdoms}</b>
          </span>
          <span className={stats.wars > 0 ? 'war-stat' : ''}>
            <small>战争</small>
            <b>{stats.wars}</b>
          </span>
        </div>
        <div className="top-actions">
          <button
            type="button"
            onClick={() => setShowMetrics((value) => !value)}
            aria-label="性能监视"
          >
            <Gauge size={17} />
          </button>
          <button type="button" onClick={() => setShowSettings(true)} aria-label="设置">
            <Settings size={17} />
          </button>
          <button type="button" onClick={() => setShowNewWorld(true)} aria-label="世界菜单">
            <Menu size={18} />
          </button>
        </div>
      </header>

      {!stressPopulation && (
        <section className={`view-navigation ${viewLevel}`} aria-label="地图层级">
          <span data-testid="view-level">
            {viewLevel === 'world'
              ? '世界局势'
              : viewLevel === 'settlement'
                ? '聚落视图'
                : '居民视图'}
          </span>
          {viewLevel !== 'world' && (
            <button
              type="button"
              data-testid="return-to-world"
              onClick={() => {
                engineRef.current?.returnToWorld();
                engineRef.current?.setSelection(null);
                setInspection(null);
                setChronicleOpen(false);
                setEcologyOpen(false);
              }}
            >
              <Globe2 size={14} />
              返回世界
            </button>
          )}
        </section>
      )}

      {!stressPopulation && (
        <ToolDock
          activeTool={activeTool}
          activePower={activePower}
          onTool={setActiveTool}
          onPower={setActivePower}
        />
      )}

      {showMetrics && (
        <PerformancePanel
          metrics={metrics}
          population={stressPopulation ?? snapshot?.population ?? 0}
        />
      )}

      {inspection && (
        <InspectorPanel
          inspection={inspection}
          onFollow={(id) => {
            if (!snapshot) return;
            engineRef.current?.focusOn(
              snapshot.positionsX[id] ?? 0,
              snapshot.positionsZ[id] ?? 0,
              'resident',
            );
            engineRef.current?.setSelection({ kind: 'entity', id });
          }}
          onClose={() => {
            setInspection(null);
            engineRef.current?.setSelection(null);
          }}
        />
      )}

      {!inspection && populationOpen && snapshot && (
        <PopulationPanel
          diagnostics={snapshot.demographics}
          onClose={() => setPopulationOpen(false)}
        />
      )}

      {!inspection && ecologyOpen && snapshot && (
        <EcologyPanel ecology={snapshot.ecology} onClose={() => setEcologyOpen(false)} />
      )}

      {!inspection &&
        !populationOpen &&
        !ecologyOpen &&
        !stressPopulation &&
        snapshot &&
        !chronicleOpen && (
          <button
            type="button"
            className="chronicle-toggle"
            data-testid="chronicle-toggle"
            onClick={() => setChronicleOpen(true)}
            aria-label="展开世界局势"
          >
            <Sparkles size={17} />
            {stats.wars > 0 && <b>{stats.wars}</b>}
          </button>
        )}

      {!inspection && !stressPopulation && snapshot && chronicleOpen && (
        <aside className="chronicle-panel">
          <div className="chronicle-heading">
            <span>
              <small>世界局势</small>
              <strong>王国与事件</strong>
            </span>
            <button type="button" onClick={() => setChronicleOpen(false)} aria-label="收起世界局势">
              <X size={15} />
            </button>
          </div>
          {snapshot.kingdoms.filter((kingdom) => !kingdom.extinct).length > 0 && (
            <div className="kingdom-row">
              {snapshot.kingdoms
                .filter((kingdom) => !kingdom.extinct)
                .map((kingdom) => (
                  <button
                    key={kingdom.id}
                    type="button"
                    onClick={() => {
                      const capital = snapshot.villages.find((village) =>
                        kingdom.villageIds.includes(village.id),
                      );
                      if (capital) {
                        engineRef.current?.focusOn(capital.x, capital.z, 'settlement');
                        engineRef.current?.setSelection({ kind: 'village', id: capital.id });
                      }
                      workerRef.current?.inspect('kingdom', kingdom.id);
                    }}
                  >
                    <i style={{ background: kingdom.color }} />
                    <span>{kingdom.name}</span>
                    <ChevronRight size={13} />
                  </button>
                ))}
            </div>
          )}
          <div className="settlement-row">
            <button
              type="button"
              data-testid="follow-resident"
              onClick={() => {
                engineRef.current?.focusOn(
                  snapshot.positionsX[0] ?? 64,
                  snapshot.positionsZ[0] ?? 64,
                  'resident',
                );
                engineRef.current?.setSelection({ kind: 'entity', id: 0 });
                workerRef.current?.inspect('entity', 0);
              }}
            >
              <Users size={13} />
              追随居民
            </button>
            {snapshot.villages.slice(0, 3).map((village) => (
              <button
                key={village.id}
                type="button"
                data-testid={`village-chip-${village.id}`}
                onClick={() => {
                  engineRef.current?.focusOn(village.x, village.z, 'settlement');
                  engineRef.current?.setSelection({ kind: 'village', id: village.id });
                  workerRef.current?.inspect('village', village.id);
                }}
              >
                {village.name}
              </button>
            ))}
          </div>
          <div className="event-list">
            {snapshot.events
              .slice(-5)
              .reverse()
              .map((event) => (
                <span key={event.id}>
                  <i />
                  <b>{event.message}</b>
                  <small>第 {Math.floor(event.tick / 20)} 日</small>
                </span>
              ))}
            {snapshot.events.length === 0 && <p>风吹过尚未命名的山谷。</p>}
          </div>
        </aside>
      )}

      <section className="playback-bar">
        <button
          type="button"
          className="play-button"
          onClick={() => setPaused((value) => !value)}
          aria-label={paused ? '继续' : '暂停'}
        >
          {paused ? (
            <Play size={17} fill="currentColor" />
          ) : (
            <Pause size={17} fill="currentColor" />
          )}
        </button>
        <div className="speed-control" role="group" aria-label="世界速度">
          {SPEED_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={speed === option ? 'active' : ''}
              onClick={() => setSpeed(option)}
            >
              {option}×
            </button>
          ))}
        </div>
      </section>

      {showNewWorld && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="world-menu-title"
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setShowNewWorld(false)}
              aria-label="关闭"
            >
              <X size={17} />
            </button>
            <span className="modal-emblem">
              <Crown size={22} />
            </span>
            <small>世界档案</small>
            <h2 id="world-menu-title">塑造新的纪元</h2>
            <label htmlFor="world-seed">世界种子</label>
            <div className="seed-input">
              <input
                id="world-seed"
                value={draftSeed}
                onChange={(event) => setDraftSeed(event.target.value)}
              />
              <button
                type="button"
                onClick={() => setDraftSeed(createSeed())}
                aria-label="随机种子"
              >
                <RotateCcw size={16} />
              </button>
            </div>
            <fieldset>
              <legend>地图规模</legend>
              <div className="choice-row" data-testid="world-size-options">
                {WORLD_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={draftWorldSize === size ? 'active' : ''}
                    onClick={() => setDraftWorldSize(size)}
                  >
                    {{ 128: '小型', 256: '中型', 384: '大型' }[size]}
                    <small>
                      {size}×{size}
                    </small>
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>世界形态</legend>
              <div className="choice-row" data-testid="world-preset-options">
                {(
                  [
                    ['archipelago', '群岛'],
                    ['continent', '主大陆'],
                    ['ocean', '空白海洋'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={draftWorldPreset === value ? 'active' : ''}
                    onClick={() => setDraftWorldPreset(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            {snapshot && !stressPopulation && (
              <fieldset>
                <legend>世界法则</legend>
                <div className="choice-row world-law-row" data-testid="world-law-options">
                  {WORLD_LAW_UI_IDS.map((law) => {
                    const enabled = snapshot.worldLaws[law];
                    return (
                      <button
                        key={law}
                        type="button"
                        className={enabled ? 'active' : ''}
                        onClick={() => workerRef.current?.setWorldLaw(law, !enabled)}
                      >
                        {WORLD_LAW_CATALOG[law].title}
                        <small>{enabled ? '开启' : '关闭'}</small>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}
            <button
              type="button"
              className="primary-action"
              data-testid="create-world"
              onClick={beginNewWorld}
            >
              创造世界
            </button>
            <div className="save-slots" role="group" aria-label="手动存档">
              {manualSaves.map((save, index) => {
                const slot = (index + 1) as 1 | 2 | 3;
                return (
                  <div key={slot} className="save-slot">
                    <span>
                      <b>档案 {slot}</b>
                      <small>{saveCaption(save)}</small>
                    </span>
                    <span>
                      <button
                        type="button"
                        onClick={() => saveManual(slot)}
                        disabled={Boolean(stressPopulation)}
                      >
                        <Save size={14} />
                        保存
                      </button>
                      <button type="button" onClick={() => loadStoredWorld(save)} disabled={!save}>
                        载入
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
            {autoSaves[0] && (
              <button
                type="button"
                className="autosave-action"
                onClick={() => loadStoredWorld(autoSaves[0] ?? null)}
              >
                <RotateCcw size={14} />
                最近自动存档 · {saveCaption(autoSaves[0] ?? null)}
              </button>
            )}
            <div className="modal-actions archive-actions">
              <button type="button" onClick={exportWorld} disabled={Boolean(stressPopulation)}>
                <Download size={15} />
                导出
              </button>
              <button type="button" onClick={() => importRef.current?.click()}>
                <Upload size={15} />
                导入
              </button>
              <input
                ref={importRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(event) => void importWorld(event.target.files?.[0])}
              />
            </div>
          </section>
        </div>
      )}

      {showSettings && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="modal-card settings-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setShowSettings(false)}
              aria-label="关闭"
            >
              <X size={17} />
            </button>
            <small>世界视图</small>
            <h2 id="settings-title">设置</h2>
            <fieldset>
              <legend>画质</legend>
              <div className="choice-row">
                {(['low', 'medium', 'high'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={quality === value ? 'active' : ''}
                    onClick={() => setQuality(value)}
                  >
                    {{ low: '轻量', medium: '均衡', high: '精细' }[value]}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>地图覆盖层</legend>
              <select
                value={overlay}
                onChange={(event) => setOverlay(event.target.value as WorldSettings['overlay'])}
              >
                <option value="none">自然世界</option>
                <option value="territory">王国领土</option>
                <option value="population">人口密度</option>
                <option value="resources">资源分布</option>
                <option value="climate">温度与湿度</option>
                <option value="navigation">可通行区域</option>
              </select>
            </fieldset>
            <fieldset>
              <legend>声音</legend>
              <div className="choice-row sound-row">
                <button
                  type="button"
                  className={soundEnabled ? 'active' : ''}
                  onClick={() => setSoundEnabled(true)}
                >
                  开启
                </button>
                <button
                  type="button"
                  className={!soundEnabled ? 'active' : ''}
                  onClick={() => setSoundEnabled(false)}
                >
                  静音
                </button>
              </div>
            </fieldset>
            <fieldset className="developer-fieldset">
              <legend>
                <Bug size={14} />
                压力场景
              </legend>
              <div className="choice-row">
                {[100, 500, 1_000].map((population) => (
                  <button
                    key={population}
                    type="button"
                    data-testid={`population-${population}`}
                    onClick={() => startStress(population)}
                  >
                    {population.toLocaleString('zh-CN')}
                  </button>
                ))}
              </div>
            </fieldset>
          </section>
        </div>
      )}

      {stressPopulation && (
        <section className="stress-banner">
          <Bug size={15} />
          <span>
            <b>{stressPopulation.toLocaleString('zh-CN')} 居民压力场景</b>
            <small>完整模拟持续运行</small>
          </span>
          <button
            type="button"
            onClick={() => {
              setStressPopulation(null);
              workerRef.current?.initializeWorld(
                seedRef.current,
                72,
                worldSizeRef.current,
                worldPresetRef.current,
              );
            }}
          >
            返回世界
          </button>
        </section>
      )}

      {notice && (
        <div className={`toast ${notice.level}`} role="status">
          {notice.message}
        </div>
      )}
    </main>
  );
}
