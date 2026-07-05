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

// 个人中心主页需要和全局主题联动，因此背景、Banner、卡片头和主按钮
// 都统一走 theme token，而不是继续保留紫色、橙色这类固定配色。
const ROLE_MAP: Record<string, { label: string; badgeClass: string }> = {
  admin: { label: '管理员', badgeClass: 'bg-destructive/15 text-destructive' },
  creator: { label: '创作者', badgeClass: 'bg-accent text-primary' },
  user: { label: '普通用户', badgeClass: 'bg-muted text-muted-foreground' },
};

const PAGE_BACKGROUND = {
  background:
    'linear-gradient(180deg, var(--background) 0%, color-mix(in srgb, hsl(var(--primary) / 0.15) 28%, hsl(var(--background))) 42%, var(--background) 100%)',
};

const sectionCardClass =
  'overflow-hidden rounded-2xl border border-border bg-card/84 shadow-[0_18px_44px_hsl(var(--primary) / 0.10)] backdrop-blur-sm';

const sectionHeaderClass =
  'border-b border-border bg-[linear-gradient(90deg,color-mix(in_srgb,hsl(var(--primary) / 0.15)_72%,hsl(var(--background))),hsl(var(--background)/0.92))] px-6 py-4';

const statPanelClass =
  'rounded-xl border border-border/24 bg-card/12 px-5 py-3 backdrop-blur-md shadow-[0_14px_30px_hsl(var(--foreground) / 0.05)]';

const inputClassName =
  'h-10 border-input bg-card/82 focus-visible:border-primary focus-visible:ring-primary/20';

function extractEmailName(email?: string) {
  return (email || '').split('@')[0]?.trim() || '';
}

