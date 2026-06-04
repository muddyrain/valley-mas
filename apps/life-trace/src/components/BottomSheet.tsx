import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BOTTOM_SHEET_CLOSE_THRESHOLD,
  getBottomSheetDragOffset,
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
  portal = false,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startYRef = useRef(0);
  const dragStartYRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);

  const shouldIgnoreDragTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return Boolean(
      target.closest(
        'button, input, textarea, select, option, a, label, [role="button"], [contenteditable="true"], [data-sheet-drag-ignore="true"]',
      ),
    );
  };

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
        targetIsInteractive: shouldIgnoreDragTarget(event.target),
      })
    ) {
      return;
    }

    pointerIdRef.current = event.pointerId;
    startYRef.current = event.clientY;
    dragStartYRef.current = event.clientY;
    setDragging(false);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId || closeDisabled) {
      return;
    }

    const sheet = sheetRef.current;
    const currentScrollTop = sheet?.scrollTop ?? 0;

    if (!dragging && currentScrollTop > 0) {
      dragStartYRef.current = event.clientY;
      return;
    }

    const nextOffset = getBottomSheetDragOffset({
      startY: startYRef.current,
      currentY: event.clientY,
      currentScrollTop,
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
          'safe-bottom absolute inset-x-0 bottom-0 mx-auto max-h-[calc(100dvh-0.75rem)] w-full max-w-[430px] overflow-x-hidden overflow-y-auto overscroll-contain rounded-t-[1.75rem] border border-border bg-card p-5 shadow-2xl max-[360px]:p-4',
          dragging ? 'transition-none' : 'transition duration-300',
          open
            ? 'visible translate-y-0 opacity-100'
            : 'invisible translate-y-[calc(100%+2rem)] opacity-0',
          className,
        )}
        style={{
          touchAction: 'pan-y',
          transform: open ? `translateY(${dragOffset}px)` : undefined,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        {showHandle ? (
          <div
            className="mb-4 flex cursor-grab justify-center active:cursor-grabbing"
            style={{ touchAction: dragging ? 'none' : 'pan-y' }}
          >
            <div className="h-1.5 w-11 rounded-full bg-muted-foreground/25" />
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );

  if (portal && typeof document !== 'undefined') {
    return createPortal(sheet, document.body);
  }

  return sheet;
}
