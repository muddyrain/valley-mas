import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readSource(path: string) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

describe('AI tools dock surface', () => {
  it('opens the Dock AI entry as the AI Command Center without pet runtime wiring', () => {
    const dockStore = readSource('src/store/dockStore.ts');
    const dockSource = readSource('src/components/Dock.tsx');
    const appSource = readSource('src/App.tsx');

    expect(dockStore).toContain("label: 'AI 工具'");
    expect(dockStore).toContain("appId: 'aiTools'");
    expect(dockStore).toContain('canOpenWindow: true');
    expect(dockStore).not.toContain("action: 'ai-pet'");
    expect(dockSource).not.toContain('togglePet');
    expect(dockSource).not.toContain('isPetSummoned');
    expect(appSource).not.toContain('AIPetRuntime');
    expect(appSource).not.toContain('useAIPetStore');
  });

  it('removes the pet-specific source tree and preference namespace without pet runtime wiring', () => {
    expect(existsSync('src/ai-pet')).toBe(false);
    expect(existsSync('src/store/aiPetStore.ts')).toBe(false);
    expect(existsSync('public/ai-pet')).toBe(false);
  });
});
