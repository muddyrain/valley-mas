import { type ButtonHTMLAttributes, forwardRef } from 'react';

export type SwitchProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'role'> & {
  checked: boolean;
};

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked, className = '', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      role="switch"
      aria-checked={checked}
      className={`ui-switch${checked ? ' ui-switch-checked' : ''} ${className}`.trim()}
      {...props}
    >
      <span />
    </button>
  );
});
