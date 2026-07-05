import { cn } from '@/lib/utils';

type HeroSectionTitleProps = {
  eyebrow: string;
  title: string;
  description: string;
  className?: string;
  eyebrowClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
};

export default function HeroSectionTitle({
  eyebrow,
  title,
  description,
  className,
  eyebrowClassName,
  titleClassName,
  descriptionClassName,
}: HeroSectionTitleProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <div
        className={cn(
          'border-accent inline-flex items-center rounded-full border bg-card/82 px-4 py-1.5 text-[11px] tracking-[0.32em] text-primary uppercase shadow-[0_10px_24px_hsl(var(--primary) / 0.08)] backdrop-blur',
          eyebrowClassName,
        )}
      >
        {eyebrow}
      </div>
      <div className="space-y-2">
        <h2
          className={cn(
            'text-[36px] font-semibold tracking-[-0.04em] text-foreground md:text-[42px]',
            titleClassName,
          )}
        >
          {title}
        </h2>
        <p
          className={cn(
            'max-w-2xl text-[15px] leading-8 text-muted-foreground md:text-base',
            descriptionClassName,
          )}
        >
          {description}
        </p>
      </div>
    </div>
  );
}
