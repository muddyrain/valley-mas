import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { CLIMBER_CHARACTER_OPTIONS } from './characterRig';
import { CLIMBER_LEVELS } from './climberLevels';
import { createClimberPrototype } from './createClimberPrototype';
import type {
  ClimberCharacterId,
  ClimberCharacterRuntimeStatus,
  ClimberPrototypeController,
  ClimberRunStats,
} from './types';

const CONTAINER_STYLE: CSSProperties = {
  width: '100%',
  maxWidth: '980px',
  margin: '0 auto',
  padding: '28px 18px 56px',
  display: 'grid',
  gap: '18px',
};

const PANEL_STYLE: CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--theme-shell-border) 82%, transparent)',
  borderRadius: 26,
  background:
    'linear-gradient(150deg, rgba(255,255,255,0.96), color-mix(in srgb, var(--theme-primary-soft) 78%, white) 58%, rgba(255,255,255,0.94) 100%)',
  boxShadow: '0 18px 48px rgba(var(--theme-primary-rgb), 0.12)',
};

const GAME_VIEWPORT_STYLE: CSSProperties = {
  width: '100%',
  height: 'min(62vh, 560px)',
  minHeight: 380,
  borderRadius: 22,
  overflow: 'hidden',
  border: '1px solid color-mix(in srgb, var(--theme-shell-border) 78%, transparent)',
  background: '#f8fbff',
};

const TAG_STYLE: CSSProperties = {
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--theme-shell-border) 76%, white)',
  background: 'rgba(255,255,255,0.84)',
  padding: '6px 10px',
  color: '#334155',
  fontSize: 12,
  lineHeight: 1.2,
};

const GAME_SHELL_STYLE: CSSProperties = {
  position: 'relative',
  borderRadius: 22,
  overflow: 'hidden',
};

const HUD_LAYER_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  padding: 14,
  display: 'grid',
  gridTemplateRows: 'auto 1fr auto',
  gap: 10,
  pointerEvents: 'none',
};

const HUD_TOP_ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
};

const HUD_PANEL_STYLE: CSSProperties = {
  display: 'grid',
  gap: 6,
  maxWidth: 360,
  padding: '10px 12px',
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.24)',
  background: 'linear-gradient(140deg, rgba(15,23,42,0.58), rgba(15,23,42,0.38))',
  color: '#e2e8f0',
  boxShadow: '0 8px 24px rgba(2,6,23,0.25)',
  backdropFilter: 'blur(3px)',
};

const HUD_META_ROW_STYLE: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  fontSize: 12,
  lineHeight: 1.25,
  color: '#cbd5e1',
};

const HUD_PROGRESS_TRACK_STYLE: CSSProperties = {
  height: 6,
  borderRadius: 999,
  background: 'rgba(148,163,184,0.32)',
  overflow: 'hidden',
};

const HUD_BOTTOM_ROW_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-end',
  gap: 10,
  flexWrap: 'wrap',
};

const GOAL_BANNER_STYLE: CSSProperties = {
  alignSelf: 'center',
  justifySelf: 'center',
  pointerEvents: 'none',
  minWidth: 280,
  maxWidth: 'min(88%, 520px)',
  padding: '14px 18px',
  borderRadius: 16,
  border: '1px solid rgba(251,191,36,0.45)',
  background:
    'linear-gradient(160deg, rgba(15,23,42,0.76), rgba(30,41,59,0.62), rgba(15,23,42,0.76))',
  boxShadow: '0 12px 38px rgba(15,23,42,0.35)',
  textAlign: 'center',
  color: '#f8fafc',
};

const ENTER_OVERLAY_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  background:
    'linear-gradient(160deg, rgba(15,23,42,0.58), rgba(15,23,42,0.44), rgba(15,23,42,0.56))',
  color: '#fff',
  textAlign: 'center',
  backdropFilter: 'blur(2px)',
  padding: 16,
};

const PAUSE_MENU_PANEL_STYLE: CSSProperties = {
  width: 'min(92%, 560px)',
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.24)',
  background: 'linear-gradient(160deg, rgba(15,23,42,0.86), rgba(30,41,59,0.78))',
  boxShadow: '0 20px 56px rgba(2,6,23,0.48)',
  padding: '18px 16px',
  display: 'grid',
  gap: 12,
  pointerEvents: 'auto',
};

