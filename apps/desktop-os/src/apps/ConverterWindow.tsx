import { useMemo, useState } from 'react';
import { useToolStore } from '../store/toolStore';
import {
  CONVERTER_GROUPS,
  type ConverterGroupId,
  convertValue,
  getConverterGroup,
  getUnitLabel,
} from '../tools/miniTools';
import './MiniApps.css';

export default function ConverterWindow() {
  const recent = useToolStore((s) => s.converterRecent);
  const addRecent = useToolStore((s) => s.addConverterRecent);
  const clearRecent = useToolStore((s) => s.clearConverterRecent);
  const [groupId, setGroupId] = useState<ConverterGroupId>('length');
  const group = getConverterGroup(groupId);
  const [fromUnit, setFromUnit] = useState(group.units[0].id);
  const [toUnit, setToUnit] = useState(group.units[1]?.id ?? group.units[0].id);
  const [value, setValue] = useState('1');
  const result = useMemo(
    () => convertValue(value, groupId, fromUnit, toUnit),
    [fromUnit, groupId, toUnit, value],
  );

  function switchGroup(nextGroupId: ConverterGroupId) {
    const nextGroup = getConverterGroup(nextGroupId);
    setGroupId(nextGroupId);
    setFromUnit(nextGroup.units[0].id);
    setToUnit(nextGroup.units[1]?.id ?? nextGroup.units[0].id);
  }

  function saveRecent() {
    if (result === null) return;
    const label = `${value} ${getUnitLabel(groupId, fromUnit)}`;
    addRecent(label, `${result} ${getUnitLabel(groupId, toUnit)}`);
  }

  return (
    <div className="dock-app-window mini-app converter-window">
      <header className="mini-app__header">
        <div>
          <div className="dock-app-window__eyebrow">小工具</div>
          <h2>换算器</h2>
        </div>
        <span className="dock-app-window__badge">{group.label}</span>
      </header>

      <fieldset className="mini-segmented">
        <legend className="mini-app__sr-only">换算类别</legend>
        {CONVERTER_GROUPS.map((item) => (
          <button
            type="button"
            key={item.id}
            className={item.id === groupId ? 'is-active' : ''}
            onClick={() => switchGroup(item.id)}
          >
            {item.label}
          </button>
        ))}
      </fieldset>

      <section className="converter-card">
        <label>
          <span>数值</span>
          <input
            className="mini-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <div className="converter-card__units">
          <select value={fromUnit} onChange={(e) => setFromUnit(e.target.value)}>
            {group.units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.label}
              </option>
            ))}
          </select>
          <span>→</span>
          <select value={toUnit} onChange={(e) => setToUnit(e.target.value)}>
            {group.units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.label}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="converter-result" onClick={saveRecent}>
          {result === null ? '无法换算' : `${result} ${getUnitLabel(groupId, toUnit)}`}
        </button>
      </section>

      <section className="mini-app__panel">
        <div className="mini-app__panel-head">
          <span>最近换算</span>
          {recent.length > 0 ? (
            <button type="button" className="mini-app__plain" onClick={clearRecent}>
              清除
            </button>
          ) : null}
        </div>
        <div className="mini-list">
          {recent.length === 0 ? (
            <span className="mini-list__empty">暂无记录</span>
          ) : (
            recent.slice(0, 4).map((item) => (
              <div key={item.id} className="mini-list__row">
                <span>{item.label}</span>
                <strong>{item.result}</strong>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
