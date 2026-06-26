import './ToggleSwitch.css';

interface Props {
  active: boolean;
  onChange: (next: boolean) => void;
  ariaLabel?: string;
  disabled?: boolean;
}

export default function ToggleSwitch({ active, onChange, ariaLabel, disabled = false }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`toggle-switch ${active ? 'is-on' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        if (disabled) return;
        onChange(!active);
      }}
    >
      <span className="toggle-switch__knob" />
    </button>
  );
}
