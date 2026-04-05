import { ArrowRight, Eye, EyeOff, Lock, Sparkles, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { login } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/useAuthStore';
import { applyThemeToDocument, useThemeStore } from '@/stores/useThemeStore';

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const setTheme = useThemeStore((state) => state.setTheme);

  // 首次进入（localStorage 无 valley_theme 记录）默认切换到 amber
  // setTheme 是 zustand stable 引用，只需挂载时执行一次
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
    username: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.username || !formData.password) {
      toast.error('请输入用户名和密码');
      return;
    }

    try {
      setLoading(true);
      const { token, userInfo } = await login({
        username: formData.username,
        password: formData.password,
      });
      setAuth(userInfo, token);
      toast.success('登录成功！');
      navigate('/');
    } catch (error) {
      console.error('登录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden flex">
      {/* 页面背景渐变（跟随主题） */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: `linear-gradient(135deg,
            rgba(var(--theme-primary-rgb),0.92) 0%,
            rgba(var(--theme-primary-rgb),0.72) 45%,
            rgba(var(--theme-primary-deep, var(--theme-primary-rgb)),0.85) 100%)`,
        }}
      />
      {/* 背景光晕 */}
      <div
        className="absolute -left-32 -top-32 h-96 w-96 rounded-full blur-3xl opacity-40 pointer-events-none"
        style={{ background: `rgba(var(--theme-secondary-rgb),0.5)` }}
      />
      <div
        className="absolute -bottom-24 right-0 h-80 w-80 rounded-full blur-3xl opacity-30 pointer-events-none"
        style={{ background: `rgba(var(--theme-tertiary-rgb),0.5)` }}
      />

      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center relative p-12">
        {/* 装饰性大圆 */}
        <div
          className="absolute left-1/2 top-1/2 h-130 w-130 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: `rgba(var(--theme-tertiary-rgb),0.6)` }}
        />

        <div className="relative w-full max-w-sm space-y-6">
          {/* Logo 卡片 */}
          <Link to="/blog" className="block">
            <div
              className="flex items-center gap-4 rounded-2xl border border-white/30 px-5 py-4 backdrop-blur-md transition-all hover:border-white/50 hover:shadow-lg"
              style={{ background: 'rgba(255,255,255,0.14)' }}
            >
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                style={{ background: 'rgba(255,255,255,0.22)' }}
              >
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="text-xl font-bold text-white">Valley</div>
                <div className="text-xs text-white/70">持续更新 · 值得收藏</div>
              </div>
            </div>
          </Link>

          {/* 主标语 */}
          <div
            className="rounded-2xl border border-white/25 px-6 py-6 backdrop-blur-md"
            style={{ background: 'rgba(255,255,255,0.10)' }}
          >
            <h1 className="text-3xl font-bold leading-snug text-white">
              记录正在发生的，
              <br />
              <span className="opacity-80">也收藏值得留下的。</span>
            </h1>
            <p className="mt-3 text-sm leading-7 text-white/70">
              Valley 整理博客、图文、资源与创作过程，把正在成形的内容慢慢收拢进来。
            </p>
          </div>

          {/* 统计数字 */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: '10K+', label: '精美资源' },
              { value: '500+', label: '创作者' },
              { value: '持续', label: '内容更新' },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-white/20 px-3 py-3 text-center backdrop-blur-md"
                style={{ background: 'rgba(255,255,255,0.10)' }}
              >
                <div className="text-xl font-bold text-white">{item.value}</div>
                <div className="mt-0.5 text-[11px] text-white/65">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-white/20 backdrop-blur-sm mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Valley</h1>
          </div>

          {/* Login Card */}
          <div className="theme-hero-shell rounded-3xl p-8 shadow-2xl">
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-slate-900">欢迎回来</h2>
              <p className="text-slate-500 mt-1.5 text-sm">登录账号，继续探索</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-slate-700 text-sm font-medium">
                  用户名
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="请输入用户名"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="pl-10 h-12 border-theme-border bg-theme-soft/60 focus-visible:ring-theme-primary/40 focus-visible:border-theme-primary"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-slate-700 text-sm font-medium">
                  密码
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="请输入密码"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="pl-10 pr-11 h-12 border-theme-border bg-theme-soft/60 focus-visible:ring-theme-primary/40 focus-visible:border-theme-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <Link
                  to="/forgot-password"
                  className="text-sm text-theme-primary hover:text-theme-primary-hover font-medium transition-colors"
                >
                  忘记密码？
                </Link>
              </div>

              <Button
                type="submit"
                className="theme-btn-primary w-full h-12 rounded-xl text-base font-semibold"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
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

            <div className="mt-6 pt-5 border-t border-theme-shell-border text-center text-sm">
              <span className="text-slate-500">还没有账号？</span>{' '}
              <Link
                to="/register"
                className="text-theme-primary hover:text-theme-primary-hover font-semibold transition-colors"
              >
                立即注册
              </Link>
            </div>
          </div>

          <p className="text-center text-xs text-white/50 mt-6">
            登录即表示您同意我们的服务条款和隐私政策
          </p>
        </div>
      </div>
    </div>
  );
}
