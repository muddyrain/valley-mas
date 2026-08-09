import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { LongScreenshotControl } from './LongScreenshotControl';
import { LongScreenshotIndicator } from './LongScreenshotIndicator';
import { PinnedScreenshot } from './PinnedScreenshot';
import { RecorderHost } from './RecorderHost';
import { RecordingCompletion } from './RecordingCompletion';
import { RecordingControl } from './RecordingControl';
import { RecordingIndicator } from './RecordingIndicator';
import { RecordingSetup } from './RecordingSetup';
import { ScreenshotCompletion } from './ScreenshotCompletion';
import { ScreenshotEditor } from './ScreenshotEditor';
import { SelectionSurface } from './SelectionSurface';
import './styles.css';

const mode = new URLSearchParams(window.location.search).get('mode');
const root = document.getElementById('root');

document.documentElement.dataset.mode = mode ?? 'main';

if (!root) {
  throw new Error('应用根节点不存在');
}

const content =
  mode === 'selection' ? (
    <SelectionSurface />
  ) : mode === 'recorder' ? (
    <RecorderHost />
  ) : mode === 'indicator' ? (
    <RecordingIndicator />
  ) : mode === 'control' ? (
    <RecordingControl />
  ) : mode === 'screenshot-editor' ? (
    <ScreenshotEditor />
  ) : mode === 'long-screenshot-control' ? (
    <LongScreenshotControl />
  ) : mode === 'long-screenshot-indicator' ? (
    <LongScreenshotIndicator />
  ) : mode === 'recording-setup' ? (
    <RecordingSetup />
  ) : mode === 'pinned-screenshot' ? (
    <PinnedScreenshot />
  ) : mode === 'completion' ? (
    <RecordingCompletion />
  ) : mode === 'screenshot-completion' ? (
    <ScreenshotCompletion />
  ) : (
    <App />
  );

createRoot(root).render(
  mode === 'recorder' ||
    mode === 'selection' ||
    mode === 'indicator' ||
    mode === 'control' ||
    mode === 'screenshot-editor' ||
    mode === 'long-screenshot-control' ||
    mode === 'long-screenshot-indicator' ||
    mode === 'recording-setup' ||
    mode === 'pinned-screenshot' ||
    mode === 'completion' ||
    mode === 'screenshot-completion' ? (
    content
  ) : (
    <StrictMode>{content}</StrictMode>
  ),
);
