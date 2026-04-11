import {
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Loader2,
  Mail,
  Phone,
  Sparkles,
  Upload,
  User,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  type CreatorApplicationStatus,
  getMyCreatorApplication,
  submitCreatorApplication,
} from '@/api/creator';
import PageBanner from '@/components/PageBanner';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/useAuthStore';

// 状态徽标
function StatusBadge({ status }: { status: string }) {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-sm font-medium">
        <Clock className="h-4 w-4" />
        审核中
      </span>
    );
  }
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium">
        <CheckCircle2 className="h-4 w-4" />
        已通过
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-medium">
      <XCircle className="h-4 w-4" />
      已拒绝
    </span>
  );
}

// 已有申请记录展示
function ApplicationResult({
  app,
  enteringMySpace,
  onEnterMySpace,
}: {
  app: CreatorApplicationStatus;
  enteringMySpace: boolean;
  onEnterMySpace: () => Promise<void>;
}) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* 顶部状态栏 */}
        <div
          className={`px-6 py-5 flex items-center justify-between ${
            app.status === 'approved'
              ? 'bg-green-50 border-b border-green-100'
              : app.status === 'pending'
                ? 'bg-yellow-50 border-b border-yellow-100'
                : 'bg-red-50 border-b border-red-100'
          }`}
        >
          <div>
            <h3 className="text-lg font-bold text-gray-900">创作者申请</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              提交于 {new Date(app.createdAt).toLocaleDateString('zh-CN')}
            </p>
          </div>
          <StatusBadge status={app.status} />
        </div>

        {/* 申请内容 */}
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">创作者名称</p>
              <p className="text-sm font-medium text-gray-800">{app.name}</p>
            </div>
            {app.email && (
              <div>
                <p className="text-xs text-gray-400 mb-1">联系邮箱</p>
                <p className="text-sm font-medium text-gray-800">{app.email}</p>
              </div>
            )}
          </div>

          {app.description && (
            <div>
              <p className="text-xs text-gray-400 mb-1">创作者简介</p>
              <p className="text-sm text-gray-700 leading-relaxed">{app.description}</p>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-400 mb-1">申请理由</p>
            <p className="text-sm text-gray-700 leading-relaxed">{app.reason}</p>
          </div>

          {/* 审核结果 */}
          {app.status !== 'pending' && (
            <div
              className={`rounded-xl p-4 ${app.status === 'approved' ? 'bg-green-50' : 'bg-red-50'}`}
            >
              <p
                className={`text-xs font-medium mb-1 ${app.status === 'approved' ? 'text-green-600' : 'text-red-600'}`}
              >
                审核意见
              </p>
              <p className="text-sm text-gray-700">{app.reviewNote || '无备注'}</p>
              {app.reviewedAt && (
                <p className="text-xs text-gray-400 mt-2">
                  审核时间：{new Date(app.reviewedAt).toLocaleString('zh-CN')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="px-6 py-4 bg-theme-primary/5 border-t border-theme-primary/25 flex items-center justify-between">
          {app.status === 'approved' ? (
            <p className="text-sm text-green-700 font-medium">
              🎉 恭喜！请前往「我的空间」开始上传作品
            </p>
          ) : app.status === 'pending' ? (
            <p className="text-sm text-gray-500">管理员将在 1-3 个工作日内审核，请耐心等待</p>
          ) : (
            <p className="text-sm text-gray-500">可联系管理员了解拒绝原因，修改后重新提交</p>
          )}
          {app.status === 'approved' && (
            <Button
              onClick={() => void onEnterMySpace()}
              disabled={enteringMySpace}
              className="bg-theme-primary hover:bg-theme-primary/80 text-white text-sm"
            >
              {enteringMySpace ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  刷新中...
                </>
              ) : (
                <>
                  前往我的空间
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

const PAGE_BACKGROUND = {
  background:
    'linear-gradient(180deg, var(--theme-page-start) 0%, var(--theme-page-mid) 24%, var(--theme-page-cool) 56%, var(--theme-page-end) 100%)',
};

export default function ApplyCreator() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  // 从 store 读取已缓存的 profile（其他页面可能已经加载过）
  const profile = useAuthStore((s) => s.profile);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const refreshUserState = useAuthStore((s) => s.refreshUserState);
  // persist 水合完成标志——水合前不能依赖 isAuthenticated 做决策
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const [existingApp, setExistingApp] = useState<CreatorApplicationStatus | null | undefined>(
    undefined,
  ); // undefined=加载中
  const [submitting, setSubmitting] = useState(false);
  const [enteringMySpace, setEnteringMySpace] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    reason: '',
    phone: '',
    email: '',
  });
  // 水合完成后再判断登录状态，避免水合前误判为未登录
  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      toast.error('请先登录');
      navigate('/login');
    }
  }, [hasHydrated, isAuthenticated, navigate]);

  // 确保 profile 已加载（用于 role 判断和昵称预填）
  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return;
    fetchProfile();
  }, [hasHydrated, isAuthenticated, fetchProfile]);

  // 创作者/管理员无需申请，直接跳转
  useEffect(() => {
    if (!hasHydrated) return;
    const role = profile?.role ?? user?.role;
    if (role === 'creator' || role === 'admin') {
      navigate('/my-space');
    }
  }, [hasHydrated, profile?.role, user?.role, navigate]);

  // 水合完成且已登录后，加载申请记录
  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return;
    getMyCreatorApplication()
      .then((data) => setExistingApp(data))
      .catch(() => setExistingApp(null));
  }, [hasHydrated, isAuthenticated]);

  // 用 profile 昵称预填创作者名称（仅初始化一次）
  useEffect(() => {
    const nickname = profile?.nickname ?? user?.nickname;
    if (nickname) {
      setForm((f) => (f.name ? f : { ...f, name: nickname }));
    }
  }, [profile?.nickname, user?.nickname]);

  const handleEnterMySpace = useCallback(async () => {
    try {
      setEnteringMySpace(true);
      const latestUser = await refreshUserState();
      const latestRole = latestUser?.role ?? useAuthStore.getState().profile?.role;
      if (latestRole === 'creator' || latestRole === 'admin') {
        navigate('/my-space');
        return;
      }
      toast.error('用户权限还在刷新，请稍后重试');
    } catch {
      toast.error('刷新用户信息失败，请稍后重试');
    } finally {
      setEnteringMySpace(false);
    }
  }, [navigate, refreshUserState]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('请填写创作者名称');
      return;
    }
    if (form.reason.trim().length < 10) {
      toast.error('申请理由至少 10 个字符');
      return;
    }
    try {
      setSubmitting(true);
      await submitCreatorApplication({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        reason: form.reason.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
      });
      toast.success('申请已提交，等待管理员审核');
      // 重新拉取状态
      const app = await getMyCreatorApplication();
      setExistingApp(app);
    } catch {
      // 错误已在 request.ts 中通过 toast 显示
    } finally {
      setSubmitting(false);
    }
  };
  // 加载中：未水合
  if (!hasHydrated) {
    // 未水合时不渲染任何内容（避免闪跳）；已水合但未登录时 effect 会跳转，直接返回 null
    if (hasHydrated && !isAuthenticated) return null;
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]" style={PAGE_BACKGROUND}>
      {/* Banner */}
      <PageBanner>
        <div className="text-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
              <Sparkles className="h-6 w-6" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold drop-shadow-lg">申请成为创作者</h1>
          </div>
          <p className="text-purple-100 text-sm max-w-xl">
            成为创作者，即可上传并分享你的壁纸、头像等作品，让更多人发现你的才华。
          </p>
          {/* 权益说明 */}
          <div className="flex flex-wrap gap-3 mt-4">
            {['上传作品', '个人主页', '获得粉丝', '作品数据统计'].map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-sm"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </PageBanner>

      {/* 已有申请记录 */}
      {existingApp ? (
        <ApplicationResult
          app={existingApp}
          enteringMySpace={enteringMySpace}
          onEnterMySpace={handleEnterMySpace}
        />
      ) : (
        /* 申请表单 */
        <div className="max-w-2xl mx-auto px-4 py-10">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-theme-primary" />
                填写申请信息
              </h2>
              <p className="text-sm text-gray-500 mt-1">管理员将在 1-3 个工作日内审核</p>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
              {/* 创作者名称 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  创作者名称 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="你希望展示给其他用户的创作者名称"
                    maxLength={50}
                    className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-theme-primary transition"
                  />
                </div>
              </div>

              {/* 创作者简介 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  创作者简介 <span className="text-gray-400 font-normal text-xs">（可选）</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="介绍一下你的创作风格、擅长的内容类型等"
                  maxLength={500}
                  rows={3}
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-theme-primary transition resize-none"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">
                  {form.description.length}/500
                </p>
              </div>

              {/* 申请理由 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  申请理由 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="请说明你申请成为创作者的理由，例如：擅长的创作方向、已有的作品经历等（至少 10 字）"
                  maxLength={500}
                  rows={4}
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-theme-primary transition resize-none"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{form.reason.length}/500</p>
              </div>

              {/* 联系方式（可选） */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    联系电话 <span className="text-gray-400 font-normal text-xs">（可选）</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="方便联系"
                      maxLength={20}
                      className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-theme-primary transition"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    联系邮箱 <span className="text-gray-400 font-normal text-xs">（可选）</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="用于接收审核通知"
                      maxLength={100}
                      className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-theme-primary transition"
                    />
                  </div>
                </div>
              </div>

              {/* 提交按钮 */}
              <div className="pt-2 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(-1)}
                  className="flex-none h-8"
                  disabled={submitting}
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 h-8 bg-theme-primary px-6 text-white hover:bg-theme-primary-hover font-semibold shadow-md"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      提交中...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      提交申请
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>

          {/* 说明卡片 */}
          <div className="mt-4 bg-theme-primary/5 rounded-xl p-4 border border-theme-primary/25">
            <p className="text-sm text-theme-primary-deep font-medium mb-2">📋 审核说明</p>
            <ul className="text-xs text-theme-primary space-y-1 list-disc list-inside">
              <li>管理员将在 1-3 个工作日内完成审核</li>
              <li>审核通过后你的账号角色将升级为"创作者"</li>
              <li>可通过"我的资料"页面查看申请状态</li>
              <li>如被拒绝，可在了解原因后重新提交</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
