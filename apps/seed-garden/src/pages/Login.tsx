import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '@/lib/request';
import { useAuthStore } from '@/stores/useAuthStore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const setToken = useAuthStore((s) => s.setToken);
  const nav = useNavigate();

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          try {
            const resp = await request.post<{ token: string }>('/login', { email, password });
            setToken(resp.data.token);
            nav('/garden', { replace: true });
          } catch (e2) {
            setErr((e2 as Error).message);
          }
        }}
        className="w-full max-w-sm rounded-3xl bg-white/80 p-6 flex flex-col gap-3 shadow-lg"
      >
        <h1 className="text-xl font-bold text-garden-ink">登录语种园</h1>
        <input
          className="rounded-xl bg-white px-3 py-2"
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="rounded-xl bg-white px-3 py-2"
          placeholder="密码"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {err && <div className="text-red-500 text-sm">{err}</div>}
        <button type="submit" className="rounded-xl bg-garden-ink py-2 text-white">
          进入花园
        </button>
      </form>
    </main>
  );
}
