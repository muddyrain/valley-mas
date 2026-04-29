import type { DebateMessage, Persona } from '@/lib/types';

const bubbleTones: Record<string, string> = {
  blue: 'border-blue-300 bg-gradient-to-r from-blue-500/90 to-indigo-500/80 text-blue-100',
  violet: 'border-violet-300 bg-gradient-to-r from-violet-500/90 to-fuchsia-500/80 text-violet-100',
  red: 'border-red-300 bg-gradient-to-r from-red-500/90 to-pink-500/80 text-red-100',
  green: 'border-emerald-300 bg-gradient-to-r from-emerald-500/90 to-teal-500/80 text-emerald-100',
  yellow: 'border-yellow-200 bg-gradient-to-r from-yellow-500/90 to-orange-500/80 text-yellow-100',
  pink: 'border-pink-200 bg-gradient-to-r from-pink-500/90 to-rose-500/80 text-pink-100',
};

interface DebateBubbleProps {
  message: DebateMessage;
  persona?: Persona;
}

export function DebateBubble({ message, persona }: DebateBubbleProps) {
  const tone = bubbleTones[persona?.color || ''] || bubbleTones.blue;
  return (
    <div className="animate-popIn">
      <div className="mb-2 flex items-end gap-3">
        <div className="grid h-14 w-14 place-items-center rounded-2xl border-[3px] border-white/50 bg-white/20 text-3xl shadow-lg">
          {persona?.avatar || '🧠'}
        </div>
        <div>
          <div className="text-xl font-black text-white">{message.personaName}</div>
          <div className="text-xs font-bold text-white/55">
            Round {message.round} · {message.roundTitle}
          </div>
        </div>
      </div>
      <div
        className={`comic-bubble ml-20 rounded-2xl border-4 p-5 text-lg font-black leading-8 shadow-lg ${tone}`}
      >
        <p className="relative z-10 text-white">{message.content}</p>
        {persona?.name === '赌徒派' ? (
          <span className="absolute right-4 top-2 text-6xl font-black text-white/16">BAM!</span>
        ) : null}
      </div>
    </div>
  );
}
