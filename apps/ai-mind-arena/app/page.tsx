import { Brain, Sparkles } from 'lucide-react';
import { HomeToolbar } from '@/components/home/HomeToolbar';
import { Personas } from '@/components/home/Personas';
import { TopicForm } from '@/components/home/TopicForm';

export default function HomePage() {
  return (
    <main className="arena-shell min-h-screen overflow-x-hidden overflow-y-auto px-6 pb-8 pt-5">
      <div className="pointer-events-none absolute left-[3.5%] top-[28%] text-violet-500/28 drop-shadow-[0_0_30px_rgba(123,92,255,0.28)]">
        <Brain className="h-24 w-24" strokeWidth={1.2} />
      </div>
      <div className="pointer-events-none absolute right-[9%] top-[16%] text-violet-400/55 drop-shadow-[0_0_30px_rgba(123,92,255,0.32)]">
        <Sparkles className="h-11 w-11" strokeWidth={1.5} />
      </div>
      <div className="pointer-events-none absolute bottom-[10%] right-[5%] text-fuchsia-400/35 drop-shadow-[0_0_30px_rgba(255,77,157,0.28)]">
        <Brain className="h-16 w-16" strokeWidth={1.25} />
      </div>

      <div className="relative z-10 mx-auto max-w-[1200px]">
        <header className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-fuchsia-400/45 bg-[linear-gradient(135deg,rgba(236,72,153,0.3),rgba(124,58,237,0.24))] shadow-[0_0_30px_rgba(123,92,255,0.2)]">
                <Brain className="h-5 w-5 text-fuchsia-100" strokeWidth={2.1} />
              </span>
              <div className="text-[21px] font-semibold tracking-[0.04em] text-white">
                脑内会议室
              </div>
            </div>
            <span className="arena-chip border-violet-400/34 bg-violet-500/14 px-4 py-2 text-[13px] text-violet-100 shadow-[0_0_30px_rgba(123,92,255,0.2)]">
              AI人格对战场
            </span>
          </div>

          <div className="flex items-center gap-3">
            <HomeToolbar />
          </div>
        </header>

        <section className="relative mx-auto mt-8 max-w-[1200px] text-center">
          <div className="mx-auto flex w-fit items-center gap-5">
            <span className="text-[64px] leading-none drop-shadow-[0_0_36px_rgba(255,77,157,0.44)]">
              🧠
            </span>
            <h1 className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400 bg-clip-text text-[68px] font-black leading-none tracking-[0.03em] text-transparent drop-shadow-[0_0_30px_rgba(123,92,255,0.26)]">
              脑内会议室
            </h1>
          </div>

          <div className="mt-4 flex items-center justify-center gap-5">
            <span className="h-px w-16 bg-gradient-to-r from-transparent to-violet-400/80 shadow-[0_0_20px_rgba(123,92,255,0.34)]" />
            <h2 className="text-[24px] font-semibold tracking-[0.16em] text-white">
              让 5 个 AI 人格替你吵一架
            </h2>
            <span className="h-px w-16 bg-gradient-to-l from-transparent to-fuchsia-400/80 shadow-[0_0_20px_rgba(255,77,157,0.34)]" />
          </div>
          <p className="mt-3 text-[14px] leading-7 text-white/64">
            把你的纠结丢进去，交给脑内评委团。
          </p>
        </section>

        <TopicForm />
        <Personas />
      </div>
    </main>
  );
}
