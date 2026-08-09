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
    expect(packageJson.build.mac.extendInfo).toMatchObject({
      NSMicrophoneUsageDescription: expect.any(String),
      NSCameraUsageDescription: expect.any(String),
      NSScreenCaptureUsageDescription: expect.any(String),
    });
  });
});
