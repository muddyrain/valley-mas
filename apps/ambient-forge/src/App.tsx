import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AudioEngine, type AudioUiState } from './audio/AudioEngine';
import { AmbientCanvas } from './components/AmbientCanvas';
import { AudioControls } from './components/AudioControls';
import { ControlPanel } from './components/ControlPanel';
import { DebugOverlay } from './components/DebugOverlay';
import { PhotoModeOverlay } from './components/PhotoModeOverlay';
import { RecordingControls } from './components/RecordingControls';
import {
  type AmbientInputs,
  createDefaultAmbientInputs,
  getLocalTimeOfDay,
} from './core/ambient-inputs';
import {
  type CameraTourState,
  type CameraViewId,
  DEFAULT_CAMERA_TOUR_STATE,
} from './core/camera-tour';
import { type EnvironmentPresetId, getEnvironmentPresetChanges } from './core/environment-presets';
import {
  DEFAULT_NPC_CAMERA_STATE,
  type NpcCameraState,
  type NpcId,
  type NpcViewMode,
} from './core/npc';
import {
  DEFAULT_PHOTO_MODE_STATE,
  type PhotoModeState,
  setPhotoModeEnabled,
  updatePhotoModeSettings,
} from './core/photo-mode';
import {
  type AmbientPreferences,
  DEFAULT_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  parsePreferences,
  serializePreferences,
} from './core/preferences';
import {
  createRecordingFileName,
  createRecordingState,
  recordingReducer,
  selectWebmMimeType,
} from './core/recording';
import { getTimeOfDayState } from './core/time-of-day';
import type { ThunderEvent } from './core/weather-lifecycle';
import type { AmbientDebugStats, AmbientEngine } from './engine/AmbientEngine';

const INITIAL_AUDIO_STATE: AudioUiState = {
  fileName: null,
  playing: false,
  duration: 0,
  currentTime: 0,
  error: null,
};

const weatherNames = {
  clear: '晴',
  rain: '雨',
  snow: '雪',
  fog: '雾',
} as const;

