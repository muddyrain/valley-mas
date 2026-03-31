import {
  Camera,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  Save,
  Shield,
  User,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  type AvatarHistoryItem,
  changePassword,
  getAvatarHistory,
  getUseAvatarHistory,
  updateMyProfile,
  uploadAvatar,
} from '@/api/auth';
import ApplyCreatorBanner from '@/components/ApplyCreatorBanner';
import PageBanner from '@/components/PageBanner';
import AvatarBeadEditorDialog from '@/components/profile/AvatarBeadEditorDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/useAuthStore';
import { createRandomCnNickname } from '@/utils/randomNickname';

const ROLE_MAP: Record<string, { label: string; color: string }> = {
  admin: { label: '管理员', color: 'bg-red-100 text-red-600' },
  creator: { label: '创作者', color: 'bg-purple-100 text-purple-600' },
  user: { label: '普通用户', color: 'bg-gray-100 text-gray-600' },
};

export default function Profile() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  // 从 store 获取 profile 及相关 actions
  const profile = useAuthStore((s) => s.profile);
  const profileLoading = useAuthStore((s) => s.profileLoading);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const setStoreProfile = useAuthStore((s) => s.setProfile);

  const loading = profileLoading && !profile;

  // 头像上传
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);
  const [avatarHistory, setAvatarHistory] = useState<AvatarHistoryItem[]>([]);
  const [avatarHistoryLoading, setAvatarHistoryLoading] = useState(false);

  // 基本信息表单
  const [infoForm, setInfoForm] = useState({ nickname: '', email: '', phone: '' });
  const [infoSaving, setInfoSaving] = useState(false);

  // 密码表单
  const [pwdForm, setPwdForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    // 强制刷新 profile（每次进入 Profile 页都拉最新数据）
    fetchProfile(true);
  }, [hasHydrated, isAuthenticated, navigate, fetchProfile]);

  // profile 加载后同步到表单
  useEffect(() => {
    if (profile) {
      setInfoForm({
        nickname: profile.nickname || '',
        email: profile.email || '',
        phone: profile.phone || '',
      });
    }
  }, [profile]);

  const handleAvatarSaveFromEditor = async (blob: Blob) => {
    try {
      setAvatarUploading(true);
      const formData = new FormData();
      formData.append('file', new File([blob], `avatar-${Date.now()}.png`, { type: 'image/png' }));
      const { avatarUrl } = await uploadAvatar(formData);
      if (profile) {
        setStoreProfile({ ...profile, avatar: avatarUrl });
      }
      toast.success('头像已更新');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleUseHistoryAvatar = async (historyID: string) => {
    try {
      setAvatarUploading(true);
      const { avatarUrl } = await getUseAvatarHistory(historyID);
      if (profile) {
        setStoreProfile({ ...profile, avatar: avatarUrl });
      }
      toast.success('已切换历史头像');
    } finally {
      setAvatarUploading(false);
    }
  };

  useEffect(() => {
    if (!avatarEditorOpen) return;
    setAvatarHistoryLoading(true);
    getAvatarHistory(16)
      .then((list) => setAvatarHistory(list))
      .finally(() => setAvatarHistoryLoading(false));
  }, [avatarEditorOpen]);

  const handleInfoSave = async () => {
    if (!infoForm.nickname.trim()) {
      toast.error('昵称不能为空');
      return;
    }
    try {
      setInfoSaving(true);
      const updated = await updateMyProfile({
        nickname: infoForm.nickname,
        email: infoForm.email,
        phone: infoForm.phone,
      });
      // 同步更新 store（setProfile 会自动同步 user + cookie）
      if (profile) {
        setStoreProfile({ ...profile, ...updated });
      }
      toast.success('个人信息已更新');
    } catch {
      // 错误已在 request.ts 中通过 toast 显示
    } finally {
      setInfoSaving(false);
    }
  };

  const handlePasswordSave = async () => {
    if (!pwdForm.oldPassword || !pwdForm.newPassword) {
      toast.error('请填写完整密码信息');
      return;
    }
    if (pwdForm.newPassword.length < 6) {
      toast.error('新密码至少 6 位');
      return;
    }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      toast.error('两次输入的新密码不一致');
      return;
    }
    try {
      setPwdSaving(true);
      await changePassword({
        oldPassword: pwdForm.oldPassword,
        newPassword: pwdForm.newPassword,
      });
      toast.success('密码修改成功，请重新登录');
      setPwdForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch {
      // 错误已在 request.ts 中通过 toast 显示
    } finally {
      setPwdSaving(false);
    }
  };

  // 水合未完成时不渲染（避免闪跳到 /login）
  if (!hasHydrated) return null;
  if (!isAuthenticated) return null;

  const roleInfo = ROLE_MAP[profile?.role || user?.role || 'user'];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-linear-to-br from-gray-50 via-purple-50/30 to-indigo-50/30">
      {/* 头部 Banner */}
      <PageBanner maxWidth="max-w-4xl">
        <div className="flex items-center gap-6">
          {/* 头像 */}
          <div className="relative shrink-0">
            <div className="absolute -inset-2 bg-linear-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-full opacity-75 blur-xl" />
            {loading ? (
              <Skeleton className="relative h-24 w-24 rounded-full" />
            ) : (
              <button
                type="button"
                onClick={() => setAvatarEditorOpen(true)}
                className="relative group focus:outline-none"
                title="点击更换头像"
                disabled={avatarUploading}
              >
                <Avatar className="h-24 w-24 border-4 border-white/30 shadow-2xl ring-4 ring-purple-500/30">
                  <AvatarImage src={profile?.avatar} className="object-cover" />
                  <AvatarFallback className="bg-linear-to-br from-purple-400 to-indigo-600 text-white text-3xl font-bold">
                    {(profile?.nickname?.[0] || profile?.username?.[0] || 'U').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {/* 悬浮遮罩 */}
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {avatarUploading ? (
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  ) : (
                    <Camera className="h-6 w-6 text-white" />
                  )}
                </div>
              </button>
            )}
          </div>

          {/* 信息 */}
          <div className="text-white min-w-0">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-40 bg-white/20" />
                <Skeleton className="h-4 w-28 bg-white/20" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h1 className="text-2xl md:text-3xl font-bold drop-shadow-lg">
                    {profile?.nickname || profile?.username}
                  </h1>
                  <Badge className={`${roleInfo.color} border-0 px-3 py-1 font-medium`}>
                    {roleInfo.label}
                  </Badge>
                </div>
                <p className="text-purple-200 text-sm mb-4">@{profile?.username}</p>
                {/* 统计 */}
                <div className="flex gap-4 flex-wrap">
                  <div className="bg-white/10 backdrop-blur-md rounded-xl px-5 py-3 border border-white/20">
                    <div className="flex items-center gap-2 text-purple-200 mb-1">
                      <Download className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">累计下载</span>
                    </div>
                    <div className="text-2xl font-bold">{profile?.downloadCount ?? 0}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </PageBanner>

      {/* 内容区 */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* ===== 基本信息 ===== */}
        <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
          <div className="px-6 py-4 bg-linear-to-r from-purple-50 to-indigo-50 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-100">
                <User className="h-4 w-4 text-purple-600" />
              </div>
              <h2 className="font-bold text-gray-900">基本信息</h2>
            </div>
          </div>
          <CardContent className="p-6">
            {loading ? (
              <div className="space-y-5">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-5">
                {/* 用户名（只读） */}
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-1.5 block">用户名</Label>
                  <Input
                    value={profile?.username || ''}
                    disabled
                    className="bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-400 mt-1">用户名不可修改</p>
                </div>

                {/* 昵称 */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-sm font-medium text-gray-700 block">
                      昵称 <span className="text-red-500">*</span>
                    </Label>
                    <Button
                      size={'sm'}
                      variant={'link'}
                      onClick={() => {
                        setInfoForm((f) => ({ ...f, nickname: createRandomCnNickname() }));
                      }}
                    >
                      换一个
                    </Button>
                  </div>
                  <Input
                    value={infoForm.nickname}
                    onChange={(e) => setInfoForm((f) => ({ ...f, nickname: e.target.value }))}
                    placeholder="请输入昵称"
                    className="focus:ring-2 focus:ring-purple-200 focus:border-purple-500"
                    maxLength={50}
                  />
                </div>

                {/* 邮箱 */}
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-1.5 block">
                    <Mail className="h-3.5 w-3.5 inline mr-1" />
                    邮箱
                  </Label>
                  <Input
                    type="email"
                    value={infoForm.email}
                    onChange={(e) => setInfoForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="请输入邮箱"
                    className="focus:ring-2 focus:ring-purple-200 focus:border-purple-500"
                  />
                </div>

                {/* 手机号 */}
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-1.5 block">
                    <Phone className="h-3.5 w-3.5 inline mr-1" />
                    手机号
                  </Label>
                  <Input
                    type="tel"
                    value={infoForm.phone}
                    onChange={(e) => setInfoForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="请输入手机号"
                    className="focus:ring-2 focus:ring-purple-200 focus:border-purple-500"
                    maxLength={20}
                  />
                </div>

                <div className="pt-1">
                  <Button
                    onClick={handleInfoSave}
                    disabled={infoSaving}
                    className="bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold px-8 shadow-md hover:shadow-lg transition-all"
                  >
                    {infoSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        保存修改
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ===== 修改密码 ===== */}
        <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
          <div className="px-6 py-4 bg-linear-to-r from-orange-50 to-red-50 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-orange-100">
                <KeyRound className="h-4 w-4 text-orange-600" />
              </div>
              <h2 className="font-bold text-gray-900">修改密码</h2>
            </div>
          </div>
          <CardContent className="p-6">
            <div className="space-y-5">
              {/* 原密码 */}
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-1.5 block">原密码</Label>
                <div className="relative">
                  <Input
                    type={showOld ? 'text' : 'password'}
                    value={pwdForm.oldPassword}
                    onChange={(e) => setPwdForm((f) => ({ ...f, oldPassword: e.target.value }))}
                    placeholder="请输入原密码"
                    className="pr-12 focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOld((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* 新密码 */}
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  新密码 <span className="text-gray-400 font-normal">（至少 6 位）</span>
                </Label>
                <div className="relative">
                  <Input
                    type={showNew ? 'text' : 'password'}
                    value={pwdForm.newPassword}
                    onChange={(e) => setPwdForm((f) => ({ ...f, newPassword: e.target.value }))}
                    placeholder="请输入新密码"
                    className="pr-12 focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* 确认新密码 */}
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-1.5 block">确认新密码</Label>
                <div className="relative">
                  <Input
                    type={showConfirm ? 'text' : 'password'}
                    value={pwdForm.confirmPassword}
                    onChange={(e) => setPwdForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                    placeholder="请再次输入新密码"
                    className={`pr-12 focus:ring-2 focus:ring-orange-200 focus:border-orange-400 ${
                      pwdForm.confirmPassword && pwdForm.confirmPassword !== pwdForm.newPassword
                        ? 'border-red-400 focus:border-red-400 focus:ring-red-200'
                        : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {pwdForm.confirmPassword && pwdForm.confirmPassword !== pwdForm.newPassword && (
                  <p className="text-xs text-red-500 mt-1">两次输入的密码不一致</p>
                )}
              </div>

              <div className="pt-1">
                <Button
                  onClick={handlePasswordSave}
                  disabled={pwdSaving}
                  className="bg-linear-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold px-8 shadow-md hover:shadow-lg transition-all"
                >
                  {pwdSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      修改中...
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 mr-2" />
                      修改密码
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ===== 账号信息（只读） ===== */}
        {!loading && profile && (
          <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
            <div className="px-6 py-4 bg-linear-to-r from-gray-50 to-slate-50 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-gray-100">
                  <Shield className="h-4 w-4 text-gray-600" />
                </div>
                <h2 className="font-bold text-gray-900">账号信息</h2>
              </div>
            </div>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                  <span className="text-gray-500">账号角色</span>
                  <Badge className={`${roleInfo.color} border-0`}>{roleInfo.label}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                  <span className="text-gray-500">累计下载</span>
                  <span className="font-semibold text-gray-900">{profile.downloadCount} 次</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 sm:col-span-2">
                  <span className="text-gray-500">注册时间</span>
                  <span className="font-medium text-gray-900">
                    {profile.createdAt
                      ? new Date(profile.createdAt).toLocaleDateString('zh-CN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : '-'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ===== 申请创作者入口（仅普通用户显示，逻辑封装在组件内） ===== */}
        {!loading && <ApplyCreatorBanner />}
      </div>

      <AvatarBeadEditorDialog
        open={avatarEditorOpen}
        currentAvatarUrl={profile?.avatar}
        avatarHistory={avatarHistory}
        avatarHistoryLoading={avatarHistoryLoading}
        onOpenChange={(open) => {
          setAvatarEditorOpen(open);
        }}
        onCancel={() => {
          setAvatarEditorOpen(false);
        }}
        onSave={handleAvatarSaveFromEditor}
        onApplyHistory={handleUseHistoryAvatar}
      />
    </div>
  );
}
