import {
  type ComponentType,
  type LazyExoticComponent,
  lazy,
  type ReactNode,
  Suspense,
} from 'react';
import PlushLoading from '../ui/PlushLoading';
import type { DesktopAppId } from './desktopApps';

type LazyAppComponent = LazyExoticComponent<ComponentType>;

const APP_LOADING_FALLBACK = (
  <PlushLoading variant="stage" size="sm" title="正在打开" description="正在准备窗口" />
);

function createAppRenderer(AppComponent: LazyAppComponent) {
  return function renderApp() {
    return (
      <Suspense fallback={APP_LOADING_FALLBACK}>
        <AppComponent />
      </Suspense>
    );
  };
}

export const APP_RENDERERS: Record<DesktopAppId, () => ReactNode> = {
  about: createAppRenderer(lazy(() => import('./AboutWindow'))),
  account: createAppRenderer(lazy(() => import('./AccountWindow'))),
  aiTools: createAppRenderer(lazy(() => import('./AICommandCenterWindow'))),
  beadSort: createAppRenderer(lazy(() => import('./BeadSortWindow'))),
  blog: createAppRenderer(lazy(() => import('./BlogWindow'))),
  blockDrop: createAppRenderer(lazy(() => import('./BlockDropWindow'))),
  calculator: createAppRenderer(lazy(() => import('./CalculatorWindow'))),
  calendar: createAppRenderer(lazy(() => import('./CalendarWindow'))),
  clipboard: createAppRenderer(lazy(() => import('./ClipboardWindow'))),
  cloudBounce: createAppRenderer(lazy(() => import('./CloudBounceWindow'))),
  converter: createAppRenderer(lazy(() => import('./ConverterWindow'))),
  dailyTools: createAppRenderer(lazy(() => import('./DailyToolsWindow'))),
  devTools: createAppRenderer(lazy(() => import('./DevToolsWindow'))),
  deskTidy: createAppRenderer(lazy(() => import('./DeskTidyWindow'))),
  diceCup: createAppRenderer(lazy(() => import('./DiceCupWindow'))),
  downloads: createAppRenderer(lazy(() => import('./DownloadsWindow'))),
  finder: createAppRenderer(lazy(() => import('./FinderWindow'))),
  focus: createAppRenderer(lazy(() => import('./FocusTimerWindow'))),
  mail: createAppRenderer(lazy(() => import('./MailWindow'))),
  music: createAppRenderer(lazy(() => import('./MusicWindow'))),
  notes: createAppRenderer(lazy(() => import('./NotesWindow'))),
  palette: createAppRenderer(lazy(() => import('./PaletteWindow'))),
  plushMatch: createAppRenderer(lazy(() => import('./PlushMatchWindow'))),
  plushGarden: createAppRenderer(lazy(() => import('./PlushGardenWindow'))),
  randomizer: createAppRenderer(lazy(() => import('./RandomizerWindow'))),
  safari: createAppRenderer(lazy(() => import('./SafariWindow'))),
  settings: createAppRenderer(lazy(() => import('./SettingsWindow'))),
  snake: createAppRenderer(lazy(() => import('./SnakeWindow'))),
  stopwatch: createAppRenderer(lazy(() => import('./StopwatchWindow'))),
  textLab: createAppRenderer(lazy(() => import('./TextLabWindow'))),
  weather: createAppRenderer(lazy(() => import('./WeatherWindow'))),
};

export function renderDesktopApp(appId: DesktopAppId) {
  return APP_RENDERERS[appId]?.() ?? null;
}
