import { Bell, FolderOpen, Keyboard, Power, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import logoUrl from '../assets/logo.png';
import { Button } from './components/ui/button';
import { Switch } from './components/ui/switch';
import {
  getScreenCapturePermissionRecoveryAction,
  shouldOfferScreenCapturePermissionRecovery,
} from './core/screen-capture-permission';
import {
  preserveShortcutDraft,
  type ShortcutSettings,
  shortcutFromKeyboardInput,
} from './core/shortcuts';
import type { RecorderSnapshot } from './shared/contracts';

type ShortcutFieldProps = {
  label: string;
  platform: RecorderSnapshot['platform'];
  value: string;
  onChange(value: string): void;
};

function ShortcutField({ label, platform, value, onChange }: ShortcutFieldProps) {
  const [listening, setListening] = useState(false);
  const cancelOnClickRef = useRef(false);
  useEffect(() => {
    return () => {
      void window.screenRecorder.setShortcutCaptureActive(false);
    };
  }, []);

  const setCaptureActive = (active: boolean) => {
    setListening(active);
    void window.screenRecorder.setShortcutCaptureActive(active);
  };
  return (
    <label className="shortcut-field">
      <span>{label}</span>
      <Button
        variant="outline"
        className={listening ? 'shortcut-input shortcut-input-listening' : 'shortcut-input'}
        onFocus={() => setCaptureActive(true)}
        onBlur={() => setCaptureActive(false)}
        onPointerDown={(event) => {
          const cancelOnClick = listening && document.activeElement === event.currentTarget;
          cancelOnClickRef.current = cancelOnClick;
          if (!cancelOnClick) event.currentTarget.focus();
        }}
        onClick={(event) => {
          if (cancelOnClickRef.current) event.currentTarget.blur();
          cancelOnClickRef.current = false;
        }}
        onKeyDown={(event) => {
          event.preventDefault();
          if (event.key === 'Escape') {
            event.currentTarget.blur();
            return;
          }
          const shortcut = shortcutFromKeyboardInput(event, platform);
          if (shortcut) {
            onChange(shortcut);
            event.currentTarget.blur();
          }
        }}
      >
        {listening ? '请按组合键' : value}
      </Button>
    </label>
  );
}

export function App() {
  const [snapshot, setSnapshot] = useState<RecorderSnapshot>();
  const [draft, setDraft] = useState<ShortcutSettings>();
  const [message, setMessage] = useState<string>();
  const [busyAction, setBusyAction] = useState<
    'directory' | 'startup' | 'notifications' | 'permission'
  >();

  useEffect(() => {
    const applySnapshot = (next: RecorderSnapshot) => {
      setSnapshot(next);
      setDraft((current) => preserveShortcutDraft(current, next.shortcuts));
    };
    void window.screenRecorder.getSnapshot().then(applySnapshot);
    return window.screenRecorder.onSnapshot(applySnapshot);
  }, []);

  const save = async () => {
    if (!draft) return;
    setMessage(undefined);
    try {
      await window.screenRecorder.updateShortcuts(draft);
      setMessage('快捷键已保存');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : '无法保存快捷键');
    }
  };

  const chooseDirectory = async () => {
    setMessage(undefined);
    setBusyAction('directory');
    try {
      const result = await window.screenRecorder.chooseRecordingDirectory();
      if (result.changed) setMessage('录屏保存位置已更新');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : '无法更改录屏保存位置');
    } finally {
      setBusyAction(undefined);
    }
  };

  const toggleAutoLaunch = async () => {
    if (!snapshot) return;
    setMessage(undefined);
    setBusyAction('startup');
    try {
      await window.screenRecorder.setAutoLaunch(!snapshot.autoLaunch);
      setMessage(snapshot.autoLaunch ? '已关闭开机自启动' : '已开启开机自启动');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : '无法更改开机自启动');
    } finally {
      setBusyAction(undefined);
    }
  };

  const toggleNotifications = async () => {
    if (!snapshot) return;
    setMessage(undefined);
    setBusyAction('notifications');
    try {
      await window.screenRecorder.setNotificationsEnabled(!snapshot.notificationsEnabled);
      setMessage(snapshot.notificationsEnabled ? '已关闭系统通知' : '已开启系统通知');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : '无法更改系统通知');
    } finally {
      setBusyAction(undefined);
    }
  };

  const openScreenCaptureSettings = async () => {
    setMessage(undefined);
    setBusyAction('permission');
    try {
      await window.screenRecorder.openScreenCaptureSettings();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : '无法打开屏幕录制权限设置');
    } finally {
      setBusyAction(undefined);
    }
  };

  const requestScreenCapturePermission = async () => {
    setMessage(undefined);
    setBusyAction('permission');
    try {
      const status = await window.screenRecorder.requestScreenCapturePermission();
      if (status === 'granted') setMessage('屏幕录制权限已开启');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : '无法请求屏幕录制权限');
    } finally {
      setBusyAction(undefined);
    }
  };

  const permissionRecoveryVisible = Boolean(
    snapshot &&
      shouldOfferScreenCapturePermissionRecovery(
        snapshot.platform,
        snapshot.screenCapturePermission,
      ),
  );
  const permissionRecoveryAction = snapshot
    ? getScreenCapturePermissionRecoveryAction(snapshot.platform, snapshot.screenCapturePermission)
    : undefined;
  const permissionSettingsAvailable =
    snapshot?.screenCapturePermission === 'denied' ||
    snapshot?.screenCapturePermission === 'restricted';
  const visibleMessage =
    message ??
    snapshot?.warning ??
    (snapshot?.error?.includes('权限') ? undefined : snapshot?.error);

  return (
    <main className="settings-shell">
      <header className="settings-titlebar">
        <div className="settings-brand">
          <img src={logoUrl} alt="" />
          <div>
            <strong>Valley Capture</strong>
            <span>偏好设置</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="settings-close"
          aria-label="关闭设置窗口"
          onClick={() => void window.screenRecorder.hideSettings()}
        >
          <X aria-hidden="true" size={18} />
        </Button>
      </header>

      <div className="settings-content">
        <div className="settings-heading">
          <p>设置</p>
          <h1>捕捉，随手就来</h1>
        </div>

        <section className="settings-card">
          <div className="settings-card-title">
            <Keyboard aria-hidden="true" size={18} />
            <h2>快捷键</h2>
          </div>
          {draft && (
            <div className="settings-fields">
              <ShortcutField
                label="区域截图"
                platform={snapshot?.platform ?? 'other'}
                value={draft.screenshot}
                onChange={(screenshot) => setDraft({ ...draft, screenshot })}
              />
              <ShortcutField
                label="屏幕吸色"
                platform={snapshot?.platform ?? 'other'}
                value={draft.colorPicker}
                onChange={(colorPicker) => setDraft({ ...draft, colorPicker })}
              />
              <ShortcutField
                label="区域录屏"
                platform={snapshot?.platform ?? 'other'}
                value={draft.recording}
                onChange={(recording) => setDraft({ ...draft, recording })}
              />
            </div>
          )}
        </section>

        <section className="settings-card settings-option-card">
          <div className="settings-option-copy">
            <Power aria-hidden="true" size={18} />
            <div>
              <h2>开机自启动</h2>
              <span>登录系统后在托盘静默运行</span>
            </div>
          </div>
          <Switch
            checked={snapshot?.autoLaunch ?? false}
            className="settings-switch"
            aria-label="开机自启动"
            disabled={!snapshot || busyAction === 'startup'}
            onClick={() => void toggleAutoLaunch()}
          />
        </section>

        <section className="settings-card settings-option-card">
          <div className="settings-option-copy">
            <Bell aria-hidden="true" size={18} />
            <div>
              <h2>系统通知</h2>
              <span>{snapshot?.notificationsEnabled ? '录制完成时通知' : '默认关闭'}</span>
            </div>
          </div>
          <Switch
            checked={snapshot?.notificationsEnabled ?? false}
            className="settings-switch"
            aria-label="系统通知"
            disabled={!snapshot || busyAction === 'notifications'}
            onClick={() => void toggleNotifications()}
          />
        </section>

        <section className="settings-card settings-storage-card">
          <div className="settings-card-title">
            <FolderOpen aria-hidden="true" size={18} />
            <h2>录屏保存位置</h2>
          </div>
          <div className="settings-storage-row">
            <span title={snapshot?.saveDirectory}>{snapshot?.saveDirectory ?? '正在读取…'}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={!snapshot || busyAction === 'directory'}
              onClick={() => void chooseDirectory()}
            >
              更改
            </Button>
          </div>
        </section>

        {permissionRecoveryVisible && (
          <div className="settings-message">
            <span>
              {permissionRecoveryAction === 'request'
                ? '截图前需要屏幕录制权限'
                : '屏幕录制权限尚未开启'}
            </span>
            <div className="settings-message-actions">
              {permissionRecoveryAction === 'request' && (
                <Button
                  size="sm"
                  disabled={busyAction === 'permission'}
                  onClick={() => void requestScreenCapturePermission()}
                >
                  请求权限
                </Button>
              )}
              {permissionSettingsAvailable && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyAction === 'permission'}
                    onClick={() => void openScreenCaptureSettings()}
                  >
                    打开系统设置
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => window.screenRecorder.restartForScreenCapturePermission()}
                  >
                    重启应用
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {visibleMessage && <div className="settings-message">{visibleMessage}</div>}
      </div>

      <footer className="settings-footer">
        <span>关闭后继续在系统托盘运行</span>
        <Button disabled={!draft} onClick={() => void save()}>
          保存快捷键
        </Button>
      </footer>
    </main>
  );
}
