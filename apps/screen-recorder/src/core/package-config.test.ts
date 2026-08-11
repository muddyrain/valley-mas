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

  it('pins host packaging to the installed Electron runtime', async () => {
    const scriptUrls = [
      new URL('../../scripts/package-dir.mjs', import.meta.url),
      new URL('../../scripts/package-platform.mjs', import.meta.url),
    ];

    for (const scriptUrl of scriptUrls) {
      const script = await readFile(scriptUrl, 'utf8');

      expect(script).toContain('config.electronDist');
      expect(script).toContain("require.resolve('electron/package.json')");
    }

    const platformScript = await readFile(
      new URL('../../scripts/package-platform.mjs', import.meta.url),
      'utf8',
    );
    expect(platformScript).toContain("requestedPlatform === 'win'");
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

  it('requires hardened Developer ID signing and notarization for macOS release builds', async () => {
    const packageJson = JSON.parse(
      await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
    );
    const packageScript = await readFile(
      new URL('../../scripts/package-platform.mjs', import.meta.url),
      'utf8',
    );
    const verifyScript = await readFile(
      new URL('../../scripts/verify-macos-release.mjs', import.meta.url),
      'utf8',
    );
    const appEntitlements = await readFile(
      new URL('../../assets/entitlements.mac.plist', import.meta.url),
      'utf8',
    );
    const inheritedEntitlements = await readFile(
      new URL('../../assets/entitlements.mac.inherit.plist', import.meta.url),
      'utf8',
    );

    expect(packageJson.scripts['package:mac:release']).toContain('--release');
    expect(packageJson.scripts['package:mac:release']).toContain('verify-macos-release.mjs');
    expect(packageJson.build.mac).toMatchObject({
      hardenedRuntime: true,
      notarize: true,
      entitlements: 'assets/entitlements.mac.plist',
      entitlementsInherit: 'assets/entitlements.mac.inherit.plist',
    });
    expect(packageScript).toContain('Developer ID Application');
    expect(packageScript).toContain('APPLE_API_KEY');
    expect(packageScript).toContain('APPLE_KEYCHAIN_PROFILE');
    expect(packageScript).toContain('APPLE_APP_SPECIFIC_PASSWORD');
    expect(packageScript).toContain('--config.forceCodeSigning=true');
    expect(appEntitlements).toContain('com.apple.security.device.audio-input');
    expect(appEntitlements).toContain('com.apple.security.device.camera');
    expect(appEntitlements).toContain('com.apple.security.cs.allow-jit');
    expect(appEntitlements).not.toContain('com.apple.security.get-task-allow');
    expect(inheritedEntitlements).toContain('com.apple.security.cs.allow-jit');
    expect(inheritedEntitlements).toContain(
      'com.apple.security.cs.allow-unsigned-executable-memory',
    );
    expect(verifyScript).toContain("'codesign'");
    expect(verifyScript).toContain("'spctl'");
    expect(verifyScript).toContain("'stapler'");
  });

  it('uses macOS window bounds without changing the Windows overlay content coordinate system', async () => {
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

    const fitOverlaySource = mainSource.slice(
      mainSource.indexOf('function fitOverlayToDisplay'),
      mainSource.indexOf('function createMainWindow'),
    );

    expect(mainSource).toContain('getDisplayOverlayWindowOptions(process.platform)');
    expect(fitOverlaySource).toContain("process.platform === 'darwin'");
    expect(fitOverlaySource).toContain('window.setBounds(display.bounds)');
    expect(fitOverlaySource).toContain('window.setContentBounds(display.bounds)');
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
