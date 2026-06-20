import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import './PlushSelect.css';

export interface PlushSelectOption<TValue extends string = string> {
  value: TValue;
  label: string;
  disabled?: boolean;
}

interface PlushSelectProps<TValue extends string = string> {
  value: TValue;
  options: ReadonlyArray<PlushSelectOption<TValue>>;
  onChange: (value: TValue) => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
}

export default function PlushSelect<TValue extends string = string>({
  value,
  options,
  onChange,
  ariaLabel,
  className = '',
  disabled = false,
}: PlushSelectProps<TValue>) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const [highlightedIndex, setHighlightedIndex] = useState(selectedIndex);
  const selected = options[selectedIndex];

  const enabledIndices = useMemo(
    () => options.flatMap((option, index) => (option.disabled ? [] : [index])),
    [options],
  );

  useEffect(() => {
    if (!open) return;
    setHighlightedIndex(selectedIndex);
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsidePress(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener('pointerdown', closeOnOutsidePress);
    return () => window.removeEventListener('pointerdown', closeOnOutsidePress);
  }, [open]);

  function moveHighlight(direction: 1 | -1) {
    if (enabledIndices.length === 0) return;
    const currentEnabledIndex = enabledIndices.indexOf(highlightedIndex);
    const fallback = direction === 1 ? 0 : enabledIndices.length - 1;
    const nextEnabledIndex =
      currentEnabledIndex === -1
        ? fallback
        : (currentEnabledIndex + direction + enabledIndices.length) % enabledIndices.length;
    setHighlightedIndex(enabledIndices[nextEnabledIndex]);
  }

  function selectIndex(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;

    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === ' ')) {
      event.preventDefault();
      setOpen(true);
      return;
    }

    if (!open) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveHighlight(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveHighlight(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setHighlightedIndex(enabledIndices[0] ?? highlightedIndex);
    } else if (event.key === 'End') {
      event.preventDefault();
      setHighlightedIndex(enabledIndices.at(-1) ?? highlightedIndex);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectIndex(highlightedIndex);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div
      ref={rootRef}
      className={`plush-select ${open ? 'is-open' : ''} ${className}`}
      data-disabled={disabled || undefined}
    >
      <button
        type="button"
        className="plush-select__button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
      >
        <span>{selected?.label ?? value}</span>
        <ChevronDown className="plush-select__chevron" aria-hidden size={14} strokeWidth={2.4} />
      </button>
      {open ? (
        <div id={`${id}-listbox`} className="plush-select__menu" role="listbox">
          {options.map((option, index) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === value}
              disabled={option.disabled}
              key={option.value}
              className={index === highlightedIndex ? 'is-highlighted' : ''}
              onMouseEnter={() => setHighlightedIndex(index)}
              onClick={() => selectIndex(index)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
