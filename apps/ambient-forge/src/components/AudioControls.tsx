import { FileAudio, Pause, Play, Trash2, Upload } from 'lucide-react';
import { useRef } from 'react';
import type { AudioUiState } from '../audio/AudioEngine';

interface AudioControlsProps {
  state: AudioUiState;
  musicVolume: number;
  responseStrength: number;
  onFile: (file: File) => void;
  onToggle: () => void;
  onSeek: (progress: number) => void;
  onVolume: (value: number) => void;
  onResponse: (value: number) => void;
  onClear: () => void;
}

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
};

export function AudioControls({
  state,
  musicVolume,
  responseStrength,
  onFile,
  onToggle,
  onSeek,
  onVolume,
  onResponse,
  onClear,
}: AudioControlsProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const progress = state.duration > 0 ? state.currentTime / state.duration : 0;

  return (
    <section className="panel-section" aria-labelledby="music-heading">
      <div className="section-heading">
        <FileAudio size={15} aria-hidden="true" />
        <h2 id="music-heading">本地音乐</h2>
      </div>
      <input
        ref={inputRef}
        hidden
        className="visually-hidden"
        type="file"
        accept="audio/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.currentTarget.value = '';
        }}
      />
      {state.fileName ? (
        <div className="track-card">
          <div className="track-copy">
            <span className="track-name" title={state.fileName}>
              {state.fileName}
            </span>
            <span className="track-time">
              {formatTime(state.currentTime)} / {formatTime(state.duration)}
            </span>
          </div>
          <div className="track-actions">
            <button
              type="button"
              className="icon-button primary"
              aria-label={state.playing ? '暂停音乐' : '播放音乐'}
              onClick={onToggle}
            >
              {state.playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button type="button" className="icon-button" aria-label="清除音乐" onClick={onClear}>
              <Trash2 size={16} />
            </button>
          </div>
          <label className="range-field track-progress">
            <span className="visually-hidden">播放进度</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={progress}
              onChange={(event) => onSeek(Number(event.target.value))}
            />
          </label>
        </div>
      ) : (
        <button type="button" className="upload-button" onClick={() => inputRef.current?.click()}>
          <Upload size={16} aria-hidden="true" />
          选择音乐
        </button>
      )}
      {state.error ? <p className="inline-error">{state.error}</p> : null}
      <label className="range-field">
        <span>
          音乐音量 <output>{Math.round(musicVolume * 100)}%</output>
        </span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={musicVolume}
          onChange={(event) => onVolume(Number(event.target.value))}
        />
      </label>
      <label className="range-field">
        <span>
          场景响应 <output>{Math.round(responseStrength * 100)}%</output>
        </span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={responseStrength}
          onChange={(event) => onResponse(Number(event.target.value))}
        />
      </label>
    </section>
  );
}
