'use client';

import { useCallback, useEffect, useRef } from 'react';
import { CLEAN_COMPLETE_THRESHOLD, clampRatio } from '@/lib/game';

type CleaningCanvasProps = {
  active: boolean;
  onProgressChange: (progress: number) => void;
  onComplete: () => void;
};

const CANVAS_SIZE = 520;
const BRUSH_RADIUS = 27;

export function CleaningCanvas({ active, onProgressChange, onComplete }: CleaningCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const dirtyPixelsRef = useRef(1);
  const completedRef = useRef(false);

  const countDirtyPixels = useCallback(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return 0;
    }

    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context) {
      return 0;
    }

    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let dirtyPixels = 0;

    for (let index = 3; index < data.length; index += 4) {
      if (data[index] > 20) {
        dirtyPixels += 1;
      }
    }

    return dirtyPixels;
  }, []);

  const updateProgress = useCallback(() => {
    const remainingDirty = countDirtyPixels();
    const cleanedRatio = clampRatio(1 - remainingDirty / dirtyPixelsRef.current);
    const displayedRatio = cleanedRatio >= CLEAN_COMPLETE_THRESHOLD ? 1 : cleanedRatio;

    onProgressChange(displayedRatio);

    if (!completedRef.current && cleanedRatio >= CLEAN_COMPLETE_THRESHOLD) {
      completedRef.current = true;
      onComplete();
    }
  }, [countDirtyPixels, onComplete, onProgressChange]);

  const drawDirt = useCallback(() => {
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

    const dirtPatches = [
      [120, 112, 58, 42, '#c98d54'],
      [188, 92, 72, 52, '#e0b06f'],
      [280, 120, 64, 48, '#c77d45'],
      [350, 170, 78, 54, '#dfa464'],
      [166, 205, 82, 56, '#d99a5b'],
      [255, 238, 104, 58, '#c7864d'],
      [360, 285, 82, 62, '#e0b070'],
      [210, 330, 96, 68, '#cd8750'],
      [310, 370, 78, 54, '#daa264'],
      [140, 320, 76, 50, '#e4b575'],
      [112, 236, 58, 52, '#c5854a'],
      [410, 236, 62, 46, '#c8874d'],
    ] as const;

    for (const [x, y, width, height, color] of dirtPatches) {
      context.fillStyle = color;
      context.globalAlpha = 0.82;
      context.beginPath();
      context.ellipse(x, y, width, height, Math.random() * 0.6, 0, Math.PI * 2);
      context.fill();
    }

    context.globalAlpha = 1;
    context.strokeStyle = '#f0ce87';
    context.lineWidth = 8;
    context.lineCap = 'round';

    const noodleLines = [
      [
        [155, 142],
        [190, 176],
        [238, 166],
        [274, 204],
      ],
      [
        [232, 280],
        [272, 240],
        [322, 262],
        [355, 220],
      ],
      [
        [298, 110],
        [332, 154],
        [306, 190],
      ],
      [
        [184, 376],
        [218, 338],
        [264, 354],
      ],
    ];

    for (const line of noodleLines) {
      context.beginPath();
      line.forEach(([x, y], index) => {
        if (index === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      });
      context.stroke();
    }

    context.fillStyle = '#9f6744';
    context.globalAlpha = 0.78;

    for (let index = 0; index < 42; index += 1) {
      const x = 88 + Math.random() * 344;
      const y = 78 + Math.random() * 350;
      context.beginPath();
      context.ellipse(
        x,
        y,
        4 + Math.random() * 8,
        2 + Math.random() * 5,
        Math.random(),
        0,
        Math.PI * 2,
      );
      context.fill();
    }

    context.globalAlpha = 1;
    dirtyPixelsRef.current = Math.max(1, countDirtyPixels());
    completedRef.current = false;
    onProgressChange(0);
  }, [countDirtyPixels, onProgressChange]);

  const getCanvasPoint = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    return {
      x,
      y,
    };
  }, []);

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

      const { x, y } = point;
      const context = canvas.getContext('2d', { willReadFrequently: true });

      if (!context) {
        return;
      }

      context.save();
      context.globalCompositeOperation = 'destination-out';

      for (let index = 0; index < 4; index += 1) {
        const offsetX = (Math.random() - 0.5) * 10;
        const offsetY = (Math.random() - 0.5) * 10;
        context.beginPath();
        context.arc(x + offsetX, y + offsetY, BRUSH_RADIUS + Math.random() * 7, 0, Math.PI * 2);
        context.fill();
      }

      context.restore();
      updateProgress();
    },
    [active, getCanvasPoint, updateProgress],
  );

  useEffect(() => {
    drawDirt();
  }, [drawDirt]);

  useEffect(() => {
    function stopDrawing() {
      drawingRef.current = false;
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

  return (
    <div className="cleaning-canvas-wrap">
      <canvas
        ref={canvasRef}
        className="dirt-canvas"
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        aria-label="脏盘子污渍层"
        onPointerDown={(event) => {
          if (active) {
            drawingRef.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            eraseAt(event.clientX, event.clientY);
          }
        }}
        onPointerMove={(event) => {
          if (drawingRef.current) {
            eraseAt(event.clientX, event.clientY);
          }
        }}
        onPointerUp={(event) => {
          drawingRef.current = false;

          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={() => {
          drawingRef.current = false;
        }}
      />
    </div>
  );
}