const formatClock = (time: number): string => {
  const hour = Math.floor(time) % 24;
  const minute = Math.floor((time - Math.floor(time)) * 60);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const loadPreferences = (): AmbientPreferences => {
  try {
    return parsePreferences(localStorage.getItem(PREFERENCES_STORAGE_KEY));
  } catch {
    return DEFAULT_PREFERENCES;
  }
};

export default function App() {
  const appRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<AmbientEngine | null>(null);
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const preferencesRef = useRef(DEFAULT_PREFERENCES);
  const timeRef = useRef(getLocalTimeOfDay());
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingTimeoutRef = useRef<number | null>(null);
  const recordingTickerRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef(0);
  const chunksRef = useRef<Blob[]>([]);
  const downloadUrlRef = useRef<string | null>(null);
  const recordingFailedRef = useRef(false);
  const unmountedRef = useRef(false);

  const [preferences, setPreferences] = useState<AmbientPreferences>(loadPreferences);
  const [realTime, setRealTime] = useState(() => getLocalTimeOfDay());
  const [audioState, setAudioState] = useState<AudioUiState>(INITIAL_AUDIO_STATE);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [debugStats, setDebugStats] = useState<AmbientDebugStats | null>(null);
  const [cameraState, setCameraState] = useState<CameraTourState>(() => ({
    ...DEFAULT_CAMERA_TOUR_STATE,
  }));
  const [npcCameraState, setNpcCameraState] = useState<NpcCameraState>(() => ({
    ...DEFAULT_NPC_CAMERA_STATE,
  }));
  const [activeEnvironmentPreset, setActiveEnvironmentPreset] =
    useState<EnvironmentPresetId | null>(null);
  const [photoMode, setPhotoMode] = useState<PhotoModeState>(() => ({
    ...DEFAULT_PHOTO_MODE_STATE,
  }));
  const [recordingState, dispatchRecording] = useReducer(
    recordingReducer,
    undefined,
    createRecordingState,
  );
  const [recordingIncludesAudio, setRecordingIncludesAudio] = useState(false);
  const [recordingFileName, setRecordingFileName] = useState('ambient-forge.webm');
  downloadUrlRef.current = recordingState.downloadUrl;

  const debugEnabled = useMemo(
    () => new URLSearchParams(window.location.search).get('debug') === '1',
    [],
  );
  const recordingSupported = useMemo(
    () =>
      typeof MediaRecorder !== 'undefined' &&
      typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
      Boolean(selectWebmMimeType((type) => MediaRecorder.isTypeSupported(type))),
    [],
  );

  preferencesRef.current = preferences;
  const displayTime = preferences.followRealTime ? realTime : preferences.manualTime;
  timeRef.current = displayTime;

  useEffect(() => {
    const audioEngine = new AudioEngine(setAudioState);
    audioEngineRef.current = audioEngine;
    audioEngine.setMusicVolume(preferencesRef.current.musicVolume);
    const resumeStoredSoundscape = () => {
      const current = preferencesRef.current;
      if (!current.environmentEnabled) return;
      const night = getTimeOfDayState(timeRef.current).stars;
      void audioEngine
        .setEnvironmentEnabled(
          true,
          current.weather,
          current.weatherIntensity,
          night,
          current.environmentVolume,
        )
        .catch(() => setPreferences((value) => ({ ...value, environmentEnabled: false })));
      window.removeEventListener('pointerdown', resumeStoredSoundscape);
      window.removeEventListener('keydown', resumeStoredSoundscape);
    };
    if (preferencesRef.current.environmentEnabled) {
      window.addEventListener('pointerdown', resumeStoredSoundscape, { once: true });
      window.addEventListener('keydown', resumeStoredSoundscape, { once: true });
    }
    return () => {
      window.removeEventListener('pointerdown', resumeStoredSoundscape);
      window.removeEventListener('keydown', resumeStoredSoundscape);
      audioEngine.dispose();
      audioEngineRef.current = null;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PREFERENCES_STORAGE_KEY, serializePreferences(preferences));
    } catch {
      setNotice('浏览器未能保存当前设置。');
    }
  }, [preferences]);

  useEffect(() => {
    const syncTime = () => setRealTime(getLocalTimeOfDay());
    syncTime();
    const interval = window.setInterval(syncTime, 60_000);
    const handleVisibility = () => {
      if (!document.hidden) syncTime();
    };
    window.addEventListener('focus', syncTime);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', syncTime);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => setReducedMotion(media.matches);
    syncMotion();
    media.addEventListener('change', syncMotion);
    return () => media.removeEventListener('change', syncMotion);
  }, []);

  useEffect(() => {
    setFullscreenSupported(
      Boolean(document.fullscreenEnabled && appRef.current?.requestFullscreen),
    );
    const syncFullscreen = () => setFullscreen(document.fullscreenElement === appRef.current);
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  useEffect(() => {
    audioEngineRef.current?.setMusicVolume(preferences.musicVolume);
  }, [preferences.musicVolume]);

  useEffect(() => {
    const night = getTimeOfDayState(displayTime).stars;
    audioEngineRef.current?.updateSoundscape(
      preferences.weather,
      preferences.weatherIntensity,
      night,
      preferences.environmentVolume,
    );
  }, [
    displayTime,
    preferences.environmentVolume,
    preferences.weather,
    preferences.weatherIntensity,
  ]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    engineRef.current?.setPhotoMode(photoMode.enabled, photoMode.depthOfField);
  }, [photoMode.depthOfField, photoMode.enabled]);

  useEffect(() => {
    const handlePhotoShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (event.key.toLowerCase() === 'p' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        setPhotoMode((current) => setPhotoModeEnabled(current, !current.enabled));
      } else if (event.key === 'Escape') {
        setPhotoMode((current) => setPhotoModeEnabled(current, false));
        engineRef.current?.exitNpcView();
      }
    };
    window.addEventListener('keydown', handlePhotoShortcut);
    return () => window.removeEventListener('keydown', handlePhotoShortcut);
  }, []);

  const getInputs = useCallback((): AmbientInputs => {
    const current = preferencesRef.current;
    const bands = audioEngineRef.current?.sampleBands() ?? { low: 0, mid: 0, high: 0 };
    const response = current.musicResponse;
    return {
      ...createDefaultAmbientInputs(),
      timeOfDay: timeRef.current,
      weather: current.weather,
      weatherIntensity: current.weatherIntensity,
      wind: current.wind,
      audioLow: bands.low * response,
      audioMid: bands.mid * response,
      audioHigh: bands.high * response,
      reducedMotion,
    };
  }, [reducedMotion]);

  const handleEngineReady = useCallback((engine: AmbientEngine | null) => {
    engineRef.current = engine;
    if (engine) {
      setCameraState(engine.getCameraTourState());
      setNpcCameraState(engine.getNpcCameraState());
    }
  }, []);

  const handleThunder = useCallback((event: ThunderEvent) => {
    audioEngineRef.current?.triggerThunder(event);
  }, []);

  const focusCameraView = useCallback((view: CameraViewId) => {
    engineRef.current?.focusCameraView(view);
  }, []);

  const setAutoTour = useCallback((enabled: boolean) => {
    engineRef.current?.setAutoTour(enabled);
  }, []);

  const focusNpc = useCallback((id: NpcId) => {
    engineRef.current?.focusNpc(id);
  }, []);

  const setNpcCameraMode = useCallback((mode: Exclude<NpcViewMode, 'orbit'>) => {
    engineRef.current?.setNpcCameraMode(mode);
  }, []);

  const exitNpcCamera = useCallback(() => {
    engineRef.current?.exitNpcView();
  }, []);

  const handleStats = useCallback(
    (stats: AmbientDebugStats) => {
      if (debugEnabled) setDebugStats(stats);
    },
    [debugEnabled],
  );

  const updatePreferences = useCallback((changes: Partial<AmbientPreferences>) => {
    if (
      'weather' in changes ||
      'weatherIntensity' in changes ||
      'wind' in changes ||
      'manualTime' in changes ||
      'followRealTime' in changes
    ) {
      setActiveEnvironmentPreset(null);
    }
    setPreferences((current) => ({ ...current, ...changes }));
  }, []);

  const applyEnvironmentPreset = useCallback((preset: EnvironmentPresetId) => {
    setActiveEnvironmentPreset(preset);
    setPreferences((current) => ({ ...current, ...getEnvironmentPresetChanges(preset) }));
  }, []);

  const updatePhotoMode = useCallback((changes: Partial<Omit<PhotoModeState, 'enabled'>>) => {
    setPhotoMode((current) => updatePhotoModeSettings(current, changes));
  }, []);

  const capturePhoto = useCallback(async () => {
    const blob = await engineRef.current?.capturePhoto(photoMode.filter);
    if (!blob) {
      setNotice('当前场景无法生成照片。');
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.href = url;
    link.download = `ambient-forge-${stamp}.png`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setNotice('照片已保存。');
  }, [photoMode.filter]);

  const handleEnvironmentToggle = useCallback(
    async (enabled: boolean) => {
      const current = preferencesRef.current;
      const night = getTimeOfDayState(timeRef.current).stars;
      try {
        await audioEngineRef.current?.setEnvironmentEnabled(
          enabled,
          current.weather,
          current.weatherIntensity,
          night,
          current.environmentVolume,
        );
        updatePreferences({ environmentEnabled: enabled });
      } catch (error) {
        setNotice(error instanceof Error ? error.message : '环境声无法启动。');
      }
    },
    [updatePreferences],
  );

  const toggleFullscreen = useCallback(async () => {
    const host = appRef.current;
    if (!host || !document.fullscreenEnabled) return;
    try {
      if (document.fullscreenElement === host) await document.exitFullscreen();
      else await host.requestFullscreen();
    } catch {
      setNotice('浏览器未能切换全屏。');
    }
  }, []);

  const cleanupRecordingMedia = useCallback(() => {
    if (recordingTimeoutRef.current !== null) window.clearTimeout(recordingTimeoutRef.current);
    if (recordingTickerRef.current !== null) window.clearInterval(recordingTickerRef.current);
    recordingTimeoutRef.current = null;
    recordingTickerRef.current = null;
    recordingStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    recordingStreamRef.current = null;
    recorderRef.current = null;
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }, []);

  const startRecording = useCallback(() => {
    if (recorderRef.current || recordingState.status === 'recording') return;
    const canvas = engineRef.current?.getCanvas();
    if (!canvas || !recordingSupported) {
      dispatchRecording({ type: 'fail', error: '当前浏览器无法录制这个场景。' });
      return;
    }
    const mimeType = selectWebmMimeType((type) => MediaRecorder.isTypeSupported(type));
    if (!mimeType) {
      dispatchRecording({ type: 'fail', error: '当前浏览器没有可用的 WebM 编码器。' });
      return;
    }
    if (recordingState.downloadUrl) URL.revokeObjectURL(recordingState.downloadUrl);

    try {
      const canvasStream = canvas.captureStream(30);
      const audioTrack = audioEngineRef.current?.getRecordingAudioTrack() ?? null;
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...(audioTrack ? [audioTrack] : []),
      ]);
      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 6_000_000,
      });
      chunksRef.current = [];
      recordingFailedRef.current = false;
      recorderRef.current = recorder;
      recordingStreamRef.current = combinedStream;
      setRecordingIncludesAudio(Boolean(audioTrack));
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      });
      recorder.addEventListener('error', () => {
        recordingFailedRef.current = true;
        cleanupRecordingMedia();
        if (!unmountedRef.current) {
          dispatchRecording({ type: 'fail', error: '录制过程发生错误，未生成文件。' });
        }
      });
      recorder.addEventListener('stop', () => {
        if (unmountedRef.current || recordingFailedRef.current) {
          cleanupRecordingMedia();
          return;
        }
        const chunks = chunksRef.current;
        if (chunks.length === 0) {
          cleanupRecordingMedia();
          dispatchRecording({ type: 'fail', error: '录制未产生有效数据。' });
          return;
        }
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const fileName = createRecordingFileName();
        setRecordingFileName(fileName);
        cleanupRecordingMedia();
        dispatchRecording({ type: 'complete', url });
      });
      dispatchRecording({ type: 'start', durationSeconds: 10 });
      recordingStartedAtRef.current = performance.now();
      recorder.start(250);
      recordingTickerRef.current = window.setInterval(() => {
        dispatchRecording({
          type: 'tick',
          elapsedSeconds: (performance.now() - recordingStartedAtRef.current) / 1000,
        });
      }, 250);
      recordingTimeoutRef.current = window.setTimeout(stopRecording, 10_000);
    } catch (error) {
      cleanupRecordingMedia();
      dispatchRecording({
        type: 'fail',
        error: error instanceof Error ? error.message : '无法开始录制。',
      });
    }
  }, [cleanupRecordingMedia, recordingState, recordingSupported, stopRecording]);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      cleanupRecordingMedia();
      if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
    };
  }, [cleanupRecordingMedia]);

  const handleReset = useCallback(() => {
    void audioEngineRef.current?.setEnvironmentEnabled(false, 'clear', 0.55, 0, 0.28);
    audioEngineRef.current?.clearFile();
    setPreferences(DEFAULT_PREFERENCES);
    setActiveEnvironmentPreset(null);
    setPhotoMode({ ...DEFAULT_PHOTO_MODE_STATE });
    engineRef.current?.focusCameraView('overview');
    setNotice('已恢复默认设置。');
  }, []);

  return (
    <div
      ref={appRef}
      className={`ambient-app photo-filter-${photoMode.filter}${photoMode.enabled ? ' is-photo-mode' : ''}`}
    >
      <AmbientCanvas
        quality={preferences.quality}
        getInputs={getInputs}
        onReady={handleEngineReady}
        onStats={handleStats}
        onCameraState={setCameraState}
        onNpcCameraState={setNpcCameraState}
        onThunder={handleThunder}
      />
      <div className="sky-vignette" aria-hidden="true" />
      <header className="scene-status">
        <div className="forge-mark" aria-hidden="true">
          <span />
        </div>
        <div>
          <span className="scene-title">AMBIENT FORGE</span>
          <p>
            {formatClock(displayTime)} · {weatherNames[preferences.weather]}
            {audioState.playing ? ' · 音乐响应中' : ''}
          </p>
        </div>
      </header>

      <ControlPanel
        preferences={preferences}
        displayTime={displayTime}
        fullscreen={fullscreen}
        fullscreenSupported={fullscreenSupported}
        onChange={updatePreferences}
        onEnvironmentToggle={(enabled) => void handleEnvironmentToggle(enabled)}
        onFullscreen={() => void toggleFullscreen()}
        onReset={handleReset}
        cameraState={cameraState}
        npcCameraState={npcCameraState}
        onCameraView={focusCameraView}
        onAutoTour={setAutoTour}
        onNpcSelect={focusNpc}
        onNpcViewMode={setNpcCameraMode}
        onNpcExit={exitNpcCamera}
        onPhotoMode={() => setPhotoMode((current) => setPhotoModeEnabled(current, true))}
        activeEnvironmentPreset={activeEnvironmentPreset}
        onEnvironmentPreset={applyEnvironmentPreset}
        audioControls={
          <AudioControls
            state={audioState}
            musicVolume={preferences.musicVolume}
            responseStrength={preferences.musicResponse}
            onFile={(file) => audioEngineRef.current?.loadFile(file)}
            onToggle={() => {
              void audioEngineRef.current?.togglePlayback().catch((error: unknown) => {
                setNotice(error instanceof Error ? error.message : '音乐无法播放。');
              });
            }}
            onSeek={(progress) => audioEngineRef.current?.seek(progress)}
            onVolume={(musicVolume) => updatePreferences({ musicVolume })}
            onResponse={(musicResponse) => updatePreferences({ musicResponse })}
            onClear={() => audioEngineRef.current?.clearFile()}
          />
        }
        recordingControls={
          <RecordingControls
            supported={recordingSupported}
            state={recordingState}
            includesAudio={recordingIncludesAudio}
            fileName={recordingFileName}
            onStart={startRecording}
            onStop={stopRecording}
          />
        }
      />

      <PhotoModeOverlay
        state={photoMode}
        onChange={updatePhotoMode}
        onCapture={() => void capturePhoto()}
        onExit={() => setPhotoMode((current) => setPhotoModeEnabled(current, false))}
      />

      {notice ? (
        <div className="toast" role="status">
          {notice}
        </div>
      ) : null}
      {debugEnabled ? <DebugOverlay stats={debugStats} /> : null}
    </div>
  );
}
