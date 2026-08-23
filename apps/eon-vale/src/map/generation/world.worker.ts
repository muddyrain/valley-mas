/// <reference lib="webworker" />

import { generateWorldSnapshot } from './WorldGenerator';
import {
  snapshotTransferables,
  type WorldWorkerRequest,
  type WorldWorkerResponse,
} from './WorldWorkerProtocol';

const workerScope: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;
const controllers = new Map<number, AbortController>();

workerScope.addEventListener('message', (event: MessageEvent<WorldWorkerRequest>) => {
  const message = event.data;
  if (message.type === 'cancel') {
    controllers.get(message.jobId)?.abort();
    return;
  }
  const controller = new AbortController();
  controllers.set(message.jobId, controller);
  void generateWorldSnapshot(
    message.request,
    (progress) => post({ type: 'progress', jobId: message.jobId, progress }),
    controller.signal,
  )
    .then(
      (snapshot) => {
        if (controller.signal.aborted) {
          post({ type: 'cancelled', jobId: message.jobId });
          return;
        }
        workerScope.postMessage(
          { type: 'completed', jobId: message.jobId, snapshot } satisfies WorldWorkerResponse,
          snapshotTransferables(snapshot),
        );
      },
      (error: unknown) => {
        if (
          controller.signal.aborted ||
          (error instanceof DOMException && error.name === 'AbortError')
        ) {
          post({ type: 'cancelled', jobId: message.jobId });
        } else {
          post({
            type: 'failed',
            jobId: message.jobId,
            message: error instanceof Error ? error.message : 'Unknown generation failure',
          });
        }
      },
    )
    .finally(() => controllers.delete(message.jobId));
});

function post(message: WorldWorkerResponse): void {
  workerScope.postMessage(message);
}
