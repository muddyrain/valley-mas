import Image from 'next/image';
import { getPersonaAsset, getPersonaTone } from '@/lib/personaTheme';
import type { Persona } from '@/lib/types';

interface PersonaCardProps {
  persona: Persona;
  score?: number;
  active?: boolean;
}

export function PersonaCard({ persona, score = 10, active = false }: PersonaCardProps) {
  const tone = getPersonaTone(persona.color);
  const avatarSrc = getPersonaAsset(persona.name, persona.color);
  return (
    <article
      className={[
        'relative overflow-hidden rounded-2xl border bg-white/5 p-4 text-white backdrop-blur-md transition duration-200',
        active
          ? 'border-purple-400 bg-purple-500/10 shadow-[0_0_20px_rgba(123,92,255,0.6)]'
          : 'border-purple-400/20 hover:border-purple-400/40 hover:shadow-[0_0_16px_rgba(123,92,255,0.18)]',
      ].join(' ')}
    >
      {active ? (
        <span className="absolute right-3 top-3 rounded-full border border-pink-400/35 bg-pink-500/16 px-2.5 py-1 text-[11px] font-semibold leading-none text-pink-100 shadow-[0_0_10px_rgba(236,72,153,0.36)]">
          发言中
        </span>
      ) : null}
      <div className="flex items-start gap-3">
        <div
          className={`grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.3)] ${tone.avatar}`}
        >
          <Image
            src={avatarSrc}
            alt={persona.name}
            className="h-full w-full object-cover"
            sizes="48px"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-md font-bold text-white">{persona.name}</h3>
            <span className={`rounded-full border px-2 py-1 text-[11px] leading-none ${tone.chip}`}>
              {persona.stance}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {persona.personality
              .split(/[、,，]/)
              .slice(0, 2)
              .map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-[11px] leading-none text-white/68"
                >
                  {tag}
                </span>
              ))}
          </div>
          <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-white/70">{persona.style}</p>
        </div>
      </div>
      <p className="mt-3 rounded-2xl border border-white/8 bg-black/10 px-3 py-2 text-[12px] leading-5 text-white/72">
        “{persona.catchphrase}”
      </p>
      <div className="mt-3 flex items-center gap-3">
        <span className="text-[12px] font-medium text-white/56">支持热度</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full bg-gradient-to-r from-purple-400 to-pink-400 shadow-[0_0_10px_rgba(255,77,157,0.6)] ${tone.bar}`}
            style={{ width: `${Math.min(score, 100)}%` }}
          />
        </div>
        <span className={`text-[13px] font-semibold ${tone.accentText}`}>{score}%</span>
      </div>
    </article>
  );
}
