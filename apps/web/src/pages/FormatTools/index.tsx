import {
  type ConverterCategory,
  type ConverterDirection,
  FORMAT_CONVERTER_CATEGORIES,
  FORMAT_CONVERTER_LIST,
  getFormatConverterById,
  runFormatConverter,
} from '@valley/format-tools';
import { ArrowLeftRight, Copy, Search, Sparkles, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import PageBanner from '@/components/PageBanner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type CategoryFilter = 'all' | ConverterCategory;

const PAGE_BACKGROUND = {
  background:
    'linear-gradient(180deg, var(--theme-page-start) 0%, color-mix(in srgb, var(--theme-surface-alt) 64%, white) 42%, var(--theme-page-cool) 100%)',
};

const BANNER_BACKGROUND = {
  background:
    'linear-gradient(130deg, rgba(var(--theme-primary-rgb),0.96) 0%, color-mix(in srgb, rgba(var(--theme-secondary-rgb),1) 54%, var(--theme-primary-hover)) 60%, var(--theme-primary-deep) 100%)',
};

const CATEGORY_FILTERS: Array<{ value: CategoryFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'data', label: FORMAT_CONVERTER_CATEGORIES.data },
  { value: 'encoding', label: FORMAT_CONVERTER_CATEGORIES.encoding },
  { value: 'text', label: FORMAT_CONVERTER_CATEGORIES.text },
];

