export type WeatherMotionKind =
  | 'sunny'
  | 'lightRain'
  | 'rain'
  | 'heavyRain'
  | 'snow'
  | 'storm'
  | 'cloud';

type Point = [number, number];
type Scalar = number | number[];
type AnimatedFrame = {
  t: number;
  s: Scalar;
  e?: Scalar;
};

type LottieAnimationData = Record<string, unknown>;

const DURATION = 120;
const EASE = {
  i: { x: [0.667], y: [1] },
  o: { x: [0.333], y: [0] },
};

function rgb(hex: string) {
  const value = hex.replace('#', '');
  const chunk =
    value.length === 3 ? value.split('').map((part) => `${part}${part}`) : value.match(/.{1,2}/g);
  if (!chunk || chunk.length < 3) {
    return [1, 1, 1, 1];
  }
  return [
    Number.parseInt(chunk[0], 16) / 255,
    Number.parseInt(chunk[1], 16) / 255,
    Number.parseInt(chunk[2], 16) / 255,
    1,
  ];
}

function normalize(value: Scalar) {
  return Array.isArray(value) ? value : [value];
}

function fixed<T>(value: T) {
  return { a: 0, k: value };
}

function animated(frames: AnimatedFrame[]) {
  return {
    a: 1,
    k: frames.map((frame, index) => {
      const next = frames[index + 1];
      if (!next) {
        return { t: frame.t, s: normalize(frame.s) };
      }
      return {
        t: frame.t,
        s: normalize(frame.s),
        e: normalize(frame.e ?? next.s),
        ...EASE,
      };
    }),
  };
}

function transformShape({
  position = [0, 0],
  anchor = [0, 0],
  scale = [100, 100],
  rotation = 0,
  opacity = 100,
}: {
  position?: Point;
  anchor?: Point;
  scale?: Point;
  rotation?: number;
  opacity?: number;
}) {
  return {
    ty: 'tr',
    p: fixed(position),
    a: fixed(anchor),
    s: fixed(scale),
    r: fixed(rotation),
    o: fixed(opacity),
    sk: fixed(0),
    sa: fixed(0),
  };
}

function group(
  name: string,
  items: Record<string, unknown>[],
  options?: Parameters<typeof transformShape>[0],
) {
  return {
    ty: 'gr',
    nm: name,
    it: [...items, transformShape(options ?? {})],
  };
}

function fill(color: string, opacity = 100) {
  return {
    ty: 'fl',
    c: fixed(rgb(color)),
    o: fixed(opacity),
    r: 1,
  };
}

function stroke(color: string, width: number, opacity = 100) {
  return {
    ty: 'st',
    c: fixed(rgb(color)),
    o: fixed(opacity),
    w: fixed(width),
    lc: 2,
    lj: 2,
    ml: 4,
  };
}

function ellipse(size: Point) {
  return {
    ty: 'el',
    p: fixed([0, 0]),
    s: fixed(size),
    d: 1,
  };
}

function rect(size: Point, radius: number) {
  return {
    ty: 'rc',
    p: fixed([0, 0]),
    s: fixed(size),
    r: fixed(radius),
    d: 1,
  };
}

function path(points: Point[], closed = true) {
  return {
    ty: 'sh',
    ks: fixed({
      i: points.map(() => [0, 0]),
      o: points.map(() => [0, 0]),
      v: points,
      c: closed,
    }),
  };
}

function shapeLayer({
  index,
  name,
  shapes,
  position = [48, 48, 0],
  rotation = 0,
  scale = [100, 100, 100],
  opacity = 100,
}: {
  index: number;
  name: string;
  shapes: Record<string, unknown>[];
  position?: [number, number, number] | ReturnType<typeof animated>;
  rotation?: number | ReturnType<typeof animated>;
  scale?: [number, number, number] | ReturnType<typeof animated>;
  opacity?: number | ReturnType<typeof animated>;
}) {
  return {
    ddd: 0,
    ind: index,
    ty: 4,
    nm: name,
    sr: 1,
    ks: {
      o: typeof opacity === 'number' ? fixed(opacity) : opacity,
      r: typeof rotation === 'number' ? fixed(rotation) : rotation,
      p: Array.isArray(position) ? fixed(position) : position,
      a: fixed([0, 0, 0]),
      s: Array.isArray(scale) ? fixed(scale) : scale,
    },
    shapes,
    ip: 0,
    op: DURATION,
    st: 0,
    bm: 0,
  };
}

