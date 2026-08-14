import { useSearchParams } from 'react-router-dom';
import { PrivateLabPage, PrivateLabPageHeader } from '@/components/private-lab/PrivateLabPage';
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
    <PrivateLabPage>
      <PrivateLabPageHeader title="AI 资源" />
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="h-10 w-full justify-start overflow-x-auto bg-muted/70 p-1">
          {tabs.map(({ value, label, disabled }) => (
            <TabsTrigger
              key={value}
              value={value}
              disabled={disabled}
              className="h-8 flex-none px-3 text-sm"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="pt-4">
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
      </Tabs>
    </PrivateLabPage>
  );
}
