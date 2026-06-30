export const DEFAULT_MINIMUM_LOADING_MS = 250;

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function withMinimumLoadingTime<T>(
  task: Promise<T> | (() => Promise<T>),
  minimumMs = DEFAULT_MINIMUM_LOADING_MS,
): Promise<T> {
  const startedAt = Date.now();
  try {
    return await (typeof task === 'function' ? task() : task);
  } finally {
    const remainingMs = minimumMs - (Date.now() - startedAt);
    if (remainingMs > 0) {
      await wait(remainingMs);
    }
  }
}
