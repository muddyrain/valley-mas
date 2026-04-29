import Image from 'next/image';
import gamblerAvatar from '../../assets/gambler.png';
import parentsAvatar from '../../assets/parents.png';
import rationalistsAvatar from '../../assets/rationalists.png';
import sharpTongueAvatar from '../../assets/sharp-tongue.png';
import slackOffAvatar from '../../assets/slack-off.png';

const personas = [
  {
    name: '理性派',
    role: '冷静分析师',
    quote: '用逻辑和数据说话',
    avatar: rationalistsAvatar,
    border: 'border-blue-400/70',
    glow: 'shadow-[0_0_30px_rgba(59,130,246,0.3)]',
    avatarTone: 'from-blue-500/35 via-blue-500/10 to-slate-900/10',
  },
  {
    name: '毒舌派',
    role: '吐槽达人',
    quote: '扎心真相，一针见血',
    avatar: sharpTongueAvatar,
    border: 'border-purple-400/70',
    glow: 'shadow-[0_0_30px_rgba(168,85,247,0.3)]',
    avatarTone: 'from-violet-500/35 via-fuchsia-500/10 to-slate-900/10',
  },
  {
    name: '赌徒派',
    role: '冒险家',
    quote: '人生就是一场豪赌',
    avatar: gamblerAvatar,
    border: 'border-pink-400/70',
    glow: 'shadow-[0_0_30px_rgba(236,72,153,0.3)]',
    avatarTone: 'from-pink-500/35 via-rose-500/10 to-slate-900/10',
  },
  {
    name: '父母派',
    role: '保守长辈',
    quote: '为你好，但很传统',
    avatar: parentsAvatar,
    border: 'border-green-400/70',
    glow: 'shadow-[0_0_30px_rgba(16,185,129,0.3)]',
    avatarTone: 'from-emerald-500/35 via-teal-500/10 to-slate-900/10',
  },
  {
    name: '摆烂派',
    role: '躺平大师',
    quote: '人生苦短，及时行乐',
    avatar: slackOffAvatar,
    border: 'border-yellow-400/70',
    glow: 'shadow-[0_0_30px_rgba(245,158,11,0.3)]',
    avatarTone: 'from-amber-500/35 via-orange-500/10 to-slate-900/10',
  },
];

export function Personas() {
  return (
    <section className="relative mx-auto mt-8 max-w-[1200px]">
      <div className="grid grid-cols-5 gap-4">
        {personas.map((persona) => (
          <article
            key={persona.name}
            className={`rounded-2xl border bg-white/5 px-4 py-4 text-white backdrop-blur-md ${persona.border} ${persona.glow}`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border-2 ${persona.border} bg-gradient-to-br shadow-[0_0_20px_rgba(123,92,255,0.18)] ${persona.avatarTone}`}
              >
                <Image
                  src={persona.avatar}
                  alt={persona.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-semibold leading-none text-white mb-2">
                  {persona.name}
                </div>
                <div className={`w-2/3 border ${persona.border}`}></div>
                <div className="mt-2 text-sm leading-none text-white/62">{persona.role}</div>
              </div>
            </div>
            <p className="mt-4 text-md leading-6 text-zinc-300 text-center">{persona.quote}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
