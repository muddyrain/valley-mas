import daisyModelUrl from '../assets/models/characters/daisy.glb';
import peachModelUrl from '../assets/models/characters/peach.glb';
import { toRuntimeAssetUrl } from './assetUrl';
import type { ClimberCharacterId, ClimberCharacterOption } from './types';

export const CLIMBER_CHARACTER_OPTIONS: ClimberCharacterOption[] = [
  {
    id: 'peach',
    name: '碧姬',
    description: '加载 peach.glb；若资源异常会自动回退占位角色。',
  },
  {
    id: 'daisy',
    name: '黛西',
    description: '加载 daisy.glb；若资源异常会自动回退占位角色。',
  },
];

export const CHARACTER_MODEL_URLS: Record<Exclude<ClimberCharacterId, 'orb'>, string[]> = {
  peach: [
    toRuntimeAssetUrl(peachModelUrl, import.meta.url),
    '/game/models/peach.glb?v=20260412-peach',
    '/game/models/peach.glb?raw=1',
  ],
  daisy: [
    toRuntimeAssetUrl(daisyModelUrl, import.meta.url),
    '/game/models/daisy.glb?v=20260412-daisy',
    '/game/models/daisy.glb?raw=1',
  ],
};

export function isModelCharacter(
  characterId: ClimberCharacterId,
): characterId is Exclude<ClimberCharacterId, 'orb'> {
  return characterId !== 'orb';
}
