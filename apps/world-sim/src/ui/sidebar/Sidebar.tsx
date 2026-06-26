import { useCallback, useMemo, useRef, useState } from 'react';
import type { MapModeId, TerrainKind } from '@/core/map';
import { MAP_MODE_IDS, MAP_MODE_REGISTRY, TERRAIN_KINDS, TERRAIN_LABEL } from '@/core/map';
import {
  buildFrontPressureState,
  type FactionFrontPressureSummary,
  type FrontPressureLevel,
  summarizeFactionFrontPressure,
} from '@/core/sim';
import type { FactionId, FactionSummary, RegionId } from '@/shared/types';
import type { EditTool, ProvincePreset } from '@/state';
import { computeFactionRankings, PROVINCE_PRESETS, useWorldSimStore } from '@/state';
import styles from './Sidebar.module.css';

const EDIT_TOOLS: Array<{ id: EditTool; label: string; hint: string }> = [
  { id: 'paint-owner', label: '涂抹归属', hint: '把州划给当前编辑势力，可拖拽批量' },
  { id: 'erase-owner', label: '清空归属', hint: '把州变回无主' },
  { id: 'set-birth', label: '设为出生', hint: '把当前编辑势力的出生点改为该州' },
  { id: 'paint-terrain', label: '涂抹地形', hint: '把州地形改为当前选中地形' },
  { id: 'inspect', label: '只读', hint: '不做任何修改，仅查看' },
];

