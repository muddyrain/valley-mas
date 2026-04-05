import { ArrowRight, Eye, EyeOff, Lock, Sparkles, User } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { register } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/useAuthStore';
import { createRandomCnNickname } from '@/utils/randomNickname';

export default function Register() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    nickname: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleGenerateNickname = () => {
    setFormData((prev) => ({ ...prev, nickname: createRandomCnNickname() }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.username || !formData.password) {
      toast.error('请填写用户名和密码');
      return;
    }
    if (formData.username.length < 3) {
      toast.error('用户名至少 3 个字符');
      return;
    }
    if (formData.password.length < 6) {
      toast.error('密码至少 6 个字符');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('两次密码不一致');
      return;
    }

    try {
      setLoading(true);
      const { token, userInfo } = await register({
        username: formData.username,
        password: formData.password,
        nickname: formData.nickname.trim() || createRandomCnNickname(),
      });

      setAuth(userInfo, token);
      toast.success('注册成功，欢迎加入 Valley');
      navigate('/');
    } catch {
      // 错误已在 request.ts 中通过 toast 显示
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex">
      {/* ===== 左侧：深色品牌区 ===== */}
      <div className="hidden lg:flex lg:w-[44%] flex-col justify-between relative overflow-hidden bg-slate-950 px-14 py-12">
        {/* 主题色装饰光晕 */}
        <div
          className="absolute -right-24 -top-24 h-80 w-80 rounded-full opacity-30 blur-3xl pointer-events-none"
          style={{ background: `rgba(var(--theme-primary-rgb),1)` }}
        />
        <div
          className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: `rgba(var(--theme-secondary-rgb),1)` }}
        />
        {/* 网格纹理 */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* 顶部 Logo */}
        <Link to="/blog" className="relative flex items-center gap-3 w-fit group">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-white/10 transition-all group-hover:ring-white/25"
            style={{ background: `rgba(var(--theme-primary-rgb),0.85)` }}
          >
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">Valley</span>
        </Link>

        {/* 主文案 */}
        <div className="relative space-y-7">
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
            style={{
              background: `rgba(var(--theme-primary-rgb),0.18)`,
              color: `rgba(var(--theme-primary-rgb),1)`,
              border: `1px solid rgba(var(--theme-primary-rgb),0.35)`,
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: `rgba(var(--theme-primary-rgb),1)` }}
            />
            免费注册，立即开始
          </div>

          <h1 className="text-[2.4rem] font-black leading-[1.2] tracking-tight text-white">
            加入 Valley，
            <br />
            发现与收藏值得留下的。
          </h1>

          <p className="max-w-xs text-[0.95rem] leading-7 text-slate-400">
            注册后可收藏资源、关注创作者，记录你正在发生的一切。
          </p>

          <div className="h-px w-12" style={{ background: `rgba(var(--theme-primary-rgb),0.5)` }} />

          {/* 统计数字 */}
          <div className="flex gap-8">
            {[
              { value: '10K+', label: '精美资源' },
              { value: '500+', label: '创作者' },
              { value: '100K+', label: '平台用户' },
            ].map((item) => (
              <div key={item.label}>
                <div
                  className="text-2xl font-black"
                  style={{ color: `rgba(var(--theme-primary-rgb),1)` }}
                >
                  {item.value}
                </div>
                <div className="mt-1 text-xs text-slate-500">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 底部版权 */}
        <div className="relative text-xs text-slate-600">© 2025 Valley · 保留所有权利</div>
      </div>

      {/* ===== 右侧：白色注册区 ===== */}
      <div className="w-full lg:w-[56%] flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-xl mb-4"
              style={{ background: `rgba(var(--theme-primary-rgb),1)` }}
            >
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Valley</h1>
          </div>

          {/* Register Card */}
          <div className="rounded-3xl bg-white p-8 shadow-[0_8px_40px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/80">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900">创建账号</h2>
              <p className="text-slate-500 mt-1.5 text-sm">注册后即可收藏、下载资源</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-slate-700 text-sm font-medium">
                  用户名 <span className="text-red-400">*</span>
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="3-20 个字符"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="pl-10 h-12 border-theme-border bg-theme-soft/60 focus-visible:ring-theme-primary/40 focus-visible:border-theme-primary"
                    maxLength={20}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="nickname" className="text-slate-700 text-sm font-medium">
                    昵称 <span className="text-slate-400 font-normal text-xs">（可选）</span>
                  </Label>
                  <button
                    type="button"
                    onClick={handleGenerateNickname}
                    className="text-xs text-theme-primary hover:text-theme-primary-hover font-medium transition-colors"
                  >
                    随机生成
                  </button>
                </div>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="nickname"
                    type="text"
                    placeholder="不填则自动生成随机昵称"
                    value={formData.nickname}
                    onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                    className="pl-10 h-12 border-theme-border bg-theme-soft/60 focus-visible:ring-theme-primary/40 focus-visible:border-theme-primary"
                    maxLength={50}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-slate-700 text-sm font-medium">
                  密码 <span className="text-red-400">*</span>
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="至少 6 个字符"
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

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-slate-700 text-sm font-medium">
                  确认密码 <span className="text-red-400">*</span>
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="再次输入密码"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className={`pl-10 pr-11 h-12 border-theme-border bg-theme-soft/60 focus-visible:ring-theme-primary/40 focus-visible:border-theme-primary ${
                      formData.confirmPassword && formData.password !== formData.confirmPassword
                        ? 'border-red-400 focus-visible:border-red-400 focus-visible:ring-red-400/40'
                        : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <p className="text-xs text-red-500">两次密码不一致</p>
                )}
              </div>

              <Button
                type="submit"
                className="theme-btn-primary w-full h-12 rounded-xl text-base font-semibold mt-1"
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
                    注册中...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    立即注册
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-theme-shell-border text-center text-sm">
              <span className="text-slate-500">已有账号？</span>{' '}
              <Link
                to="/login"
                className="text-theme-primary hover:text-theme-primary-hover font-semibold transition-colors"
              >
                立即登录
              </Link>
            </div>
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            注册即表示您同意我们的服务条款和隐私政策
          </p>
        </div>
      </div>
    </div>
  );
}