function animation(name: string, layers: Record<string, unknown>[]): LottieAnimationData {
  return {
    v: '5.10.0',
    fr: 60,
    ip: 0,
    op: DURATION,
    w: 96,
    h: 96,
    nm: name,
    ddd: 0,
    assets: [],
    layers,
  };
}

function buildCloudShape() {
  const cloudFill = '#e6edf8';
  const cloudStroke = '#93a4ba';

  return [
    group('Cloud Left', [ellipse([28, 28]), fill(cloudFill), stroke(cloudStroke, 2)], {
      position: [-16, 4],
    }),
    group('Cloud Middle', [ellipse([34, 34]), fill(cloudFill), stroke(cloudStroke, 2)], {
      position: [2, -6],
    }),
    group('Cloud Right', [ellipse([24, 24]), fill(cloudFill), stroke(cloudStroke, 2)], {
      position: [20, 2],
    }),
    group('Cloud Base', [rect([50, 20], 10), fill(cloudFill), stroke(cloudStroke, 2)], {
      position: [2, 10],
    }),
  ];
}

function buildSunnyAnimation() {
  return animation('Sunny', [
    shapeLayer({
      index: 1,
      name: 'Sun Halo',
      rotation: animated([
        { t: 0, s: 0, e: 360 },
        { t: DURATION, s: 360 },
      ]),
      shapes: [
        group('Ring', [ellipse([54, 54]), stroke('#fbbf24', 3, 88)]),
        group('Horizontal', [
          path(
            [
              [-34, 0],
              [34, 0],
            ],
            false,
          ),
          stroke('#f59e0b', 3, 92),
        ]),
        group('Vertical', [
          path(
            [
              [0, -34],
              [0, 34],
            ],
            false,
          ),
          stroke('#f59e0b', 3, 92),
        ]),
        group('Diag A', [
          path(
            [
              [-24, -24],
              [24, 24],
            ],
            false,
          ),
          stroke('#f59e0b', 3, 92),
        ]),
        group('Diag B', [
          path(
            [
              [24, -24],
              [-24, 24],
            ],
            false,
          ),
          stroke('#f59e0b', 3, 92),
        ]),
      ],
    }),
    shapeLayer({
      index: 2,
      name: 'Sun Core',
      scale: animated([
        { t: 0, s: [96, 96, 100], e: [104, 104, 100] },
        { t: 60, s: [104, 104, 100], e: [96, 96, 100] },
        { t: DURATION, s: [96, 96, 100] },
      ]),
      shapes: [
        group('Glow', [ellipse([34, 34]), fill('#fde68a', 70)]),
        group('Core', [ellipse([26, 26]), fill('#fbbf24'), stroke('#f59e0b', 2.5)]),
      ],
    }),
  ]);
}

function buildCloudAnimation() {
  return animation('Cloudy', [
    shapeLayer({
      index: 1,
      name: 'Cloud',
      position: animated([
        { t: 0, s: [48, 50, 0], e: [48, 44, 0] },
        { t: 60, s: [48, 44, 0], e: [48, 50, 0] },
        { t: DURATION, s: [48, 50, 0] },
      ]),
      shapes: buildCloudShape(),
    }),
  ]);
}

