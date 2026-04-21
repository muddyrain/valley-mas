import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { login, sendEmailCode } from '@/api/auth';
import AuthSplitLayout from '@/components/AuthSplitLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/useAuthStore';
import { applyThemeToDocument, useThemeStore } from '@/stores/useThemeStore';

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const setTheme = useThemeStore((state) => state.setTheme);

  useEffect(() => {
    const raw = localStorage.getItem('valley_theme');
    const saved = raw ? (JSON.parse(raw) as { state?: { theme?: string } })?.state?.theme : null;
    if (!saved) {
      setTheme('amber');
    } else {
      applyThemeToDocument(saved as Parameters<typeof applyThemeToDocument>[0]);
    }
  }, [setTheme]);

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

  useEffect(() => {
    if (codeCountdown <= 0) return;
    const timer = window.setTimeout(() => setCodeCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [codeCountdown]);

  const handleSendCode = async () => {
    const email = formData.email.trim();
    if (!email) {
      toast.error('请先输入邮箱');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('请输入正确的邮箱地址');
      return;
    }

    try {
      setSendingCode(true);
      await sendEmailCode({ email, purpose: 'login' });
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
      navigate('/');
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
          <span className="text-slate-500">还没有账号？</span>{' '}
          <Link
            to="/register"
            className="font-semibold text-theme-primary transition-colors hover:text-theme-primary-hover"
          >
            立即注册
          </Link>
        </>
      }
      bottomNote="登录即表示您同意我们的服务条款和隐私政策"
    >
      <div className="mb-5 grid grid-cols-2 rounded-2xl border border-theme-shell-border bg-gradient-to-r from-theme-soft/70 via-white to-theme-soft/70 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <button
          type="button"
          onClick={() => setLoginType('code')}
          className={`min-h-10 rounded-lg px-3 text-sm font-medium transition-colors ${
            loginType === 'code'
              ? 'bg-white text-slate-900 shadow-[0_8px_18px_rgba(var(--theme-primary-rgb),0.22)]'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          邮箱验证码登录
        </button>
        <button
          type="button"
          onClick={() => setLoginType('password')}
          className={`min-h-10 rounded-lg px-3 text-sm font-medium transition-colors ${
            loginType === 'password'
              ? 'bg-white text-slate-900 shadow-[0_8px_18px_rgba(var(--theme-primary-rgb),0.22)]'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          密码登录
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium text-slate-700">
            邮箱
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="email"
              type="email"
              placeholder="请输入邮箱"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="h-12 rounded-xl border-theme-border/80 bg-theme-soft/80 pl-10 shadow-[0_6px_18px_rgba(var(--theme-primary-rgb),0.08)] transition-all focus-visible:border-theme-primary focus-visible:ring-theme-primary/50 focus-visible:shadow-[0_10px_24px_rgba(var(--theme-primary-rgb),0.16)]"
            />
          </div>
        </div>

        {loginType === 'password' ? (
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-medium text-slate-700">
              密码
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="请输入密码"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="h-12 border-theme-border bg-theme-soft/60 pl-10 pr-11 focus-visible:border-theme-primary focus-visible:ring-theme-primary/40"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5 rounded-2xl border border-theme-shell-border bg-gradient-to-br from-theme-soft/70 via-white to-theme-soft/30 p-3 shadow-[0_10px_26px_rgba(var(--theme-primary-rgb),0.10)]">
            <Label htmlFor="verificationCode" className="text-sm font-medium text-slate-700">
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
                className="h-12 rounded-xl border-theme-border/80 bg-white text-center text-base font-semibold tracking-[0.28em] shadow-[0_6px_18px_rgba(var(--theme-primary-rgb),0.08)] transition-all focus-visible:border-theme-primary focus-visible:ring-theme-primary/50 focus-visible:shadow-[0_10px_24px_rgba(var(--theme-primary-rgb),0.14)]"
              />
              <Button
                type="button"
                variant="outline"
                className="h-12 shrink-0 rounded-xl border-theme-primary/35 bg-white/90 px-4 text-theme-primary shadow-[0_6px_18px_rgba(var(--theme-primary-rgb),0.12)] transition-all hover:bg-theme-soft hover:text-theme-primary-hover hover:shadow-[0_10px_22px_rgba(var(--theme-primary-rgb),0.2)] sm:min-w-[132px]"
                onClick={handleSendCode}
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
              className="text-sm font-medium text-theme-primary transition-colors hover:text-theme-primary-hover"
            >
              忘记密码？
            </Link>
          </div>
        )}

        <Button
          type="submit"
          className="theme-btn-primary h-12 w-full rounded-xl text-base font-semibold"
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
    </AuthSplitLayout>
  );
}
