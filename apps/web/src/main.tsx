import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import './components/blog/mdx-editor.css';
import { applyThemeToDocument } from './stores/useThemeStore';

if (typeof window !== 'undefined') {
  const savedTheme = localStorage.getItem('valley_theme');
  let mode: 'dark' | 'light' = 'light';
  if (savedTheme) {
    try {
      const parsed = JSON.parse(savedTheme);
      if (parsed.state?.mode === 'dark') {
        mode = 'dark';
      }
    } catch {
      mode = 'light';
    }
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
