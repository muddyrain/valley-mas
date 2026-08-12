import { BookOpenText } from 'lucide-react';
import type { TownJournalState } from '../core/town-journal';

interface TownJournalProps {
  state: TownJournalState;
}

export function TownJournal({ state }: TownJournalProps) {
  return (
    <section className="panel-section town-journal" aria-labelledby="town-journal-heading">
      <div className="section-heading">
        <BookOpenText size={15} aria-hidden="true" />
        <h2 id="town-journal-heading">本局故事</h2>
        <output className="section-value">{state.entries.length} 条</output>
      </div>
      <div className="town-journal-list">
        {state.entries.length > 0 ? (
          state.entries.map((entry) => (
            <article key={entry.id} className={`is-${entry.kind}`}>
              <time>{entry.time}</time>
              <div>
                <strong>{entry.title}</strong>
                <p>{entry.detail}</p>
              </div>
            </article>
          ))
        ) : (
          <p className="town-journal-empty">小镇刚刚醒来</p>
        )}
      </div>
    </section>
  );
}