function dropLayer({
  index,
  x,
  delay,
  top = 60,
  bottom = 76,
  width = 3,
  length = 8,
  slant = 0,
  color = '#38bdf8',
  opacity = 100,
}: {
  index: number;
  x: number;
  delay: number;
  top?: number;
  bottom?: number;
  width?: number;
  length?: number;
  slant?: number;
  color?: string;
  opacity?: number;
}) {
  const start = delay;
  const middle = Math.min(delay + 22, DURATION);
  const fade = Math.min(delay + 30, DURATION);
  const secondStart = Math.min(delay + 42, DURATION);
  const secondMiddle = Math.min(delay + 64, DURATION);
  const secondFade = Math.min(delay + 72, DURATION);
  const finalStart = Math.min(delay + 84, DURATION);
  const finalMiddle = Math.min(delay + 106, DURATION);

  return shapeLayer({
    index,
    name: `Rain Drop ${index}`,
    position: animated([
      { t: 0, s: [x, top, 0] },
      { t: start, s: [x, top, 0], e: [x, bottom, 0] },
      { t: middle, s: [x, bottom, 0], e: [x, top, 0] },
      { t: fade, s: [x, top, 0], e: [x, bottom, 0] },
      { t: secondStart, s: [x, top, 0], e: [x, bottom, 0] },
      { t: secondMiddle, s: [x, bottom, 0], e: [x, top, 0] },
      { t: secondFade, s: [x, top, 0], e: [x, bottom, 0] },
      { t: finalStart, s: [x, top, 0], e: [x, bottom, 0] },
      { t: finalMiddle, s: [x, bottom, 0] },
      { t: DURATION, s: [x, top, 0] },
    ]),
    opacity: animated([
      { t: 0, s: 0 },
      { t: start, s: 0, e: 100 },
      { t: start + 8, s: 100, e: 0 },
      { t: middle, s: 0, e: 100 },
      { t: secondStart, s: 0, e: 100 },
      { t: secondStart + 8, s: 100, e: 0 },
      { t: secondMiddle, s: 0, e: 100 },
      { t: finalStart, s: 0, e: 100 },
      { t: finalStart + 8, s: 100, e: 0 },
      { t: DURATION, s: 0 },
    ]),
    shapes: [
      group('Drop', [
        path(
          [
            [slant, -length / 2],
            [-slant, length / 2],
          ],
          false,
        ),
        stroke(color, width, opacity),
      ]),
    ],
  });
}

type RainIntensity = 'light' | 'medium' | 'heavy';

const rainDropConfigs: Record<
  RainIntensity,
  Array<{
    x: number;
    delay: number;
  }>
> = {
  light: [
    { x: 36, delay: 8 },
    { x: 58, delay: 44 },
  ],
  medium: [
    { x: 28, delay: 0 },
    { x: 42, delay: 12 },
    { x: 56, delay: 24 },
    { x: 70, delay: 36 },
  ],
  heavy: [
    { x: 20, delay: 0 },
    { x: 32, delay: 7 },
    { x: 44, delay: 14 },
    { x: 56, delay: 21 },
    { x: 68, delay: 28 },
    { x: 80, delay: 35 },
  ],
};

function rainSplashLayer(index: number, intensity: RainIntensity) {
  const isHeavy = intensity === 'heavy';

  return shapeLayer({
    index,
    name: 'Rain Splash',
    position: [48, isHeavy ? 82 : 78, 0],
    scale: animated([
      { t: 0, s: [88, 88, 100], e: [108, 108, 100] },
      { t: 40, s: [108, 108, 100], e: [92, 92, 100] },
      { t: 80, s: [92, 92, 100], e: [108, 108, 100] },
      { t: DURATION, s: [88, 88, 100] },
    ]),
    opacity: animated([
      { t: 0, s: isHeavy ? 72 : 46, e: isHeavy ? 96 : 64 },
      { t: 40, s: isHeavy ? 96 : 64, e: isHeavy ? 58 : 38 },
      { t: 80, s: isHeavy ? 58 : 38, e: isHeavy ? 88 : 58 },
      { t: DURATION, s: isHeavy ? 72 : 46 },
    ]),
    shapes: [
      group('Splash', [
        ellipse([isHeavy ? 42 : 28, isHeavy ? 8 : 6]),
        stroke(isHeavy ? '#0284c7' : '#38bdf8', isHeavy ? 3 : 2, isHeavy ? 88 : 72),
      ]),
    ],
  });
}

function buildRainAnimation(intensity: RainIntensity) {
  const isHeavy = intensity === 'heavy';
  const isLight = intensity === 'light';

  return animation(
    intensity === 'light' ? 'Light Rain' : intensity === 'heavy' ? 'Heavy Rain' : 'Rainy',
    [
      shapeLayer({
        index: 1,
        name: 'Cloud',
        position: animated([
          { t: 0, s: [48, 43, 0], e: [48, 39, 0] },
          { t: 60, s: [48, 39, 0], e: [48, 43, 0] },
          { t: DURATION, s: [48, 43, 0] },
        ]),
        shapes: buildCloudShape(),
      }),
      ...rainDropConfigs[intensity].map((drop, index) =>
        dropLayer({
          index: index + 2,
          x: drop.x,
          delay: drop.delay,
          top: isHeavy ? 56 : 60,
          bottom: isHeavy ? 84 : isLight ? 74 : 80,
          width: isHeavy ? 4.4 : isLight ? 2.8 : 3.6,
          length: isHeavy ? 18 : isLight ? 11 : 15,
          slant: isHeavy ? 3.2 : isLight ? 1.2 : 2.2,
          color: isHeavy ? '#0284c7' : isLight ? '#7dd3fc' : '#0ea5e9',
          opacity: isLight ? 92 : 100,
        }),
      ),
      ...(isLight ? [] : [rainSplashLayer(rainDropConfigs[intensity].length + 2, intensity)]),
    ],
  );
}

