import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import {
  createSingleFlightScreenCapturePermissionRequest,
  getScreenCapturePermissionRecoveryAction,
  requestScreenCapturePermissionStatus,
  resolveScreenCapturePermissionStatus,
  runAfterScreenCapturePermission,
  type ScreenCapturePermissionStatus,
  shouldOfferScreenCapturePermissionRecovery,
} from './screen-capture-permission';

describe('screen capture permission gate', () => {
  it('coalesces simultaneous macOS permission requests into one native prompt', async () => {
    let finishRequest: (() => void) | undefined;
    const nativeRequest = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishRequest = resolve;
        }),
    );
    const requestPermission = createSingleFlightScreenCapturePermissionRequest(nativeRequest);

    const requests = [requestPermission(), requestPermission(), requestPermission()];
    expect(nativeRequest).toHaveBeenCalledOnce();
    finishRequest?.();
    await Promise.all(requests);
  });

  it('does not request screen capture permission during passive application startup', async () => {
    const mainSource = await readFile(new URL('../../electron/main.ts', import.meta.url), 'utf8');
    expect(mainSource).not.toContain('refreshScreenCapturePermission');
  });

  it('requests macOS permission before directing the user to System Settings', () => {
    expect(getScreenCapturePermissionRecoveryAction('darwin', 'not-determined')).toBe('request');
    expect(getScreenCapturePermissionRecoveryAction('darwin', 'unknown')).toBe('request');
    expect(getScreenCapturePermissionRecoveryAction('darwin', 'denied')).toBe('request');
    expect(getScreenCapturePermissionRecoveryAction('darwin', 'restricted')).toBe('settings');
    expect(getScreenCapturePermissionRecoveryAction('darwin', 'granted')).toBeUndefined();
    expect(getScreenCapturePermissionRecoveryAction('win32', 'denied')).toBeUndefined();
  });

  it('performs the native request while macOS permission is not determined', async () => {
    let status: ScreenCapturePermissionStatus = 'not-determined';
    const requestPermission = vi.fn(async () => {
      status = 'granted';
    });

    await expect(
      requestScreenCapturePermissionStatus({
        platform: 'darwin',
        getStatus: () => status,
        requestPermission,
      }),
    ).resolves.toBe('granted');
    expect(requestPermission).toHaveBeenCalledOnce();
  });

  it('trusts a successful native capture probe when macOS still reports denied', async () => {
    const requestPermission = vi.fn(async () => undefined);

    await expect(
      requestScreenCapturePermissionStatus({
        platform: 'darwin',
        getStatus: () => 'denied',
        requestPermission,
      }),
    ).resolves.toBe('granted');
    expect(requestPermission).toHaveBeenCalledOnce();
  });

  it('keeps a successful native probe authoritative for later snapshots', () => {
    expect(resolveScreenCapturePermissionStatus('darwin', 'denied', true)).toBe('granted');
    expect(resolveScreenCapturePermissionStatus('darwin', 'denied', false)).toBe('denied');
    expect(resolveScreenCapturePermissionStatus('win32', 'denied', false)).toBe('granted');
  });

  it('keeps the current status when macOS cannot create a capture source', async () => {
    await expect(
      requestScreenCapturePermissionStatus({
        platform: 'darwin',
        getStatus: () => 'denied',
        requestPermission: async () => {
          throw new Error('Failed to get sources');
        },
      }),
    ).resolves.toBe('denied');
  });

  it('waits for the first macOS permission request before creating a capture surface', async () => {
    const events: string[] = [];
    let status: ScreenCapturePermissionStatus = 'not-determined';

    await runAfterScreenCapturePermission({
      platform: 'darwin',
      getStatus: () => status,
      requestPermission: async () => {
        events.push('permission');
        status = 'granted';
      },
      deniedMessage: 'screen capture permission denied',
      run: () => {
        events.push('surface');
      },
    });

    expect(events).toEqual(['permission', 'surface']);
  });

  it('creates the capture surface after a successful native probe despite stale status', async () => {
    const requestPermission = vi.fn(async () => undefined);
    const run = vi.fn();

    await expect(
      runAfterScreenCapturePermission({
        platform: 'darwin',
        getStatus: () => 'denied',
        requestPermission,
        deniedMessage: 'screen capture permission denied',
        run,
      }),
    ).resolves.toBeUndefined();

    expect(requestPermission).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledOnce();
  });

  it('does not create a capture surface when the native permission probe fails', async () => {
    const run = vi.fn();

    await expect(
      runAfterScreenCapturePermission({
        platform: 'darwin',
        getStatus: () => 'not-determined',
        requestPermission: async () => {
          throw new Error('Failed to get sources');
        },
        deniedMessage: 'screen capture permission denied',
        run,
      }),
    ).rejects.toThrow('screen capture permission denied');

    expect(run).not.toHaveBeenCalled();
  });

  it('does not add a permission gate on Windows', async () => {
    const getStatus = vi.fn(() => 'denied' as const);
    const requestPermission = vi.fn(async () => undefined);
    const run = vi.fn(() => 'started');

    await expect(
      runAfterScreenCapturePermission({
        platform: 'win32',
        getStatus,
        requestPermission,
        deniedMessage: 'screen capture permission denied',
        run,
      }),
    ).resolves.toBe('started');

    expect(getStatus).not.toHaveBeenCalled();
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('offers macOS recovery actions until the current process sees granted access', () => {
    expect(shouldOfferScreenCapturePermissionRecovery('darwin', 'denied')).toBe(true);
    expect(shouldOfferScreenCapturePermissionRecovery('darwin', 'not-determined')).toBe(true);
    expect(shouldOfferScreenCapturePermissionRecovery('darwin', 'granted')).toBe(false);
    expect(shouldOfferScreenCapturePermissionRecovery('win32', 'denied')).toBe(false);
  });
});
