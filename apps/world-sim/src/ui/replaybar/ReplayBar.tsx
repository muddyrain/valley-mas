import { useCallback, useMemo, useRef } from 'react';
import { formatGameTime, REPLAY_SPEED_TIERS, type ReplaySpeed } from '@/shared/types';
import { computeReplayEventAnchors, type ReplayEventAnchor, useWorldSimStore } from '@/state';
import styles from './ReplayBar.module.css';

const REPLAY_EVENT_ANCHOR_LIMIT = 8;

export function ReplayBar() {
  const replayMode = useWorldSimStore((s) => s.replayMode);
  const replayPlaying = useWorldSimStore((s) => s.replayPlaying);
  const replaySpeed = useWorldSimStore((s) => s.replaySpeed);
  const replayCursor = useWorldSimStore((s) => s.replayCursor);
  const replayFrames = useWorldSimStore((s) => s.replayFrames);
  const replayMessage = useWorldSimStore((s) => s.replayMessage);
  const enterReplayMode = useWorldSimStore((s) => s.enterReplayMode);
  const exitReplayMode = useWorldSimStore((s) => s.exitReplayMode);
  const toggleReplayPlay = useWorldSimStore((s) => s.toggleReplayPlay);
  const setReplaySpeed = useWorldSimStore((s) => s.setReplaySpeed);
  const stepReplay = useWorldSimStore((s) => s.stepReplay);
  const seekReplay = useWorldSimStore((s) => s.seekReplay);
  const exportReplayToJson = useWorldSimStore((s) => s.exportReplayToJson);
  const exportReplaySummaryToJson = useWorldSimStore((s) => s.exportReplaySummaryToJson);
  const importReplayFromJson = useWorldSimStore((s) => s.importReplayFromJson);
  const status = useWorldSimStore((s) => s.status);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const total = replayFrames.length;
  const isReplay = replayMode === 'replaying';
  const atEnd = isReplay && replayCursor >= total;
  const eventAnchors = useMemo(
    () => computeReplayEventAnchors(replayFrames, REPLAY_EVENT_ANCHOR_LIMIT),
    [replayFrames],
  );

  const onSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      if (Number.isFinite(v)) seekReplay(v);
    },
    [seekReplay],
  );

  const onPickSpeed = useCallback((s: ReplaySpeed) => () => setReplaySpeed(s), [setReplaySpeed]);
  const onPickEventAnchor = useCallback((cursor: number) => () => seekReplay(cursor), [seekReplay]);

  const handleExport = useCallback(() => {
    const json = exportReplayToJson();
    if (!json) return;
    downloadJsonFile(json, 'worldsim-replay');
  }, [exportReplayToJson]);

  const handleExportSummary = useCallback(() => {
    const json = exportReplaySummaryToJson();
    if (!json) return;
    downloadJsonFile(json, 'worldsim-summary');
  }, [exportReplaySummaryToJson]);

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
        importReplayFromJson(text);
      };
      reader.readAsText(file);
    },
    [importReplayFromJson],
  );

  const recordingHint = useMemo(() => {
    if (isReplay) return null;
    if (total === 0) return '尚未录制任何内容，开始推演后将自动录制每季';
    return `已录制 ${total} 季 · 状态：${status}`;
  }, [isReplay, total, status]);

  const cursorMax = Math.max(total, 1);

  return (
    <div className={styles.bar} data-mode={replayMode}>
      <div className={styles.left}>
        <span className={styles.title}>Replay</span>
        <span className={styles.modeChip} data-mode={replayMode}>
          {replayMode === 'replaying' ? '回放中' : '录制中'}
        </span>
        <span className={styles.cursor}>
          {replayCursor} / {total}
        </span>
      </div>

      <div className={styles.center}>
        {isReplay ? (
          <>
            <button
              type="button"
              onClick={() => stepReplay(-1)}
              disabled={replayCursor <= 0}
              title="后退 1 季"
            >
              {'<'}
            </button>
            <button
              type="button"
              onClick={toggleReplayPlay}
              disabled={atEnd}
              className={styles.primaryBtn}
              title={replayPlaying ? '暂停回放' : '继续回放'}
            >
              {replayPlaying ? '暂停' : '播放'}
            </button>
            <button type="button" onClick={() => stepReplay(1)} disabled={atEnd} title="前进 1 季">
              {'>'}
            </button>
            <input
              type="range"
              min={0}
              max={cursorMax}
              step={1}
              value={replayCursor}
              onChange={onSeek}
              className={styles.timeline}
              aria-label="回放时间轴"
            />
            {eventAnchors.length > 0 && (
              <div className={styles.eventJumps}>
                {eventAnchors.map((anchor) => (
                  <button
                    key={`${anchor.cursor}-${anchor.category}-${anchor.message}`}
                    type="button"
                    className={styles.eventJumpBtn}
                    data-active={replayCursor === anchor.cursor}
                    title={anchor.message}
                    onClick={onPickEventAnchor(anchor.cursor)}
                  >
                    {formatReplayAnchor(anchor)}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <span className={styles.hint}>{recordingHint}</span>
        )}
      </div>

      <div className={styles.right}>
        {isReplay && (
          <div className={styles.speedGroup} title="回放倍速">
            {REPLAY_SPEED_TIERS.map((tier) => (
              <button
                key={tier}
                type="button"
                data-active={replaySpeed === tier}
                className={styles.speedBtn}
                onClick={onPickSpeed(tier)}
              >
                {tier}
              </button>
            ))}
          </div>
        )}
        {isReplay ? (
          <button type="button" onClick={exitReplayMode} title="退出回放，回到录制模式">
            退出回放
          </button>
        ) : (
          <button
            type="button"
            onClick={enterReplayMode}
            disabled={total === 0}
            className={styles.primaryBtn}
            title={total === 0 ? '尚无可回放帧' : '进入回放模式'}
          >
            进入回放
          </button>
        )}
        <button
          type="button"
          onClick={handleExportSummary}
          disabled={total === 0}
          title="导出摘要 JSON"
        >
          摘要
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={total === 0}
          title="导出 Replay JSON"
        >
          导出
        </button>
        <button type="button" onClick={handleImportPick} title="导入 Replay JSON">
          导入
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImportFile}
          style={{ display: 'none' }}
        />
      </div>

      {replayMessage && <div className={styles.message}>{replayMessage}</div>}
    </div>
  );
}

function downloadJsonFile(json: string, prefix: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  a.href = url;
  a.download = `${prefix}-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatReplayAnchor(anchor: ReplayEventAnchor): string {
  return `${formatGameTime(anchor.tick)} ${replayAnchorLabel(anchor.category)}`;
}

function replayAnchorLabel(category: ReplayEventAnchor['category']): string {
  switch (category) {
    case 'capital':
      return '都城';
    case 'eliminate':
      return '灭国';
    case 'victory':
      return '统一';
    case 'stalemate':
      return '僵局';
    case 'revolt':
      return '叛乱';
    case 'divine':
      return '神力';
    case 'diplomacy':
      return '战争';
    default:
      return '事件';
  }
}
