import { useCallback, useEffect, useRef, useState } from 'react';

export function useDelayedHoverVisibility(delay = 120) {
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<number | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const show = useCallback(() => {
    clearHideTimer();
    setVisible(true);
  }, [clearHideTimer]);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => setVisible(false), delay);
  }, [clearHideTimer, delay]);

  useEffect(() => clearHideTimer, [clearHideTimer]);

  return { visible, show, scheduleHide };
}
