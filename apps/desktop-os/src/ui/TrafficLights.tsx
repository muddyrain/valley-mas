import './TrafficLights.css';

interface Props {
  active: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
}

export default function TrafficLights({ active, onClose, onMinimize, onMaximize }: Props) {
  return (
    <div className={`traffic-lights ${active ? 'is-active' : 'is-inactive'}`}>
      <button
        type="button"
        className="traffic-light traffic-light--close"
        onClick={onClose}
        aria-label="关闭"
      >
        <span className="traffic-light__glyph">×</span>
      </button>
      <button
        type="button"
        className="traffic-light traffic-light--min"
        onClick={onMinimize}
        aria-label="最小化"
      >
        <span className="traffic-light__glyph">−</span>
      </button>
      <button
        type="button"
        className="traffic-light traffic-light--max"
        onClick={onMaximize}
        aria-label="最大化"
      >
        <span className="traffic-light__glyph">+</span>
      </button>
    </div>
  );
}
