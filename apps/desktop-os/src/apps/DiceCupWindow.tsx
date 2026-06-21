import { Dices } from 'lucide-react';
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import { createDicePlacements3D, rollDice } from '../tools/miniGamesV2';
import DiceCupScene from './DiceCupScene';
import './MiniApps.css';

const DICE_COUNT = 5;
const SHAKE_DURATION_MS = 920;
const REVEAL_THRESHOLD = 82;
const CLOSE_DRAG_THRESHOLD = 24;
const OPEN_LID_OFFSET = { x: 112, y: -110 };
const CLOSED_LID_OFFSET = { x: 0, y: 0 };

interface Point {
  x: number;
  y: number;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  origin: Point;
}

export default function DiceCupWindow() {
  const reducedMotion = usePrefersReducedMotion();
  const [dice, setDice] = useState(() => rollDice(DICE_COUNT));
  const [rollingDice, setRollingDice] = useState(() => rollDice(DICE_COUNT));
  const [dicePlacements, setDicePlacements] = useState(() => createDicePlacements3D(DICE_COUNT));
  const [rollingPlacements, setRollingPlacements] = useState(() =>
    createDicePlacements3D(DICE_COUNT),
  );
  const [isShaking, setIsShaking] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasRolled, setHasRolled] = useState(false);
  const [lidOffset, setLidOffset] = useState<Point>(CLOSED_LID_OFFSET);
  const dragRef = useRef<DragState | null>(null);
  const displayDice = isShaking ? rollingDice : dice;
  const displayPlacements = isShaking ? rollingPlacements : dicePlacements;

  useEffect(() => {
    if (!isShaking) return;
    const roller = window.setInterval(() => {
      setRollingDice(rollDice(DICE_COUNT));
      setRollingPlacements(createDicePlacements3D(DICE_COUNT));
    }, 90);
    const stopper = window.setTimeout(() => {
      const nextDice = rollDice(DICE_COUNT);
      const nextPlacements = createDicePlacements3D(DICE_COUNT);
      setDice(nextDice);
      setRollingDice(nextDice);
      setDicePlacements(nextPlacements);
      setRollingPlacements(nextPlacements);
      setIsShaking(false);
      setHasRolled(true);
    }, SHAKE_DURATION_MS);
    return () => {
      window.clearInterval(roller);
      window.clearTimeout(stopper);
    };
  }, [isShaking]);

  function closeLid() {
    dragRef.current = null;
    setIsOpen(false);
    setLidOffset(CLOSED_LID_OFFSET);
  }

  function shake() {
    if (isShaking) return;
    closeLid();
    setRollingDice(rollDice(DICE_COUNT));
    setRollingPlacements(createDicePlacements3D(DICE_COUNT));
    setIsShaking(true);
  }

  function onLidPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (isShaking) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: lidOffset,
    };
  }

  function onLidPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const nextOffset = {
      x: clamp(drag.origin.x + event.clientX - drag.startX, -96, 118),
      y: clamp(drag.origin.y + event.clientY - drag.startY, -138, 22),
    };
    setLidOffset(nextOffset);
  }

  function onLidPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    const dragDistance = Math.hypot(deltaX, deltaY);
    if (isOpen) {
      const movedTowardClosed =
        dragDistance <= 6 ||
        deltaY >= CLOSE_DRAG_THRESHOLD ||
        deltaX <= -CLOSE_DRAG_THRESHOLD ||
        lidOffset.x < OPEN_LID_OFFSET.x - 32 ||
        lidOffset.y > OPEN_LID_OFFSET.y + 32;
      setIsOpen(!movedTowardClosed);
      setLidOffset(movedTowardClosed ? CLOSED_LID_OFFSET : OPEN_LID_OFFSET);
      return;
    }
    const revealScore = Math.abs(lidOffset.x) + Math.max(0, -lidOffset.y) * 1.15;
    const shouldOpen = revealScore >= REVEAL_THRESHOLD || lidOffset.y <= -64;
    setIsOpen(shouldOpen);
    setLidOffset(shouldOpen ? OPEN_LID_OFFSET : CLOSED_LID_OFFSET);
  }

  return (
    <div
      className={`dock-app-window mini-app dice-cup-window${isShaking ? ' is-shaking' : ''}${
        isOpen ? ' is-open' : ''
      }`}
    >
      <header className="mini-app__header">
        <div>
          <div className="dock-app-window__eyebrow">小游戏</div>
          <h2>骰盅</h2>
        </div>
        <div className="mini-app__header-actions">
          <button type="button" className="mini-app__secondary" onClick={closeLid}>
            盖上
          </button>
        </div>
      </header>

      <section className="dice-cup-stage" aria-label="骰盅">
        <div className="dice-cup-canvas-stage">
          <DiceCupScene
            dice={displayDice}
            isOpen={isOpen}
            isShaking={isShaking}
            lidOffset={lidOffset}
            placements={displayPlacements}
            reducedMotion={reducedMotion}
          />
          <button
            type="button"
            className="dice-cup-lid-drag"
            aria-label={isOpen ? '盖上' : '掀开'}
            onPointerDown={onLidPointerDown}
            onPointerMove={onLidPointerMove}
            onPointerUp={onLidPointerUp}
            onPointerCancel={onLidPointerUp}
          />
        </div>
      </section>

      <div className="dice-cup-actions">
        <button
          type="button"
          className="dice-cup-shake-button"
          onClick={shake}
          disabled={isShaking}
        >
          <Dices size={22} strokeWidth={2.5} />
          <span>{isShaking ? '摇动中' : hasRolled ? '重摇' : '摇'}</span>
        </button>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(query.matches);
    function onChange(event: MediaQueryListEvent) {
      setReducedMotion(event.matches);
    }
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reducedMotion;
}
