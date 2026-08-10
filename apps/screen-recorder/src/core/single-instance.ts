export type SecondInstanceActivation = {
  request(): void;
  flush(): void;
  hasPendingRequest(): boolean;
};

export function createSecondInstanceActivation(
  showExistingWindow: () => boolean,
): SecondInstanceActivation {
  let pending = false;
  return {
    request() {
      pending = !showExistingWindow();
    },
    flush() {
      if (pending) pending = !showExistingWindow();
    },
    hasPendingRequest() {
      return pending;
    },
  };
}
