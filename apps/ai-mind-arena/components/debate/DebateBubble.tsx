import Image from 'next/image';
import { getPersonaAsset, getPersonaTone } from '@/lib/personaTheme';
import type { DebateMessage, Persona } from '@/lib/types';

interface DebateBubbleProps {
  message: DebateMessage;
  persona?: Persona;
}

export function DebateBubble({ message, persona }: DebateBubbleProps) {
  const tone = getPersonaTone(persona?.color);
  const avatarSrc = getPersonaAsset(persona?.name || message.personaName, persona?.color);
  const createdAt = new Date(message.createdAt);
  const timeText = Number.isNaN(createdAt.getTime())
    ? ''
    : new Intl.DateTimeFormat('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(createdAt);

  return (
    <div className="grid animate-popIn grid-cols-[44px_minmax(0,1fr)] items-start gap-3">
      <div
        className={`grid h-11 w-11 place-items-center overflow-hidden rounded-full border border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.3)] ${tone.avatar}`}
      >
        <Image
          src={avatarSrc}
          alt={message.personaName}
          className="h-full w-full object-cover"
          sizes="44px"
        />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <div className="text-[15px] font-semibold leading-none text-white">
            {message.personaName}
          </div>
          <span className={`rounded-full border px-2 py-1 text-[11px] leading-none ${tone.chip}`}>
            {message.roundTitle}
          </span>
          {timeText ? (
            <span className="text-[12px] leading-none text-white/38">{timeText}</span>
          ) : null}
        </div>
        <div
          className={`comic-bubble mt-2 rounded-xl border bg-white/5 px-4 py-3 backdrop-blur-md transition hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] ${tone.surface} ${tone.glow}`}
        >
          <p className="relative z-10 text-[13px] leading-6 text-white/88">{message.content}</p>
        </div>
      </div>
    </div>
  );
}