export function Sidebar() {
  const factions = useWorldSimStore((s) => s.factions);
  const selectedFactionId = useWorldSimStore((s) => s.selectedFactionId);
  const selectFaction = useWorldSimStore((s) => s.selectFaction);
  const createFaction = useWorldSimStore((s) => s.createFaction);
  const removeFaction = useWorldSimStore((s) => s.removeFaction);
  const renameFaction = useWorldSimStore((s) => s.renameFaction);
  const recolorFaction = useWorldSimStore((s) => s.recolorFaction);
  const respawnFaction = useWorldSimStore((s) => s.respawnFaction);
  const resetFactions = useWorldSimStore((s) => s.resetFactions);
  const mode = useWorldSimStore((s) => s.mode);

  const map = useWorldSimStore((s) => s.map);
  const seed = useWorldSimStore((s) => s.seed);
  const provinceCount = useWorldSimStore((s) => s.provinceCount);
  const lastGenerateMs = useWorldSimStore((s) => s.lastGenerateMs);
  const hoveredRegionId = useWorldSimStore((s) => s.hoveredRegionId);
  const selectedRegionId = useWorldSimStore((s) => s.selectedRegionId);
  const setSeed = useWorldSimStore((s) => s.setSeed);
  const setProvinceCount = useWorldSimStore((s) => s.setProvinceCount);
  const regenerateMap = useWorldSimStore((s) => s.regenerateMap);
  const mapMode = useWorldSimStore((s) => s.mapMode);
  const setMapMode = useWorldSimStore((s) => s.setMapMode);
  const frontPressureOverlayVisible = useWorldSimStore((s) => s.frontPressureOverlayVisible);
  const toggleFrontPressureOverlay = useWorldSimStore((s) => s.toggleFrontPressureOverlay);

  const currentScenarioId = useWorldSimStore((s) => s.currentScenarioId);
  const scenarioUnresolvedCount = useWorldSimStore((s) => s.scenarioUnresolvedCount);
  const loadScenario = useWorldSimStore((s) => s.loadScenario);
  const listAvailableScenarios = useWorldSimStore((s) => s.listAvailableScenarios);
  const randomScenarioOptions = useWorldSimStore((s) => s.randomScenarioOptions);
  const setRandomScenarioOptions = useWorldSimStore((s) => s.setRandomScenarioOptions);
  const scenarios = useMemo(() => listAvailableScenarios(), [listAvailableScenarios]);

  const worldMode = useWorldSimStore((s) => s.worldMode);
  const editTool = useWorldSimStore((s) => s.editTool);
  const editFactionId = useWorldSimStore((s) => s.editFactionId);
  const editTerrain = useWorldSimStore((s) => s.editTerrain);
  const lastEditMessage = useWorldSimStore((s) => s.lastEditMessage);
  const setEditTool = useWorldSimStore((s) => s.setEditTool);
  const setEditFaction = useWorldSimStore((s) => s.setEditFaction);
  const setEditTerrain = useWorldSimStore((s) => s.setEditTerrain);
  const exportMapToJson = useWorldSimStore((s) => s.exportMapToJson);
  const importMapFromJson = useWorldSimStore((s) => s.importMapFromJson);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const rankings = useMemo(() => computeFactionRankings(factions, map), [factions, map]);
  const frontPressureSummaries = useMemo(() => {
    if (!map) return new Map<FactionId, FactionFrontPressureSummary>();
    const liveFactions = factions.filter((f) => (f.regions ?? 0) > 0);
    const frontPressureState = buildFrontPressureState({
      map,
      factions: liveFactions.map((f) => ({
        id: f.id,
        regions: f.regions ?? 0,
        centroidRegionId: f.centroidRegionId ?? f.capitalRegionId,
      })),
      ownedTargetPreference: 0,
    });
    return new Map(
      liveFactions.map((f) => [
        f.id,
        summarizeFactionFrontPressure({
          state: frontPressureState,
          faction: {
            id: f.id,
            regions: f.regions ?? 0,
            centroidRegionId: f.centroidRegionId ?? f.capitalRegionId,
          },
        }),
      ]),
    );
  }, [factions, map]);
  const factionNameById = useMemo(() => new Map(factions.map((f) => [f.id, f.name])), [factions]);

  const [seedDraft, setSeedDraft] = useState(seed);
  const [newFactionName, setNewFactionName] = useState('');
  const [renameDraft, setRenameDraft] = useState<{ id: FactionId; value: string } | null>(null);

  const handleApplySeed = useCallback(() => {
    const trimmed = seedDraft.trim();
    if (trimmed.length === 0) return;
    setSeed(trimmed);
    regenerateMap({ seed: trimmed });
  }, [seedDraft, setSeed, regenerateMap]);

  const handleRandomSeed = useCallback(() => {
    const next = `seed-${Math.floor(Math.random() * 1e9).toString(36)}`;
    setSeedDraft(next);
    setSeed(next);
    regenerateMap({ seed: next });
  }, [setSeed, regenerateMap]);

  const handleSelectCount = useCallback(
    (count: ProvincePreset) => {
      setProvinceCount(count);
      regenerateMap({ provinceCount: count });
    },
    [setProvinceCount, regenerateMap],
  );

  const handleSelectScenario = useCallback(
    (id: string) => {
      if (id === currentScenarioId) {
        // 同剧本再次点击：当作"重置开局"重新随机出生
        loadScenario(id);
        return;
      }
      loadScenario(id);
    },
    [currentScenarioId, loadScenario],
  );

  const handlePickMapMode = useCallback(
    (id: MapModeId) => {
      setMapMode(id);
    },
    [setMapMode],
  );

  const handleCreateFaction = useCallback(() => {
    createFaction({ name: newFactionName });
    setNewFactionName('');
  }, [createFaction, newFactionName]);

  const handleStartRename = useCallback((faction: FactionSummary) => {
    setRenameDraft({ id: faction.id, value: faction.name });
  }, []);

  const handleCommitRename = useCallback(() => {
    if (!renameDraft) return;
    renameFaction(renameDraft.id, renameDraft.value);
    setRenameDraft(null);
  }, [renameDraft, renameFaction]);

  const handleExportMap = useCallback(() => {
    const json = exportMapToJson();
    if (!json) return;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `worldsim-map-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [exportMapToJson]);

  const handleImportPick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result : '';
        importMapFromJson(text);
      };
      reader.readAsText(file);
    },
    [importMapFromJson],
  );

  const inspector = useMemo(
    () => buildInspectorText(map, selectedRegionId, hoveredRegionId, factions),
    [map, selectedRegionId, hoveredRegionId, factions],
  );

  const terrainCounts = useMemo(() => buildTerrainCounts(map), [map]);

  return (
    <div className={styles.root}>
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <span>地图模式</span>
        </header>
        <div className={styles.sourceGroup}>
          {MAP_MODE_IDS.map((id) => {
            const src = MAP_MODE_REGISTRY[id];
            const active = mapMode === id;
            return (
              <button
                key={id}
                type="button"
                className={styles.sourceBtn}
                data-active={active}
                onClick={() => handlePickMapMode(id)}
                title={src.description}
              >
                <span className={styles.sourceName}>{src.name}</span>
                <span className={styles.sourceMeta}>{src.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <span>地图</span>
          {map && (
            <span className={styles.muted}>
              {map.meta.provinceCount} 州 · {lastGenerateMs.toFixed(0)} ms
            </span>
          )}
        </header>
        <button
          type="button"
          className={styles.overlayToggle}
          data-active={frontPressureOverlayVisible}
          disabled={!map}
          onClick={toggleFrontPressureOverlay}
        >
          前线压力
        </button>
        <div className={styles.controlGroup}>
          <label className={styles.fieldLabel}>种子</label>
          <div className={styles.seedRow}>
            <input
              className={styles.seedInput}
              value={seedDraft}
              onChange={(e) => setSeedDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApplySeed();
              }}
              placeholder="seed 字符串"
            />
            <button type="button" onClick={handleApplySeed} disabled={seedDraft.trim() === ''}>
              生成
            </button>
            <button type="button" onClick={handleRandomSeed} title="生成随机种子并刷新">
              随机
            </button>
          </div>
        </div>
        <div className={styles.controlGroup}>
          <label className={styles.fieldLabel}>规模</label>
          <div className={styles.presetGroup}>
            {PROVINCE_PRESETS.map((count) => (
              <button
                key={count}
                type="button"
                className={styles.presetBtn}
                data-active={provinceCount === count}
                onClick={() => handleSelectCount(count)}
              >
                {count}
              </button>
            ))}
          </div>
        </div>
        {map && (
          <div className={styles.metaList}>
            <div>
              <span className={styles.metaLabel}>边界数</span>
              <span className={styles.metaValue}>{map.borders.length}</span>
            </div>
            <div>
              <span className={styles.metaLabel}>松弛轮次</span>
              <span className={styles.metaValue}>{map.meta.relaxIterations}</span>
            </div>
            <div>
              <span className={styles.metaLabel}>地图尺寸</span>
              <span className={styles.metaValue}>
                {map.meta.bounds.width}×{map.meta.bounds.height}
              </span>
            </div>
          </div>
        )}
        {map && (
          <div className={styles.metaList}>
            {TERRAIN_KINDS.map((kind) => (
              <div key={kind}>
                <span className={styles.metaLabel}>{TERRAIN_LABEL[kind]}</span>
                <span className={styles.metaValue}>{terrainCounts[kind] ?? 0}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <span>剧本</span>
          {scenarioUnresolvedCount > 0 && (
            <span className={styles.muted}>未满足 {scenarioUnresolvedCount}</span>
          )}
        </header>
        <div className={styles.scenarioGroup}>
          {scenarios.map((s) => (
            <button
              key={s.id}
              type="button"
              className={styles.scenarioBtn}
              data-active={currentScenarioId === s.id}
              onClick={() => handleSelectScenario(s.id)}
              title={s.description ?? s.name}
              disabled={!map}
            >
              <span className={styles.scenarioName}>{s.name}</span>
              <span className={styles.scenarioMeta}>
                {s.factionsFactory ? '随机' : `${s.factions.length} 家`}
              </span>
            </button>
          ))}
        </div>
        {currentScenarioId === 'random' && (
          <div className={styles.scenarioOptions}>
            <span className={styles.scenarioOptionsTitle}>随机剧本来源</span>
            <label
              className={styles.scenarioOptionRow}
              data-disabled={
                randomScenarioOptions.includeChinese && !randomScenarioOptions.includeForeign
                  ? 'true'
                  : undefined
              }
            >
              <input
                type="checkbox"
                checked={randomScenarioOptions.includeChinese}
                onChange={(e) => setRandomScenarioOptions({ includeChinese: e.target.checked })}
                disabled={
                  randomScenarioOptions.includeChinese && !randomScenarioOptions.includeForeign
                }
              />
              中国朝代（蜀汉 / 大唐 / 大明 …）
            </label>
            <label
              className={styles.scenarioOptionRow}
              data-disabled={
                randomScenarioOptions.includeForeign && !randomScenarioOptions.includeChinese
                  ? 'true'
                  : undefined
              }
            >
              <input
                type="checkbox"
                checked={randomScenarioOptions.includeForeign}
                onChange={(e) => setRandomScenarioOptions({ includeForeign: e.target.checked })}
                disabled={
                  randomScenarioOptions.includeForeign && !randomScenarioOptions.includeChinese
                }
              />
              国外政体（法兰西帝国 / 罗马帝国 …）
            </label>
          </div>
        )}
        <p className={styles.empty}>
          点击切换剧本，或再次点击当前剧本以重新随机出生。地图刷新时会自动应用当前剧本。
        </p>
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <span>编辑</span>
          <span className={styles.muted}>{worldMode === 'edit' ? '编辑模式' : '观察模式'}</span>
        </header>
        <div className={styles.toolGroup}>
          {EDIT_TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={styles.toolBtn}
              data-active={editTool === t.id}
              disabled={worldMode !== 'edit'}
              onClick={() => setEditTool(t.id)}
              title={t.hint}
            >
              {t.label}
            </button>
          ))}
        </div>
        {(editTool === 'paint-owner' || editTool === 'set-birth') && (
          <div className={styles.controlGroup}>
            <label className={styles.fieldLabel}>编辑势力</label>
            <select
              className={styles.editSelect}
              value={editFactionId == null ? '' : String(editFactionId as unknown as number)}
              disabled={worldMode !== 'edit' || factions.length === 0}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                  setEditFaction(null);
                } else {
                  const idNum = Number(raw);
                  const target = factions.find((f) => (f.id as unknown as number) === idNum);
                  setEditFaction(target ? target.id : null);
                }
              }}
            >
              <option value="">未选择</option>
              {factions.map((f) => (
                <option key={f.id} value={String(f.id as unknown as number)}>
                  {f.name}（{f.leader}）
                </option>
              ))}
            </select>
          </div>
        )}
        {editTool === 'paint-terrain' && (
          <div className={styles.terrainGroup}>
            {TERRAIN_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                className={styles.terrainBtn}
                data-active={editTerrain === k}
                disabled={worldMode !== 'edit'}
                onClick={() => setEditTerrain(k)}
              >
                {TERRAIN_LABEL[k]}
              </button>
            ))}
          </div>
        )}
        <div className={styles.editIoRow}>
          <button type="button" onClick={handleExportMap} disabled={!map}>
            导出 JSON
          </button>
          <button type="button" onClick={handleImportPick}>
            导入 JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className={styles.editFileInput}
            onChange={handleImportFile}
          />
        </div>
        <p className={styles.empty}>
          {worldMode === 'edit'
            ? '左键涂抹，右键拖拽地图。涂抹工具支持按住批量。'
            : '切换到 Edit 模式后可点击地图修改归属、地形与出生点。'}
        </p>
        {lastEditMessage && <p className={styles.editMessage}>{lastEditMessage}</p>}
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <span>检视</span>
        </header>
        <div className={styles.inspector}>
          <pre className={styles.inspectorText}>{inspector}</pre>
        </div>
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <span>势力</span>
          <span className={styles.muted}>{factions.length}</span>
        </header>
        <div className={styles.factionForm}>
          <input
            className={styles.seedInput}
            value={newFactionName}
            onChange={(e) => setNewFactionName(e.target.value)}
            placeholder="名称（留空自动取）"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateFaction();
            }}
          />
          <button type="button" onClick={handleCreateFaction}>
            新建
          </button>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={resetFactions}
            title="清空所有势力并恢复默认四家"
          >
            重置
          </button>
        </div>
        {factions.length === 0 ? (
          <p className={styles.empty}>暂无势力。点击「新建」或在输入框填名后回车。</p>
        ) : (
          <ul className={styles.factionList}>
            {factions.map((f) => {
              const isActive = selectedFactionId === f.id;
              const isRenaming = renameDraft?.id === f.id;
              const isDead = (f.regions ?? 0) === 0;
              const frontPressureSummary = frontPressureSummaries.get(f.id);
              return (
                <li
                  key={f.id}
                  className={styles.factionRow}
                  data-active={isActive}
                  data-dead={isDead}
                >
                  <button
                    type="button"
                    className={styles.factionItem}
                    data-active={isActive}
                    data-dead={isDead}
                    onClick={() => selectFaction(isActive ? null : f.id)}
                  >
                    <span className={styles.colorDot} style={{ backgroundColor: f.colorHex }} />
                    <span className={styles.factionName}>{f.name}</span>
                    <span className={styles.factionLeader}>{f.leader}</span>
                    <span className={styles.factionStat}>
                      {isDead ? '已灭' : `区 ${f.regions}`}
                    </span>
                  </button>
                  <div className={styles.factionActions}>
                    {isRenaming ? (
                      <>
                        <input
                          className={styles.renameInput}
                          // biome-ignore lint/a11y/noAutofocus: 改名输入框唤起后立即可输入，是用户预期的临时焦点
                          autoFocus
                          value={renameDraft.value}
                          onChange={(e) => setRenameDraft({ id: f.id, value: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCommitRename();
                            if (e.key === 'Escape') setRenameDraft(null);
                          }}
                        />
                        <button type="button" onClick={handleCommitRename}>
                          保存
                        </button>
                        <button
                          type="button"
                          className={styles.ghostBtn}
                          onClick={() => setRenameDraft(null)}
                        >
                          取消
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => handleStartRename(f)}>
                          改名
                        </button>
                        <button type="button" onClick={() => recolorFaction(f.id)}>
                          换色
                        </button>
                        <button
                          type="button"
                          onClick={() => respawnFaction(f.id)}
                          disabled={!map}
                          title={map ? '随机分配出生州' : '请先生成地图'}
                        >
                          重摇出生
                        </button>
                        <button
                          type="button"
                          className={styles.dangerBtn}
                          onClick={() => removeFaction(f.id)}
                        >
                          删除
                        </button>
                      </>
                    )}
                  </div>
                  {isActive && (
                    <FrontPressureCard
                      summary={frontPressureSummary}
                      factionNameById={factionNameById}
                      isDead={isDead}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <span>排行榜</span>
          <span className={styles.muted}>按州数</span>
        </header>
        {rankings.length === 0 ? (
          <p className={styles.empty}>暂无势力。</p>
        ) : (
          <ol className={styles.rankList}>
            {rankings.map((entry) => (
              <li key={entry.id} className={styles.rankRow}>
                <span className={styles.rankIndex}>{entry.rank}</span>
                <span className={styles.colorDot} style={{ backgroundColor: entry.colorHex }} />
                <span className={styles.rankName}>{entry.name}</span>
                <span className={styles.rankLeader}>{entry.leader}</span>
                <span className={styles.rankStat}>
                  {entry.regions} 州 · {(entry.share * 100).toFixed(1)}%
                </span>
                <span className={styles.rankSub}>边 {entry.borderLength}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <span>模式</span>
        </header>
        <p className={styles.empty}>当前：{mode === 'live' ? '实时推演' : '回放模式'}</p>
      </section>
    </div>
  );
}

function FrontPressureCard({
  summary,
  factionNameById,
  isDead,
}: {
  summary: FactionFrontPressureSummary | undefined;
  factionNameById: Map<FactionId, string>;
  isDead: boolean;
}) {
  if (isDead) {
    return <p className={styles.frontPressureEmpty}>势力已灭</p>;
  }
  if (!summary || summary.frontCount === 0) {
    return <p className={styles.frontPressureEmpty}>暂无接敌前线</p>;
  }

  const risk = summary.highestRiskFront;
  const riskEnemyName = risk ? (factionNameById.get(risk.enemyId) ?? '未知势力') : '未知势力';

  return (
    <div className={styles.frontPressureCard}>
      <div className={styles.frontPressureHead}>
        <span>前线压力</span>
        <span data-level={summary.pressureLevel}>
          {PRESSURE_LEVEL_LABEL[summary.pressureLevel]}
        </span>
      </div>
      <div className={styles.frontPressureGrid}>
        <div>
          <span className={styles.frontPressureLabel}>接敌</span>
          <span className={styles.frontPressureValue}>{summary.frontCount} 条</span>
        </div>
        <div>
          <span className={styles.frontPressureLabel}>补给</span>
          <span className={styles.frontPressureValue}>{formatPercent(summary.averageSupply)}</span>
        </div>
        <div>
          <span className={styles.frontPressureLabel}>多线</span>
          <span className={styles.frontPressureValue}>
            -{formatPercent(summary.multiFrontPenalty)}
          </span>
        </div>
        <div>
          <span className={styles.frontPressureLabel}>潜力</span>
          <span className={styles.frontPressureValue}>{Math.round(summary.totalWarPotential)}</span>
        </div>
      </div>
      {risk && (
        <div className={styles.frontPressureRisk}>
          <span className={styles.frontPressureLabel}>最高风险</span>
          <span className={styles.frontPressureValue}>
            对 {riskEnemyName} · {Math.round(risk.myPower)}:{Math.round(risk.enemyPower)}
          </span>
        </div>
      )}
    </div>
  );
}

const PRESSURE_LEVEL_LABEL: Record<FrontPressureLevel, string> = {
  none: '无',
  low: '边境稳定',
  medium: '多线牵制',
  high: '腹背受敌',
};

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function buildInspectorText(
  map: ReturnType<typeof useWorldSimStore.getState>['map'],
  selectedRegionId: RegionId | null,
  hoveredRegionId: RegionId | null,
  factions: FactionSummary[],
): string {
  if (!map) {
    return '尚未生成地图。';
  }
  const target = selectedRegionId ?? hoveredRegionId;
  if (target == null) {
    return '将光标移到地图上查看悬停信息，或点击州查看详情。';
  }
  const province = map.provinces[target];
  if (!province) return '州不存在。';
  const role = selectedRegionId === target ? '已选中' : '悬停中';
  const ownerLabel = ownerLabelOf(province.ownerFactionId, factions);
  const headLabel = `州 #${province.id}`;
  return [
    `${role}：${headLabel}`,
    `地形：${TERRAIN_LABEL[province.terrain]}`,
    `海拔：${province.elevation.toFixed(2)}`,
    `湿度：${province.moisture.toFixed(2)}`,
    `站点：(${province.site.x.toFixed(1)}, ${province.site.y.toFixed(1)})`,
    `重心：(${province.centroid.x.toFixed(1)}, ${province.centroid.y.toFixed(1)})`,
    `邻接：${province.neighbors.length} 个`,
    `边界段：${province.borderEdgeIds.length} 段`,
    `所属势力：${ownerLabel}`,
  ].join('\n');
}

function ownerLabelOf(ownerFactionId: FactionId | null, factions: FactionSummary[]): string {
  if (ownerFactionId == null) return '无主';
  const owner = factions.find((f) => f.id === ownerFactionId);
  if (!owner) return `#${ownerFactionId as unknown as number}（已删除）`;
  return `${owner.name}（${owner.leader}）`;
}

function buildTerrainCounts(
  map: ReturnType<typeof useWorldSimStore.getState>['map'],
): Record<TerrainKind, number> {
  const counts: Record<TerrainKind, number> = {
    plain: 0,
    forest: 0,
    mountain: 0,
    desert: 0,
    river: 0,
    ocean: 0,
  };
  if (!map) return counts;
  for (const province of map.provinces) {
    counts[province.terrain] += 1;
  }
  return counts;
}
