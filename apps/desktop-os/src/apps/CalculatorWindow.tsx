import { useState } from 'react';
import { useToolStore } from '../store/toolStore';
import { evaluateCalcExpression } from '../tools/calc';
import './MiniApps.css';

const KEYS = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', '0', '.', '=', '+'];

export default function CalculatorWindow() {
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState('');
  const history = useToolStore((s) => s.calcHistory);
  const addHistory = useToolStore((s) => s.addCalcHistory);
  const clearHistory = useToolStore((s) => s.clearCalcHistory);

  function press(key: string) {
    if (key === '=') {
      runCalc();
      return;
    }
    setExpression((value) => `${value}${key}`);
  }

  function runCalc() {
    const next = evaluateCalcExpression(expression);
    if (!next) {
      setResult('无法计算');
      return;
    }
    setResult(next.result);
    addHistory(next.expression, next.result);
  }

  async function copyResult() {
    if (!result || result === '无法计算') return;
    await navigator.clipboard?.writeText(result);
  }

  return (
    <div className="dock-app-window mini-app mini-calculator">
      <header className="mini-app__header">
        <div>
          <div className="dock-app-window__eyebrow">小工具</div>
          <h2>小算盘</h2>
        </div>
        <button type="button" className="mini-app__plain" onClick={() => setExpression('')}>
          清空
        </button>
      </header>

      <section className="calculator-display" aria-label="计算结果">
        <input
          className="calculator-display__input"
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') runCalc();
          }}
          placeholder="12 + 8"
        />
        <button type="button" className="calculator-display__result" onClick={copyResult}>
          {result || '0'}
        </button>
      </section>

      <div className="calculator-grid">
        {KEYS.map((key) => (
          <button key={key} type="button" onClick={() => press(key)}>
            {key}
          </button>
        ))}
      </div>

      <section className="mini-app__panel">
        <div className="mini-app__panel-head">
          <span>最近计算</span>
          {history.length > 0 ? (
            <button type="button" className="mini-app__plain" onClick={clearHistory}>
              清除
            </button>
          ) : null}
        </div>
        <div className="mini-list">
          {history.length === 0 ? (
            <span className="mini-list__empty">暂无记录</span>
          ) : (
            history.slice(0, 4).map((item) => (
              <button
                type="button"
                key={item.id}
                className="mini-list__row"
                onClick={() => {
                  setExpression(item.expression);
                  setResult(item.result);
                }}
              >
                <span>{item.expression}</span>
                <strong>{item.result}</strong>
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
