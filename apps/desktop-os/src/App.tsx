import type { CSSProperties } from 'react';
import ControlCenter from './components/ControlCenter';
import DesktopGlobalEvents from './components/DesktopGlobalEvents';
import Dock from './components/Dock';
import FocusTimerRuntime from './components/FocusTimerRuntime';
import Launchpad from './components/Launchpad';
import MenuBar from './components/MenuBar';
import MusicRuntimeGate from './components/MusicRuntimeGate';
import NotificationCenter from './components/NotificationCenter';
import NotificationPollingGate from './components/NotificationPollingGate';
import Wallpaper from './components/Wallpaper';
import WindowManager from './components/window/WindowManager';
import Spotlight from './spotlight/Spotlight';
import { useControlCenterStore } from './store/controlCenterStore';
import { PlushTooltipProvider } from './ui/PlushPrimitives';
import './App.css';

export default function App() {
  const brightness = useControlCenterStore((s) => s.brightness);

  return (
    <PlushTooltipProvider>
      <div
        className="desktop"
        style={{ '--wallpaper-brightness': String(0.82 + brightness / 400) } as CSSProperties}
      >
        <Wallpaper />
        <DesktopGlobalEvents />
        <NotificationPollingGate />
        <FocusTimerRuntime />
        <MusicRuntimeGate />
        <MenuBar />
        <WindowManager />
        <Launchpad />
        <Dock />
        <Spotlight />
        <ControlCenter />
        <NotificationCenter />
      </div>
    </PlushTooltipProvider>
  );
}
