import AboutWindow from '../../apps/AboutWindow';
import NotesWindow from '../../apps/NotesWindow';
import { useWindowStore } from '../../store/windowStore';
import Window from './Window';

export default function WindowManager() {
  const windows = useWindowStore((s) => s.windows);

  return (
    <>
      {windows.map((w) => (
        <Window key={w.id} state={w}>
          {w.appId === 'about' ? <AboutWindow /> : null}
          {w.appId === 'notes' ? <NotesWindow /> : null}
          {w.appId === 'finder' ? <AboutWindow /> : null}
        </Window>
      ))}
    </>
  );
}
