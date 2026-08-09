import { Aperture, Camera, Grid3X3, ImageDown, X } from 'lucide-react';
import type { PhotoFilter, PhotoModeState } from '../core/photo-mode';

interface PhotoModeOverlayProps {
  state: PhotoModeState;
  onChange: (changes: Partial<Omit<PhotoModeState, 'enabled'>>) => void;
  onCapture: () => void;
  onExit: () => void;
}

const filters: ReadonlyArray<{ value: PhotoFilter; label: string }> = [
  { value: 'natural', label: '自然' },
  { value: 'warm', label: '暖色' },
  { value: 'cool', label: '冷色' },
  { value: 'cinematic', label: '电影' },
];

export function PhotoModeOverlay({ state, onChange, onCapture, onExit }: PhotoModeOverlayProps) {
  if (!state.enabled) return null;
  return (
    <>
      {state.grid ? <div className="photo-grid" aria-hidden="true" /> : null}
      <aside className="photo-toolbar" aria-label="摄影模式">
        <div className="photo-toolbar-title">
          <Camera size={16} aria-hidden="true" />
          <span>摄影模式</span>
        </div>
        <div className="photo-filter-group" role="group" aria-label="照片滤镜">
          {filters.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={state.filter === value ? 'active' : undefined}
              aria-pressed={state.filter === value}
              onClick={() => onChange({ filter: value })}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="photo-tool-button"
          aria-pressed={state.grid}
          onClick={() => onChange({ grid: !state.grid })}
        >
          <Grid3X3 size={15} aria-hidden="true" />
          网格
        </button>
        <button
          type="button"
          className="photo-tool-button"
          aria-pressed={state.depthOfField}
          onClick={() => onChange({ depthOfField: !state.depthOfField })}
        >
          <Aperture size={15} aria-hidden="true" />
          景深
        </button>
        <button type="button" className="photo-capture-button" onClick={onCapture}>
          <ImageDown size={15} aria-hidden="true" />
          保存照片
        </button>
        <button
          type="button"
          className="photo-exit-button"
          aria-label="退出摄影模式"
          onClick={onExit}
        >
          <X size={17} aria-hidden="true" />
        </button>
      </aside>
    </>
  );
}
