'use client';

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import {
  clampRatio,
  getScratchCardRevealRatio,
  getScratchCardRevealSlotIndex,
  getScratchCardRevealThreshold,
  type ScratchCardType,
  type ScratchSurfacePoint,
  shouldRevealFullScratchCover,
} from '@/lib/game';

type ScratchCardCanvasProps = {
  active: boolean;
  visible: boolean;
  cardType: ScratchCardType;
  scratchPoints: readonly ScratchSurfacePoint[];
  brushRadius: number;
  stepDistance: number;
  onProgressChange: (progress: number) => void;
  onRevealSlotsSync: (slotIndexes: readonly number[]) => void;
  onRevealSlot: (slotIndex: number) => void;
  onScratchPointsFlush: (points: readonly ScratchSurfacePoint[]) => void;
  onComplete: () => void;
};

const SCRATCH_CANVAS_LAYOUTS = {
  'basic-safe': {
    width: 230,
    height: 66,
  },
  'triple-match': {
    width: 230,
    height: 128,
    slotBounds: [
      { left: 18, top: 5, width: 54, height: 54 },
      { left: 88, top: 5, width: 54, height: 54 },
      { left: 158, top: 5, width: 54, height: 54 },
      { left: 48, top: 69, width: 54, height: 54 },
      { left: 118, top: 69, width: 54, height: 54 },
    ],
  },
  'risk-peek': {
    width: 230,
    height: 134,
    slotBounds: [
      { left: 18, top: 5, width: 54, height: 54 },
      { left: 88, top: 5, width: 54, height: 54 },
      { left: 158, top: 5, width: 54, height: 54 },
      { left: 18, top: 75, width: 54, height: 54 },
      { left: 88, top: 75, width: 54, height: 54 },
      { left: 158, top: 75, width: 54, height: 54 },
    ],
  },
} as const satisfies Record<
  ScratchCardType,
  {
    width: number;
    height: number;
    slotBounds?: readonly { left: number; top: number; width: number; height: number }[];
  }
>;

const SCRATCH_POINT_SAVE_DISTANCE = 10;
const SCRATCH_PROGRESS_REPORT_STEP = 0.03;
const SCRATCH_COVER_TEXTURE_SRC = '/ui-textures/pixel-silver-scratch-layer.png';
const SCRATCH_STAMP_OFFSETS = [
  [0, 0, 1],
  [-10, -3, 0.62],
  [8, 5, 0.68],
  [-5, 9, 0.5],
  [13, -7, 0.42],
  [-15, 6, 0.36],
] as const;

function getLayoutSlotBounds(cardType: ScratchCardType) {
  const layout = SCRATCH_CANVAS_LAYOUTS[cardType];

  return 'slotBounds' in layout ? layout.slotBounds : undefined;
}

