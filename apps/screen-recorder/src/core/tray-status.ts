import type { RecordingState } from './state-machine';

export function getTrayRecordingStatus(
  state: RecordingState,
  startedAt?: number,
  countdownEndsAt?: number,
  now = Date.now(),
) {
  const seconds = Math.max(0, Math.floor((now - (startedAt ?? now)) / 1000));
  const elapsed = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  if (state === 'countdown') {
    const remaining = Math.max(0, Math.ceil(((countdownEndsAt ?? now) - now) / 1000));
    return {
      title: `准备 ${remaining}`,
      label: `准备录制 · ${remaining} 秒`,
      tooltip: '点击打开取消菜单',
    };
  }
  if (state === 'recording')
    return {
      title: `● ${elapsed}`,
      label: `正在录制 · ${elapsed}`,
      tooltip: `正在录制 ${elapsed} · 点击打开停止菜单`,
    };
  if (state === 'stopping')
    return { title: '保存中…', label: '正在保存录屏…', tooltip: '正在保存录屏，请稍候' };
  return { title: '', label: 'Valley Screen Recorder', tooltip: 'Valley Screen Recorder' };
}
