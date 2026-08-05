declare module '@valley/devbox-inspector-runtime' {
  import type { FC } from 'react';

  export interface InspectorRuntimeProps {
    enabled?: boolean;
    workspaceRoot?: string;
  }

  export const InspectorRuntime: FC<InspectorRuntimeProps>;
}
