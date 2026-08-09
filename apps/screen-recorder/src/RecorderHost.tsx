import { useEffect } from 'react';
import { RecorderRuntime } from './renderer/recorder-runtime';
import type { RecorderSnapshot } from './shared/contracts';

export function RecorderHost() {
  useEffect(() => {
    const runtime = new RecorderRuntime(
      window.screenRecorder,
      () => undefined,
      () => undefined,
    );
    const applySnapshot = (snapshot: RecorderSnapshot) => {
      if (snapshot.state === 'countdown' && snapshot.plan) {
        void runtime.begin(snapshot.plan);
      } else if (snapshot.state === 'stopping') {
        runtime.requestStop();
      }
    };
    void window.screenRecorder.getSnapshot().then(applySnapshot);
    const disposeSnapshot = window.screenRecorder.onSnapshot(applySnapshot);
    return () => {
      disposeSnapshot();
      runtime.dispose();
    };
  }, []);

  return <div aria-hidden="true" />;
}
