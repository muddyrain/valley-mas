import axios from 'axios';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchShare, type ShareView } from '@/api/share';
import { ShareCardExport } from '@/components/ShareCardExport';

type LoadState = 'loading' | 'ready' | 'error';

export default function SharePreview() {
  const { id } = useParams();
  const [view, setView] = useState<ShareView | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    const numericId = Number(id);
    if (!id || !Number.isFinite(numericId)) {
      setState('error');
      setErrMsg('无效的分享链接');
      return;
    }
    let alive = true;
    setState('loading');
    fetchShare(numericId)
      .then((v) => {
        if (!alive) return;
        setView(v);
        setState('ready');
      })
      .catch((e: unknown) => {
        if (!alive) return;
        const msg =
          axios.isAxiosError(e) && e.response?.status === 404
            ? '这棵植物还没准备好被分享'
            : e instanceof Error
              ? e.message
              : '分享内容暂时打不开';
        setErrMsg(msg);
        setState('error');
      });
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center gap-4 p-6">
      {state === 'loading' && (
        <p className="mt-12 text-center text-sm text-garden-ink/60">加载中...</p>
      )}
      {state === 'error' && (
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <p className="text-base font-bold text-garden-ink/80">这棵植物还没准备好被分享</p>
          {errMsg && <p className="text-xs text-garden-ink/50">{errMsg}</p>}
          <Link
            to="/garden"
            className="mt-2 inline-block rounded-full bg-garden-ink px-5 py-1.5 text-sm font-bold text-white shadow hover:bg-garden-ink/90"
          >
            来语种园种一棵自己的
          </Link>
        </div>
      )}
      {state === 'ready' && view && (
        <>
          <header className="flex flex-col items-center gap-1 text-center">
            <h1 className="text-xl font-bold text-garden-ink">来自语种园的礼物</h1>
            <p className="text-sm text-garden-ink/70">这是 {view.plant.name} 写给世界的告别信</p>
          </header>
          <ShareCardExport plant={view.plant} harvest={view.harvest} />
          <Link
            to="/garden"
            className="mt-2 text-sm text-garden-ink/70 underline-offset-2 hover:text-garden-ink hover:underline"
          >
            ← 来语种园种一棵自己的
          </Link>
        </>
      )}
    </main>
  );
}
