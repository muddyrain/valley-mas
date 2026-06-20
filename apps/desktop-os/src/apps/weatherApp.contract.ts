import { APP_RENDERERS } from './appRenderers';
import { DESKTOP_APPS } from './desktopApps';

const weatherApp = DESKTOP_APPS.weather;
const renderWeatherApp = APP_RENDERERS.weather;

export const WEATHER_APP_CONTRACT = {
  appId: weatherApp.id,
  title: weatherApp.title,
  render: renderWeatherApp,
};
