import { useId } from 'react';
import './PlushSegmented.css';

export interface PlushSegmentedOption<TValue extends string = string> {
  value: TValue;
  label: string;
  disabled?: boolean;
}

interface PlushSegmentedProps<TValue extends string = string> {
  value: TValue;
  options: ReadonlyArray<PlushSegmentedOption<TValue>>;
  onValueChange: (value: TValue) => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
}

export default function PlushSegmented<TValue extends string = string>({
  value,
  options,
  onValueChange,
  ariaLabel,
  className = '',
  disabled = false,
}: PlushSegmentedProps<TValue>) {
  const groupId = useId();
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className={`plush-segmented ${className}`.trim()}
      id={groupId}
    >
      {options.map((option) => {
        const isOn = option.value === value;
        return (
          // biome-ignore lint/a11y/useSemanticElements: PlushSegmented is a custom radiogroup of buttons; native radio inputs cannot host the segmented visual treatment.
          <button
            type="button"
            role="radio"
            aria-checked={isOn}
            data-state={isOn ? 'on' : 'off'}
            disabled={disabled || option.disabled}
            key={option.value}
            className="plush-segmented__option"
            onClick={() => {
              if (!isOn) onValueChange(option.value);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
