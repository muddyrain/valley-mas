import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { resetPassword, sendEmailCode } from '@/api/auth';
import AuthSplitLayout from '@/components/AuthSplitLayout';
import CaptchaDialog from '@/components/CaptchaDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useThemeStore } from '@/stores/useThemeStore';

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export default function ForgotPassword() {
  const navigate = useNavigate();
  const setMode = useThemeStore((state) => state.setMode);
  const [formData, setFormData] = useState({
    email: '',
    verificationCode: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeCountdown, setCodeCountdown] = useState(0);
  const [captchaOpen, setCaptchaOpen] = useState(false);

  useEffect(() => {
    setMode('light');
  }, [setMode]);

  useEffect(() => {
    if (codeCountdown <= 0) return;
    const timer = window.setTimeout(() => setCodeCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [codeCountdown]);

  const requestCaptcha = () => {
    if (!isValidEmail(formData.email.trim())) {
      toast.error('请输入正确的邮箱地址');
      return;
    }
    setCaptchaOpen(true);
  };

  const handleSendCode = async () => {
    try {
      setSendingCode(true);
      await sendEmailCode({ email: formData.email.trim(), purpose: 'reset' });
      setCodeCountdown(60);
      toast.success('验证码已发送');
    } catch {
      // 错误已在 request.ts 中通过 toast 显示
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const email = formData.email.trim();
    if (!isValidEmail(email)) {
      toast.error('请输入正确的邮箱地址');
      return;
    }
    if (!formData.verificationCode.trim()) {
      toast.error('请输入邮箱验证码');
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
      await resetPassword({
        email,
        verificationCode: formData.verificationCode.trim(),
        newPassword: formData.password,
      });
      toast.success('密码已重置，请使用新密码登录');
      navigate('/login', { replace: true });
    } catch {
      // 错误已在 request.ts 中通过 toast 显示
    } finally {
      setLoading(false);
    }
  };

  const updateField = (key: keyof typeof formData, value: string) => {
    setFormData((current) => ({ ...current, [key]: value }));
  };

  return (
    <AuthSplitLayout
      badge="账号安全"
      heroTitle={
        <>
          重新设置密码，
          <br />
          继续回到 Valley。
        </>
      }
      heroDescription="通过注册邮箱验证身份后，即可设置新的登录密码。"
      stats={[
        { value: '10 分钟', label: '验证码有效期' },
        { value: '6 位', label: '验证码' },
        { value: '6+', label: '密码长度' },
      ]}
      cardTitle="找回密码"
      cardDescription="验证邮箱后设置新密码"
      footer={
        <>
          <span className="text-muted-foreground">想起密码了？</span>{' '}
          <Link
            to="/login"
            className="font-semibold text-primary transition-colors hover:text-primary"
          >
            返回登录
          </Link>
        </>
      }
      bottomNote="请勿将验证码提供给他人"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="reset-email">邮箱</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="reset-email"
              type="email"
              placeholder="请输入注册邮箱"
              value={formData.email}
              onChange={(event) => updateField('email', event.target.value)}
              className="h-12 pl-10"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reset-code">邮箱验证码</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="reset-code"
              inputMode="numeric"
              placeholder="请输入6位验证码"
              value={formData.verificationCode}
              onChange={(event) =>
                updateField('verificationCode', event.target.value.replace(/\D/g, '').slice(0, 6))
              }
              className="h-12 text-center font-semibold tracking-[0.28em]"
            />
            <Button
              type="button"
              variant="outline"
              className="h-12 shrink-0 sm:min-w-[132px]"
              onClick={requestCaptcha}
              disabled={sendingCode || codeCountdown > 0}
            >
              {sendingCode ? '发送中...' : codeCountdown > 0 ? `${codeCountdown}s` : '发送验证码'}
            </Button>
          </div>
        </div>
        <PasswordField
          id="reset-password"
          label="新密码"
          placeholder="至少 6 个字符"
          value={formData.password}
          visible={showPassword}
          onToggle={() => setShowPassword((value) => !value)}
          onChange={(value) => updateField('password', value)}
        />
        <PasswordField
          id="reset-confirm-password"
          label="确认新密码"
          placeholder="再次输入新密码"
          value={formData.confirmPassword}
          visible={showConfirmPassword}
          onToggle={() => setShowConfirmPassword((value) => !value)}
          onChange={(value) => updateField('confirmPassword', value)}
        />
        <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={loading}>
          {loading ? (
            '正在重置...'
          ) : (
            <span className="flex items-center gap-2">
              重置密码 <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </Button>
      </form>
      <CaptchaDialog open={captchaOpen} onOpenChange={setCaptchaOpen} onVerify={handleSendCode} />
    </AuthSplitLayout>
  );
}

function PasswordField({
  id,
  label,
  placeholder,
  value,
  visible,
  onToggle,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  visible: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-12 pl-10 pr-11"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={visible ? `隐藏${label}` : `显示${label}`}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
