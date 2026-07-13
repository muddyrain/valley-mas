import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { login, sendEmailCode } from '@/api/auth';
import AuthSplitLayout from '@/components/AuthSplitLayout';
import CaptchaDialog from '@/components/CaptchaDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/useAuthStore';
import { useThemeStore } from '@/stores/useThemeStore';

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const setMode = useThemeStore((state) => state.setMode);
  const [searchParams] = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/';
  const safeRedirectPath =
    redirectPath && redirectPath.startsWith('/') && redirectPath !== '/login' ? redirectPath : '/';

  useEffect(() => {
    setMode('light');
  }, [setMode]);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    verificationCode: '',
  });
  const [loginType, setLoginType] = useState<'code' | 'password'>('code');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeCountdown, setCodeCountdown] = useState(0);
  const [captchaOpen, setCaptchaOpen] = useState(false);

  useEffect(() => {
    if (codeCountdown <= 0) return;
    const timer = window.setTimeout(() => setCodeCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [codeCountdown]);

  const requestCaptcha = () => {
    const email = formData.email.trim();
    if (!email) {
      toast.error('请先输入邮箱');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('请输入正确的邮箱地址');
      return;
    }
    setCaptchaOpen(true);
  };

  const handleSendCode = async () => {
    try {
      setSendingCode(true);
      await sendEmailCode({ email: formData.email.trim(), purpose: 'login' });
      setCodeCountdown(60);
      toast.success('验证码已发送');
    } catch (error) {
      console.error('发送验证码失败:', error);
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const email = formData.email.trim();
    if (!email) {
      toast.error('请输入邮箱');
      return;
    }

    if (loginType === 'password') {
      if (!formData.password) {
        toast.error('请输入密码');
        return;
      }
    } else if (!formData.verificationCode.trim()) {
      toast.error('请输入邮箱验证码');
      return;
    }

    try {
      setLoading(true);
      const payload =
        loginType === 'password'
          ? {
              email,
              password: formData.password,
              loginType: 'password' as const,
            }
          : {
              email,
              verificationCode: formData.verificationCode.trim(),
              loginType: 'code' as const,
            };

      const { token, userInfo } = await login(payload);
      setAuth(userInfo, token);
      toast.success('登录成功！');
      navigate(safeRedirectPath, { replace: true });
    } catch (error) {
      console.error('登录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const codeButtonText = sendingCode
    ? '发送中...'
    : codeCountdown > 0
      ? `${codeCountdown}s`
      : '发送验证码';

  return (
    <AuthSplitLayout
      badge="正在持续更新"
      heroTitle={
        <>
          记录正在发生的，
          <br />
          也收藏值得留下的。
        </>
      }
      heroDescription="Valley 整理博客、图文、资源与创作过程，把正在成形的内容慢慢收拢进来。"
      stats={[
        { value: '10K+', label: '精美资源' },
        { value: '500+', label: '创作者' },
        { value: '持续', label: '内容更新' },
      ]}
      cardTitle="欢迎回来"
      cardDescription="登录账号，继续探索"
      footer={
        <>
          <span className="text-muted-foreground">还没有账号？</span>{' '}
          <Link
            to="/register"
            className="font-semibold text-primary transition-colors hover:text-primary"
          >
            立即注册
          </Link>
        </>
      }
      bottomNote="登录即表示您同意我们的服务条款和隐私政策"
    >
      <div className="mb-5 grid grid-cols-2 rounded-2xl border border-border bg-gradient-to-r from-accent/70 via-background to-accent/70 p-1.5 shadow-[inset_0_1px_0_hsl(var(--background)/0.9)]">
        <button
          type="button"
          onClick={() => setLoginType('code')}
          className={`min-h-10 rounded-lg px-3 text-sm font-medium transition-colors ${
            loginType === 'code'
              ? 'bg-background text-foreground shadow-[0_8px_18px_hsl(var(--primary) / 0.22)]'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          邮箱验证码登录
        </button>
        <button
          type="button"
          onClick={() => setLoginType('password')}
          className={`min-h-10 rounded-lg px-3 text-sm font-medium transition-colors ${
            loginType === 'password'
              ? 'bg-background text-foreground shadow-[0_8px_18px_hsl(var(--primary) / 0.22)]'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          密码登录
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium text-foreground">
            邮箱
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="请输入邮箱"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="h-12 rounded-xl border-border/80 bg-accent/80 pl-10 shadow-[0_6px_18px_hsl(var(--primary)/0.08)] transition-all focus-visible:border-primary focus-visible:ring-primary/50 focus-visible:shadow-[0_10px_24px_hsl(var(--primary)/0.16)]"
            />
          </div>
        </div>

        {loginType === 'password' ? (
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-medium text-foreground">
              密码
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="请输入密码"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="h-12 border-border bg-accent/60 pl-10 pr-11 focus-visible:border-primary focus-visible:ring-primary/40"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5 rounded-2xl border border-border bg-gradient-to-br from-accent/70 via-background to-accent/30 p-3 shadow-[0_10px_26px_hsl(var(--primary)/0.10)]">
            <Label htmlFor="verificationCode" className="text-sm font-medium text-foreground">
              邮箱验证码
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="verificationCode"
                type="text"
                placeholder="请输入6位验证码"
                value={formData.verificationCode}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    verificationCode: e.target.value.replace(/\D/g, '').slice(0, 6),
                  })
                }
                className="h-12 rounded-xl border-border/80 bg-background text-center text-base font-semibold tracking-[0.28em] shadow-[0_6px_18px_hsl(var(--primary)/0.08)] transition-all focus-visible:border-primary focus-visible:ring-primary/50 focus-visible:shadow-[0_10px_24px_hsl(var(--primary)/0.14)]"
              />
              <Button
                type="button"
                variant="outline"
                className="h-12 shrink-0 rounded-xl border-primary/35 bg-background/90 px-4 text-primary shadow-[0_6px_18px_hsl(var(--primary) / 0.12)] transition-all hover:bg-accent hover:text-primary hover:shadow-[0_10px_22px_hsl(var(--primary) / 0.2)] sm:min-w-[132px]"
                onClick={requestCaptcha}
                disabled={sendingCode || codeCountdown > 0}
              >
                {codeButtonText}
              </Button>
            </div>
          </div>
        )}

        {loginType === 'password' && (
          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-primary transition-colors hover:text-primary"
            >
              忘记密码？
            </Link>
          </div>
        )}

        <Button
          type="submit"
          className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 w-full rounded-xl text-base font-semibold"
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              登录中...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              登录
              <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </Button>
      </form>
      <CaptchaDialog open={captchaOpen} onOpenChange={setCaptchaOpen} onVerify={handleSendCode} />
    </AuthSplitLayout>
  );
}
