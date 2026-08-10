import { describe, expect, it, vi } from 'vitest';
import { type DepthOfFieldBackend, LazyDepthOfFieldPipeline } from './DepthOfFieldPipeline';

function createBackend(): DepthOfFieldBackend {
  return {
    resize: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
  };
}

describe('LazyDepthOfFieldPipeline', () => {
  it('只在启用景深时加载，并按半分辨率配置后处理', async () => {
    const backend = createBackend();
    const loader = vi.fn(async () => backend);
    const pipeline = new LazyDepthOfFieldPipeline(loader);
    pipeline.resize(1440, 900, 2);

    expect(loader).not.toHaveBeenCalled();

    await pipeline.setEnabled(true);

    expect(loader).toHaveBeenCalledOnce();
    expect(backend.resize).toHaveBeenCalledWith(1440, 900, 1);
    expect(pipeline.render(18)).toBe(true);
    expect(backend.render).toHaveBeenCalledWith(18);
  });

  it('关闭景深后释放后处理资源并回退到主渲染器', async () => {
    const backend = createBackend();
    const pipeline = new LazyDepthOfFieldPipeline(async () => backend);
    await pipeline.setEnabled(true);

    await pipeline.setEnabled(false);

    expect(backend.dispose).toHaveBeenCalledOnce();
    expect(pipeline.render(12)).toBe(false);
  });
});
