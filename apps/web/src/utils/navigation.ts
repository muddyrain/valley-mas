import type { NavigateFunction, To } from 'react-router-dom';

function canNavigateBack() {
  return typeof window !== 'undefined' && (window.history.state?.idx ?? 0) > 0;
}

export function navigateBackOrFallback(navigate: NavigateFunction, fallback: To) {
  if (canNavigateBack()) {
    navigate(-1);
    return;
  }

  navigate(fallback, { replace: true });
}
