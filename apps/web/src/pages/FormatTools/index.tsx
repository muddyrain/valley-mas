import {
  type ConverterCategory,
  FORMAT_CONVERTER_LIST,
  STRUCTURED_FORMAT_TOOL_LIST,
} from '@valley/format-tools';
import {
  ArrowLeftRight,
  Braces,
  Check,
  Hash,
  ImageIcon,
  type LucideIcon,
  Search,
  WandSparkles,
  WrapText,
} from 'lucide-react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { FormatWorkspace, type ToolCatalogItem } from './FormatWorkspace';
import { ImageWorkspace } from './ImageWorkspace';

type ToolCategory = 'image' | ConverterCategory;
type CategoryFilter = 'all' | ToolCategory;

const STRUCTURED_TOOL_COPY: Record<string, Pick<ToolCatalogItem, 'label' | 'description'>> = {
  'json-sort-keys': {
    label: 'JSON 键排序',
    description: '按字母顺序整理对象键，同时保留数组顺序。',
  },
  'json-pointer': {
    label: 'JSON 路径读取',
    description: '使用 JSON Pointer 精确读取嵌套值。',
  },
  'text-case': {
    label: '文本命名转换',
    description: '转换大小写与 camel、snake、kebab 等命名风格。',
  },
  'text-normalize': {
    label: '空白整理',
    description: '统一换行、缩减空白并清理空行。',
  },
};

const IMAGE_TOOL: ToolCatalogItem = {
  id: 'image-transform',
  label: '图片处理',
  description: '转换格式、压缩、裁剪、缩放、旋转、翻转、加水印与圆角。',
  category: 'image',
  keywords: ['图片', '格式', '压缩', '裁剪', '尺寸', '旋转', '翻转', '圆角', '水印'],
  kind: 'image',
  supportsReverse: false,
  forwardLabel: '处理图片',
};

const TOOL_CATALOG: ToolCatalogItem[] = [
  IMAGE_TOOL,
  ...FORMAT_CONVERTER_LIST.map((tool) => ({
    id: tool.id,
    label: tool.name,
    description: tool.description,
    category: tool.category,
    keywords: tool.keywords,
    kind: 'format' as const,
    supportsReverse: tool.supportsReverse,
    forwardLabel: tool.forwardActionLabel,
    reverseLabel: tool.reverseActionLabel,
    inputPlaceholder: tool.inputPlaceholder,
  })),
  ...STRUCTURED_FORMAT_TOOL_LIST.map((tool) => ({
    id: tool.id,
    label: STRUCTURED_TOOL_COPY[tool.id]?.label ?? tool.name,
    description: STRUCTURED_TOOL_COPY[tool.id]?.description ?? tool.description,
    category: tool.category,
    keywords: tool.keywords,
    kind: 'format' as const,
    supportsReverse: false,
    forwardLabel: '执行处理',
  })),
];

const CATEGORY_OPTIONS: Array<{
  id: CategoryFilter;
  label: string;
  icon: LucideIcon;
}> = [
  { id: 'all', label: '全部', icon: WandSparkles },
  { id: 'image', label: '图片', icon: ImageIcon },
  { id: 'data', label: '数据', icon: Braces },
  { id: 'encoding', label: '编码', icon: ArrowLeftRight },
  { id: 'text', label: '文本', icon: WrapText },
  { id: 'crypto', label: '摘要', icon: Hash },
];

const CATEGORY_IDS = new Set<CategoryFilter>(CATEGORY_OPTIONS.map((item) => item.id));

function getCategoryLabel(category: ToolCategory) {
  return CATEGORY_OPTIONS.find((item) => item.id === category)?.label ?? '';
}

