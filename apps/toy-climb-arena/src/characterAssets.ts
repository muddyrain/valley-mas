import daisyModelUrl from '../assets/models/characters/daisy.glb';
import peachModelUrl from '../assets/models/characters/peach.glb';
import toyHeroModelUrl from '../assets/models/characters/toy_hero.glb';
import { toRuntimeAssetUrl } from './assetUrl';
import type { ClimberCharacterId, ClimberCharacterOption } from './types';

export type ModelCharacterId = 'toyhero' | 'peach' | 'daisy';

export const CLIMBER_CHARACTER_OPTIONS: ClimberCharacterOption[] = [
  {
    id: 'toyhero',
    name: '玩具队长',
    description: '原创精细玩具人偶 GLB：护目镜、围巾、背包、手套和靴子，适合作为默认主角。',
  },
  {
    id: 'woodendoll',
    name: '木偶',
    description: '程序化木制玩偶角色，圆润关节，暖木纹配色。',
  },
  {
    id: 'panda',
    name: '熊猫',
    description: '圆滚滚的黑白大熊猫，憨态可掬，程序化模型。',
  },
  {
    id: 'frog',
    name: '青蛙',
    description: '扁宽绿色身体，突出大眼球，后腿弹跳有力，程序化模型。',
  },
  {
    id: 'cat',
    name: '猫咪',
    description: '三角尖耳橘猫，懒洋洋摆尾，程序化模型。',
  },
  {
    id: 'peach',
    name: '碧姬',
    description: '旧版 peach.glb；保留作对照，资源异常会自动回退占位角色。',
  },
  {
    id: 'daisy',
    name: '黛西',
    description: '旧版 daisy.glb；保留作对照，资源异常会自动回退占位角色。',
  },
];

export const CHARACTER_MODEL_URLS: Record<ModelCharacterId, string[]> = {
  toyhero: [toRuntimeAssetUrl(toyHeroModelUrl, import.meta.url)],
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

export function isModelCharacter(characterId: ClimberCharacterId): characterId is ModelCharacterId {
  return characterId === 'toyhero' || characterId === 'peach' || characterId === 'daisy';
}
