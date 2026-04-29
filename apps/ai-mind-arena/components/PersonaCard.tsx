import type { Persona } from '@/lib/types';

const colorClass: Record<string, string> = {
  blue: 'from-blue-500 to-blue-400 border-blue-200',
  violet: 'from-violet-500 to-fuchsia-500 border-violet-200',
  red: 'from-red-500 to-pink-500 border-red-200',
  green: 'from-emerald-500 to-green-400 border-emerald-200',
  yellow: 'from-yellow-400 to-orange-400 border-yellow-100',
  pink: 'from-pink-500 to-rose-400 border-pink-200',
};

interface PersonaCardProps {
  persona: Persona;
  score?: number;
  active?: boolean;
}

export function PersonaCard({ persona, score = 10, active = false }: PersonaCardProps) {
  const tone = colorClass[persona.color || ''] || colorClass.blue;
  return (
    <article
      className={[
        'relative rounded-2xl border bg-white/12 p-4 text-white shadow-lg transition',
        active
          ? 'border-arena-yellow bg-gradient-to-br from-yellow-400 to-orange-500 shadow-glow'
          : 'border-white/10',
      ].join(' ')}
    >
      {active ? (
        <span className="absolute -right-2 -top-3 rounded-full bg-pink-500 px-4 py-1 text-sm font-black">
          发言中
        </span>
      ) : null}
      <div className="flex gap-4">
        <div
          className={`grid h-20 w-20 shrink-0 place-items-center rounded-2xl border-4 bg-gradient-to-br text-4xl ${tone}`}
        >
          {persona.avatar || '🧠'}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-2xl font-black">{persona.name}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {persona.personality
              .split(/[、,，]/)
              .slice(0, 2)
              .map((tag) => (
                <span key={tag} className="rounded-full bg-white/22 px-3 py-1 text-xs font-black">
                  {tag}
                </span>
              ))}
          </div>
        </div>
      </div>
      <p className="mt-4 text-sm font-bold leading-6 text-white/90">☁️ “{persona.catchphrase}”</p>
      <div className="mt-3 flex items-center gap-3">
        <span className="text-sm font-black text-arena-yellow">⚡ 战力值</span>
        <div className="h-3 flex-1 overflow-hidden rounded-full border border-white/20 bg-black/25">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-blue-500"
            style={{ width: `${Math.min(score, 100)}%` }}
          />
        </div>
        <span className="text-xl font-black text-arena-yellow">{score}</span>
      </div>
    </article>
  );
}
