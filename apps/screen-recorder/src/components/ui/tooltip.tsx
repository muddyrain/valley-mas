import { type ReactNode, useId } from 'react';

export function Tooltip({ children, content }: { children: ReactNode; content: ReactNode }) {
  const id = useId();
  return (
    <span className="ui-tooltip-root" aria-describedby={id}>
      {children}
      <span id={id} role="tooltip" className="ui-tooltip-content">
        {content}
      </span>
    </span>
  );
}
