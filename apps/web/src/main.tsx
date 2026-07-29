import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import './components/blog/code-theme.css';
import './components/blog/mdx-editor.css';
import { applyThemeToDocument, type ThemeMode } from './stores/useThemeStore';

if (typeof window !== 'undefined') {
  const savedTheme = localStorage.getItem('valley_theme');
  let mode: ThemeMode = 'system';
  if (savedTheme) {
    try {
      const parsed = JSON.parse(savedTheme);
      const savedMode = parsed.state?.mode;
      if (savedMode === 'dark' || savedMode === 'light' || savedMode === 'system') {
        mode = savedMode;
      }
    } catch {}
  }
  applyThemeToDocument(mode);
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
