import { Brain } from 'lucide-react';
import { TopicForm } from '@/components/TopicForm';

export default function HomePage() {
  return (
    <main className="arena-shell px-6 pb-20 pt-12">
      <section className="relative z-10 mx-auto max-w-6xl text-center">
        <div className="mx-auto flex w-fit items-center gap-5">
          <span className="animate-floaty text-6xl">🧠</span>
          <h1 className="bg-gradient-to-r from-orange-300 via-pink-400 to-violet-400 bg-clip-text text-7xl font-black text-transparent drop-shadow-lg md:text-8xl">
            脑内会议室
          </h1>
        </div>
        <div className="mx-auto mt-4 h-3 w-44 rounded-full bg-gradient-to-r from-cyan-300 via-pink-400 to-arena-yellow" />

        <h2 className="mt-10 text-5xl font-black leading-tight text-white drop-shadow md:text-6xl">
          让 5 个 AI 人格替你吵一架
        </h2>
        <p className="mt-6 text-2xl font-black text-white/82">把你的纠结丢进去，交给脑内评委团。</p>

        <div className="pointer-events-none absolute left-0 top-28 hidden animate-floaty rounded-full bg-white/10 p-5 text-5xl blur-[0.2px] md:block">
          💭
        </div>
        <div className="pointer-events-none absolute right-3 top-40 hidden animate-floaty text-6xl opacity-55 md:block">
          💥
        </div>
      </section>

      <TopicForm />

      <section className="relative z-10 mx-auto mt-24 max-w-4xl text-center">
        <h2 className="text-2xl font-black text-white">⭐ 本场嘉宾预告 ⭐</h2>
        <div className="mt-8 grid grid-cols-5 gap-8">
          {[
            ['👨‍💼', '理性派', '冷静分析师', 'bg-blue-500'],
            ['😼', '毒舌派', '吐槽达人', 'bg-violet-500'],
            ['🦸', '赌徒派', '冒险家', 'bg-red-500'],
            ['👵', '父母派', '保守长者', 'bg-green-500'],
            ['😴', '摆烂派', '躺平大师', 'bg-yellow-500'],
          ].map(([emoji, name, desc, color]) => (
            <div key={name} className="text-center">
              <div
                className={`mx-auto grid h-28 w-28 place-items-center rounded-3xl border-4 border-white text-5xl shadow-lg ${color}`}
              >
                {emoji}
              </div>
              <div className="mx-auto mt-4 rounded-full border-2 border-white bg-arena-yellow px-4 py-2 text-base font-black text-purple-800">
                {name}
              </div>
              <p className="mt-2 text-sm font-bold text-white/85">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="pointer-events-none fixed bottom-8 right-9 text-arena-yellow/40">
        <Brain className="h-16 w-16" />
      </div>
    </main>
  );
}