export default function Profile() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const profile = useAuthStore((state) => state.profile);
  const profileLoading = useAuthStore((state) => state.profileLoading);
  const fetchProfile = useAuthStore((state) => state.fetchProfile);
  const setStoreProfile = useAuthStore((state) => state.setProfile);

  const loading = profileLoading && !profile;

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);
  const [avatarHistory, setAvatarHistory] = useState<AvatarHistoryItem[]>([]);
  const [avatarHistoryLoading, setAvatarHistoryLoading] = useState(false);

  const [infoForm, setInfoForm] = useState({ nickname: '', email: '', phone: '' });
  const [infoSaving, setInfoSaving] = useState(false);

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
    fetchProfile(true);
  }, [hasHydrated, isAuthenticated, navigate, fetchProfile]);

  useEffect(() => {
    if (!profile) return;
    setInfoForm({
      nickname: profile.nickname || '',
      email: profile.email || '',
      phone: profile.phone || '',
    });
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

  const handleUseHistoryAvatar = async (historyId: string) => {
    try {
      setAvatarUploading(true);
      const { avatarUrl } = await getUseAvatarHistory(historyId);
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
    const trimmedNickname = infoForm.nickname.trim();
    const trimmedEmail = infoForm.email.trim();
    const trimmedPhone = infoForm.phone.trim();

    if (!trimmedNickname) {
      toast.error('昵称不能为空');
      return;
    }
    if (!trimmedEmail) {
      toast.error('邮箱不能为空');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error('请输入正确的邮箱地址');
      return;
    }
    try {
      setInfoSaving(true);
      const updated = await updateMyProfile({
        nickname: trimmedNickname,
        email: trimmedEmail,
        phone: trimmedPhone,
      });
      if (profile) {
        setStoreProfile({ ...profile, ...updated });
      }
      toast.success('个人信息已更新');
    } catch {
      // request.ts 已统一处理错误提示
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
      // request.ts 已统一处理错误提示
    } finally {
      setPwdSaving(false);
    }
  };

  if (!hasHydrated) return null;
  if (!isAuthenticated) return null;

  const roleInfo = ROLE_MAP[profile?.role || user?.role || 'user'];
  const displayName = profile?.nickname?.trim() || extractEmailName(profile?.email) || '未命名用户';
  const avatarFallbackText = (displayName[0] || 'U').toUpperCase();

  return (
    <div className="min-h-[calc(100vh-4rem)]" style={PAGE_BACKGROUND}>
      {/* 顶部信息区复用主题 Banner，头像光晕和统计块也跟随当前主题变化 */}
      <PageBanner padding="py-10" maxWidth="max-w-4xl">
        <div className="flex flex-wrap items-center gap-6">
          <div className="relative shrink-0">
            <div
              className="absolute -inset-2 rounded-full opacity-80 blur-xl"
              style={{
                background:
                  'linear-gradient(135deg, hsl(var(--primary) / 0.50), hsl(var(--primary) / 0.34), hsl(var(--primary) / 0.58))',
              }}
            />
            {loading ? (
              <Skeleton className="relative h-24 w-24 rounded-full bg-card/20" />
            ) : (
              <button
                type="button"
                onClick={() => setAvatarEditorOpen(true)}
                className="group relative focus:outline-none"
                title="点击更换头像"
                disabled={avatarUploading}
              >
                <Avatar className="h-24 w-24 border-4 border-border/30 shadow-2xl ring-4 ring-foreground/15">
                  <AvatarImage src={profile?.avatar} className="object-cover" />
                  <AvatarFallback className="bg-primary text-primary-foreground text-3xl font-bold text-primary-foreground">
                    {avatarFallbackText}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/45 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  {avatarUploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-foreground" />
                  ) : (
                    <Camera className="h-6 w-6 text-foreground" />
                  )}
                </div>
              </button>
            )}
          </div>

          <div className="min-w-0 flex-1 text-foreground">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-40 bg-card/20" />
                <Skeleton className="h-4 w-28 bg-card/20" />
              </div>
            ) : (
              <>
                <div className="mb-2 flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold drop-shadow-lg md:text-3xl">{displayName}</h1>
                  <Badge className={`${roleInfo.badgeClass} border-0 px-3 py-1 font-medium`}>
                    {roleInfo.label}
                  </Badge>
                </div>
                <p className="mb-4 text-sm text-foreground/78">
                  <Mail className="mr-1 inline h-3.5 w-3.5" />
                  {profile?.email || '未绑定邮箱'}
                </p>
                <div className="flex flex-wrap gap-4">
                  <div className={statPanelClass}>
                    <div className="mb-1 flex items-center gap-2 text-xs font-medium text-foreground/76">
                      <Download className="h-3.5 w-3.5" />
                      <span>累计下载</span>
                    </div>
                    <div className="text-2xl font-bold">{profile?.downloadCount ?? 0}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </PageBanner>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {/* 基本信息卡片承接个人资料编辑，是个人中心里的核心操作区 */}
        <Card className={sectionCardClass}>
          <div className={sectionHeaderClass}>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-accent p-2">
                <User className="h-4 w-4 text-primary" />
              </div>
              <h2 className="font-bold text-foreground">基本信息</h2>
            </div>
          </div>
          <CardContent className="p-6">
            {loading ? (
              <div className="space-y-5">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="space-y-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <Label className="block text-sm font-medium text-foreground">
                      昵称 <span className="text-destructive">*</span>
                    </Label>
                    <Button
                      size="sm"
                      variant="link"
                      className="px-0 text-primary hover:text-primary"
                      onClick={() => {
                        setInfoForm((form) => ({ ...form, nickname: createRandomCnNickname() }));
                      }}
                    >
                      换一个
                    </Button>
                  </div>
                  <Input
                    value={infoForm.nickname}
                    onChange={(event) =>
                      setInfoForm((form) => ({ ...form, nickname: event.target.value }))
                    }
                    placeholder="请输入昵称"
                    className={inputClassName}
                    maxLength={50}
                  />
                </div>

                <div>
                  <Label className="mb-1.5 block text-sm font-medium text-foreground">
                    <Mail className="mr-1 inline h-3.5 w-3.5" />
                    邮箱 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={infoForm.email}
                    onChange={(event) =>
                      setInfoForm((form) => ({ ...form, email: event.target.value }))
                    }
                    disabled
                    placeholder="请输入登录邮箱"
                    className={inputClassName}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">该邮箱用于登录与接收验证码</p>
                </div>

                <div>
                  <Label className="mb-1.5 block text-sm font-medium text-foreground">
                    <Phone className="mr-1 inline h-3.5 w-3.5" />
                    手机号
                  </Label>
                  <Input
                    type="tel"
                    value={infoForm.phone}
                    onChange={(event) =>
                      setInfoForm((form) => ({ ...form, phone: event.target.value }))
                    }
                    placeholder="请输入手机号"
                    className={inputClassName}
                    maxLength={20}
                  />
                </div>

                <div className="pt-1">
                  <Button
                    onClick={handleInfoSave}
                    disabled={infoSaving}
                    className="px-8 font-semibold"
                  >
                    {infoSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        保存修改
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 密码区域保留安全感，但视觉仍然跟随当前主题，不再单独使用橙红色系 */}
        <Card className={sectionCardClass}>
          <div className={sectionHeaderClass}>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-accent p-2">
                <KeyRound className="h-4 w-4 text-primary" />
              </div>
              <h2 className="font-bold text-foreground">修改密码</h2>
            </div>
          </div>
          <CardContent className="p-6">
            <div className="space-y-5">
              <div>
                <Label className="mb-1.5 block text-sm font-medium text-foreground">原密码</Label>
                <div className="relative">
                  <Input
                    type={showOld ? 'text' : 'password'}
                    value={pwdForm.oldPassword}
                    onChange={(event) =>
                      setPwdForm((form) => ({ ...form, oldPassword: event.target.value }))
                    }
                    placeholder="请输入原密码"
                    className={`${inputClassName} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOld((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-primary"
                  >
                    {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label className="mb-1.5 block text-sm font-medium text-foreground">
                  新密码
                  <span className="ml-1 font-normal text-muted-foreground">（至少 6 位）</span>
                </Label>
                <div className="relative">
                  <Input
                    type={showNew ? 'text' : 'password'}
                    value={pwdForm.newPassword}
                    onChange={(event) =>
                      setPwdForm((form) => ({ ...form, newPassword: event.target.value }))
                    }
                    placeholder="请输入新密码"
                    className={`${inputClassName} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-primary"
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label className="mb-1.5 block text-sm font-medium text-foreground">
                  确认新密码
                </Label>
                <div className="relative">
                  <Input
                    type={showConfirm ? 'text' : 'password'}
                    value={pwdForm.confirmPassword}
                    onChange={(event) =>
                      setPwdForm((form) => ({ ...form, confirmPassword: event.target.value }))
                    }
                    placeholder="请再次输入新密码"
                    className={`${inputClassName} pr-12 ${
                      pwdForm.confirmPassword && pwdForm.confirmPassword !== pwdForm.newPassword
                        ? 'border-destructive/40 focus-visible:border-destructive/40 focus-visible:ring-destructive/30'
                        : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-primary"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {pwdForm.confirmPassword && pwdForm.confirmPassword !== pwdForm.newPassword ? (
                  <p className="mt-1 text-xs text-destructive">两次输入的密码不一致</p>
                ) : null}
              </div>

              <div className="pt-1">
                <Button
                  onClick={handlePasswordSave}
                  disabled={pwdSaving}
                  className="px-8 font-semibold"
                >
                  {pwdSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      修改中...
                    </>
                  ) : (
                    <>
                      <Shield className="mr-2 h-4 w-4" />
                      修改密码
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 账号信息区用更轻的主题面板承接只读信息，避免信息块跳出整体视觉语言 */}
        {!loading && profile ? (
          <Card className={sectionCardClass}>
            <div className={sectionHeaderClass}>
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-accent p-2">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                <h2 className="font-bold text-foreground">账号信息</h2>
              </div>
            </div>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-xl bg-accent/72 p-3 sm:col-span-2">
                  <span className="text-muted-foreground">登录邮箱</span>
                  <span className="font-medium text-foreground">{profile.email || '-'}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-accent/72 p-3">
                  <span className="text-muted-foreground">账号角色</span>
                  <Badge className={`${roleInfo.badgeClass} border-0`}>{roleInfo.label}</Badge>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-accent/72 p-3">
                  <span className="text-muted-foreground">累计下载</span>
                  <span className="font-semibold text-foreground">{profile.downloadCount} 次</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-accent/72 p-3 sm:col-span-2">
                  <span className="text-muted-foreground">注册时间</span>
                  <span className="font-medium text-foreground">
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
        ) : null}

        {/* 普通用户的申请入口已移除，所有登录用户均可创作 */}
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
