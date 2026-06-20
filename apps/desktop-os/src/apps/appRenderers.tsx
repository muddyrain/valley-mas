import type { ReactNode } from 'react';
import AboutWindow from './AboutWindow';
import AccountWindow from './AccountWindow';
import AICommandCenterWindow from './AICommandCenterWindow';
import BeadSortWindow from './BeadSortWindow';
import BlockDropWindow from './BlockDropWindow';
import CalculatorWindow from './CalculatorWindow';
import CalendarWindow from './CalendarWindow';
import ClipboardWindow from './ClipboardWindow';
import CloudBounceWindow from './CloudBounceWindow';
import ConverterWindow from './ConverterWindow';
import DailyToolsWindow from './DailyToolsWindow';
import DeskTidyWindow from './DeskTidyWindow';
import DevToolsWindow from './DevToolsWindow';
import DiceCupWindow from './DiceCupWindow';
import DownloadsWindow from './DownloadsWindow';
import type { DesktopAppId } from './desktopApps';
import FinderWindow from './FinderWindow';
import FocusTimerWindow from './FocusTimerWindow';
import MailWindow from './MailWindow';
import MusicWindow from './MusicWindow';
import NotesWindow from './NotesWindow';
import PaletteWindow from './PaletteWindow';
import PlushGardenWindow from './PlushGardenWindow';
import PlushMatchWindow from './PlushMatchWindow';
import RandomizerWindow from './RandomizerWindow';
import SafariWindow from './SafariWindow';
import SettingsWindow from './SettingsWindow';
import SnakeWindow from './SnakeWindow';
import StopwatchWindow from './StopwatchWindow';
import TextLabWindow from './TextLabWindow';
import WeatherWindow from './WeatherWindow';

export const APP_RENDERERS: Record<DesktopAppId, () => ReactNode> = {
  about: () => <AboutWindow />,
  account: () => <AccountWindow />,
  aiTools: () => <AICommandCenterWindow />,
  beadSort: () => <BeadSortWindow />,
  blockDrop: () => <BlockDropWindow />,
  calculator: () => <CalculatorWindow />,
  calendar: () => <CalendarWindow />,
  clipboard: () => <ClipboardWindow />,
  cloudBounce: () => <CloudBounceWindow />,
  converter: () => <ConverterWindow />,
  dailyTools: () => <DailyToolsWindow />,
  devTools: () => <DevToolsWindow />,
  deskTidy: () => <DeskTidyWindow />,
  diceCup: () => <DiceCupWindow />,
  downloads: () => <DownloadsWindow />,
  finder: () => <FinderWindow />,
  focus: () => <FocusTimerWindow />,
  mail: () => <MailWindow />,
  music: () => <MusicWindow />,
  notes: () => <NotesWindow />,
  palette: () => <PaletteWindow />,
  plushMatch: () => <PlushMatchWindow />,
  plushGarden: () => <PlushGardenWindow />,
  randomizer: () => <RandomizerWindow />,
  safari: () => <SafariWindow />,
  settings: () => <SettingsWindow />,
  snake: () => <SnakeWindow />,
  stopwatch: () => <StopwatchWindow />,
  textLab: () => <TextLabWindow />,
  weather: () => <WeatherWindow />,
};

export function renderDesktopApp(appId: DesktopAppId) {
  return APP_RENDERERS[appId]?.() ?? null;
}
