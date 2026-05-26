export function SectionHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {meta ? <span className="text-sm text-muted-foreground">{meta}</span> : null}
    </div>
  );
}
