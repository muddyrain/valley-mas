import { PrivateLabPage } from '@/components/private-lab/PrivateLabPage';
import { AIAppsPanel } from '@/components/workbench/AIAppsPanel';

export default function Workbench() {
  return (
    <PrivateLabPage>
      <AIAppsPanel />
    </PrivateLabPage>
  );
}
