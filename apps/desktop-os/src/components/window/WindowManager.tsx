import { useWindowStore } from '../../store/windowStore';
import { PlushPresence } from '../../ui/PlushMotion';
import Window from './Window';

export default function WindowManager() {
  const windows = useWindowStore((s) => s.windows);

  return (
    <PlushPresence>
      {windows.map((w) => (
        <Window key={w.id} state={w} appId={w.appId} />
      ))}
    </PlushPresence>
  );
}
