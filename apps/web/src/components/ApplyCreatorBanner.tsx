/**
 * 申请创作者入口卡片
 *
 * 只对 role === 'user' 的普通用户显示，创作者/管理员自动隐藏。
 * 可在 Profile 页、个人设置侧栏等多处复用。
 */
import { ChevronRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';

interface ApplyCreatorBannerProps {
  /** 额外的外层 className */
  className?: string;
}

export default function ApplyCreatorBanner({ className = '' }: ApplyCreatorBannerProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);

  // 只对普通用户显示（profile 优先，profile 未加载时回退到 user）
  const role = profile?.role ?? user?.role;
  if (role !== 'user') return null;

  return (
    <button
      type="button"
      onClick={() => navigate('/apply-creator')}
      className={`w-full cursor-pointer group flex items-center justify-between p-5
        bg-linear-to-r from-purple-50 to-indigo-50
        border border-purple-200 rounded-2xl
        hover:from-purple-100 hover:to-indigo-100 hover:border-purple-300
        transition-all ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-purple-100 group-hover:bg-purple-200 transition-colors">
          <Sparkles className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <p className="font-semibold text-purple-900 text-left">申请成为创作者</p>
          <p className="text-xs text-purple-600 mt-0.5">上传作品 · 个人主页 · 获得粉丝</p>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-purple-400 group-hover:translate-x-1 transition-transform" />
    </button>
  );
}
