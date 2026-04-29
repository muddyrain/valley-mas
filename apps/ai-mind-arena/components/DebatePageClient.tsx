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
      <main className="arena-shell grid min-h-screen place-items-center p-6">
        <section className="relative z-10 rounded-3xl border-4 border-arena-yellow bg-white p-10 text-center text-arena-purple shadow-glow">
          <h1 className="text-4xl font-black">评委席空了</h1>
          <p className="mt-4 text-lg font-bold">{error}</p>
          <Link
            href="/"
            className="mt-8 inline-flex rounded-full bg-purple-700 px-6 py-3 font-black text-white"
          >
            重新开场
          </Link>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="arena-shell grid min-h-screen place-items-center">
        <div className="relative z-10 inline-flex items-center gap-4 rounded-full bg-white/15 px-8 py-5 text-2xl font-black text-white">
          <Loader2 className="h-8 w-8 animate-spin" />
          正在搭建脑内舞台...
        </div>
      </main>
    );
  }

  return <DebateRoom initialSession={session} />;
}
