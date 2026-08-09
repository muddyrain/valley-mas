import { describe, expect, it } from 'vitest';
import { createRecordingState, recordingReducer, selectWebmMimeType } from './recording';

describe('recording helpers', () => {
  it('按优先级选择浏览器真实支持的 WebM MIME', () => {
    const supported = new Set(['video/webm;codecs=vp8,opus', 'video/webm']);
    expect(selectWebmMimeType((type) => supported.has(type))).toBe('video/webm;codecs=vp8,opus');
    expect(selectWebmMimeType(() => false)).toBeNull();
  });

  it('录制中拒绝重复开始并能完成到可下载状态', () => {
    const started = recordingReducer(createRecordingState(), {
      type: 'start',
      durationSeconds: 10,
    });
    const duplicate = recordingReducer(started, { type: 'start', durationSeconds: 10 });
    const complete = recordingReducer(started, { type: 'complete', url: 'blob:test' });

    expect(started.status).toBe('recording');
    expect(duplicate).toBe(started);
    expect(complete).toMatchObject({ status: 'ready', downloadUrl: 'blob:test' });
  });
});