function FormatTools() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get('category') as CategoryFilter | null;
  const category = categoryParam && CATEGORY_IDS.has(categoryParam) ? categoryParam : 'all';
  const keyword = searchParams.get('q') ?? '';
  const selectedTool =
    TOOL_CATALOG.find((item) => item.id === searchParams.get('tool')) ?? TOOL_CATALOG[0];

  const filteredTools = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase();
    return TOOL_CATALOG.filter((tool) => {
      if (category !== 'all' && tool.category !== category) return false;
      if (!normalizedKeyword) return true;
      return [tool.label, tool.description, ...tool.keywords]
        .join(' ')
        .toLocaleLowerCase()
        .includes(normalizedKeyword);
    });
  }, [category, keyword]);

  const updateQuery = (
    update: (next: URLSearchParams) => void,
    options: { replace?: boolean } = {},
  ) => {
    const next = new URLSearchParams(searchParams);
    update(next);
    setSearchParams(next, options);
  };

  const selectCategory = (nextCategory: CategoryFilter) => {
    updateQuery((next) => {
      if (nextCategory === 'all') next.delete('category');
      else next.set('category', nextCategory);

      if (nextCategory !== 'all' && selectedTool.category !== nextCategory) {
        const firstTool = TOOL_CATALOG.find((tool) => tool.category === nextCategory);
        if (firstTool) next.set('tool', firstTool.id);
      }
    });
  };

  const selectTool = (tool: ToolCatalogItem) => {
    updateQuery((next) => {
      next.set('tool', tool.id);
    });
  };

  return (
    <main className="min-h-[calc(100dvh-3.5rem)] bg-background">
      <header className="border-border border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8 lg:py-10">
          <div className="max-w-2xl space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <WandSparkles className="size-4" aria-hidden="true" />
              <span className="font-medium text-xs">浏览器工具箱</span>
            </div>
            <h1 className="font-semibold text-3xl tracking-tight text-balance sm:text-4xl">
              实用工具
            </h1>
            <p className="text-muted-foreground text-sm leading-6 text-pretty sm:text-base">
              转换图片、整理文本、检查数据。文件默认在浏览器内处理。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{TOOL_CATALOG.length} 项工具</Badge>
            <Badge variant="secondary">本地处理</Badge>
          </div>
        </div>
      </header>

      <section className="border-border border-b bg-background">
        <div className="mx-auto max-w-7xl space-y-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search
                className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={keyword}
                onChange={(event) =>
                  updateQuery(
                    (next) => {
                      const value = event.target.value;
                      if (value) next.set('q', value);
                      else next.delete('q');
                    },
                    { replace: true },
                  )
                }
                placeholder="搜索转换、裁剪、JSON…"
                aria-label="搜索工具"
                className="pl-9"
              />
            </div>
            <div
              className="flex gap-1 overflow-x-auto pb-1 lg:pb-0"
              role="group"
              aria-label="工具分类"
            >
              {CATEGORY_OPTIONS.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.id}
                    type="button"
                    size="sm"
                    variant={category === item.id ? 'secondary' : 'ghost'}
                    aria-pressed={category === item.id}
                    onClick={() => selectCategory(item.id)}
                  >
                    <Icon aria-hidden="true" />
                    {item.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {filteredTools.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-2" role="group" aria-label="可用工具">
              {filteredTools.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => selectTool(tool)}
                  aria-pressed={selectedTool.id === tool.id}
                  className={cn(
                    'min-w-44 rounded-lg border border-border px-3 py-2.5 text-left transition-[background-color,border-color,color,scale] duration-150 active:scale-[0.96]',
                    selectedTool.id === tool.id
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-medium text-sm">{tool.label}</span>
                    {selectedTool.id === tool.id ? (
                      <Check className="size-3.5 text-primary" aria-hidden="true" />
                    ) : null}
                  </span>
                  <span className="mt-1 block truncate text-xs">
                    {getCategoryLabel(tool.category)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-6 text-center text-muted-foreground text-sm">
              没有匹配的工具，请调整关键词或分类。
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {selectedTool.kind === 'image' ? (
          <ImageWorkspace />
        ) : (
          <FormatWorkspace
            key={selectedTool.id}
            tool={selectedTool}
            categoryLabel={getCategoryLabel(selectedTool.category)}
          />
        )}
      </div>
    </main>
  );
}

export default FormatTools;
