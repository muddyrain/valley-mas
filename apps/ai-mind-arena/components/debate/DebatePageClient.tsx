'use client';

import { AlertTriangle, Loader2, RefreshCcw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getDebate } from '@/lib/api';
import type { DebateSession } from '@/lib/types';
import { DebateRoom } from './DebateRoom';
import { DebateStatePanel } from './DebateStatePanel';

interface DebatePageClientProps {
  debateId: string;
}

export function DebatePageClient({ debateId }: DebatePageClientProps) {
  const [session, setSession] = useState<DebateSession | null>(null);
  const [error, setError] = useState('');

  function reloadDebate() {
    setSession(null);
    setError('');
    getDebate(debateId)
      .then(setSession)
      .catch((err) => setError(err instanceof Error ? err.message : '没有找到这场脑内会议'));
  }

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
        <div className="relative z-10">
          <DebateStatePanel
            icon={<AlertTriangle className="h-5 w-5" />}
            title="评委席空了"
            description={error}
          >
            <button type="button" onClick={reloadDebate} className="arena-ghost-button">
              <RefreshCcw className="h-4 w-4" />
              重试
            </button>
          </DebateStatePanel>
          <Link href="/" className="arena-ghost-button mt-6">
            重新开场
          </Link>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="arena-shell grid h-screen place-items-center p-6">
        <div className="relative z-10">
          <DebateStatePanel
            icon={<Loader2 className="h-5 w-5 animate-spin" />}
            title="正在搭建脑内舞台"
            description="人格嘉宾和裁判席正在同步入场。"
          />
        </div>
      </main>
    );
  }

  return <DebateRoom initialSession={session} />;
}
