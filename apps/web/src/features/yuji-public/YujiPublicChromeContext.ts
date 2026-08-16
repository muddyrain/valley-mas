import { createContext, useContext } from 'react';

export type YujiHeaderSurface = 'stage' | 'content';

interface YujiPublicChromeValue {
  setHeaderSurface: (surface: YujiHeaderSurface) => void;
}

export const YujiPublicChromeContext = createContext<YujiPublicChromeValue | null>(null);

export function useYujiPublicChrome() {
  return useContext(YujiPublicChromeContext);
}
