import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Shuffle, Sparkles, User } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { sendEmailVerificationCode } from '@/api/auth';
import { LifeTraceBrandMark } from '@/components/LifeTraceBrandMark';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLifeTraceEntrance } from '@/hooks/useLifeTraceEntrance';
import { useAuthStore } from '@/store/useAuthStore';

const NICKNAME_PREFIXES = [
  '晨光',
  '柔风',
  '微澜',
  '夏萤',
  '云隙',
  '暖橘',
  '青柠',
  '梧桐',
  '溪畔',
  '糖渍',
];
const NICKNAME_SUFFIXES = [
  '的便签',
  '的笔记',
  '的清单',
  '的纪念',
  '的角落',
  '的口袋',
  '的小屋',
  '的日记',
  '的橱柜',
  '的踪迹',
];

function createNickname() {
  const prefix = NICKNAME_PREFIXES[Math.floor(Math.random() * NICKNAME_PREFIXES.length)];
  const suffix = NICKNAME_SUFFIXES[Math.floor(Math.random() * NICKNAME_SUFFIXES.length)];
  return `${prefix}${suffix}`;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RegisterPage() {
  const signUp = useAuthStore((state) => state.signUp);
  const error = useAuthStore((state) => state.error);
  const setError = useAuthStore((state) => state.setError);

  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeCountdown, setCodeCountdown] = useState(0);
  const [codeInfo, setCodeInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const pageRef = useRef<HTMLElement>(null);

  useLifeTraceEntrance(pageRef, {
    selector: '[data-register-entrance]',
    y: 12,
    stagger: 0.06,
  });

  useEffect(() => {
    if (codeCountdown <= 0) {
      return;
    }
    const timer = window.setTimeout(() => setCodeCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [codeCountdown]);

  const handleGenerateNickname = () => {
    setNickname(createNickname());
  };

  const handleSendCode = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError('请先输入邮箱');
      return;
    }
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError('请输入正确的邮箱地址');
      return;
    }

    setSendingCode(true);
    setError('');
    try {
      await sendEmailVerificationCode({ email: normalizedEmail, purpose: 'register' });
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
    const normalizedNickname = nickname.trim();
    const normalizedCode = verificationCode.trim();

    if (!normalizedEmail || !password) {
      setError('请填写邮箱和密码');
      return;
    }
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError('请输入正确的邮箱地址');
      return;
    }
    if (normalizedCode.length !== 6) {
      setError('请输入 6 位邮箱验证码');
      return;
    }
    if (password.length < 6) {
      setError('密码至少 6 个字符');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次密码不一致');
      return;
    }

    setSubmitting(true);
    try {
      await signUp({
        email: normalizedEmail,
        password,
        verificationCode: normalizedCode,
        nickname: normalizedNickname || createNickname(),
      });
    } catch {
      // The store owns the user-facing error message.
    } finally {
      setSubmitting(false);
    }
  };

  const codeButtonLabel = sendingCode
    ? '发送中'
    : codeCountdown > 0
      ? `${codeCountdown}s`
      : '发送验证码';

  const passwordMismatch = Boolean(confirmPassword) && password !== confirmPassword;

  return (
    <main
      ref={pageRef}
      className="safe-top safe-x h-dvh overflow-y-auto overflow-x-hidden bg-background pb-6 text-foreground"
    >
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[430px] flex-col justify-between gap-8">
        <header className="pt-5" data-register-entrance>
          <div className="mb-8 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <LifeTraceBrandMark className="size-11 rounded-2xl" />
              <div>
                <p className="text-sm font-semibold text-muted-foreground">Life Trace</p>
                <h1 className="text-xl font-bold">生活迹</h1>
              </div>
            </div>
            <div className="shrink-0 rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground max-[360px]:hidden">
              新建账号
            </div>
          </div>

          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-life-ai">
              <Sparkles className="size-4" />
              注册后即可同步天气、计划与生活踪迹
            </div>
            <h2 className="max-w-[12ch] text-4xl font-bold leading-tight tracking-tight max-[360px]:text-3xl">
              创建你的生活迹账号
            </h2>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              使用邮箱验证码完成注册，注册成功后将自动登录并进入今日生活简报。
            </p>
          </div>
        </header>

        <Card className="space-y-5 p-4" data-register-entrance>
          <div>
            <h3 className="text-lg font-semibold">邮箱注册</h3>
            <p className="mt-1 text-sm text-muted-foreground">填写邮箱、验证码和密码即可注册。</p>
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
                  onClick={handleSendCode}
                  disabled={sendingCode || codeCountdown > 0}
                >
                  {codeButtonLabel}
                </Button>
              </div>
              {codeInfo ? (
                <span className="block text-xs text-muted-foreground">{codeInfo}</span>
              ) : null}
            </label>

            <label className="block space-y-2">
              <span className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-muted-foreground">
                  昵称
                  <span className="ml-1 text-xs font-normal text-muted-foreground">（可选）</span>
                </span>
                <button
                  type="button"
                  onClick={handleGenerateNickname}
                  className="inline-flex items-center gap-1 text-xs font-medium text-life-ai transition hover:text-life-ai/80"
                >
                  <Shuffle className="size-3.5" />
                  随机生成
                </button>
              </span>
              <span className="flex h-12 items-center gap-3 rounded-2xl border border-border bg-secondary px-4 focus-within:border-ring">
                <User className="size-4 text-muted-foreground" />
                <input
                  value={nickname}
                  type="text"
                  autoComplete="nickname"
                  placeholder="留空将自动生成一个随机昵称"
                  maxLength={50}
                  className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
                  onChange={(event) => setNickname(event.target.value)}
                />
              </span>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-muted-foreground">密码</span>
              <span className="flex h-12 items-center gap-3 rounded-2xl border border-border bg-secondary px-4 focus-within:border-ring">
                <LockKeyhole className="size-4 text-muted-foreground" />
                <input
                  value={password}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="至少 6 个字符"
                  className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="shrink-0 text-muted-foreground transition hover:text-foreground"
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </span>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-muted-foreground">确认密码</span>
              <span
                className={`flex h-12 items-center gap-3 rounded-2xl border bg-secondary px-4 focus-within:border-ring ${
                  passwordMismatch ? 'border-destructive/60' : 'border-border'
                }`}
              >
                <LockKeyhole className="size-4 text-muted-foreground" />
                <input
                  value={confirmPassword}
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="再次输入密码"
                  className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((value) => !value)}
                  className="shrink-0 text-muted-foreground transition hover:text-foreground"
                  aria-label={showConfirm ? '隐藏密码' : '显示密码'}
                >
                  {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </span>
              {passwordMismatch ? (
                <span className="block text-xs text-destructive">两次密码不一致</span>
              ) : null}
            </label>

            {error ? (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <Button type="submit" variant="ai" className="h-12 w-full" disabled={submitting}>
              {submitting ? '注册中' : '创建账号并进入'}
              <ArrowRight className="size-4" />
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            已有账号？
            <Link
              to="/login"
              className="ml-1 font-semibold text-life-ai transition hover:text-life-ai/80"
            >
              直接登录
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
}
