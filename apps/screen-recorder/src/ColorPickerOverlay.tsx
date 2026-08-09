import { Pipette } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { colorFormatForShift, formatPickedColor, type RgbColor, rgbToHex } from './core/color';
import type { ColorPickerFrame } from './shared/contracts';
import { useShiftColorFormat } from './useShiftColorFormat';

export function ColorPickerOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [frame, setFrame] = useState<ColorPickerFrame>();
  const [color, setColor] = useState<RgbColor>();
  const format = useShiftColorFormat();
  const [point, setPoint] = useState({ x: 24, y: 24 });
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void window.screenRecorder
      .getColorPickerFrame()
      .then((next) => {
        if (active) setFrame(next);
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : '无法读取屏幕颜色');
      });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void window.screenRecorder.cancelSelection();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      active = false;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frame) return;
    const image = new Image();
    image.onload = () => {
      canvas.width = frame.pixelSize.width;
      canvas.height = frame.pixelSize.height;
      canvas.getContext('2d', { willReadFrequently: true })?.drawImage(image, 0, 0);
      window.screenRecorder.selectionReady();
    };
    image.onerror = () => setError('屏幕画面无法读取');
    image.src = frame.imageDataUrl;
  }, [frame]);

  const sample = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !frame || canvas.width === 0 || canvas.height === 0) return;
    const x = Math.max(
      0,
      Math.min(canvas.width - 1, Math.floor((clientX / frame.displaySize.width) * canvas.width)),
    );
    const y = Math.max(
      0,
      Math.min(canvas.height - 1, Math.floor((clientY / frame.displaySize.height) * canvas.height)),
    );
    const pixel = canvas
      .getContext('2d', { willReadFrequently: true })
      ?.getImageData(x, y, 1, 1).data;
    if (pixel) setColor({ r: pixel[0], g: pixel[1], b: pixel[2] });
    setPoint({ x: clientX, y: clientY });
  };

  const complete = (shiftKey: boolean) => {
    if (color) {
      void window.screenRecorder.completeColorPicker(
        formatPickedColor(color, colorFormatForShift(shiftKey)),
      );
    }
  };

  return (
    <div
      className="color-picker-overlay"
      onContextMenu={(event) => {
        event.preventDefault();
        void window.screenRecorder.cancelSelection();
      }}
      onPointerMove={(event) => sample(event.clientX, event.clientY)}
      onPointerDown={(event) => {
        if (event.button === 0) complete(event.shiftKey);
      }}
    >
      <canvas ref={canvasRef} className="color-picker-canvas" />
      <div className="color-picker-hint">
        <Pipette size={15} aria-hidden="true" /> 移动取色 · 按住 Shift 显示 RGB · 单击复制
      </div>
      {color && (
        <div
          className="color-picker-card"
          style={{
            left: Math.min(window.innerWidth - 204, point.x + 18),
            top: Math.min(window.innerHeight - 116, point.y + 18),
          }}
        >
          <span className="color-picker-swatch" style={{ backgroundColor: rgbToHex(color) }} />
          <div>
            <strong>{formatPickedColor(color, format)}</strong>
            <span>{format === 'hex' ? formatPickedColor(color, 'rgb') : rgbToHex(color)}</span>
          </div>
          <kbd className="color-picker-shortcut">
            {format === 'hex' ? 'Shift · RGB' : '松开 · HEX'}
          </kbd>
        </div>
      )}
      {error && <div className="selection-error">{error}</div>}
    </div>
  );
}
