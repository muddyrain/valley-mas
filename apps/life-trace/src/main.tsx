import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // PWA registration should never block the app shell.
    });
  });
}

if ('serviceWorker' in navigator && import.meta.env.DEV) {
  window.addEventListener('load', () => {
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
  });
}
