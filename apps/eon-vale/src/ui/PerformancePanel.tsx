import { Activity, Box, Cpu, Route } from 'lucide-react';
import type { RuntimeMetrics } from '@/render/EonValeEngine';

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      <span className="metric-icon">{icon}</span>
      <span className="metric-copy">
        <span>{label}</span>
        <strong>{value}</strong>
      </span>
    </div>
  );
}

export function PerformancePanel({
  metrics,
  population,
}: {
  metrics: RuntimeMetrics;
  population: number;
}) {
  return (
    <aside
      className="performance-panel"
      data-testid="performance-panel"
      data-user-agent={navigator.userAgent}
      data-viewport={`${window.innerWidth}x${window.innerHeight}`}
      data-dpr={window.devicePixelRatio}
      data-cores={navigator.hardwareConcurrency}
      data-population={population}
    >
      <div className="panel-heading">
        <span>
          <small>实时遥测</small>
          <strong>性能监视</strong>
        </span>
        <span className={metrics.fps >= 50 ? 'health-badge good' : 'health-badge'}>
          {metrics.fps >= 50 ? '流畅' : '采样中'}
        </span>
      </div>
      <div className="metric-grid">
        <Metric icon={<Activity size={16} />} label="FPS" value={metrics.fps.toFixed(1)} />
        <Metric icon={<Cpu size={16} />} label="Tick" value={`${metrics.tickMs.toFixed(2)} ms`} />
        <Metric
          icon={<Route size={16} />}
          label="寻路队列"
          value={metrics.pathQueue.toLocaleString('zh-CN')}
        />
        <Metric icon={<Box size={16} />} label="Draw calls" value={String(metrics.drawCalls)} />
      </div>
      <div className="telemetry-list">
        <span>
          <b>帧 P95</b>
          <em data-testid="frame-p95">{metrics.frameP95Ms.toFixed(2)} ms</em>
        </span>
        <span>
          <b>平均 Tick</b>
          <em>{metrics.averageTickMs.toFixed(2)} ms</em>
        </span>
        <span>
          <b>三角形</b>
          <em>{metrics.triangles.toLocaleString('zh-CN')}</em>
        </span>
        <span>
          <b>长任务</b>
          <em>{metrics.longTasks}</em>
        </span>
      </div>
    </aside>
  );
}
