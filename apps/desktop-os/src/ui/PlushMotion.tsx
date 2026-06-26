// data-motion-duration 协议:reduced 一律 "0",非 reduced 一律 "",方便后续 Phase 用统一选择器断言 reduced-motion 命中。
// reduced + open=false 时三个原语统一直接 return null,跳过 AnimatePresence exit,避免 motion / 业务侧对 exit 时序产生分歧假设。
import { AnimatePresence, motion, type Transition, useReducedMotion } from 'motion/react';
import type { CSSProperties, PropsWithChildren, ReactNode } from 'react';

export const MOTION_TOKENS = {
  pop: {
    type: 'spring' as const,
    stiffness: 320,
    damping: 26,
    mass: 0.9,
  } satisfies Transition,
  fade: {
    type: 'tween' as const,
    duration: 0.18,
    ease: [0.32, 0.08, 0.24, 1] as [number, number, number, number],
  } satisfies Transition,
  slide: {
    type: 'spring' as const,
    stiffness: 280,
    damping: 30,
    mass: 0.85,
  } satisfies Transition,
};

interface PresenceProps {
  children: ReactNode;
  mode?: 'sync' | 'wait' | 'popLayout';
}

export function PlushPresence({ children, mode = 'popLayout' }: PresenceProps) {
  return (
    <AnimatePresence mode={mode} initial={false}>
      {children}
    </AnimatePresence>
  );
}

interface BaseProps extends PropsWithChildren {
  open?: boolean;
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

export function PlushPop({ open = true, children, className, style, ...rest }: BaseProps) {
  const reduced = useReducedMotion();
  if (!open && reduced) return null;
  return (
    <motion.div
      data-state={open ? 'enter' : 'exit'}
      data-motion-presence="pop"
      data-motion-duration={reduced ? '0' : ''}
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 6 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 6 }}
      transition={reduced ? { duration: 0 } : MOTION_TOKENS.pop}
      className={className}
      style={style}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function PlushFade({ open = true, children, className, style, ...rest }: BaseProps) {
  const reduced = useReducedMotion();
  if (!open && reduced) return null;
  return (
    <motion.div
      data-state={open ? 'enter' : 'exit'}
      data-motion-presence="fade"
      data-motion-duration={reduced ? '0' : ''}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={reduced ? { duration: 0 } : MOTION_TOKENS.fade}
      className={className}
      style={style}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

type SlideFrom = 'top' | 'right' | 'bottom' | 'left';
interface SlideProps extends BaseProps {
  from: SlideFrom;
}

const SLIDE_OFFSET: Record<SlideFrom, { x: number; y: number }> = {
  top: { x: 0, y: -16 },
  right: { x: 16, y: 0 },
  bottom: { x: 0, y: 16 },
  left: { x: -16, y: 0 },
};

export function PlushSlide({ open = true, from, children, className, style, ...rest }: SlideProps) {
  const reduced = useReducedMotion();
  if (!open && reduced) return null;
  const offset = SLIDE_OFFSET[from];
  return (
    <motion.div
      data-state={open ? 'enter' : 'exit'}
      data-motion-presence="slide"
      data-from={from}
      data-motion-duration={reduced ? '0' : ''}
      initial={reduced ? { opacity: 0 } : { opacity: 0, ...offset }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, x: 0, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, ...offset }}
      transition={reduced ? { duration: 0 } : MOTION_TOKENS.slide}
      className={className}
      style={style}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
