import './Slider.css';

interface Props {
  value: number; // 0-100
  onChange: (value: number) => void;
  icon?: React.ReactNode;
  ariaLabel?: string;
}

export default function Slider({ value, onChange, icon, ariaLabel }: Props) {
  return (
    <div className="ui-slider">
      {icon && (
        <span className="ui-slider__icon" aria-hidden>
          {icon}
        </span>
      )}
      <div className="ui-slider__track">
        <div className="ui-slider__fill" style={{ width: `${value}%` }} />
        <input
          className="ui-slider__input"
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={ariaLabel}
        />
      </div>
    </div>
  );
}
