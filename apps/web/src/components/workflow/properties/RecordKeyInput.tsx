import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';

interface RecordKeyInputProps {
  name: string;
  names: string[];
  ariaLabel: string;
  onCommit: (name: string) => void;
}

export function RecordKeyInput({ name, names, ariaLabel, onCommit }: RecordKeyInputProps) {
  const [draft, setDraft] = useState(name);

  useEffect(() => {
    setDraft(name);
  }, [name]);

  const commit = () => {
    const nextName = draft.trim();
    if (!nextName || (nextName !== name && names.includes(nextName))) {
      setDraft(name);
      return;
    }
    if (nextName !== name) onCommit(nextName);
  };

  return (
    <Input
      value={draft}
      aria-label={ariaLabel}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          setDraft(name);
          event.currentTarget.blur();
        }
      }}
    />
  );
}
