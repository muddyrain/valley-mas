import { describe, expect, it, vi } from 'vitest';
import { createTrayPrimaryAction } from './tray-action';

describe('tray primary action', () => {
  it('opens the control menu instead of starting a screenshot while busy', () => {
    const start = vi.fn(async () => undefined);
    const menu = vi.fn();
    createTrayPrimaryAction(start, vi.fn(), { isBusy: () => true, showMenu: menu })();
    expect(start).not.toHaveBeenCalled();
    expect(menu).toHaveBeenCalledOnce();
  });
  it('starts one region screenshot on a left click', async () => {
    const startRegionScreenshot = vi.fn(async () => undefined);
    const reportError = vi.fn();

    createTrayPrimaryAction(startRegionScreenshot, reportError)();
    await vi.waitFor(() => expect(startRegionScreenshot).toHaveBeenCalledOnce());

    expect(reportError).not.toHaveBeenCalled();
  });

  it('routes a rejected screenshot start to the visible error handler', async () => {
    const error = new Error('当前已有截图任务');
    const reportError = vi.fn();

    createTrayPrimaryAction(async () => Promise.reject(error), reportError)();
    await vi.waitFor(() => expect(reportError).toHaveBeenCalledWith(error));
  });
});
