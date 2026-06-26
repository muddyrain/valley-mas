import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { applyTheme, getStoredTheme } from './lib/theme';

// Apply theme immediately before React renders to avoid flash
const initialTheme = getStoredTheme();
applyTheme(initialTheme);

// Listen for system theme changes when in system mode
if (initialTheme === 'system') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    applyTheme('system');
  });
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

const devServiceWorkerHosts = new Set(['localhost', '127.0.0.1', '::1']);
const shouldRegisterServiceWorkerInDev =
  import.meta.env.DEV && devServiceWorkerHosts.has(window.location.hostname);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (import.meta.env.PROD || shouldRegisterServiceWorkerInDev) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // PWA registration should never block the app shell.
      });
      return;
    }

    if (import.meta.env.DEV) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => void registration.unregister());
      });

      if ('caches' in window) {
        caches
          .keys()
          .then((keys) =>
            Promise.all(
              keys.filter((key) => key.startsWith('life-trace-')).map((key) => caches.delete(key)),
            ),
          )
          .catch(() => {
            // Cache cleanup should never block local development.
          });
      }
    }
  });
}
