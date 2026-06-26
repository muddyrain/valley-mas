import { useState } from 'react';
import { useNotificationCenterStore } from '../store/notificationCenterStore';
import { useToolStore } from '../store/toolStore';
import './MiniApps.css';

const PLOT_COUNT = 9;

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

      <div className="plush-garden-layout">
        <section className="plush-farm-scene" aria-label="毛绒农场">
          <div className="plush-farm-sky">
            <span className="plush-cloud plush-cloud--left" />
            <span className="plush-cloud plush-cloud--right" />
          </div>
          <div className="plush-farm-sun" />
          <div className="plush-farm-hills" />
          <div className="plush-farm-fence" aria-hidden="true">
            {Array.from({ length: 9 }).map((_, index) => (
              <span key={`fence-${index}`} />
            ))}
          </div>
          <div className="plush-farm-yard">
            <div className="plush-farm-shed">
              <span className="plush-farm-shed__roof" />
              <span className="plush-farm-shed__body" />
            </div>
            <div className="plush-farm-path" />
            <div className="garden-bed">
              {Array.from({ length: PLOT_COUNT }).map((_, index) => {
                const isBlooming = index < garden.blooms;
                const isWatered = !isBlooming && index < garden.water;
                const cropClass = isBlooming
                  ? ` garden-plot--crop-${(index % 3) + 1}`
                  : isWatered
                    ? ' garden-plot--sprout'
                    : '';
                return (
                  <span
                    key={`plot-${index}`}
                    className={`garden-plot${isBlooming ? ' is-blooming' : ''}${isWatered ? ' is-watered' : ''}${cropClass}`}
                    role="img"
                    aria-label={isBlooming ? '开花地块' : isWatered ? '发芽地块' : '空地'}
                  >
                    <span className="garden-plot__soil" />
                    <span className="garden-plot__plant" />
                  </span>
                );
              })}
            </div>
            <div className="plush-farm-pond" />
            <div className="plush-farm-crate" />
            <ul className="plush-farm-decor-row" aria-label="已解锁装饰">
              {garden.decorations.map((item, index) => (
                <li
                  key={item}
                  className={`plush-farm-decor plush-farm-decor--${(index % 4) + 1}`}
                  title={item}
                />
              ))}
            </ul>
          </div>
        </section>

        <aside className="plush-garden-panel">
          <div className="game-stats">
            <span>水滴 {garden.water}</span>
            <span>花朵 {garden.blooms}</span>
            <span>装饰 {garden.decorations.length}</span>
          </div>

          <div className="plush-garden-actions">
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

          <section className="plush-garden-decor-panel">
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
        </aside>
      </div>
    </div>
  );
}
