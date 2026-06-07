import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BOTTOM_SHEET_CLOSE_THRESHOLD,
  getBottomSheetDragOffset,
  isBottomSheetInteractiveTarget,
  shouldCloseBottomSheetByDrag,
  shouldStartBottomSheetDrag,
} from '@/lib/bottomSheetGesture';
import { cn } from '@/lib/utils';

type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overlayLabel: string;
  children: ReactNode;
  closeDisabled?: boolean;
  className?: string;
  zIndexClassName?: string;
  showHandle?: boolean;
  portal?: boolean;
};

export function BottomSheet({
  open,
  onOpenChange,
  overlayLabel,
  children,
  closeDisabled = false,
  className,
  zIndexClassName = 'z-[70]',
  showHandle = true,
  portal = true,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startYRef = useRef(0);
  const dragStartYRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setDragOffset(0);
      setDragging(false);
      startYRef.current = 0;
      dragStartYRef.current = 0;
      pointerIdRef.current = null;
    }
  }, [open]);

  const requestClose = () => {
    if (closeDisabled) {
      return;
    }
    onOpenChange(false);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (
      !shouldStartBottomSheetDrag({
        open,
        closeDisabled,
        targetIsInteractive: isBottomSheetInteractiveTarget(event.target),
      })
    ) {
      return;
    }

    pointerIdRef.current = event.pointerId;
    startYRef.current = event.clientY;
    dragStartYRef.current = event.clientY;
    setDragging(false);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (event.cancelable) {
      event.preventDefault();
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId || closeDisabled) {
      return;
    }

    const nextOffset = getBottomSheetDragOffset({
      startY: startYRef.current,
      currentY: event.clientY,
      currentScrollTop: 0,
      dragging,
      dragStartY: dragStartYRef.current,
    });
    if (nextOffset === null) {
      return;
    }

    if (!dragging) {
      setDragging(true);
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    setDragOffset(nextOffset);
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    pointerIdRef.current = null;

    const finalOffset = Math.max(0, event.clientY - dragStartYRef.current);
    setDragging(false);
    if (
      shouldCloseBottomSheetByDrag({
        finalOffset,
        closeDisabled,
        closeThreshold: BOTTOM_SHEET_CLOSE_THRESHOLD,
      })
    ) {
      setDragOffset(0);
      onOpenChange(false);
      return;
    }

    setDragOffset(0);
  };

  const sheet = (
    <div
      className={cn(
        'fixed inset-0 transition',
        zIndexClassName,
        open ? 'pointer-events-auto' : 'pointer-events-none',
      )}
    >
      <button
        type="button"
        aria-label={overlayLabel}
        className={cn(
          'absolute inset-0 bg-background/72 backdrop-blur-sm transition-opacity',
          open ? 'opacity-100' : 'opacity-0',
        )}
        style={{
          opacity: open ? Math.max(0, 1 - dragOffset / 220) : 0,
        }}
        onClick={requestClose}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        className={cn(
          'absolute inset-x-0 bottom-0 mx-auto flex max-h-[calc(100dvh-0.75rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[1.75rem] border border-border bg-card shadow-2xl',
          dragging ? 'transition-none' : 'transition duration-300',
          open
            ? 'visible translate-y-0 opacity-100'
            : 'invisible translate-y-[calc(100%+2rem)] opacity-0',
          className,
        )}
        style={{
          transform: open ? `translateY(${dragOffset}px)` : undefined,
        }}
      >
        {showHandle ? (
          <div className="shrink-0 px-5 pt-5 max-[360px]:px-4 max-[360px]:pt-4">
            <div
              className="-mx-2 mb-4 flex h-8 touch-none select-none items-center justify-center rounded-full cursor-grab active:cursor-grabbing"
              data-sheet-drag-handle="true"
              style={{ touchAction: 'none' }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
            >
              <div className="h-1.5 w-11 rounded-full bg-muted-foreground/25" />
            </div>
          </div>
        ) : null}
        <div
          className={cn(
            'safe-bottom min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 max-[360px]:px-4',
            showHandle ? null : 'pt-5 max-[360px]:pt-4',
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );

  if (portal && typeof document !== 'undefined') {
    return createPortal(sheet, document.body);
  }

  return sheet;
}
