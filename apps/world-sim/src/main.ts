import { createGame } from './game/Game';
import './styles.css';

const root = document.querySelector<HTMLDivElement>('#app');

if (!root) {
  throw new Error('未找到世界模拟器根节点 #app。');
}

createGame(root);
