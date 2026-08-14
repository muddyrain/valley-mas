import { useEffect, useState } from 'react';

export const YUJI_LOADING_REVEAL_DELAY = 300;

export function useDelayedLoading(loading: boolean, delay = YUJI_LOADING_REVEAL_DELAY): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!loading) {
      setVisible(false);
      return;
    }

    const timer = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay, loading]);

  return visible;
}