const MENU_ROW_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
};

const MENU_LABEL_STYLE: CSSProperties = {
  textAlign: 'left',
  fontSize: 12,
  color: '#cbd5e1',
  marginBottom: 6,
};

const MENU_SELECT_STYLE: CSSProperties = {
  width: '100%',
  borderRadius: 10,
  border: '1px solid rgba(148,163,184,0.55)',
  background: 'rgba(15,23,42,0.45)',
  color: '#f8fafc',
  padding: '10px 12px',
  fontSize: 13,
};

const MENU_BUTTON_PRIMARY_STYLE: CSSProperties = {
  border: 'none',
  borderRadius: 10,
  padding: '10px 14px',
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  background: 'linear-gradient(135deg, var(--theme-primary), var(--theme-primary-deep))',
};

const MENU_BUTTON_SECONDARY_STYLE: CSSProperties = {
  border: '1px solid rgba(148,163,184,0.62)',
  borderRadius: 10,
  padding: '10px 14px',
  color: '#e2e8f0',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  background: 'rgba(15,23,42,0.42)',
};

function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function formatHeight(value: number): string {
  return `${Math.max(0, value).toFixed(1)} m`;
}

function resolveCharacterRuntimeLabel(status: ClimberCharacterRuntimeStatus): string {
  switch (status) {
    case 'model-loading':
      return '模型加载中';
    case 'model-ready':
      return 'GLB 动画已就绪';
    case 'model-ready-static':
      return 'GLB 已加载(无动画)';
    case 'model-no-rig':
      return 'GLB 无骨骼(分段动画)';
    case 'model-fallback':
      return '占位角色(模型缺失)';
    case 'procedural':
    default:
      return '程序角色';
  }
}

export interface ClimberArcadeExperienceProps {
  title?: string;
}

