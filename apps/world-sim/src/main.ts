import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Missing #app root element.');
}

app.innerHTML = `
  <div class="app-shell">
    <header class="hero">
      <div>
        <p class="eyebrow">WorldSim / 开发入口</p>
        <h1>沙盒文明模拟游戏</h1>
        <p>
          这里保留最小 Vite 入口，后续会接入 Phaser 场景、地图渲染、单位系统和上帝工具。
          AI coding 的 Harness Engineering 已移动到仓库级文档，不放在游戏运行页面里。
        </p>
      </div>
    </header>

    <section class="layout">
      <article class="panel">
        <h2>当前状态</h2>
        <p class="muted">M0 工程骨架已创建，游戏主体还没有接入 Phaser。</p>
      </article>
      <article class="panel">
        <h2>下一步</h2>
        <p class="muted">按 TASK-002 开始创建 Phaser.Game、BootScene、WorldScene 和 UIScene。</p>
      </article>
      <article class="panel">
        <h2>协作规则</h2>
        <p class="muted">实现玩法或架构前，先阅读 apps/world-sim/AGENTS.md 和 docs 下的设计合同。</p>
      </article>
    </section>
  </div>
`;
