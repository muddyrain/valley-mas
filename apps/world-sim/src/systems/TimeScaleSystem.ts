export type TimeScaleSpeed = 0 | 1 | 2 | 4;

export type TimeScaleKeyboardEventLike = {
  key?: string;
  code?: string;
};

const SUPPORTED_SPEEDS: TimeScaleSpeed[] = [0, 1, 2, 4];

export function getTimeScaleSpeedFromKeyboardEvent(
  event: TimeScaleKeyboardEventLike,
): TimeScaleSpeed | undefined {
  const key = event.key?.toLowerCase();
  const code = event.code?.toLowerCase();

  if (key === '1' || code === 'digit1' || code === 'numpad1') {
    return 1;
  }

  if (key === '2' || code === 'digit2' || code === 'numpad2') {
    return 2;
  }

  if (key === '4' || code === 'digit4' || code === 'numpad4') {
    return 4;
  }

  if (key === '0' || key === 'p' || code === 'digit0' || code === 'numpad0' || code === 'keyp') {
    return 0;
  }

  return undefined;
}

export class TimeScaleSystem {
  private currentSpeed: TimeScaleSpeed = 1;

  get speed() {
    return this.currentSpeed;
  }

  setSpeed(speed: number) {
    if (!SUPPORTED_SPEEDS.includes(speed as TimeScaleSpeed)) {
      return;
    }

    this.currentSpeed = speed as TimeScaleSpeed;
  }

  scaleDelta(deltaMs: number) {
    return deltaMs * this.currentSpeed;
  }

  getLabel() {
    return this.currentSpeed === 0 ? '暂停' : `${this.currentSpeed}x`;
  }
}
