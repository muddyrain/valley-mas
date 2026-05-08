'use client';

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { clampRatio, type ScratchSurfacePoint, shouldRevealFullScratchCover } from '@/lib/game';

type ScratchCardCanvasProps = {
  active: boolean;
  visible: boolean;
  scratchPoints: readonly ScratchSurfacePoint[];
  brushRadius: number;
  stepDistance: number;
  onProgressChange: (progress: number) => void;
  onScratchPoint: (point: ScratchSurfacePoint) => void;
  onComplete: () => void;
};

const CANVAS_WIDTH = 230;
const CANVAS_HEIGHT = 66;
const SCRATCH_STAMP_OFFSETS = [
  [0, 0, 1],
  [-10, -3, 0.62],
  [8, 5, 0.68],
  [-5, 9, 0.5],
  [13, -7, 0.42],
  [-15, 6, 0.36],
] as const;

export function ScratchCardCanvas({
  active,
  visible,
  scratchPoints,
  brushRadius,
  stepDistance,
  onProgressChange,
  onScratchPoint,
  onComplete,
}: ScratchCardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const coveredPixelsRef = useRef(1);
  const completedRef = useRef(false);
  const scratchPointsRef = useRef(scratchPoints);
  const onProgressChangeRef = useRef(onProgressChange);
  const onScratchPointRef = useRef(onScratchPoint);
  const onCompleteRef = useRef(onComplete);

  scratchPointsRef.current = scratchPoints;
  onProgressChangeRef.current = onProgressChange;
  onScratchPointRef.current = onScratchPoint;
  onCompleteRef.current = onComplete;

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

  const updateProgress = useCallback(() => {
    const remainingCover = countCoveredPixels();
    const scratchedRatio = clampRatio(1 - remainingCover / coveredPixelsRef.current);
    const shouldRevealFullCover = shouldRevealFullScratchCover(scratchedRatio);
    const displayedRatio = shouldRevealFullCover ? 1 : scratchedRatio;

    onProgressChangeRef.current(displayedRatio);

    if (!completedRef.current && shouldRevealFullCover) {
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d', { willReadFrequently: true });

      context?.clearRect(0, 0, canvas?.width ?? 0, canvas?.height ?? 0);
      completedRef.current = true;
      onCompleteRef.current();
    }
  }, [countCoveredPixels]);

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

    context.fillStyle = 'rgba(65, 76, 83, 0.62)';
    context.font = '700 14px Arial';
    context.textAlign = 'center';
    context.fillText('SCRATCH', canvas.width / 2, canvas.height / 2 + 5);

    coveredPixelsRef.current = Math.max(1, countCoveredPixels());
    completedRef.current = false;
    lastPointRef.current = null;
    onProgressChangeRef.current(0);
  }, [countCoveredPixels]);

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
      onScratchPointRef.current({
        xPercent: clampRatio(point.x / canvas.width),
        yPercent: clampRatio(point.y / canvas.height),
      });
      updateProgress();
    },
    [active, eraseCanvasPoint, getCanvasPoint, updateProgress],
  );

  useLayoutEffect(() => {
    if (!visible) {
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

    lastPointRef.current = null;
    updateProgress();
  }, [drawCover, eraseCanvasPoint, updateProgress, visible]);

  useEffect(() => {
    function stopDrawing() {
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
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className="scratch-card-cover"
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
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
        drawingRef.current = false;
        lastPointRef.current = null;

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => {
        drawingRef.current = false;
        lastPointRef.current = null;
      }}
    />
  );
}
