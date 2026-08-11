import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

async function bootstrap() {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('mock')) {
    const { installMockApi } = await import('./dev/mock-api');
    installMockApi();
  }

  const root = document.getElementById('root');
  if (!root) throw new Error('Root element is missing');
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
