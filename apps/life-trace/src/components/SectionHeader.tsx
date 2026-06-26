export function SectionHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 px-1">
      <h2 className="min-w-0 truncate text-[1.12rem] font-semibold leading-tight text-foreground">
        {title}
      </h2>
      {meta ? <span className="shrink-0 text-sm text-muted-foreground">{meta}</span> : null}
    </div>
  );
}
