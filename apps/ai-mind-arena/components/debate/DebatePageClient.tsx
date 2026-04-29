'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getDebate } from '@/lib/api';
import type { DebateSession } from '@/lib/types';
import { DebateRoom } from './DebateRoom';

interface DebatePageClientProps {
  debateId: string;
}

export function DebatePageClient({ debateId }: DebatePageClientProps) {
  const [session, setSession] = useState<DebateSession | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    getDebate(debateId)
      .then((data) => {
        if (alive) setSession(data);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : '没有找到这场脑内会议');
      });
    return () => {
      alive = false;
    };
  }, [debateId]);

  if (error) {
    return (
      <main className="arena-shell grid h-screen place-items-center p-6">
        <section className="arena-panel relative z-10 max-w-md p-8 text-center text-white">
          <h1 className="text-[20px] font-semibold">评委席空了</h1>
          <p className="mt-3 text-[14px] leading-6 text-white/70">{error}</p>
          <Link href="/" className="arena-ghost-button mt-6">
            重新开场
          </Link>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="arena-shell grid h-screen place-items-center p-6">
        <div className="arena-panel relative z-10 inline-flex items-center gap-3 px-5 py-4 text-[14px] font-medium text-white/82">
          <Loader2 className="h-4 w-4 animate-spin text-fuchsia-300" />
          正在搭建脑内舞台...
        </div>
      </main>
    );
  }

  return <DebateRoom initialSession={session} />;
}
