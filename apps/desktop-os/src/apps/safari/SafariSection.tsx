import { Children, type ReactNode } from 'react';
import { type SafariSection as SafariSectionId, useBrowserStore } from '../../store/browserStore';
import './SafariWindow.css';

interface SafariSectionProps {
  id: SafariSectionId;
  title: string;
  empty?: ReactNode;
  children?: ReactNode;
}

export default function SafariSection({ id, title, empty, children }: SafariSectionProps) {
  const collapsed = useBrowserStore((s) => s.collapsedSections[id]);
  const toggleSection = useBrowserStore((s) => s.toggleSection);

  const items = Children.toArray(children).filter(Boolean);
  const hasContent = items.length > 0;

  if (!hasContent && !empty) return null;

  const bodyId = `safari-section-${id}`;

  return (
    <section className="safari-section" data-section-id={id} aria-label={title}>
      <button
        type="button"
        className="safari-section__head"
        aria-expanded={!collapsed}
        aria-controls={bodyId}
        onClick={() => toggleSection(id)}
      >
        <span className="safari-section__chevron" aria-hidden>
          {collapsed ? '▶' : '▼'}
        </span>
        <span className="safari-section__title">{title}</span>
      </button>
      {!collapsed && (
        <div id={bodyId} className="safari-section__body">
          {hasContent ? children : empty}
        </div>
      )}
    </section>
  );
}
