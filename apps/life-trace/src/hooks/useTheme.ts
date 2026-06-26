import { useCallback, useEffect, useState } from 'react';

function isDarkMode(): boolean {
  return document.documentElement.classList.contains('dark');
}

export function useTheme() {
  const [dark, setDark] = useState(isDarkMode);

  const update = useCallback(() => {
    setDark(isDarkMode());
  }, []);

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'class') {
          update();
        }
      }
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, [update]);

  return { dark };
}
