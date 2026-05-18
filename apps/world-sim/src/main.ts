import { createGame } from './game/Game';
import './styles.css';

const root = document.querySelector<HTMLDivElement>('#app');

if (!root) {
  throw new Error('WorldSim root element #app was not found.');
}

createGame(root);
