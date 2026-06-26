import { useEffect, useState } from 'react';

export function useDelayedFlag(value: boolean, delayMs = 300) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!value) {
      setVisible(false);
      return;
    }

    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);

  return visible;
}
