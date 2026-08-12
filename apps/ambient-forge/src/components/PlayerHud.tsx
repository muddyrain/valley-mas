import { CarFront, Gamepad2, MessageCircle } from 'lucide-react';
import { NPC_PROFILES } from '../core/npc';
import type { NpcInteractionHudState } from '../core/npc-interactions';
import type { VehicleId, WorldControlState } from '../core/playable-world';

interface PlayerHudProps {
  state: WorldControlState;
  interactionState: NpcInteractionHudState;
}

const VEHICLE_NAMES: Readonly<Record<VehicleId, string>> = {
  copper: '铜雀小车',
  sage: '苔绿旅行车',
  cream: '奶油小车',
  navy: '深海通勤车',
  amber: '琥珀出租车',
  teal: '青瓷通勤车',
  rose: '蔷薇小车',
  slate: '岩灰旅行车',
  sand: '沙丘小车',
};

export function PlayerHud({ state, interactionState }: PlayerHudProps) {
  const resident = NPC_PROFILES.find((profile) => profile.id === state.residentId);

  return (
    <div className="player-hud" aria-live="polite">
      <div className="player-hud-main">
        <div className="player-hud-title">
          {state.mode === 'vehicle' ? <CarFront size={17} /> : <Gamepad2 size={17} />}
          <strong>
            {state.mode === 'vehicle' && state.vehicleId
              ? VEHICLE_NAMES[state.vehicleId]
              : resident?.name}
          </strong>
          {resident ? <span>{resident.role}</span> : null}
        </div>
        <div className="player-hud-keys" role="group" aria-label="操作提示">
          <span>
            <kbd>WASD</kbd>
            {state.mode === 'vehicle' ? '驾驶' : '移动'}
          </span>
          {state.mode === 'resident' ? (
            <>
              <span>
                <kbd>Shift</kbd>奔跑
              </span>
              <span>
                <kbd>E</kbd>互动
              </span>
            </>
          ) : null}
          <span>
            <kbd>Space</kbd>
            {state.mode === 'vehicle' ? '手刹' : '跳跃'}
          </span>
          <span>
            <kbd>F</kbd>
            {state.mode === 'vehicle' ? '下车' : '上车'}
          </span>
          {state.mode === 'vehicle' ? (
            <span>
              <kbd>H</kbd>鸣笛
            </span>
          ) : null}
          <span>
            <kbd>Esc</kbd>暂停
          </span>
        </div>
      </div>
      {interactionState.current ? (
        <div className="npc-conversation-strip">
          <MessageCircle size={15} aria-hidden="true" />
          <div>
            <span>
              {interactionState.current.npcName} · {interactionState.current.relationLabel}
            </span>
            <strong>{interactionState.current.line}</strong>
          </div>
        </div>
      ) : null}
    </div>
  );
}