export default function FormatTools() {
  const [selectedConverterId, setSelectedConverterId] = useState(
    FORMAT_CONVERTER_LIST[0]?.id ?? '',
  );
  const [direction, setDirection] = useState<ConverterDirection>('forward');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [keyword, setKeyword] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [outputValue, setOutputValue] = useState('');
  const [error, setError] = useState('');

  const selectedConverter =
    getFormatConverterById(selectedConverterId) ?? FORMAT_CONVERTER_LIST[0] ?? null;

  const converterList = useMemo(() => {
    const key = keyword.trim().toLowerCase();
    return FORMAT_CONVERTER_LIST.filter((converter) => {
      if (categoryFilter !== 'all' && converter.category !== categoryFilter) {
        return false;
      }
      if (!key) return true;
      return [converter.name, converter.description, ...converter.keywords].some((item) =>
        item.toLowerCase().includes(key),
      );
    });
  }, [categoryFilter, keyword]);

  useEffect(() => {
    if (!selectedConverter) return;
    if (
      !converterList.some((item) => item.id === selectedConverter.id) &&
      converterList.length > 0
    ) {
      setSelectedConverterId(converterList[0].id);
    }
  }, [converterList, selectedConverter]);

  useEffect(() => {
    if (selectedConverter && !selectedConverter.supportsReverse && direction === 'reverse') {
      setDirection('forward');
    }
  }, [direction, selectedConverter]);

  const handleConvert = () => {
    if (!selectedConverter) return;
    const result = runFormatConverter({
      converterId: selectedConverter.id,
      direction,
      input: inputValue,
    });
    if (!result.ok) {
      setOutputValue('');
      setError(result.error || '转换失败，请检查输入。');
      return;
    }
    setError('');
    setOutputValue(result.output);
  };

  const handleCopyOutput = async () => {
    if (!outputValue.trim()) {
      toast.message('还没有可复制的结果');
      return;
    }

    try {
      await navigator.clipboard.writeText(outputValue);
      toast.success('转换结果已复制');
    } catch {
      toast.error('复制失败，请手动复制');
    }
  };

  const handleSelectConverter = (converterId: string) => {
    setSelectedConverterId(converterId);
    setOutputValue('');
    setError('');
  };

  if (!selectedConverter) {
    return null;
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]" style={PAGE_BACKGROUND}>
      <PageBanner backgroundStyle={BANNER_BACKGROUND} padding="py-10 md:py-12" maxWidth="max-w-7xl">
        <div className="flex flex-col gap-4 text-white">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/35 bg-white/16 px-3 py-1 text-xs backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5" />
            工具实验室
          </div>
          <div>
            <h1 className="text-2xl font-bold drop-shadow-lg md:text-3xl">格式转换工具箱</h1>
            <p className="mt-2 max-w-3xl text-sm text-white/84 md:text-[15px]">
              把常用的数据、编码和文本格式转换集中到一页，复制即用，减少来回切换工具的成本。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-white/85">
            <span className="rounded-full border border-white/30 bg-white/14 px-3 py-1">
              已接入 {FORMAT_CONVERTER_LIST.length} 个转换器
            </span>
            <span className="rounded-full border border-white/30 bg-white/14 px-3 py-1">
              数据 / 编码 / 文本 三类
            </span>
          </div>
        </div>
      </PageBanner>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[320px_1fr] lg:px-8">
        <Card className="h-fit rounded-3xl border border-theme-shell-border bg-white/82 shadow-[0_20px_52px_rgba(var(--theme-primary-rgb),0.12)] backdrop-blur-sm">
          <CardContent className="space-y-4 p-5">
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-900">选择转换器</h2>
              <div className="theme-input-border flex items-center gap-2 rounded-xl border px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="搜索工具名或关键词"
                  className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {CATEGORY_FILTERS.map((item) => {
                const active = categoryFilter === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setCategoryFilter(item.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition ${
                      active
                        ? 'border-theme-soft-strong bg-theme-soft text-theme-primary'
                        : 'border-theme-shell-border bg-white text-slate-500 hover:bg-theme-soft/55 hover:text-theme-primary'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="max-h-[calc(100vh-20rem)] space-y-2 overflow-auto pr-1">
              {converterList.map((converter) => {
                const active = converter.id === selectedConverter.id;
                return (
                  <button
                    key={converter.id}
                    type="button"
                    onClick={() => handleSelectConverter(converter.id)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                      active
                        ? 'border-theme-soft-strong bg-theme-soft shadow-[0_10px_24px_rgba(var(--theme-primary-rgb),0.14)]'
                        : 'border-theme-shell-border bg-white/86 hover:-translate-y-0.5 hover:border-theme-soft-strong hover:bg-theme-soft/40'
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{converter.name}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{converter.description}</p>
                  </button>
                );
              })}

              {converterList.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-theme-shell-border bg-white/70 px-3 py-5 text-center text-xs text-slate-500">
                  没有匹配的工具，换个关键词试试。
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="rounded-3xl border border-theme-shell-border bg-white/85 shadow-[0_20px_52px_rgba(var(--theme-primary-rgb),0.12)] backdrop-blur-sm">
            <CardContent className="space-y-5 p-5 md:p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{selectedConverter.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">{selectedConverter.description}</p>
                </div>

                {selectedConverter.supportsReverse ? (
                  <button
                    type="button"
                    onClick={() =>
                      setDirection((prev) => (prev === 'forward' ? 'reverse' : 'forward'))
                    }
                    className="inline-flex items-center gap-2 self-start rounded-xl border border-theme-soft-strong bg-theme-soft px-3 py-2 text-xs text-theme-primary transition hover:brightness-105"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    {direction === 'forward'
                      ? selectedConverter.forwardActionLabel
                      : selectedConverter.reverseActionLabel || '反向转换'}
                  </button>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500">输入区</p>
                  <textarea
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    placeholder={selectedConverter.inputPlaceholder}
                    className="theme-input-border min-h-[260px] w-full rounded-2xl border px-4 py-3 text-sm leading-6 text-slate-700 outline-none focus:border-theme-soft-strong focus:ring-2 focus:ring-theme-soft"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-500">结果区</p>
                    <button
                      type="button"
                      onClick={handleCopyOutput}
                      className="inline-flex items-center gap-1.5 text-xs text-theme-primary hover:text-theme-primary-hover"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      复制结果
                    </button>
                  </div>
                  <textarea
                    value={outputValue}
                    readOnly
                    placeholder={selectedConverter.outputPlaceholder}
                    className="min-h-[260px] w-full rounded-2xl border border-theme-shell-border bg-theme-soft/32 px-4 py-3 font-mono text-sm leading-6 text-slate-700 outline-none"
                  />
                </div>
              </div>

              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                  {error}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={handleConvert}
                  className="theme-btn-primary rounded-xl px-5 text-sm font-medium"
                >
                  <Wand2 className="mr-2 h-4 w-4" />
                  {direction === 'forward'
                    ? selectedConverter.forwardActionLabel
                    : selectedConverter.reverseActionLabel || '执行转换'}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl border-theme-soft-strong bg-white/85 text-theme-primary hover:bg-theme-soft"
                  onClick={() => {
                    setInputValue('');
                    setOutputValue('');
                    setError('');
                  }}
                >
                  清空
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-theme-shell-border bg-white/75 shadow-[0_16px_40px_rgba(var(--theme-primary-rgb),0.10)] backdrop-blur-sm">
            <CardContent className="space-y-2 p-5">
              <p className="text-sm font-semibold text-slate-900">使用小贴士</p>
              <p className="text-sm text-slate-600">
                先在左侧选择转换类型，再粘贴原始内容并执行转换。结果支持一键复制，方便直接复用到你的工作流。
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
