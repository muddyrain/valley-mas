import type { StaticImageData } from 'next/image';
import gamblerAvatar from '../assets/gambler.png';
import parentsAvatar from '../assets/parents.png';
import rationalistsAvatar from '../assets/rationalists.png';
import sharpTongueAvatar from '../assets/sharp-tongue.png';
import slackOffAvatar from '../assets/slack-off.png';

export interface PersonaTone {
  avatar: string;
  surface: string;
  chip: string;
  bar: string;
  accentText: string;
  glow: string;
}

const personaTones: Record<string, PersonaTone> = {
  blue: {
    avatar:
      'border-sky-300/45 bg-[linear-gradient(135deg,rgba(56,189,248,0.28),rgba(59,130,246,0.14),rgba(79,70,229,0.26))]',
    surface:
      'border-blue-400/30 bg-[linear-gradient(135deg,rgba(96,165,250,0.12),rgba(255,255,255,0.05),rgba(17,24,39,0.9))] backdrop-blur-md',
    chip: 'border-sky-300/20 bg-sky-400/12 text-sky-100',
    bar: 'from-sky-400 via-blue-500 to-indigo-500',
    accentText: 'text-sky-200',
    glow: 'shadow-[0_0_20px_rgba(96,165,250,0.2)]',
  },
  violet: {
    avatar:
      'border-violet-300/45 bg-[linear-gradient(135deg,rgba(168,85,247,0.28),rgba(217,70,239,0.18),rgba(244,114,182,0.26))]',
    surface:
      'border-pink-400/30 bg-[linear-gradient(135deg,rgba(217,70,239,0.12),rgba(244,114,182,0.08),rgba(24,24,48,0.92))] backdrop-blur-md',
    chip: 'border-violet-300/20 bg-violet-400/12 text-violet-100',
    bar: 'from-violet-400 via-fuchsia-500 to-pink-500',
    accentText: 'text-violet-200',
    glow: 'shadow-[0_0_20px_rgba(236,72,153,0.3)]',
  },
  red: {
    avatar:
      'border-rose-300/45 bg-[linear-gradient(135deg,rgba(251,113,133,0.26),rgba(244,63,94,0.15),rgba(251,146,60,0.28))]',
    surface:
      'border-orange-400/30 bg-[linear-gradient(135deg,rgba(251,146,60,0.12),rgba(244,114,182,0.06),rgba(24,24,48,0.92))] backdrop-blur-md',
    chip: 'border-rose-300/20 bg-rose-400/12 text-rose-100',
    bar: 'from-rose-400 via-pink-500 to-orange-400',
    accentText: 'text-rose-200',
    glow: 'shadow-[0_0_20px_rgba(251,146,60,0.24)]',
  },
  green: {
    avatar:
      'border-emerald-300/45 bg-[linear-gradient(135deg,rgba(52,211,153,0.26),rgba(16,185,129,0.15),rgba(45,212,191,0.26))]',
    surface:
      'border-green-400/30 bg-[linear-gradient(135deg,rgba(74,222,128,0.1),rgba(255,255,255,0.04),rgba(24,24,48,0.92))] backdrop-blur-md',
    chip: 'border-emerald-300/20 bg-emerald-400/12 text-emerald-100',
    bar: 'from-emerald-400 via-teal-400 to-cyan-400',
    accentText: 'text-emerald-200',
    glow: 'shadow-[0_0_20px_rgba(74,222,128,0.2)]',
  },
  yellow: {
    avatar:
      'border-amber-300/45 bg-[linear-gradient(135deg,rgba(251,191,36,0.26),rgba(249,115,22,0.15),rgba(245,158,11,0.26))]',
    surface:
      'border-yellow-400/30 bg-[linear-gradient(135deg,rgba(250,204,21,0.11),rgba(255,255,255,0.04),rgba(24,24,48,0.92))] backdrop-blur-md',
    chip: 'border-amber-300/20 bg-amber-400/12 text-amber-100',
    bar: 'from-amber-300 via-orange-400 to-yellow-400',
    accentText: 'text-amber-100',
    glow: 'shadow-[0_0_20px_rgba(250,204,21,0.22)]',
  },
  pink: {
    avatar:
      'border-pink-300/45 bg-[linear-gradient(135deg,rgba(244,114,182,0.26),rgba(236,72,153,0.16),rgba(192,132,252,0.26))]',
    surface:
      'border-pink-400/30 bg-[linear-gradient(135deg,rgba(244,114,182,0.12),rgba(255,255,255,0.04),rgba(24,24,48,0.92))] backdrop-blur-md',
    chip: 'border-pink-300/20 bg-pink-400/12 text-pink-100',
    bar: 'from-pink-400 via-fuchsia-500 to-violet-500',
    accentText: 'text-pink-100',
    glow: 'shadow-[0_0_20px_rgba(244,114,182,0.22)]',
  },
};

const personaAssetsByName: Record<string, StaticImageData> = {
  理性派: rationalistsAvatar,
  毒舌派: sharpTongueAvatar,
  赌徒派: gamblerAvatar,
  乐观派: parentsAvatar,
  父母派: parentsAvatar,
  摆烂派: slackOffAvatar,
};

const personaAssetsByColor: Record<string, StaticImageData> = {
  blue: rationalistsAvatar,
  violet: sharpTongueAvatar,
  red: gamblerAvatar,
  pink: gamblerAvatar,
  green: parentsAvatar,
  yellow: slackOffAvatar,
};

export function getPersonaTone(color?: string) {
  return personaTones[color || ''] || personaTones.violet;
}

export function getPersonaAsset(name?: string, color?: string) {
  if (name && personaAssetsByName[name]) {
    return personaAssetsByName[name];
  }
  if (color && personaAssetsByColor[color]) {
    return personaAssetsByColor[color];
  }
  return sharpTongueAvatar;
}
