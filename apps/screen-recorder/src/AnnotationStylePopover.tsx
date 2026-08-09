import type { CSSProperties } from 'react';
import { Button } from './components/ui/button';
import type { AnnotationColor, AnnotationStrokeWidth } from './core/annotation';

const COLORS: AnnotationColor[] = ['#2563eb', '#ef4444', '#111827', '#ffffff'];
const STROKE_WIDTHS: AnnotationStrokeWidth[] = [2, 4, 8];
const DEFAULT_SIZE_OPTIONS = STROKE_WIDTHS.map((value) => ({
  value,
  label: String(value),
  dotSize: value + 4,
}));

type AnnotationStylePopoverProps = {
  toolLabel: string;
  color?: AnnotationColor;
  strokeWidth?: AnnotationStrokeWidth;
  sizeValue?: number;
  sizeLabel?: string;
  sizeOptions?: Array<{ value: number; label: string; dotSize: number }>;
  anchorOffset: number;
  onColorChange?(color: AnnotationColor): void;
  onStrokeWidthChange?(strokeWidth: AnnotationStrokeWidth): void;
  onSizeChange?(value: number): void;
};

export function AnnotationStylePopover({
  toolLabel,
  color,
  strokeWidth,
  sizeValue,
  sizeLabel = '粗细',
  sizeOptions = DEFAULT_SIZE_OPTIONS,
  anchorOffset,
  onColorChange,
  onStrokeWidthChange,
  onSizeChange,
}: AnnotationStylePopoverProps) {
  const selectedSize = sizeValue ?? strokeWidth;
  const updateSize = (value: number) => {
    if (onSizeChange) onSizeChange(value);
    else onStrokeWidthChange?.(value as AnnotationStrokeWidth);
  };
  return (
    <div
      className="annotation-style-popover"
      role="dialog"
      aria-label={`${toolLabel}样式`}
      style={{ '--annotation-popover-left': `${anchorOffset}px` } as CSSProperties}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {color && onColorChange && (
        <div className="annotation-style-group">
          <span>颜色</span>
          <div>
            {COLORS.map((value) => (
              <Button
                key={value}
                size="icon"
                variant="ghost"
                className={color === value ? 'annotation-style-selected' : undefined}
                aria-label={`颜色 ${value}`}
                aria-pressed={color === value}
                onClick={() => onColorChange(value)}
              >
                <i className="annotation-color-dot" style={{ background: value }} />
              </Button>
            ))}
          </div>
        </div>
      )}
      {color && onColorChange && <div className="annotation-style-divider" />}
      <div className="annotation-style-group">
        <span>{sizeLabel}</span>
        <div>
          {sizeOptions.map((option) => (
            <Button
              key={option.value}
              size="icon"
              variant="ghost"
              className={selectedSize === option.value ? 'annotation-style-selected' : undefined}
              aria-label={`${sizeLabel} ${option.label}`}
              aria-pressed={selectedSize === option.value}
              onClick={() => updateSize(option.value)}
            >
              <i
                className="annotation-width-dot"
                style={{ width: option.dotSize, height: option.dotSize }}
              />
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
