import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';

import type { MapSession, MapSessionState } from '@/map';
import './MapEntryShell.css';

const ACCEPTANCE_SEED = 0x1a2b3c4d;

const templateCopy: Record<string, { name: string; note: string; terrain: string }> = {
  continent: { name: '主大陆', note: '一片不规则主陆与数座近海小岛', terrain: '主陆 · 卫星岛' },
  twin_continents: { name: '双大陆', note: '两片主要陆地隔海相望', terrain: '双陆 · 海峡' },
  archipelago: { name: '群岛', note: '大小岛群散布于开阔海面', terrain: '岛群 · 外海' },
  island_chain: { name: '岛链', note: '岛屿沿主方向连续延展', terrain: '长链 · 水道' },
  inland_sea: { name: '内海', note: '大陆围合一片大型海盆', terrain: '环陆 · 内海' },
  ring_continent: { name: '环形大陆', note: '陆环包围中央深水盆地', terrain: '陆环 · 海心' },
  fractured_coast: {
    name: '破碎海岸',
    note: '半岛、海湾与近岸岛屿密集交错',
    terrain: '海湾 · 半岛',
  },
  tri_continents: { name: '三洲', note: '三片独立陆地被宽阔海峡分开', terrain: '三洲 · 群岛' },
};

const stageCopy: Record<string, string> = {
  starting: '校准世界边界',
  terrain: '塑造陆地与高程',
  hydrology: '开辟海洋与水系',
  climate: '推演温度与湿度',
  biomes: '划分自然生境',
  ground: '铺设地表材质',
  objects: '播撒植被与岩石',
  validation: '校验世界事实',
  'world-view-prep': '绘制世界全景',
};

export function MapEntryShell({ session }: { readonly session: MapSession }) {
  const state = useMapSessionState(session);
  const debugSeedEnabled = useMemo(() => isDebugSeedEnabled(), []);
  const [seed, setSeed] = useState(() => initialDebugSeed());
  const [previewId, setPreviewId] = useState('continent');

  if (state.status === 'template-selection') {
    const preview = templateCopy[previewId] ?? templateCopy.continent;
    return (
      <main className="map-entry" data-map-shell="template-selection">
        <div className="map-entry__grain" aria-hidden="true" />
        <header className="map-entry__header">
          <div>
            <p className="map-entry__eyebrow">新的世界正在等你</p>
            <h1>挑一张世界蓝图</h1>
          </div>
          <p className="map-entry__brief">
            每张蓝图只决定海陆的大致关系，真正的海岸、半岛和岛屿每次都会重新生长。
          </p>
        </header>

        <section className="map-entry__atlas" aria-label="世界构型预览">
          <div className="map-entry__chart">
            <img
              src={templateConceptImage(previewId)}
              alt={`${preview.name}概念图`}
              draggable={false}
            />
            <span className="map-entry__concept-badge">{preview.terrain}</span>
          </div>
          <div className="map-entry__selection-copy" aria-live="polite">
            <h2>{preview.name}</h2>
            <p>{preview.note}</p>
          </div>
        </section>

        <section className="map-entry__chooser" aria-labelledby="template-heading">
          <div className="map-entry__chooser-heading">
            <div>
              <span>选择一个起点</span>
              <h2 id="template-heading">你想从哪里开始？</h2>
            </div>
            <p>点击后就会生成一个全新的世界</p>
          </div>
          <div className="map-entry__templates">
            {state.templates.map(({ id }) => {
              const copy = templateCopy[id] ?? { name: id, note: '', terrain: '世界构型' };
              return (
                <button
                  className="map-template"
                  data-template-id={id}
                  key={id}
                  type="button"
                  onPointerEnter={() => setPreviewId(id)}
                  onFocus={() => setPreviewId(id)}
                  onClick={() =>
                    session.generate({
                      templateId: id,
                      seed: debugSeedEnabled ? normalizeSeed(seed) : randomSeed(),
                    })
                  }
                >
                  <img src={templateConceptImage(id)} alt="" draggable={false} />
                  <span className="map-template__copy">
                    <strong>{copy.name}</strong>
                    <small>{copy.terrain}</small>
                  </span>
                  <span className="map-template__enter" aria-hidden="true">
                    选择
                  </span>
                </button>
              );
            })}
          </div>
          {debugSeedEnabled && (
            <div className="map-entry__seed" data-dev-seed-control>
              <span>开发确定性 seed</span>
              <label htmlFor="world-seed" className="sr-only">
                世界种子
              </label>
              <input
                id="world-seed"
                inputMode="numeric"
                value={seed}
                onChange={(event) => setSeed(event.target.value.replace(/\D/g, '').slice(0, 10))}
              />
              <button type="button" onClick={() => setSeed(String(randomSeed()))}>
                随机
              </button>
            </div>
          )}
        </section>
      </main>
    );
  }

  if (state.status === 'loading') {
    const percent = Math.round(state.completed * 100);
    const template = templateCopy[state.templateId] ?? templateCopy.continent;
    return (
      <main className="map-loading" data-map-shell="loading">
        <div className="map-loading__stars" aria-hidden="true" />
        <section className="map-loading__forge" aria-labelledby="loading-title">
          <div className="map-loading__orbit" aria-hidden="true">
            <span className="map-loading__orbit-ring map-loading__orbit-ring--outer" />
            <span className="map-loading__orbit-ring map-loading__orbit-ring--inner" />
            <span className="map-loading__satellite" />
            <div className="map-loading__world">
              <img src={templateConceptImage(state.templateId)} alt="" draggable={false} />
            </div>
          </div>
          <div className="map-loading__copy">
            <p>正在生成 · {template.name}</p>
            <h1 id="loading-title">{stageCopy[state.stage]}</h1>
            <div
              className="map-loading__progress"
              role="progressbar"
              aria-label="世界生成进度"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <span style={{ width: `${percent}%` }} />
            </div>
            <div className="map-loading__status">
              <span>{template.terrain}</span>
              <output>{String(percent).padStart(3, '0')}%</output>
            </div>
            <button type="button" onClick={() => session.returnToTemplateSelection()}>
              返回蓝图
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (state.status === 'failed') {
    return (
      <main className="map-failed" data-map-shell="failed">
        <p>世界绘制中断。</p>
        <div>
          <button
            type="button"
            onClick={() => session.generate({ templateId: state.templateId, seed: state.seed })}
          >
            重试本次生成
          </button>
          <button type="button" onClick={() => session.returnToTemplateSelection()}>
            返回蓝图
          </button>
        </div>
      </main>
    );
  }

  if (state.status === 'world') {
    return (
      <button
        className="map-world-back"
        data-return-template-selection
        type="button"
        onClick={() => session.returnToTemplateSelection()}
      >
        <span aria-hidden="true">←</span>
        更换世界
      </button>
    );
  }

  return null;
}

function useMapSessionState(session: MapSession): MapSessionState {
  const subscribe = useCallback((listener: () => void) => session.subscribe(listener), [session]);
  const getSnapshot = useCallback(() => session.getState(), [session]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function templateConceptImage(templateId: string): string {
  return `/map/ui/concepts/${templateId}.webp`;
}

function isDebugSeedEnabled(): boolean {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).get('mapDebug') === '1';
}

function initialDebugSeed(): string {
  const querySeed = new URLSearchParams(window.location.search).get('seed');
  return querySeed === null ? String(ACCEPTANCE_SEED) : String(normalizeSeed(querySeed));
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
}

function normalizeSeed(value: string): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed >>> 0 : randomSeed();
}
