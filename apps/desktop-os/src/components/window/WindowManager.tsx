import { useWindowStore } from '../../store/windowStore';
import Window from './Window';

export default function WindowManager() {
  const windows = useWindowStore((s) => s.windows);

  return (
    <>
      {windows.map((w) => (
        <Window key={w.id} state={w} appId={w.appId} />
      ))}
    </>
  );
}
