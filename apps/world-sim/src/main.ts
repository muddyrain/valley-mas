import './styles.css';
import { WorldSimGame } from './game/Game';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Missing #app root element.');
}

app.innerHTML = '<div id="world-sim-root"></div>';

const gameRoot = document.querySelector<HTMLDivElement>('#world-sim-root');

if (!gameRoot) {
  throw new Error('Missing #world-sim-root element.');
}

new WorldSimGame({ parent: gameRoot });