export function ClimberArcadeExperience(props: ClimberArcadeExperienceProps) {
  const { title = 'Climber Playground' } = props;
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<ClimberPrototypeController | null>(null);
  const activeLevel = CLIMBER_LEVELS[0];
  const [activeCharacterId, setActiveCharacterId] = useState<ClimberCharacterId>('peach');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [debugCollidersVisible, setDebugCollidersVisible] = useState(false);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [hasEnteredSession, setHasEnteredSession] = useState(false);
  const [characterStatus, setCharacterStatus] =
    useState<ClimberCharacterRuntimeStatus>('procedural');

  const [stats, setStats] = useState<ClimberRunStats>({
    elapsedMs: 0,
    currentHeight: 0,
    bestHeight: 0,
    progress: 0,
    goalReached: false,
    goalReachedAtMs: null,
  });
  useEffect(() => {
    if (!mountRef.current || !activeLevel) return;
    setCharacterStatus(activeCharacterId === 'orb' ? 'procedural' : 'model-loading');
    const controller = createClimberPrototype({
      mount: mountRef.current,
      level: activeLevel,
      characterId: activeCharacterId,
      audioEnabled,
      debugCollidersVisible,
      onStats: (next) => setStats(next),
      onCharacterStatusChange: (nextStatus) => setCharacterStatus(nextStatus),
      onPointerLockChange: (locked) => {
        setPointerLocked(locked);
        if (locked) {
          setHasEnteredSession(true);
        }
      },
    });
    controllerRef.current = controller;
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, [activeCharacterId]);

  useEffect(() => {
    controllerRef.current?.setAudioEnabled(audioEnabled);
  }, [audioEnabled]);

  useEffect(() => {
    controllerRef.current?.setDebugCollidersVisible(debugCollidersVisible);
  }, [debugCollidersVisible]);

  const progressPercent = useMemo(() => Math.round((stats.progress || 0) * 100), [stats.progress]);
  const progressLabel = useMemo(
    () => `${progressPercent.toString().padStart(2, '0')}%`,
    [progressPercent],
  );
  const activeCharacter = useMemo(
    () => CLIMBER_CHARACTER_OPTIONS.find((item) => item.id === activeCharacterId),
    [activeCharacterId],
  );
  const goalTimeLabel = useMemo(
    () => (stats.goalReachedAtMs == null ? '--:--' : formatTime(stats.goalReachedAtMs)),
    [stats.goalReachedAtMs],
  );
  const currentMapName = activeLevel ? activeLevel.name : '--';
  const currentCharacterName = activeCharacter ? activeCharacter.name : '--';

  return (
    <section style={CONTAINER_STYLE}>
      <div style={{ ...PANEL_STYLE, padding: 22 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <span style={TAG_STYLE}>3D Prototype</span>
          <span style={TAG_STYLE}>Engine: Three.js</span>
          <span style={TAG_STYLE}>Mode: Single Player Jump</span>
          <span style={TAG_STYLE}>{pointerLocked ? '控制状态: 游戏中' : '控制状态: 已暂停'}</span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'start',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ maxWidth: 720 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 'clamp(1.5rem, 2.8vw, 2rem)',
                color: '#0f172a',
              }}
            >
              {title}
            </h2>
            <p style={{ margin: '8px 0 0', color: '#475569', lineHeight: 1.75, fontSize: 14 }}>
              这是单张超大地图版本，目标是构建“高空密集悬浮板块 +
              高难登顶”的核心体验。后续复杂玩法继续在 `packages/climber-game` 迭代，不污染
              `apps/web` 业务入口代码。
            </p>
            {activeLevel ? (
              <p style={{ margin: '6px 0 0', color: '#334155', fontSize: 13, lineHeight: 1.75 }}>
                当前地图：{activeLevel.name}。{activeLevel.description}
              </p>
            ) : null}
            {activeCharacter ? (
              <p style={{ margin: '4px 0 0', color: '#475569', fontSize: 12, lineHeight: 1.65 }}>
                当前角色：{activeCharacter.name}。{activeCharacter.description}
              </p>
            ) : null}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <span style={TAG_STYLE}>当前地图: {currentMapName}</span>
            <span style={TAG_STYLE}>当前角色: {currentCharacterName}</span>
            <span style={TAG_STYLE}>声音: {audioEnabled ? '开' : '关'}</span>
            <span style={TAG_STYLE}>碰撞体: {debugCollidersVisible ? '显示' : '隐藏'}</span>
            <span style={TAG_STYLE}>菜单: Esc</span>
          </div>
        </div>
      </div>

      <div style={{ ...PANEL_STYLE, padding: 12 }}>
        <div style={GAME_SHELL_STYLE}>
          <div ref={mountRef} style={GAME_VIEWPORT_STYLE} />
          <div style={HUD_LAYER_STYLE}>
            <div style={HUD_TOP_ROW_STYLE}>
              <div style={HUD_PANEL_STYLE}>
                <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 0.2 }}>
                  高度 {formatHeight(stats.currentHeight)}
                </div>
                <div style={HUD_META_ROW_STYLE}>
                  <span>最高 {formatHeight(stats.bestHeight)}</span>
                  <span>用时 {formatTime(stats.elapsedMs)}</span>
                </div>
              </div>
              <div style={{ ...HUD_PANEL_STYLE, minWidth: 208 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <strong style={{ fontSize: 13, color: '#e2e8f0' }}>进度</strong>
                  <span style={{ fontSize: 13, color: '#f8fafc' }}>{progressLabel}</span>
                </div>
                <div style={HUD_PROGRESS_TRACK_STYLE}>
                  <div
                    style={{
                      height: '100%',
                      width: `${progressPercent}%`,
                      background:
                        'linear-gradient(90deg, #38bdf8, color-mix(in srgb, var(--theme-primary) 78%, #facc15))',
                      transition: 'width 180ms ease',
                    }}
                  />
                </div>
                <div style={{ fontSize: 11, color: '#cbd5e1' }}>
                  角色状态: {resolveCharacterRuntimeLabel(characterStatus)}
                </div>
              </div>
            </div>
            {stats.goalReached ? (
              <div style={GOAL_BANNER_STYLE}>
                <div
                  style={{ fontSize: 18, fontWeight: 700, color: '#fcd34d', letterSpacing: 0.2 }}
                >
                  登顶成功
                </div>
                <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.65, color: '#e2e8f0' }}>
                  本次通关用时 {goalTimeLabel}，按“重新开始”可立刻再挑战。
                </div>
              </div>
            ) : (
              <div />
            )}
            <div style={HUD_BOTTOM_ROW_STYLE}>
              <div style={{ ...HUD_PANEL_STYLE, maxWidth: 540 }}>
                <div style={{ fontSize: 12, color: '#f8fafc', fontWeight: 600 }}>按键说明</div>
                <div style={{ fontSize: 12, lineHeight: 1.6, color: '#cbd5e1' }}>
                  W A S D / 方向键 移动 | 空格 跳跃 | Shift 冲刺 | 鼠标 视角 | 滚轮 缩放 | Esc 暂停
                </div>
              </div>
              <div style={{ ...HUD_PANEL_STYLE, maxWidth: 300 }}>
                <div style={{ fontSize: 12, color: '#f8fafc', fontWeight: 600 }}>
                  {stats.goalReached ? '已登顶' : pointerLocked ? '游戏进行中' : '已暂停'}
                </div>
                <div style={{ fontSize: 11, lineHeight: 1.6, color: '#cbd5e1' }}>
                  {stats.goalReached
                    ? '终点已触发特效与结算，你可以继续探索或重新开始。'
                    : '底部地面可站立，场景四周已加入实体边界墙。'}
                </div>
              </div>
            </div>
          </div>
          {!pointerLocked ? (
            <div style={ENTER_OVERLAY_STYLE}>
              <div style={PAUSE_MENU_PANEL_STYLE}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#f8fafc' }}>
                  {hasEnteredSession ? '暂停菜单' : '进入游戏'}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: '#cbd5e1', textAlign: 'left' }}>
                  所有游戏操作都在这里完成：切换角色、重新开始与设置。点击继续后进入第三人称操作。
                </div>

                <div style={MENU_ROW_STYLE}>
                  <div>
                    <div style={MENU_LABEL_STYLE}>角色</div>
                    <select
                      id="climber-menu-character-select"
                      value={activeCharacterId}
                      style={MENU_SELECT_STYLE}
                      onChange={(event) =>
                        setActiveCharacterId(event.target.value as ClimberCharacterId)
                      }
                    >
                      {CLIMBER_CHARACTER_OPTIONS.map((character) => (
                        <option key={character.id} value={character.id}>
                          {character.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div style={MENU_LABEL_STYLE}>地图</div>
                    <div
                      style={{
                        ...MENU_SELECT_STYLE,
                        minHeight: 41,
                        display: 'flex',
                        alignItems: 'center',
                        color: '#e2e8f0',
                        fontWeight: 600,
                      }}
                    >
                      {activeLevel?.name ?? '单图模式'}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                    gap: 10,
                  }}
                >
                  <button
                    type="button"
                    style={MENU_BUTTON_PRIMARY_STYLE}
                    onClick={() => controllerRef.current?.requestPointerLock()}
                  >
                    {hasEnteredSession ? '继续游戏' : '开始游戏'}
                  </button>
                  <button
                    type="button"
                    style={MENU_BUTTON_SECONDARY_STYLE}
                    onClick={() => {
                      const controller = controllerRef.current;
                      if (!controller) return;
                      controller.reset();
                      controller.requestPointerLock();
                    }}
                  >
                    重新开始
                  </button>
                  <button
                    type="button"
                    style={MENU_BUTTON_SECONDARY_STYLE}
                    onClick={() => setAudioEnabled((prev) => !prev)}
                  >
                    {audioEnabled ? '声音: 开' : '声音: 关'}
                  </button>
                  <button
                    type="button"
                    style={MENU_BUTTON_SECONDARY_STYLE}
                    onClick={() => setDebugCollidersVisible((prev) => !prev)}
                  >
                    {debugCollidersVisible ? '碰撞体: 开' : '碰撞体: 关'}
                  </button>
                </div>

                <div style={{ fontSize: 12, color: '#cbd5e1', textAlign: 'left', lineHeight: 1.6 }}>
                  当前角色状态: {resolveCharacterRuntimeLabel(characterStatus)}；碰撞体调试:
                  {debugCollidersVisible ? ' 开启' : ' 关闭'}。按 `Esc` 可随时回到此菜单。
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ ...PANEL_STYLE, padding: '14px 18px' }}>
        <p style={{ margin: 0, color: '#334155', fontSize: 13, lineHeight: 1.75 }}>
          单图玩法版本：场景以大量高空悬浮板块构成，目标是在一张大地图内连续跳跃并登顶；角色模型会按菜单选择加载
          `peach / daisy` 对应的 glb 资源，失败时自动回退占位角色。
        </p>
      </div>
    </section>
  );
}
