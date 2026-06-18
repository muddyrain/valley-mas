import { useEffect } from 'react';
import Dock from './components/Dock';
import MenuBar from './components/MenuBar';
import Wallpaper from './components/Wallpaper';
import WindowManager from './components/window/WindowManager';
import { useWindowStore } from './store/windowStore';
import './App.css';

export default function App() {
  const openWindow = useWindowStore((s) => s.openWindow);

  useEffect(() => {
    openWindow('about', { title: '关于本机', width: 520, height: 360 });
  }, [openWindow]);

  return (
    <div className="desktop">
      <Wallpaper />
      <MenuBar />
      <WindowManager />
      <Dock />
    </div>
  );
}