export function ScratchCardCanvas({
  active,
  visible,
  cardType,
  scratchPoints,
  brushRadius,
  stepDistance,
  onProgressChange,
  onRevealSlotsSync,
  onRevealSlot,
  onScratchPointsFlush,
  onComplete,
}: ScratchCardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const coveredPixelsRef = useRef(1);
  const completedRef = useRef(false);
  const progressFrameRef = useRef<number | null>(null);
  const lastSavedPointRef = useRef<{ x: number; y: number } | null>(null);
  const pendingScratchPointsRef = useRef<ScratchSurfacePoint[]>([]);
  const lastReportedProgressRef = useRef(0);
  const revealedSlotIndexesRef = useRef<Set<number>>(new Set());
  const coverTextureImageRef = useRef<HTMLImageElement | null>(null);
  const scratchPointsRef = useRef(scratchPoints);
  const cardTypeRef = useRef(cardType);
  const onProgressChangeRef = useRef(onProgressChange);
  const onRevealSlotsSyncRef = useRef(onRevealSlotsSync);
  const onRevealSlotRef = useRef(onRevealSlot);
  const onScratchPointsFlushRef = useRef(onScratchPointsFlush);
  const onCompleteRef = useRef(onComplete);

  scratchPointsRef.current = scratchPoints;
  cardTypeRef.current = cardType;
  onProgressChangeRef.current = onProgressChange;
  onRevealSlotsSyncRef.current = onRevealSlotsSync;
  onRevealSlotRef.current = onRevealSlot;
  onScratchPointsFlushRef.current = onScratchPointsFlush;
  onCompleteRef.current = onComplete;

  const getSlotBounds = useCallback((slotIndex: number) => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return null;
    }

    if (cardTypeRef.current === 'basic-safe') {
      if (slotIndex < 0 || slotIndex > 2) {
        return null;
      }

      const slotWidth = canvas.width / 3;
      const slotHeight = Math.min(canvas.height, 28);
      return {
        left: slotWidth * slotIndex + slotWidth * 0.17,
        top: (canvas.height - slotHeight) / 2,
        width: slotWidth * 0.66,
        height: slotHeight,
      };
    }

    const slotBounds = getLayoutSlotBounds(cardTypeRef.current);

    if (!slotBounds || slotIndex < 0 || slotIndex >= slotBounds.length) {
      return null;
    }

    return slotBounds[slotIndex] ?? null;
  }, []);

  const measureSlotRevealRatio = useCallback(
    (slotIndex: number) => {
      const canvas = canvasRef.current;
      const bounds = getSlotBounds(slotIndex);

      if (!canvas || !bounds) {
        return 0;
      }

      const context = canvas.getContext('2d', { willReadFrequently: true });

      if (!context) {
        return 0;
      }

      const startX = Math.max(0, Math.floor(bounds.left));
      const startY = Math.max(0, Math.floor(bounds.top));
      const endX = Math.min(canvas.width, Math.ceil(bounds.left + bounds.width));
      const endY = Math.min(canvas.height, Math.ceil(bounds.top + bounds.height));
      const width = Math.max(1, endX - startX);
      const height = Math.max(1, endY - startY);
      const { data } = context.getImageData(startX, startY, width, height);
      let coveredPixels = 0;

      for (let index = 3; index < data.length; index += 4) {
        if (data[index] > 20) {
          coveredPixels += 1;
        }
      }

      return getScratchCardRevealRatio(coveredPixels / (width * height));
    },
    [getSlotBounds],
  );

  const countCoveredPixels = useCallback(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return 0;
    }

    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context) {
      return 0;
    }

    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let coveredPixels = 0;

    for (let index = 3; index < data.length; index += 4) {
      if (data[index] > 20) {
        coveredPixels += 1;
      }
    }

    return coveredPixels;
  }, []);

  const flushScratchPoints = useCallback(() => {
    if (pendingScratchPointsRef.current.length === 0) {
      return;
    }

    const points = pendingScratchPointsRef.current;
    pendingScratchPointsRef.current = [];
    onScratchPointsFlushRef.current(points);
  }, []);

  const reportProgress = useCallback((progress: number, forceReport = false) => {
    const previousProgress = lastReportedProgressRef.current;
    const shouldReport =
      forceReport ||
      progress === 0 ||
      progress === 1 ||
      Math.abs(progress - previousProgress) >= SCRATCH_PROGRESS_REPORT_STEP;

    if (!shouldReport) {
      return;
    }

    lastReportedProgressRef.current = progress;
    onProgressChangeRef.current(progress);
  }, []);

  const updateProgress = useCallback(
    (forceReport = false) => {
      progressFrameRef.current = null;
      const remainingCover = countCoveredPixels();
      const scratchedRatio = clampRatio(1 - remainingCover / coveredPixelsRef.current);
      const shouldRevealFullCover = shouldRevealFullScratchCover(
        scratchedRatio,
        cardTypeRef.current,
      );
      const displayedRatio = shouldRevealFullCover ? 1 : scratchedRatio;

      reportProgress(displayedRatio, forceReport);

      if (!completedRef.current && shouldRevealFullCover) {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d', { willReadFrequently: true });

        context?.clearRect(0, 0, canvas?.width ?? 0, canvas?.height ?? 0);
        completedRef.current = true;
        flushScratchPoints();
        onCompleteRef.current();
      }
    },
    [countCoveredPixels, flushScratchPoints, reportProgress],
  );

  const scheduleProgressUpdate = useCallback(() => {
    if (progressFrameRef.current !== null) {
      return;
    }

    progressFrameRef.current = window.requestAnimationFrame(() => updateProgress());
  }, [updateProgress]);

  const flushProgressUpdate = useCallback(() => {
    if (progressFrameRef.current !== null) {
      window.cancelAnimationFrame(progressFrameRef.current);
      progressFrameRef.current = null;
    }

    updateProgress(true);
  }, [updateProgress]);

  const drawCover = useCallback(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.globalCompositeOperation = 'source-over';

    const slotClipBounds = getLayoutSlotBounds(cardTypeRef.current);

    if (slotClipBounds) {
      context.save();
      context.beginPath();

      for (const bounds of slotClipBounds) {
        const radius = bounds.width / 2;

        context.moveTo(bounds.left + bounds.width, bounds.top + radius);
        context.arc(bounds.left + radius, bounds.top + radius, radius, 0, Math.PI * 2);
      }

      context.clip();
    }

    const coverTextureImage = coverTextureImageRef.current;
    const hasCoverTexture = Boolean(
      coverTextureImage?.complete && coverTextureImage.naturalWidth > 0,
    );

    if (hasCoverTexture && coverTextureImage) {
      context.drawImage(coverTextureImage, 0, 0, canvas.width, canvas.height);

      const shine = context.createLinearGradient(0, 0, canvas.width, canvas.height);
      shine.addColorStop(0, 'rgba(255, 255, 255, 0.26)');
      shine.addColorStop(0.45, 'rgba(255, 255, 255, 0)');
      shine.addColorStop(1, 'rgba(69, 86, 96, 0.18)');
      context.fillStyle = shine;
      context.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#eef3f4');
      gradient.addColorStop(0.36, '#bac6cb');
      gradient.addColorStop(0.72, '#d8e0e3');
      gradient.addColorStop(1, '#9aa9b0');
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.globalAlpha = 0.5;
      context.strokeStyle = '#829199';
      context.lineWidth = 4;

      for (let x = -canvas.height; x < canvas.width + canvas.height; x += 20) {
        context.beginPath();
        context.moveTo(x, canvas.height);
        context.lineTo(x + canvas.height, 0);
        context.stroke();
      }

      context.globalAlpha = 1;
      context.fillStyle = 'rgba(255, 255, 255, 0.42)';

      for (let index = 0; index < 80; index += 1) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        context.fillRect(x, y, 1 + Math.random() * 4, 1 + Math.random() * 3);
      }

      context.strokeStyle = 'rgba(95, 108, 116, 0.28)';
      context.lineWidth = 1;

      for (let index = 0; index < 26; index += 1) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;

        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + 10 + Math.random() * 18, y - 4 + Math.random() * 8);
        context.stroke();
      }
    }

    context.fillStyle = 'rgba(65, 76, 83, 0.62)';
    context.font = '700 14px Arial';
    context.textAlign = 'center';

    if (slotClipBounds) {
      context.restore();
      context.strokeStyle = 'rgba(255, 255, 255, 0.24)';
      context.lineWidth = 2;

      for (const bounds of slotClipBounds) {
        const radius = bounds.width / 2;

        context.beginPath();
        context.arc(bounds.left + radius, bounds.top + radius, radius, 0, Math.PI * 2);
        context.stroke();
      }
    } else {
      context.fillText('SCRATCH', canvas.width / 2, canvas.height / 2 + 5);
    }

    coveredPixelsRef.current = Math.max(1, countCoveredPixels());
    completedRef.current = false;
    lastPointRef.current = null;
    lastSavedPointRef.current = null;
    pendingScratchPointsRef.current = [];
    lastReportedProgressRef.current = 0;
    reportProgress(0, true);
  }, [countCoveredPixels, reportProgress]);

  const getCanvasPoint = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, []);

  const eraseCanvasPoint = useCallback(
    (point: { x: number; y: number }) => {
      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      const context = canvas.getContext('2d', { willReadFrequently: true });

      if (!context) {
        return;
      }

      const previousPoint = lastPointRef.current ?? point;
      const distance = Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y);
      const normalizedBrushRadius = Math.max(4, brushRadius);
      const normalizedStepDistance = Math.max(2, stepDistance);
      const steps = Math.max(1, Math.ceil(distance / normalizedStepDistance));

      context.save();
      context.globalCompositeOperation = 'destination-out';

      for (let step = 0; step <= steps; step += 1) {
        const ratio = step / steps;
        const x = previousPoint.x + (point.x - previousPoint.x) * ratio;
        const y = previousPoint.y + (point.y - previousPoint.y) * ratio;

        for (const [offsetX, offsetY, radiusRatio] of SCRATCH_STAMP_OFFSETS) {
          context.beginPath();
          context.arc(
            x + offsetX * (normalizedBrushRadius / 17),
            y + offsetY * (normalizedBrushRadius / 17),
            normalizedBrushRadius * radiusRatio,
            0,
            Math.PI * 2,
          );
          context.fill();
        }

        for (let speck = 0; speck < 4; speck += 1) {
          const angle = Math.random() * Math.PI * 2;
          const distanceFromCenter = normalizedBrushRadius * (0.75 + Math.random() * 1.2);

          context.beginPath();
          context.arc(
            x + Math.cos(angle) * distanceFromCenter,
            y + Math.sin(angle) * distanceFromCenter,
            2 + Math.random() * 4,
            0,
            Math.PI * 2,
          );
          context.fill();
        }
      }

      context.restore();
      lastPointRef.current = point;
    },
    [brushRadius, stepDistance],
  );

  const eraseAt = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;

      if (!canvas || !active) {
        return;
      }

      const point = getCanvasPoint(clientX, clientY);

      if (!point) {
        return;
      }

      eraseCanvasPoint(point);
      const surfacePoint = {
        xPercent: clampRatio(point.x / canvas.width),
        yPercent: clampRatio(point.y / canvas.height),
      };
      const revealSlotIndex = getScratchCardRevealSlotIndex(cardTypeRef.current, surfacePoint);

      if (revealSlotIndex !== null && !revealedSlotIndexesRef.current.has(revealSlotIndex)) {
        const revealRatio = measureSlotRevealRatio(revealSlotIndex);

        if (revealRatio >= getScratchCardRevealThreshold(cardTypeRef.current)) {
          revealedSlotIndexesRef.current.add(revealSlotIndex);
          onRevealSlotRef.current(revealSlotIndex);
        }
      }

      const previousSavedPoint = lastSavedPointRef.current;
      const savedDistance = previousSavedPoint
        ? Math.hypot(point.x - previousSavedPoint.x, point.y - previousSavedPoint.y)
        : Number.POSITIVE_INFINITY;

      if (savedDistance >= SCRATCH_POINT_SAVE_DISTANCE) {
        lastSavedPointRef.current = point;
        pendingScratchPointsRef.current.push(surfacePoint);
      }

      scheduleProgressUpdate();
    },
    [active, eraseCanvasPoint, getCanvasPoint, measureSlotRevealRatio, scheduleProgressUpdate],
  );

  const restoreCoverFromScratchPoints = useCallback(() => {
    if (!visible) {
      return;
    }

    if (drawingRef.current) {
      return;
    }

    drawCover();

    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    lastPointRef.current = null;

    for (const point of scratchPointsRef.current) {
      eraseCanvasPoint({
        x: point.xPercent * canvas.width,
        y: point.yPercent * canvas.height,
      });
    }

    const revealedSlots = Array.from(
      { length: getLayoutSlotBounds(cardTypeRef.current)?.length ?? 3 },
      (_, slotIndex) => slotIndex,
    ).filter(
      (slotIndex) =>
        measureSlotRevealRatio(slotIndex) >= getScratchCardRevealThreshold(cardTypeRef.current),
    );

    revealedSlotIndexesRef.current = new Set(revealedSlots);
    onRevealSlotsSyncRef.current(revealedSlots);
    lastPointRef.current = null;
    flushProgressUpdate();
  }, [drawCover, eraseCanvasPoint, flushProgressUpdate, measureSlotRevealRatio, visible]);

  useEffect(() => {
    if (coverTextureImageRef.current) {
      return;
    }

    let cancelled = false;
    const coverTextureImage = new Image();
    coverTextureImage.decoding = 'async';
    coverTextureImage.src = SCRATCH_COVER_TEXTURE_SRC;

    coverTextureImage.onload = () => {
      if (cancelled) {
        return;
      }

      coverTextureImageRef.current = coverTextureImage;
      restoreCoverFromScratchPoints();
    };

    coverTextureImage.onerror = () => {
      if (cancelled) {
        return;
      }

      coverTextureImageRef.current = null;
    };

    if (coverTextureImage.complete && coverTextureImage.naturalWidth > 0) {
      coverTextureImageRef.current = coverTextureImage;
      restoreCoverFromScratchPoints();
    }

    return () => {
      cancelled = true;
      coverTextureImage.onload = null;
      coverTextureImage.onerror = null;
    };
  }, [restoreCoverFromScratchPoints]);

  useLayoutEffect(() => {
    restoreCoverFromScratchPoints();
  }, [restoreCoverFromScratchPoints]);

  useEffect(() => {
    function stopDrawing() {
      if (drawingRef.current) {
        flushProgressUpdate();
        flushScratchPoints();
      }

      drawingRef.current = false;
      lastPointRef.current = null;
    }

    window.addEventListener('blur', stopDrawing);
    window.addEventListener('pointerup', stopDrawing);
    document.addEventListener('visibilitychange', stopDrawing);

    return () => {
      window.removeEventListener('blur', stopDrawing);
      window.removeEventListener('pointerup', stopDrawing);
      document.removeEventListener('visibilitychange', stopDrawing);

      if (progressFrameRef.current !== null) {
        window.cancelAnimationFrame(progressFrameRef.current);
      }
    };
  }, [flushProgressUpdate, flushScratchPoints]);

  if (!visible) {
    return null;
  }

  const canvasLayout = SCRATCH_CANVAS_LAYOUTS[cardType];

  return (
    <canvas
      ref={canvasRef}
      className="scratch-card-cover"
      width={canvasLayout.width}
      height={canvasLayout.height}
      aria-label="刮刮卡遮罩"
      onPointerDown={(event) => {
        if (active) {
          drawingRef.current = true;
          lastPointRef.current = getCanvasPoint(event.clientX, event.clientY);
          event.currentTarget.setPointerCapture(event.pointerId);
        }
      }}
      onPointerMove={(event) => {
        if (drawingRef.current) {
          eraseAt(event.clientX, event.clientY);
        }
      }}
      onPointerUp={(event) => {
        flushProgressUpdate();
        flushScratchPoints();
        drawingRef.current = false;
        lastPointRef.current = null;

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => {
        flushProgressUpdate();
        flushScratchPoints();
        drawingRef.current = false;
        lastPointRef.current = null;
      }}
    />
  );
}
