import { MapPin, Star } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { Place } from '@/types';

type PlaceSuggestionsProps = {
  value?: string;
  onSelect: (place: Place) => void;
  limit?: number;
};

export function PlaceSuggestions({ value = '', onSelect, limit = 6 }: PlaceSuggestionsProps) {
  const places = useLifeTraceStore((state) => state.places);
  const placesLoaded = useLifeTraceStore((state) => state.placesLoaded);
  const loadPlaces = useLifeTraceStore((state) => state.loadPlaces);
  const normalizedValue = value.trim();

  const suggestions = useMemo(
    () =>
      [...places]
        .filter((place) => !place.archived)
        .sort((left, right) => {
          if (left.favorite !== right.favorite) {
            return left.favorite ? -1 : 1;
          }
          if (right.visitCount !== left.visitCount) {
            return right.visitCount - left.visitCount;
          }
          return (right.lastSeenAt ?? '').localeCompare(left.lastSeenAt ?? '');
        })
        .slice(0, limit),
    [limit, places],
  );

  useEffect(() => {
    if (!placesLoaded) {
      void loadPlaces({ page: 1, pageSize: 20, archived: false });
    }
  }, [loadPlaces, placesLoaded]);

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="-mx-0.5 flex gap-2 overflow-x-auto px-0.5 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {suggestions.map((place) => {
        const active = normalizedValue === place.name;
        return (
          <button
            key={place.id}
            type="button"
            className={cn(
              'inline-flex h-9 max-w-[9.5rem] shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition',
              active
                ? 'border-life-trace/45 bg-life-trace/10 text-life-trace'
                : 'border-border bg-secondary text-muted-foreground hover:text-foreground',
            )}
            onClick={() => onSelect(place)}
          >
            {place.favorite ? (
              <Star className="size-3.5 fill-current" />
            ) : (
              <MapPin className="size-3.5" />
            )}
            <span className="truncate">{place.name}</span>
          </button>
        );
      })}
    </div>
  );
}
