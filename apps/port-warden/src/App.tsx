import {
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleStop,
  Clock3,
  Command,
  FolderOpen,
  GitBranch,
  Inbox,
  LoaderCircle,
  LockKeyhole,
  Moon,
  PanelRightOpen,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SquareTerminal,
  Sun,
  TreePine,
  X,
} from 'lucide-react';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import portWardenLogo from '../assets/port-warden-logo-ui.png';
import { filterRecords } from './domain/filter-records';
import type {
  PortProcessRecord,
  ProcessTreeContext,
  ProcessTreeNode,
  ScanResult,
  StopPlan,
  StopScope,
} from './shared/domain';

type Toast = { id: number; tone: 'success' | 'warning' | 'danger'; message: string };
type StopDialogState = {
  scope: StopScope;
  preparing: boolean;
  executing: boolean;
  confirmed: boolean;
  plan?: StopPlan;
  error?: string;
};

const errorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/^Error invoking remote method '[^']+': Error: /, '');
};

const formatStartedAt = (value?: string) => {
  if (!value) return '未知';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
};

const platformName = (platform: ScanResult['platform']) =>
  platform === 'darwin' ? 'macOS' : platform === 'win32' ? 'Windows' : '不支持的平台';

function IconButton({
  label,
  children,
  onClick,
  disabled,
}: {
  label: string;
  children: ReactNode;
  onClick(): void;
  disabled?: boolean;
}) {
  return (
    <button
      className="icon-button"
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function StatusBadge({ record }: { record: PortProcessRecord }) {
  if (record.process.readOnly) {
    return (
      <span className="badge badge-readonly" title={record.process.readOnlyReason}>
        <LockKeyhole size={12} /> 只读
      </span>
    );
  }
  if (record.project.confidence === 'inferred') {
    return <span className="badge badge-inferred">推断</span>;
  }
  return null;
}

function TreeNode({ node, depth = 0 }: { node: ProcessTreeNode; depth?: number }) {
  return (
    <li>
      <div className="tree-node" style={{ paddingLeft: `${depth * 18 + 8}px` }}>
        {node.children.length > 0 ? <ChevronRight size={13} /> : <span className="tree-spacer" />}
        <span className="tree-process">{node.process.name}</span>
        <span className="mono muted">{node.process.pid}</span>
        {node.process.readOnly && <LockKeyhole size={12} className="tree-lock" />}
      </div>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <TreeNode key={child.process.pid} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

function DetailField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: string;
  mono?: boolean;
}) {
  return (
    <div className="detail-field">
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>{value || '未知'}</dd>
    </div>
  );
}

export function App() {
  const [scan, setScan] = useState<ScanResult>();
  const [scanError, setScanError] = useState<string>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('port-warden-theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });
  const [selected, setSelected] = useState<PortProcessRecord>();
  const [selectedExited, setSelectedExited] = useState(false);
  const [tree, setTree] = useState<ProcessTreeContext>();
  const [treeLoading, setTreeLoading] = useState(false);
  const [stopDialog, setStopDialog] = useState<StopDialogState>();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const scanInFlight = useRef(false);

  const pushToast = useCallback((tone: Toast['tone'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, tone, message }]);
    window.setTimeout(
      () => setToasts((current) => current.filter((toast) => toast.id !== id)),
      4200,
    );
  }, []);

  const refresh = useCallback(
    async (silent = false) => {
      if (scanInFlight.current) return;
      scanInFlight.current = true;
      if (!silent) setIsRefreshing(true);
      try {
        if (!window.portWarden) throw new Error('桌面安全桥不可用，请从 Electron 应用启动');
        const result = await window.portWarden.scan();
        setScan(result);
        setScanError(undefined);
        setSelected((current) => {
          if (!current) return current;
          const fresh = result.records.find(({ key }) => key === current.key);
          setSelectedExited(!fresh);
          return fresh ?? current;
        });
        if (result.opened.length > 0) {
          const ports = result.opened.map(({ port }) => port).join('、');
          pushToast('success', `新增监听端口：${ports}`);
        }
        if (result.closed.length > 0) {
          const ports = result.closed.map(({ port }) => port).join('、');
          pushToast('warning', `端口已释放：${ports}`);
        }
      } catch (error) {
        setScanError(errorMessage(error));
      } finally {
        scanInFlight.current = false;
        setIsRefreshing(false);
      }
    },
    [pushToast],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => void refresh(true), 5000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, refresh]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('port-warden-theme', theme);
  }, [theme]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
      if ((event.metaKey || event.ctrlKey) && (event.key === 'f' || event.key === 'k')) {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key.toLowerCase() === 'r' && !isTyping && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        void refresh();
      } else if (event.key === 'Escape') {
        if (stopDialog) setStopDialog(undefined);
        else if (selected) setSelected(undefined);
        else if (query) setQuery('');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [query, refresh, selected, stopDialog]);

  const filteredRecords = useMemo(() => filterRecords(scan?.records ?? [], query), [query, scan]);

  const openDetails = async (record: PortProcessRecord) => {
    setSelected(record);
    setSelectedExited(false);
    setTree(undefined);
    setTreeLoading(true);
    try {
      setTree(await window.portWarden?.getProcessTree(record.process.pid));
    } catch (error) {
      pushToast('danger', errorMessage(error));
    } finally {
      setTreeLoading(false);
    }
  };

  const onRowKeyDown = (
    event: ReactKeyboardEvent<HTMLTableRowElement>,
    record: PortProcessRecord,
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      void openDetails(record);
    }
  };

  const openTarget = async (kind: 'project' | 'executable') => {
    if (!selected || !window.portWarden) return;
    try {
      await window.portWarden.openTarget({ pid: selected.process.pid, kind });
    } catch (error) {
      pushToast('danger', errorMessage(error));
    }
  };

  const registerProject = async () => {
    if (!selected || !window.portWarden) return;
    try {
      const result = await window.portWarden.registerProject(selected.process.pid);
      if (!result.registered) return;
      pushToast('success', '已登记项目目录');
      await refresh();
    } catch (error) {
      pushToast('danger', errorMessage(error));
    }
  };

  const prepareStop = async (scope: StopScope) => {
    if (!selected || !window.portWarden) return;
    setStopDialog({ scope, preparing: true, executing: false, confirmed: false });
    try {
      const plan = await window.portWarden.prepareStop({ pid: selected.process.pid, scope });
      setStopDialog({ scope, preparing: false, executing: false, confirmed: false, plan });
    } catch (error) {
      setStopDialog({
        scope,
        preparing: false,
        executing: false,
        confirmed: false,
        error: errorMessage(error),
      });
    }
  };

  const executeStop = async () => {
    if (!stopDialog?.plan || !window.portWarden || !stopDialog.confirmed) return;
    setStopDialog((current) =>
      current ? { ...current, executing: true, error: undefined } : current,
    );
    try {
      const result = await window.portWarden.executeStop({
        planId: stopDialog.plan.id,
        confirmedPids: stopDialog.plan.targetProcesses.map(({ pid }) => pid),
      });
      if (result.failed.length > 0) {
        pushToast('danger', `${result.failed.length} 个进程停止失败`);
      } else if (result.alreadyExitedPids.length > 0 && result.stoppedPids.length === 0) {
        pushToast('warning', '进程已经退出');
      } else {
        pushToast('success', `已停止 PID：${result.stoppedPids.join('、')}`);
      }
      setStopDialog(undefined);
      setSelectedExited(true);
      window.setTimeout(() => void refresh(), 350);
    } catch (error) {
      setStopDialog((current) =>
        current ? { ...current, executing: false, error: errorMessage(error) } : current,
      );
    }
  };

  const closeDrawer = () => {
    setSelected(undefined);
    setTree(undefined);
    setSelectedExited(false);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <img src={portWardenLogo} alt="" />
          </div>
          <div>
            <h1>Port Warden</h1>
            <p>端口管家</p>
          </div>
        </div>

        <div className="search-box">
          <Search size={16} />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索端口、PID、进程、命令或项目"
            aria-label="搜索监听端口"
          />
          {query ? (
            <button type="button" aria-label="清空搜索" onClick={() => setQuery('')}>
              <X size={14} />
            </button>
          ) : (
            <kbd>{scan?.platform === 'win32' ? 'Ctrl K' : '⌘ K'}</kbd>
          )}
        </div>

        <div className="topbar-actions">
          <div className={`platform-pill ${scan?.permissionLimited ? 'limited' : ''}`}>
            {scan?.permissionLimited ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}
            <span>{scan ? platformName(scan.platform) : '正在连接'}</span>
            {scan?.permissionLimited && <em>部分只读</em>}
          </div>
          <label className="refresh-switch" title="每 5 秒自动刷新">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(event) => setAutoRefresh(event.target.checked)}
            />
            <span className="switch-track">
              <span />
            </span>
            自动刷新
          </label>
          <IconButton
            label={theme === 'dark' ? '切换浅色主题' : '切换深色主题'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </IconButton>
          <IconButton
            label="刷新端口列表 (R)"
            onClick={() => void refresh()}
            disabled={isRefreshing}
          >
            <RefreshCw size={16} className={isRefreshing ? 'spin' : undefined} />
          </IconButton>
        </div>
      </header>

      <main className="main-content">
        <div className="section-heading">
          <div>
            <h2>TCP 监听</h2>
            <span>{filteredRecords.length} 个端口</span>
          </div>
          <div className="last-scan">
            <Clock3 size={13} />{' '}
            {scan
              ? `上次扫描 ${new Date(scan.scannedAt).toLocaleTimeString('zh-CN', { hour12: false })}`
              : '等待首次扫描'}
          </div>
        </div>

        {scan?.permissionLimited && (
          <div className="notice notice-warning" role="status">
            <ShieldAlert size={16} />
            <span>部分进程信息不可访问，相关记录保持只读。</span>
          </div>
        )}
        {scan?.warning && (
          <div className="notice">
            <CircleAlert size={16} />
            <span>{scan.warning}</span>
          </div>
        )}

        <section className="table-card" aria-busy={!scan && !scanError}>
          {!scan && !scanError ? (
            <div className="state-panel">
              <LoaderCircle className="spin" size={25} />
              <h3>正在扫描监听端口</h3>
              <p>正在关联端口与进程快照…</p>
            </div>
          ) : scanError ? (
            <div className="state-panel state-error">
              <CircleAlert size={28} />
              <h3>扫描失败</h3>
              <p>{scanError}</p>
              <button className="button secondary" type="button" onClick={() => void refresh()}>
                重新扫描
              </button>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="state-panel">
              <Inbox size={28} />
              <h3>{query ? '没有匹配结果' : '没有 TCP 监听端口'}</h3>
              <p>{query ? '尝试搜索其他端口、PID 或项目路径。' : '启动本地服务后刷新列表。'}</p>
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>端口</th>
                    <th>进程</th>
                    <th>PID</th>
                    <th>地址</th>
                    <th>项目归属</th>
                    <th aria-label="操作" />
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <tr
                      key={record.key}
                      tabIndex={0}
                      className={selected?.key === record.key ? 'selected' : undefined}
                      onClick={() => void openDetails(record)}
                      onKeyDown={(event) => onRowKeyDown(event, record)}
                    >
                      <td>
                        <span className="port-number mono">{record.port}</span>
                      </td>
                      <td>
                        <div className="process-cell">
                          <div className="process-icon">
                            <SquareTerminal size={15} />
                          </div>
                          <div>
                            <strong>{record.process.name}</strong>
                            <span className="ellipsis mono">
                              {record.process.commandLine || '命令不可见'}
                            </span>
                          </div>
                          <StatusBadge record={record} />
                        </div>
                      </td>
                      <td>
                        <span className="mono pid">{record.process.pid}</span>
                      </td>
                      <td>
                        <div className="address-list">
                          {record.addresses.map(({ address, family }) => (
                            <span key={`${address}:${family}`} className="address-chip mono">
                              {address}
                              <small>{family === 'ipv6' ? 'v6' : 'v4'}</small>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        {record.project.path ? (
                          <div className="project-cell">
                            <GitBranch size={14} />
                            <div>
                              <strong>
                                {record.project.path.split(/[\\/]/).filter(Boolean).at(-1)}
                              </strong>
                              <span className="ellipsis mono">{record.project.path}</span>
                            </div>
                            {record.project.confidence === 'inferred' && (
                              <span className="badge badge-inferred">推断</span>
                            )}
                          </div>
                        ) : (
                          <span className="muted">unknown</span>
                        )}
                      </td>
                      <td>
                        <PanelRightOpen size={15} className="row-action" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {selected && (
        <aside className="drawer" aria-label="进程详情">
          <div className="drawer-header">
            <div>
              <span className="eyebrow">PID {selected.process.pid}</span>
              <h2>{selected.process.name}</h2>
            </div>
            <IconButton label="关闭详情" onClick={closeDrawer}>
              <X size={17} />
            </IconButton>
          </div>
          {selectedExited && (
            <div className="notice notice-warning">
              <CircleAlert size={16} />
              <span>进程已退出或端口已释放。</span>
            </div>
          )}
          <div className="drawer-scroll">
            <section className="detail-section">
              <h3>进程</h3>
              <dl>
                <DetailField label="完整命令" value={selected.process.commandLine} mono />
                <DetailField label="可执行文件" value={selected.process.executablePath} mono />
                <DetailField label="工作目录" value={selected.process.workingDirectory} mono />
                <DetailField label="启动时间" value={formatStartedAt(selected.process.startedAt)} />
                <DetailField label="父进程 PID" value={String(selected.process.ppid)} mono />
              </dl>
            </section>
            <section className="detail-section">
              <div className="detail-title-row">
                <h3>项目归属</h3>
                <span className={`confidence ${selected.project.confidence}`}>
                  {selected.project.confidence === 'exact'
                    ? '精确'
                    : selected.project.confidence === 'inferred'
                      ? '推断'
                      : '未知'}
                </span>
              </div>
              <p className="project-path mono">{selected.project.path || 'unknown'}</p>
              {selected.project.marker && (
                <p className="marker-line">
                  标志文件 <code>{selected.project.marker}</code>
                </p>
              )}
              <div className="button-row">
                <button
                  className="button secondary"
                  type="button"
                  disabled={selectedExited}
                  onClick={() => void registerProject()}
                >
                  <GitBranch size={14} />
                  登记项目目录
                </button>
                <button
                  className="button secondary"
                  type="button"
                  disabled={!selected.project.path || selectedExited}
                  onClick={() => void openTarget('project')}
                >
                  <FolderOpen size={14} />
                  打开项目目录
                </button>
                <button
                  className="button secondary"
                  type="button"
                  disabled={!selected.process.executablePath || selectedExited}
                  onClick={() => void openTarget('executable')}
                >
                  <Command size={14} />
                  打开进程目录
                </button>
              </div>
            </section>
            <section className="detail-section">
              <h3>进程树</h3>
              {treeLoading ? (
                <div className="tree-loading">
                  <LoaderCircle size={16} className="spin" />
                  加载进程关系…
                </div>
              ) : tree?.root ? (
                <div className="process-tree">
                  {tree.ancestors.length > 0 && (
                    <div className="ancestor-line">
                      父级：
                      {tree.ancestors
                        .map((ancestor) => `${ancestor.name} (${ancestor.pid})`)
                        .join(' › ')}
                    </div>
                  )}
                  <ul>
                    <TreeNode node={tree.root} />
                  </ul>
                </div>
              ) : (
                <p className="muted">没有可用的进程关系。</p>
              )}
            </section>
          </div>
          <footer className="drawer-footer">
            {selected.process.readOnly ? (
              <div className="readonly-reason">
                <LockKeyhole size={14} />
                {selected.process.readOnlyReason || '当前进程只读'}
              </div>
            ) : (
              <div className="danger-actions">
                <button
                  className="button danger-ghost"
                  type="button"
                  disabled={selectedExited}
                  onClick={() => void prepareStop('process')}
                >
                  <CircleStop size={15} />
                  停止进程
                </button>
                <button
                  className="button danger"
                  type="button"
                  disabled={selectedExited}
                  onClick={() => void prepareStop('tree')}
                >
                  <TreePine size={15} />
                  停止进程树
                </button>
              </div>
            )}
          </footer>
        </aside>
      )}

      {stopDialog && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !stopDialog.executing)
              setStopDialog(undefined);
          }}
        >
          <section
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stop-title"
          >
            <div className="danger-icon">
              <CircleStop size={22} />
            </div>
            <div className="confirm-header">
              <div>
                <span className="eyebrow">危险操作</span>
                <h2 id="stop-title">
                  {stopDialog.scope === 'tree' ? '确认停止进程树' : '确认停止进程'}
                </h2>
              </div>
              <IconButton
                label="关闭确认"
                onClick={() => setStopDialog(undefined)}
                disabled={stopDialog.executing}
              >
                <X size={16} />
              </IconButton>
            </div>
            {stopDialog.preparing ? (
              <div className="preparing">
                <LoaderCircle className="spin" size={20} />
                正在重新校验进程身份…
              </div>
            ) : stopDialog.error && !stopDialog.plan ? (
              <div className="notice notice-danger">
                <CircleAlert size={16} />
                <span>{stopDialog.error}</span>
              </div>
            ) : (
              stopDialog.plan && (
                <>
                  <p className="confirm-copy">即将向以下进程发送停止信号：</p>
                  <div className="pid-list">
                    {stopDialog.plan.targetProcesses.map((process) => (
                      <div key={process.pid}>
                        <span className="mono">PID {process.pid}</span>
                        <strong>{process.name}</strong>
                        <small className="mono">{process.commandLine || '命令不可见'}</small>
                      </div>
                    ))}
                  </div>
                  <label className="confirm-check">
                    <input
                      type="checkbox"
                      checked={stopDialog.confirmed}
                      onChange={(event) =>
                        setStopDialog((current) =>
                          current ? { ...current, confirmed: event.target.checked } : current,
                        )
                      }
                    />
                    <span>我已核对全部 PID</span>
                  </label>
                  {stopDialog.error && (
                    <div className="notice notice-danger">
                      <CircleAlert size={16} />
                      <span>{stopDialog.error}</span>
                    </div>
                  )}
                </>
              )
            )}
            <footer className="confirm-footer">
              <button
                className="button secondary"
                type="button"
                disabled={stopDialog.executing}
                onClick={() => setStopDialog(undefined)}
              >
                取消
              </button>
              <button
                className="button danger"
                type="button"
                disabled={!stopDialog.plan || !stopDialog.confirmed || stopDialog.executing}
                onClick={() => void executeStop()}
              >
                {stopDialog.executing ? (
                  <LoaderCircle size={15} className="spin" />
                ) : (
                  <CircleStop size={15} />
                )}
                确认停止 {stopDialog.plan ? `${stopDialog.plan.targetProcesses.length} 个进程` : ''}
              </button>
            </footer>
          </section>
        </div>
      )}

      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div className={`toast ${toast.tone}`} key={toast.id}>
            {toast.tone === 'success' ? <CircleCheck size={16} /> : <CircleAlert size={16} />}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
