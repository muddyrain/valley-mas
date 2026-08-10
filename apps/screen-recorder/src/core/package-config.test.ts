import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('desktop installer configuration', () => {
  it('defines Windows NSIS and macOS DMG/ZIP delivery targets with media permission copy', async () => {
    const packageJson = JSON.parse(
      await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
    );

    expect(packageJson.scripts['package:win']).toBeTruthy();
    expect(packageJson.scripts['package:mac']).toBeTruthy();
    expect(packageJson.build.win.target).toEqual([{ target: 'nsis', arch: ['x64'] }]);
    expect(packageJson.build.win.icon).toBe('assets/logo.png');
    expect(packageJson.build.nsis).toMatchObject({
      useZip: false,
      differentialPackage: false,
    });
    expect(packageJson.build.electronLanguages).toEqual(['zh-CN', 'en-US']);
    expect(packageJson.build.files).toContain('!node_modules/**/*');
    expect(packageJson.dependencies).toEqual({});
    expect(packageJson.devDependencies).toMatchObject({
      'lucide-react': expect.any(String),
      react: expect.any(String),
      'react-dom': expect.any(String),
    });
    expect(packageJson.build.mac.target).toEqual([
      { target: 'dmg', arch: ['x64', 'arm64'] },
      { target: 'zip', arch: ['x64', 'arm64'] },
    ]);
    expect(packageJson.build.appId).toBe('com.valley.screenrecorder');
    expect(packageJson.build.mac).not.toHaveProperty('identity');
    expect(packageJson.build.mac.icon).toBe('assets/logo.png');
    expect(packageJson.build.mac.extraResources).toContainEqual({
      from: 'dist-electron/native/macos-window-query',
      to: 'native/macos-window-query',
    });
    expect(packageJson.build.mac.extendInfo).toMatchObject({
      NSMicrophoneUsageDescription: expect.any(String),
      NSCameraUsageDescription: expect.any(String),
      NSScreenCaptureUsageDescription: expect.any(String),
    });
  });

  it('lets electron-builder resolve the Electron runtime for each target architecture', async () => {
    const scriptUrls = [
      new URL('../../scripts/package-dir.mjs', import.meta.url),
      new URL('../../scripts/package-platform.mjs', import.meta.url),
    ];

    for (const scriptUrl of scriptUrls) {
      const script = await readFile(scriptUrl, 'utf8');

      expect(script).not.toContain('config.electronDist');
      expect(script).not.toContain("require.resolve('electron/package.json')");
    }
  });

  it('builds the macOS window helper and only falls back to ad-hoc signing without an identity', async () => {
    const packageJson = JSON.parse(
      await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
    );
    const packageScript = await readFile(
      new URL('../../scripts/package-platform.mjs', import.meta.url),
      'utf8',
    );

    expect(packageJson.scripts['build:electron']).toContain('build-native-helpers.mjs');
    expect(packageScript).toContain('security');
    expect(packageScript).toContain('find-identity');
    expect(packageScript).toContain('--config.mac.identity=-');
  });

  it('uses full-display macOS overlay options and dedicated tray template images', async () => {
    const mainSource = await readFile(new URL('../../electron/main.ts', import.meta.url), 'utf8');
    const traySource = await readFile(
      new URL('../../assets/trayTemplate.svg', import.meta.url),
      'utf8',
    );
    const vectorLogoSource = await readFile(
      new URL('../../assets/logo.svg', import.meta.url),
      'utf8',
    );
    const logoIcon = await readFile(new URL('../../assets/logo.png', import.meta.url));
    const trayIcon = await readFile(new URL('../../assets/trayTemplate.png', import.meta.url));
    const trayIcon2x = await readFile(new URL('../../assets/trayTemplate@2x.png', import.meta.url));

    expect(mainSource).toContain('getDisplayOverlayWindowOptions(process.platform)');
    expect(mainSource).toContain('window.setBounds(display.bounds)');
    expect(mainSource).not.toContain('window.setContentBounds(display.bounds)');
    expect(mainSource).toContain('nextSelectionWindow.setVisibleOnAllWorkspaces');
    expect(mainSource).toContain('trayTemplate.png');
    expect(traySource).toContain('data-logo-motif="red-panda"');
    expect(vectorLogoSource).toContain('data-logo-motif="red-panda"');
    expect(vectorLogoSource).toContain('<linearGradient');
    expect(vectorLogoSource).not.toContain('<image');
    expect([logoIcon.readUInt32BE(16), logoIcon.readUInt32BE(20)]).toEqual([1024, 1024]);
    expect([trayIcon.readUInt32BE(16), trayIcon.readUInt32BE(20)]).toEqual([16, 16]);
    expect([trayIcon2x.readUInt32BE(16), trayIcon2x.readUInt32BE(20)]).toEqual([32, 32]);
  });
});
