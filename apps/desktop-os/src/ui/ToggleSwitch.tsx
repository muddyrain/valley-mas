import './ToggleSwitch.css';

interface Props {
  active: boolean;
  onChange: (next: boolean) => void;
  ariaLabel?: string;
}

export default function ToggleSwitch({ active, onChange, ariaLabel }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={ariaLabel}
      className={`toggle-switch ${active ? 'is-on' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!active);
      }}
    >
      <span className="toggle-switch__knob" />
    </button>
  );
}
