import { useState } from 'react';
import { useNotificationCenterStore } from '../store/notificationCenterStore';
import { useToolStore } from '../store/toolStore';
import './MiniApps.css';

export default function PlushGardenWindow() {
  const garden = useToolStore((s) => s.plushGarden);
  const waterGarden = useToolStore((s) => s.waterPlushGarden);
  const harvestGarden = useToolStore((s) => s.harvestPlushGarden);
  const resetGarden = useToolStore((s) => s.resetPlushGarden);
  const pushNotification = useNotificationCenterStore((s) => s.pushNotification);
  const [status, setStatus] = useState('等待浇水');

  function water() {
    waterGarden();
    setStatus('水滴 +1');
  }

  function harvest() {
    const decoration = harvestGarden();
    if (decoration) {
      setStatus(`解锁 ${decoration}`);
      pushNotification({
        app: '毛绒花园',
        title: '新装饰',
        body: decoration,
      });
      return;
    }
    setStatus(garden.water >= 3 ? '花朵 +1' : '需要水滴');
  }

  return (
    <div className="dock-app-window mini-app plush-garden-window">
      <header className="mini-app__header">
        <div>
          <div className="dock-app-window__eyebrow">小游戏</div>
          <h2>毛绒花园</h2>
        </div>
        <span className="dock-app-window__badge">{status}</span>
      </header>

      <section className="garden-bed" aria-label="毛绒花园">
        {Array.from({ length: 9 }).map((_, index) => (
          <span key={`plot-${index}`} className={index < garden.blooms ? 'is-blooming' : ''} />
        ))}
      </section>

      <div className="game-stats">
        <span>水滴 {garden.water}</span>
        <span>花朵 {garden.blooms}</span>
        <span>装饰 {garden.decorations.length}</span>
      </div>

      <div className="mini-actions">
        <button type="button" className="dock-app-window__button" onClick={water}>
          浇水
        </button>
        <button type="button" className="mini-app__secondary" onClick={harvest}>
          开花
        </button>
        <button type="button" className="mini-app__secondary" onClick={resetGarden}>
          重置
        </button>
      </div>

      <section className="mini-app__panel">
        <div className="mini-app__panel-head">
          <span>装饰</span>
        </div>
        <div className="garden-decorations">
          {garden.decorations.length === 0 ? (
            <span className="mini-list__empty">暂无装饰</span>
          ) : (
            garden.decorations.map((item) => <span key={item}>{item}</span>)
          )}
        </div>
      </section>
    </div>
  );
}
