import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import KnowledgeBases from '@/pages/KnowledgeBases';
import Workflows from '@/pages/Workflows';
import PromptResources from './PromptResources';
import SkillResources from './SkillResources';
import ToolResources from './ToolResources';

const tabs = [
  { value: 'workflows', label: '工作流', disabled: false },
  { value: 'knowledge', label: '知识库', disabled: false },
  { value: 'prompts', label: '提示词', disabled: false },
  { value: 'skills', label: '技能', disabled: false },
  { value: 'tools', label: '工具', disabled: false },
] as const;

type ResourceTab = (typeof tabs)[number]['value'];

function parseResourceTab(value: string | null): ResourceTab {
  return value === 'knowledge' || value === 'prompts' || value === 'skills' || value === 'tools'
    ? value
    : 'workflows';
}

export default function AIResources() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseResourceTab(searchParams.get('tab'));

  const handleTabChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', parseResourceTab(value));
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
                  className="h-11 flex-none rounded-t-md border border-transparent px-3 text-base text-muted-foreground transition-colors hover:text-foreground group-data-[variant=line]/tabs-list:data-active:bg-primary/[0.12] data-active:font-semibold data-active:text-primary data-active:after:bottom-0 data-active:after:h-[3px] data-active:after:rounded-full data-active:after:bg-primary data-active:after:opacity-100"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </header>

        <div className="pt-6">
          {activeTab === 'knowledge' ? (
            <KnowledgeBases embedded />
          ) : activeTab === 'prompts' ? (
            <PromptResources />
          ) : activeTab === 'skills' ? (
            <SkillResources />
          ) : activeTab === 'tools' ? (
            <ToolResources />
          ) : (
            <Workflows embedded />
          )}
        </div>
      </div>
    </main>
  );
}
