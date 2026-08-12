import {
  Beef,
  Bird,
  Bone,
  ChevronLeft,
  CloudRain,
  Cross,
  Flame,
  HeartPulse,
  LandPlot,
  Leaf,
  Mountain,
  PawPrint,
  Pickaxe,
  Rabbit,
  ShieldAlert,
  Skull,
  Snowflake,
  Sparkles,
  Sprout,
  SunDim,
  Sword,
  TreePine,
  UserRoundPlus,
  Waves,
  Wind,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { GodPower, type MapTool } from '@/shared/gameTypes';

type ToolCategory = 'terrain' | 'life' | 'powers';

interface ToolItem<T extends string> {
  id: T;
  label: string;
  icon: React.ReactNode;
}

const TERRAIN_TOOLS: Array<ToolItem<MapTool>> = [
  { id: 'raise', label: '抬高', icon: <Mountain size={17} /> },
  { id: 'lower', label: '降低', icon: <LandPlot size={17} /> },
  { id: 'paint-land', label: '陆地', icon: <SunDim size={17} /> },
  { id: 'paint-water', label: '水域', icon: <Waves size={17} /> },
  { id: 'paint-forest', label: '森林', icon: <TreePine size={17} /> },
  { id: 'place-food', label: '食物', icon: <Leaf size={17} /> },
  { id: 'place-stone', label: '石料', icon: <Pickaxe size={17} /> },
  { id: 'erase', label: '清理', icon: <Cross size={17} /> },
];

const LIFE_TOOLS: Array<ToolItem<MapTool>> = [
  { id: 'spawn-human', label: '人类', icon: <UserRoundPlus size={17} /> },
  { id: 'spawn-chicken', label: '鸡群', icon: <Bird size={17} /> },
  { id: 'spawn-sheep', label: '羊群', icon: <Rabbit size={17} /> },
  { id: 'spawn-cow', label: '牛群', icon: <Beef size={17} /> },
  { id: 'spawn-deer', label: '鹿群', icon: <PawPrint size={17} /> },
  { id: 'spawn-wolf', label: '狼群', icon: <Bone size={17} /> },
  { id: 'spawn-bear', label: '熊', icon: <ShieldAlert size={17} /> },
];

const POWER_TOOLS: Array<ToolItem<GodPower>> = [
  { id: GodPower.Rain, label: '降雨', icon: <CloudRain size={17} /> },
  { id: GodPower.Lightning, label: '雷击', icon: <Zap size={17} /> },
  { id: GodPower.Fire, label: '火焰', icon: <Flame size={17} /> },
  { id: GodPower.Tornado, label: '龙卷风', icon: <Wind size={17} /> },
  { id: GodPower.Meteor, label: '陨石', icon: <SunDim size={17} /> },
  { id: GodPower.Plague, label: '瘟疫', icon: <HeartPulse size={17} /> },
  { id: GodPower.Blessing, label: '祝福', icon: <Sparkles size={17} /> },
  { id: GodPower.Heal, label: '治愈', icon: <Cross size={17} /> },
  { id: GodPower.Rage, label: '狂暴', icon: <Sword size={17} /> },
  { id: GodPower.Diplomacy, label: '和平 / 战争', icon: <ShieldAlert size={17} /> },
  { id: GodPower.Curse, label: '诅咒', icon: <Skull size={17} /> },
  { id: GodPower.Growth, label: '生长', icon: <Sprout size={17} /> },
  { id: GodPower.Frost, label: '冰霜', icon: <Snowflake size={17} /> },
  { id: GodPower.Earthquake, label: '地震', icon: <Mountain size={17} /> },
  { id: GodPower.Purify, label: '净化', icon: <Cross size={17} /> },
  { id: GodPower.Fertility, label: '繁盛', icon: <HeartPulse size={17} /> },
];

export interface ToolDockProps {
  activeTool: MapTool | null;
  activePower: GodPower | null;
  onTool: (tool: MapTool | null) => void;
  onPower: (power: GodPower | null) => void;
}

export function ToolDock({ activeTool, activePower, onTool, onPower }: ToolDockProps) {
  const [category, setCategory] = useState<ToolCategory>('terrain');
  const [expanded, setExpanded] = useState(false);
  const title = category === 'terrain' ? '塑造世界' : category === 'life' ? '投放生命' : '神明能力';
  const selectCategory = (next: ToolCategory) => {
    setCategory(next);
    setExpanded(true);
  };
  return (
    <section
      className={`tool-dock ${expanded ? 'expanded' : 'collapsed'}`}
      aria-label="神明工具"
      data-testid="tool-dock"
      data-expanded={expanded}
    >
      <div className="tool-tabs" role="tablist" aria-label="工具分类">
        <button
          type="button"
          role="tab"
          className={category === 'terrain' ? 'active' : ''}
          onClick={() => selectCategory('terrain')}
          aria-selected={category === 'terrain'}
        >
          <LandPlot size={17} />
          <span>地形</span>
        </button>
        <button
          type="button"
          role="tab"
          className={category === 'life' ? 'active' : ''}
          onClick={() => selectCategory('life')}
          aria-selected={category === 'life'}
        >
          <UserRoundPlus size={17} />
          <span>生命</span>
        </button>
        <button
          type="button"
          role="tab"
          className={category === 'powers' ? 'active' : ''}
          onClick={() => selectCategory('powers')}
          aria-selected={category === 'powers'}
        >
          <Sparkles size={17} />
          <span>神力</span>
        </button>
      </div>
      <div className="tool-palette">
        <div className="tool-palette-heading">
          <span>{title}</span>
          <span className="tool-palette-actions">
            {(activeTool || activePower) && (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  onTool(null);
                  onPower(null);
                  setExpanded(false);
                }}
              >
                观察
              </button>
            )}
            <button
              type="button"
              className="tool-collapse"
              onClick={() => setExpanded(false)}
              aria-label="收起工具"
            >
              <ChevronLeft size={14} />
            </button>
          </span>
        </div>
        <div className="tool-grid">
          {category !== 'powers' &&
            (category === 'terrain' ? TERRAIN_TOOLS : LIFE_TOOLS).map((tool) => (
              <button
                key={tool.id}
                type="button"
                data-testid={`tool-${tool.id}`}
                className={activeTool === tool.id ? 'active' : ''}
                onClick={() => {
                  onPower(null);
                  onTool(activeTool === tool.id ? null : tool.id);
                }}
                aria-label={tool.label}
                title={tool.label}
              >
                {tool.icon}
                <span>{tool.label}</span>
              </button>
            ))}
          {category === 'powers' &&
            POWER_TOOLS.map((power) => (
              <button
                key={power.id}
                type="button"
                data-testid={`power-${power.id}`}
                className={activePower === power.id ? 'active' : ''}
                onClick={() => {
                  onTool(null);
                  onPower(activePower === power.id ? null : power.id);
                }}
                aria-label={power.label}
                title={power.label}
              >
                {power.icon}
                <span>{power.label}</span>
              </button>
            ))}
        </div>
      </div>
    </section>
  );
}
