import type { ReactNode } from 'react';
import AboutWindow from './AboutWindow';
import AccountWindow from './AccountWindow';
import BeadSortWindow from './BeadSortWindow';
import CalculatorWindow from './CalculatorWindow';
import CalendarWindow from './CalendarWindow';
import ClipboardWindow from './ClipboardWindow';
import CloudBounceWindow from './CloudBounceWindow';
import ConverterWindow from './ConverterWindow';
import DeskTidyWindow from './DeskTidyWindow';
import DownloadsWindow from './DownloadsWindow';
import type { DesktopAppId } from './desktopApps';
import FinderWindow from './FinderWindow';
import FocusTimerWindow from './FocusTimerWindow';
import MusicWindow from './MusicWindow';
import NotesWindow from './NotesWindow';
import PaletteWindow from './PaletteWindow';
import PlushGardenWindow from './PlushGardenWindow';
import PlushMatchWindow from './PlushMatchWindow';
import RandomizerWindow from './RandomizerWindow';
import SafariWindow from './SafariWindow';
import SettingsWindow from './SettingsWindow';
import StopwatchWindow from './StopwatchWindow';
import TextLabWindow from './TextLabWindow';
import WeatherWindow from './WeatherWindow';

export const APP_RENDERERS: Record<DesktopAppId, () => ReactNode> = {
  about: () => <AboutWindow />,
  account: () => <AccountWindow />,
  beadSort: () => <BeadSortWindow />,
  calculator: () => <CalculatorWindow />,
  calendar: () => <CalendarWindow />,
  clipboard: () => <ClipboardWindow />,
  cloudBounce: () => <CloudBounceWindow />,
  converter: () => <ConverterWindow />,
  deskTidy: () => <DeskTidyWindow />,
  downloads: () => <DownloadsWindow />,
  finder: () => <FinderWindow />,
  focus: () => <FocusTimerWindow />,
  music: () => <MusicWindow />,
  notes: () => <NotesWindow />,
  palette: () => <PaletteWindow />,
  plushMatch: () => <PlushMatchWindow />,
  plushGarden: () => <PlushGardenWindow />,
  randomizer: () => <RandomizerWindow />,
  safari: () => <SafariWindow />,
  settings: () => <SettingsWindow />,
  stopwatch: () => <StopwatchWindow />,
  textLab: () => <TextLabWindow />,
  weather: () => <WeatherWindow />,
};

export function renderDesktopApp(appId: DesktopAppId) {
  return APP_RENDERERS[appId]?.() ?? null;
}
