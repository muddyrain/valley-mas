import { ChevronRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';

interface ApplyCreatorBannerProps {
  className?: string;
}

export default function ApplyCreatorBanner({ className = '' }: ApplyCreatorBannerProps) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);

  const role = profile?.role ?? user?.role;
  if (role !== 'user') return null;

  return (
    <button
      type="button"
      onClick={() => navigate('/apply-creator')}
      className={`group flex w-full cursor-pointer items-center justify-between rounded-2xl border border-theme-shell-border bg-[linear-gradient(135deg,color-mix(in_srgb,var(--theme-primary-soft)_78%,white),rgba(255,255,255,0.92))] p-5 text-left shadow-[0_16px_38px_rgba(var(--theme-primary-rgb),0.10)] transition-all hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,color-mix(in_srgb,var(--theme-primary-soft)_88%,white),rgba(255,255,255,0.96))] hover:shadow-[0_22px_48px_rgba(var(--theme-primary-rgb),0.16)] ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-theme-soft p-2.5 transition-colors group-hover:bg-theme-soft-strong">
          <Sparkles className="h-5 w-5 text-theme-primary" />
        </div>
        <div>
          <p className="font-semibold text-slate-900">申请成为创作者</p>
          <p className="mt-0.5 text-xs text-slate-500">上传作品 · 个人主页 · 获得粉丝</p>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-theme-primary transition-transform group-hover:translate-x-1" />
    </button>
  );
}
