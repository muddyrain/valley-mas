type SeedFactoryOptions = {
  now?: () => number;
  random?: () => number;
};

export function resolveDemoWorldSeed(search: string, options: SeedFactoryOptions = {}) {
  const params = new URLSearchParams(search);
  const urlSeed = params.get('seed')?.trim();

  return urlSeed || createDemoWorldSeed(options);
}

export function createDemoWorldSeed(options: SeedFactoryOptions = {}) {
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const timePart = Math.max(0, Math.floor(now())).toString(36);
  const randomPart = Math.floor(Math.max(0, Math.min(0.999999999, random())) * 36 ** 6)
    .toString(36)
    .padStart(6, '0');

  return `worldsim-${timePart}-${randomPart}`;
}
