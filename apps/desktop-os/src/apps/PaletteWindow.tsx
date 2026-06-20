import { useMemo, useState } from 'react';
import { useToolStore } from '../store/toolStore';
import { generatePalette, getContrastText, hexToRgb, normalizeHexColor } from '../tools/miniTools';
import './MiniApps.css';

interface EyeDropperLike {
  open: () => Promise<{ sRGBHex: string }>;
}

export default function PaletteWindow() {
  const colors = useToolStore((s) => s.paletteColors);
  const addColor = useToolStore((s) => s.addPaletteColor);
  const removeColor = useToolStore((s) => s.removePaletteColor);
  const [input, setInput] = useState('#8FB45E');
  const [status, setStatus] = useState('调色盘');
  const normalized = normalizeHexColor(input);
  const generated = useMemo(() => generatePalette(normalized ?? '#8FB45E'), [normalized]);

  async function copyColor(hex: string) {
    await navigator.clipboard?.writeText(hex);
    setStatus('已复制');
  }

  function saveColor(hex = normalized) {
    if (!hex) {
      setStatus('颜色无效');
      return;
    }
    addColor(hex);
    setInput(hex);
    setStatus('已保存');
  }

  async function pickColor() {
    const EyeDropperCtor = (window as unknown as { EyeDropper?: new () => EyeDropperLike })
      .EyeDropper;
    if (!EyeDropperCtor) {
      setStatus('手动输入');
      return;
    }
    try {
      const result = await new EyeDropperCtor().open();
      saveColor(normalizeHexColor(result.sRGBHex) ?? result.sRGBHex);
    } catch {
      setStatus('已取消');
    }
  }

  return (
    <div className="dock-app-window mini-app palette-window">
      <header className="mini-app__header">
        <div>
          <div className="dock-app-window__eyebrow">小工具</div>
          <h2>调色盘</h2>
        </div>
        <span className="dock-app-window__badge">{status}</span>
      </header>

      <section className="palette-hero" style={{ background: normalized ?? '#F8F5EC' }}>
        <span style={{ color: normalized ? getContrastText(normalized) : '#5A4A3A' }}>
          {normalized ?? '输入 HEX'}
        </span>
      </section>

      <div className="palette-controls">
        <input
          className="mini-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
        />
        <button type="button" className="dock-app-window__button" onClick={() => saveColor()}>
          保存
        </button>
        <button type="button" className="mini-app__secondary" onClick={pickColor}>
          取色
        </button>
      </div>

      <section className="mini-app__panel">
        <div className="mini-app__panel-head">
          <span>毛绒色板</span>
          <span>{hexToRgb(normalized ?? '') ? 'RGB 可用' : '等待颜色'}</span>
        </div>
        <div className="palette-grid">
          {generated.map((hex) => (
            <button
              type="button"
              key={hex}
              className="palette-swatch"
              style={{ background: hex, color: getContrastText(hex) }}
              onClick={() => copyColor(hex)}
            >
              {hex}
            </button>
          ))}
        </div>
      </section>

      <section className="mini-app__panel">
        <div className="mini-app__panel-head">
          <span>收藏颜色</span>
        </div>
        <div className="palette-grid">
          {colors.map((item) => (
            <button
              type="button"
              key={item.id}
              className="palette-swatch"
              style={{ background: item.hex, color: getContrastText(item.hex) }}
              onClick={() => copyColor(item.hex)}
              onDoubleClick={() => removeColor(item.id)}
            >
              {item.hex}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
