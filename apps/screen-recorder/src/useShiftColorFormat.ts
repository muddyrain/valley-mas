import { useEffect, useState } from 'react';
import { type ColorFormat, colorFormatForShift } from './core/color';

export function useShiftColorFormat(): ColorFormat {
  const [shiftPressed, setShiftPressed] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') setShiftPressed(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') setShiftPressed(false);
    };
    const reset = () => setShiftPressed(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', reset);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', reset);
    };
  }, []);

  return colorFormatForShift(shiftPressed);
}