function snowLayer(index: number, x: number, delay: number) {
  const start = delay;
  const middle = Math.min(delay + 34, DURATION);
  const secondStart = Math.min(delay + 52, DURATION);
  const secondMiddle = Math.min(delay + 86, DURATION);

  return shapeLayer({
    index,
    name: `Snow ${index}`,
    position: animated([
      { t: 0, s: [x, 58, 0] },
      { t: start, s: [x, 58, 0], e: [x - 3, 72, 0] },
      { t: middle, s: [x - 3, 72, 0], e: [x + 2, 58, 0] },
      { t: secondStart, s: [x + 2, 58, 0], e: [x - 2, 72, 0] },
      { t: secondMiddle, s: [x - 2, 72, 0] },
      { t: DURATION, s: [x, 58, 0] },
    ]),
    opacity: animated([
      { t: 0, s: 0 },
      { t: start, s: 0, e: 100 },
      { t: start + 10, s: 100, e: 60 },
      { t: secondStart, s: 60, e: 100 },
      { t: secondStart + 12, s: 100, e: 0 },
      { t: DURATION, s: 0 },
    ]),
    shapes: [group('Snow Dot', [ellipse([6, 6]), fill('#f8fafc'), stroke('#bfdbfe', 1.6)])],
  });
}

function buildSnowAnimation() {
  return animation('Snowy', [
    shapeLayer({
      index: 1,
      name: 'Cloud',
      position: animated([
        { t: 0, s: [48, 43, 0], e: [48, 39, 0] },
        { t: 60, s: [48, 39, 0], e: [48, 43, 0] },
        { t: DURATION, s: [48, 43, 0] },
      ]),
      shapes: buildCloudShape(),
    }),
    snowLayer(2, 32, 0),
    snowLayer(3, 48, 18),
    snowLayer(4, 64, 36),
  ]);
}

function buildStormAnimation() {
  return animation('Storm', [
    shapeLayer({
      index: 1,
      name: 'Cloud',
      position: animated([
        { t: 0, s: [48, 41, 0], e: [48, 38, 0] },
        { t: 60, s: [48, 38, 0], e: [48, 41, 0] },
        { t: DURATION, s: [48, 41, 0] },
      ]),
      shapes: buildCloudShape(),
    }),
    shapeLayer({
      index: 2,
      name: 'Lightning',
      position: [52, 60, 0],
      scale: animated([
        { t: 0, s: [88, 88, 100], e: [104, 104, 100] },
        { t: 18, s: [104, 104, 100], e: [88, 88, 100] },
        { t: 40, s: [88, 88, 100], e: [108, 108, 100] },
        { t: 56, s: [108, 108, 100], e: [88, 88, 100] },
        { t: DURATION, s: [88, 88, 100] },
      ]),
      opacity: animated([
        { t: 0, s: 28, e: 100 },
        { t: 18, s: 100, e: 34 },
        { t: 40, s: 34, e: 100 },
        { t: 56, s: 100, e: 28 },
        { t: DURATION, s: 28 },
      ]),
      shapes: [
        group('Bolt', [
          path(
            [
              [-8, -18],
              [4, -18],
              [-2, -3],
              [10, -3],
              [-6, 18],
              [0, 3],
              [-10, 3],
            ],
            true,
          ),
          fill('#facc15'),
          stroke('#f59e0b', 2),
        ]),
      ],
    }),
  ]);
}

export const weatherLottieMap: Record<WeatherMotionKind, LottieAnimationData> = {
  sunny: buildSunnyAnimation(),
  lightRain: buildRainAnimation('light'),
  rain: buildRainAnimation('medium'),
  heavyRain: buildRainAnimation('heavy'),
  snow: buildSnowAnimation(),
  storm: buildStormAnimation(),
  cloud: buildCloudAnimation(),
};
