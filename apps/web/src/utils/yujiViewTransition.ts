import type { CSSProperties } from 'react';

export function getYujiImageTransitionName(resourceId: string): string {
  const safeId = resourceId.replace(/[^a-zA-Z0-9_-]/g, '-');
  return `yuji-image-${safeId}`;
}

export function getYujiImageTransitionStyle(resourceId: string): CSSProperties {
  return {
    '--yuji-image-transition-name': getYujiImageTransitionName(resourceId),
  } as CSSProperties;
}
