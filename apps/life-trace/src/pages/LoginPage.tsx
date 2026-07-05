import { ArrowRight, CloudSun, LockKeyhole, Mail } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { sendEmailVerificationCode } from '@/api/auth';
import { CaptchaSheet } from '@/components/CaptchaSheet';
import { LifeTraceBrandMark } from '@/components/LifeTraceBrandMark';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLifeTraceEntrance } from '@/hooks/useLifeTraceEntrance';
import { useAuthStore } from '@/store/useAuthStore';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type LoginMode = 'password' | 'code';

export function LoginPage() {
  const signIn = useAuthStore((state) => state.signIn);
  const error = useAuthStore((state) => state.error);
  const setError = useAuthStore((state) => state.setError);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [mode, setMode] = useState<LoginMode>('password');
  const [sendingCode, setSendingCode] = useState(false);
  const [codeCountdown, setCodeCountdown] = useState(0);
  const [codeInfo, setCodeInfo] = useState('');
  const [captchaOpen, setCaptchaOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const pageRef = useRef<HTMLElement>(null);

  useLifeTraceEntrance(pageRef, {
    selector: '[data-login-entrance]',
    y: 12,
    stagger: 0.06,
  });

  useEffect(() => {
    if (codeCountdown <= 0) return;
    const timer = window.setTimeout(() => setCodeCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [codeCountdown]);

  const requestCaptcha = () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError('请先输入邮箱');
      return;
    }
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError('请输入正确的邮箱地址');
      return;
    }
    setCaptchaOpen(true);
  };

  const handleSendCode = async () => {
    const normalizedEmail = email.trim();
    setSendingCode(true);
    setError('');
    try {
      await sendEmailVerificationCode({ email: normalizedEmail, purpose: 'login' });
      setCodeCountdown(60);
      setCodeInfo('验证码已发送，请查收邮箱（10 分钟内有效）');
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : '验证码发送失败');
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setError('请输入邮箱');
      return;
    }

    if (mode === 'password') {
      if (!password) {
        setError('请输入密码');
        return;
      }
      setSubmitting(true);
      try {
        await signIn({ email: normalizedEmail, password });
      } catch {
        // The store owns the user-facing error message.
      } finally {
        setSubmitting(false);
      }
    } else {
      const normalizedCode = verificationCode.trim();
      if (normalizedCode.length !== 6) {
        setError('请输入 6 位验证码');
        return;
      }
      setSubmitting(true);
      try {
        await signIn({ email: normalizedEmail, password: '', verificationCode: normalizedCode });
      } catch {
        // The store owns the user-facing error message.
      } finally {
        setSubmitting(false);
      }
    }
  };

  const codeButtonLabel = sendingCode
    ? '发送中'
    : codeCountdown > 0
      ? `${codeCountdown}s`
      : '发送验证码';

  return (
    <main
      ref={pageRef}
      className="safe-top safe-x h-dvh overflow-y-auto overflow-x-hidden bg-background pb-6 text-foreground"
    >
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[430px] flex-col justify-between gap-8">
        <header className="pt-5" data-login-entrance>
          <div className="mb-8 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <LifeTraceBrandMark className="size-11 rounded-2xl" />
              <div>
                <p className="text-sm font-semibold text-muted-foreground">Life Trace</p>
                <h1 className="text-xl font-bold">生活迹</h1>
              </div>
            </div>
            <div className="shrink-0 rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground max-[360px]:hidden">
              私人生活助理
            </div>
          </div>

          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-life-ai">
              <CloudSun className="size-4" />
              天气、计划、提醒都绑定到你的账号
            </div>
            <h2 className="max-w-[12ch] text-4xl font-bold leading-tight tracking-tight max-[360px]:text-3xl">
              登录后进入你的今日生活简报
            </h2>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              Life Trace 会把天气建议、今日计划和生活踪迹沉淀到你的个人空间，后续用于跨设备同步。
            </p>
          </div>
        </header>

        <Card className="space-y-5 p-4" data-login-entrance>
          <div>
            <h3 className="text-lg font-semibold">账号登录</h3>
            <p className="mt-1 text-sm text-muted-foreground">支持密码登录和验证码登录。</p>
          </div>

          <div className="flex rounded-2xl bg-secondary p-1">
            <button
              type="button"
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${
                mode === 'password' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
              onClick={() => setMode('password')}
            >
              密码登录
            </button>
            <button
              type="button"
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${
                mode === 'code' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
              onClick={() => setMode('code')}
            >
              验证码登录
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-muted-foreground">邮箱</span>
              <span className="flex h-12 items-center gap-3 rounded-2xl border border-border bg-secondary px-4 transition focus-within:border-ring">
                <Mail className="size-4 text-muted-foreground" />
                <input
                  value={email}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
                  onChange={(event) => setEmail(event.target.value)}
                />
              </span>
            </label>

            {mode === 'password' ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-muted-foreground">密码</span>
                <span className="flex h-12 items-center gap-3 rounded-2xl border border-border bg-secondary px-4 focus-within:border-ring">
                  <LockKeyhole className="size-4 text-muted-foreground" />
                  <input
                    value={password}
                    type="password"
                    autoComplete="current-password"
                    placeholder="输入密码"
                    className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </span>
              </label>
            ) : (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-muted-foreground">邮箱验证码</span>
                <div className="flex items-stretch gap-2">
                  <span className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-border bg-secondary px-4 transition focus-within:border-ring">
                    <input
                      value={verificationCode}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="6 位验证码"
                      maxLength={6}
                      className="min-w-0 flex-1 bg-transparent text-base font-semibold tracking-[0.32em] outline-none placeholder:text-muted-foreground placeholder:tracking-normal placeholder:font-normal"
                      onChange={(event) =>
                        setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                    />
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 shrink-0 whitespace-nowrap px-3 text-sm"
                    onClick={requestCaptcha}
                    disabled={sendingCode || codeCountdown > 0}
                  >
                    {codeButtonLabel}
                  </Button>
                </div>
                {codeInfo ? (
                  <span className="block text-xs text-muted-foreground">{codeInfo}</span>
                ) : null}
              </label>
            )}

            {error ? (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <Button type="submit" variant="ai" className="h-12 w-full" disabled={submitting}>
              {submitting ? '登录中' : '进入 Life Trace'}
              <ArrowRight className="size-4" />
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            还没有账号？
            <Link
              to="/register"
              className="ml-1 font-semibold text-life-ai transition hover:text-life-ai/80"
            >
              去注册
            </Link>
          </p>
        </Card>
      </div>
      <CaptchaSheet open={captchaOpen} onOpenChange={setCaptchaOpen} onVerify={handleSendCode} />
    </main>
  );
}
