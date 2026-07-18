import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import KnowledgeBases from '@/pages/KnowledgeBases';
import Workflows from '@/pages/Workflows';

const tabs = [
  { value: 'workflows', label: '工作流', disabled: false },
  { value: 'knowledge', label: '知识库', disabled: false },
  { value: 'prompts', label: '提示词', disabled: true },
  { value: 'tools', label: '工具', disabled: true },
] as const;

export default function AIResources() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'knowledge' ? 'knowledge' : 'workflows';

  const handleTabChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', value === 'knowledge' ? 'knowledge' : 'workflows');
    setSearchParams(next, { replace: true });
  };

  return (
    <main className="min-h-full bg-background">
      <div className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 lg:px-10">
        <header className="border-b border-border">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            AI 资源
          </h1>
          <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-7">
            <TabsList
              variant="line"
              className="w-full justify-start gap-7 overflow-x-auto rounded-none px-0"
            >
              {tabs.map(({ value, label, disabled }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  disabled={disabled}
                  className="h-11 flex-none rounded-none px-1 text-base text-muted-foreground data-active:text-primary data-active:after:bg-primary data-active:after:opacity-100"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </header>

        <div className="pt-6">
          {activeTab === 'knowledge' ? <KnowledgeBases embedded /> : <Workflows embedded />}
        </div>
      </div>
    </main>
  );
}
