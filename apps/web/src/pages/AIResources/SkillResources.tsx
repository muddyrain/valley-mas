import {
  Download,
  ExternalLink,
  FileArchive,
  FileCode2,
  FileImage,
  FileText,
  FolderOpen,
  Github,
  MoreHorizontal,
  Pencil,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  type AISkill,
  type AISkillDetail,
  type AISkillImportPreview,
  archiveAISkill,
  getAISkill,
  getAISkillFileImageData,
  getAPIErrorMessage,
  installAISkill,
  listAISkills,
  previewAISkillImport,
  updateAISkill,
} from '@/api/aiWorkbench';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const suggestedSkillTags = ['通用', '智能体', '工作流', '写作', '生图', '数据'];
const maxSkillZipBytes = 32 * 1024 * 1024;

type InstallSourceType = 'github' | 'zip';

function parseSkillTags(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,，]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ).slice(0, 8);
}

function formatSkillTags(tags: string[]) {
  return tags.join('，');
}

export default function SkillResources() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [skills, setSkills] = useState<AISkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [installOpen, setInstallOpen] = useState(false);
  const [installSourceType, setInstallSourceType] = useState<InstallSourceType>('github');
  const [installURL, setInstallURL] = useState('');
  const [installFile, setInstallFile] = useState<File | null>(null);
  const [installPreview, setInstallPreview] = useState<AISkillImportPreview | null>(null);
  const [selectedInstallPaths, setSelectedInstallPaths] = useState<string[]>([]);
  const [resolvingInstall, setResolvingInstall] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailSkill, setDetailSkill] = useState<AISkill | null>(null);
  const [skillDetail, setSkillDetail] = useState<AISkillDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState('SKILL.md');
  const [selectedImageData, setSelectedImageData] = useState('');
  const [selectedImageLoading, setSelectedImageLoading] = useState(false);
  const [tagEditorSkill, setTagEditorSkill] = useState<AISkill | null>(null);
  const [tagText, setTagText] = useState('');
  const [savingTags, setSavingTags] = useState(false);
  const keyword = searchParams.get('skill_search') || '';
  const activeTag = searchParams.get('skill_tag') || '';

  useEffect(() => {
    let active = true;
    void listAISkills()
      .then(({ list }) => {
        if (active) setSkills(list);
      })
      .catch((error) => {
        if (active) toast.error(getAPIErrorMessage(error, '加载技能失败'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleSkills = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase();
    return skills.filter((skill) => {
      const matchesKeyword =
        !normalizedKeyword ||
        `${skill.name} ${skill.description} ${skill.sourceAuthor} ${skill.tags.join(' ')}`
          .toLocaleLowerCase()
          .includes(normalizedKeyword);
      return matchesKeyword && (!activeTag || skill.tags.includes(activeTag));
    });
  }, [activeTag, keyword, skills]);

  const tagFilters = useMemo(
    () =>
      Array.from(
        new Set([activeTag, ...skills.flatMap((skill) => skill.tags)].filter(Boolean)),
      ).sort((left, right) => {
        const leftIndex = suggestedSkillTags.indexOf(left);
        const rightIndex = suggestedSkillTags.indexOf(right);
        if (leftIndex >= 0 || rightIndex >= 0) {
          return (
            (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) -
            (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex)
          );
        }
        return left.localeCompare(right, 'zh-CN');
      }),
    [activeTag, skills],
  );

  const updateSearch = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value.trim()) next.set('skill_search', value);
    else next.delete('skill_search');
    setSearchParams(next, { replace: true });
  };

  const updateTagFilter = (tag: string) => {
    const next = new URLSearchParams(searchParams);
    if (tag) next.set('skill_tag', tag);
    else next.delete('skill_tag');
    setSearchParams(next, { replace: true });
  };

  const resetInstallFlow = () => {
    setInstallSourceType('github');
    setInstallURL('');
    setInstallFile(null);
    setInstallPreview(null);
    setSelectedInstallPaths([]);
    setResolvingInstall(false);
    setInstalling(false);
  };

  const resetInstallPreview = () => {
    setInstallPreview(null);
    setSelectedInstallPaths([]);
  };

  const getInstallSource = () => (installSourceType === 'zip' ? installFile : installURL.trim());

  const previewInstall = async () => {
    const source = getInstallSource();
    if (!source) {
      toast.error(installSourceType === 'zip' ? '请选择 ZIP 技能包' : '请输入 GitHub 仓库链接');
      return;
    }
    try {
      setResolvingInstall(true);
      const preview = await previewAISkillImport(source);
      setInstallPreview(preview);
      setSelectedInstallPaths(preview.skills.map((skill) => skill.path));
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '解析技能失败'));
    } finally {
      setResolvingInstall(false);
    }
  };

  const install = async () => {
    if (!installPreview) {
      await previewInstall();
      return;
    }
    if (selectedInstallPaths.length === 0) {
      toast.error('请选择至少一个技能');
      return;
    }
    try {
      setInstalling(true);
      const source = getInstallSource();
      if (!source) {
        toast.error('技能来源已失效，请重新选择');
        return;
      }
      const result = await installAISkill(source, selectedInstallPaths);
      setSkills((items) => [
        ...result.list,
        ...items.filter((item) => !result.list.some((skill) => skill.id === item.id)),
      ]);
      setInstallOpen(false);
      resetInstallFlow();
      toast.success(`已安装 ${result.list.length} 个技能`);
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '安装技能失败'));
    } finally {
      setInstalling(false);
    }
  };

  const toggleInstallPath = (path: string, checked: boolean) => {
    setSelectedInstallPaths((paths) =>
      checked ? [...new Set([...paths, path])] : paths.filter((item) => item !== path),
    );
  };

  const archive = async (skill: AISkill) => {
    try {
      await archiveAISkill(skill.id);
      setSkills((items) => items.filter((item) => item.id !== skill.id));
      toast.success('技能已卸载');
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '卸载技能失败'));
    }
  };

  const openTagEditor = (skill: AISkill) => {
    setTagEditorSkill(skill);
    setTagText(formatSkillTags(skill.tags));
  };

  const saveTags = async () => {
    if (!tagEditorSkill) return;
    try {
      setSavingTags(true);
      const updated = await updateAISkill(tagEditorSkill.id, { tags: parseSkillTags(tagText) });
      setSkills((items) => [updated, ...items.filter((item) => item.id !== updated.id)]);
      setTagEditorSkill(null);
      toast.success('技能标签已保存');
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '保存技能标签失败'));
    } finally {
      setSavingTags(false);
    }
  };

  const openSkillDetail = async (skill: AISkill) => {
    setDetailSkill(skill);
    setSkillDetail(null);
    setSelectedFilePath('SKILL.md');
    setSelectedImageData('');
    setDetailOpen(true);
    try {
      setDetailLoading(true);
      const detail = await getAISkill(skill.id);
      setSkillDetail(detail);
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '加载技能详情失败'));
    } finally {
      setDetailLoading(false);
    }
  };

  const detailFiles = skillDetail?.files ?? [];
  const selectedFile = detailFiles.find((file) => file.path === selectedFilePath) ?? detailFiles[0];
  const skillFile = detailFiles.find((file) => file.kind === 'skill');
  const referenceFiles = detailFiles.filter((file) => file.kind === 'reference');
  const referenceImageFiles = detailFiles.filter((file) => file.kind === 'reference_image');
  const assetFiles = detailFiles.filter((file) => file.kind === 'asset');
  const assetImageFiles = detailFiles.filter((file) => file.kind === 'asset_image');
  const scriptFiles = detailFiles.filter((file) => file.kind === 'script');

  useEffect(() => {
    if (
      !skillDetail ||
      !selectedFile?.id ||
      !['reference_image', 'asset_image'].includes(selectedFile.kind)
    ) {
      setSelectedImageData('');
      setSelectedImageLoading(false);
      return;
    }
    let active = true;
    setSelectedImageLoading(true);
    void getAISkillFileImageData(skillDetail.id, selectedFile.id)
      .then(({ imageBase64 }) => {
        if (active) setSelectedImageData(imageBase64);
      })
      .catch((error) => {
        if (active) toast.error(getAPIErrorMessage(error, '加载参考图片失败'));
      })
      .finally(() => {
        if (active) setSelectedImageLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedFile?.id, selectedFile?.kind, skillDetail]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(event) => updateSearch(event.target.value)}
            placeholder="搜索已安装技能"
            className="pl-9"
          />
        </div>
        <Button onClick={() => setInstallOpen(true)}>
          <Download className="mr-2 size-4" />
          安装技能
        </Button>
      </div>

      {tagFilters.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="按标签筛选">
          <Button
            type="button"
            size="sm"
            variant={activeTag ? 'outline' : 'secondary'}
            onClick={() => updateTagFilter('')}
          >
            全部
          </Button>
          {tagFilters.map((tag) => (
            <Button
              key={tag}
              type="button"
              size="sm"
              variant={activeTag === tag ? 'secondary' : 'outline'}
              onClick={() => updateTagFilter(tag)}
            >
              {tag}
            </Button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div aria-busy="true" className="space-y-3 py-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : visibleSkills.length === 0 ? (
        <div className="py-24 text-center">
          <Sparkles className="mx-auto mb-3 size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {keyword || activeTag ? '没有匹配的技能' : '还没有安装技能'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleSkills.map((skill) => (
            <article
              key={skill.id}
              className="group flex h-52 flex-col rounded-xl border border-border bg-card p-4 shadow-sm transition-[border-color,box-shadow] hover:border-primary/30 hover:shadow-md"
            >
              <div className="relative min-h-0 flex-1">
                <button
                  type="button"
                  className="flex w-full items-start gap-3 pr-8 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={() => void openSkillDetail(skill)}
                  aria-label={`查看 ${skill.name} 的技能目录`}
                >
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Sparkles className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {skill.name}
                    </span>
                    <span className="mt-1 block min-h-[3.75rem] max-h-[3.75rem] overflow-hidden text-xs leading-5 text-muted-foreground [-webkit-box-orient:vertical] [-webkit-line-clamp:3] [display:-webkit-box]">
                      {skill.description || '未提供技能说明'}
                    </span>
                  </span>
                </button>
                <div className="absolute top-0 right-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon-sm" aria-label={`操作 ${skill.name}`} />
                      }
                    >
                      <MoreHorizontal />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openTagEditor(skill)}>
                        <Pencil />
                        编辑标签
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => void archive(skill)}
                      >
                        <Trash2 />
                        卸载
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="mt-3 flex shrink-0 items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                {skill.tags.slice(0, 2).map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
                {skill.tags.length > 2 ? (
                  <Badge variant="outline">+{skill.tags.length - 2}</Badge>
                ) : null}
                {skill.tags.length === 0 ? <Badge variant="outline">未分类</Badge> : null}
                {skill.sourceUrl.startsWith('http') ? (
                  <a
                    href={skill.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <Github className="size-3.5" />
                    {skill.sourceAuthor || '来源'}
                    <ExternalLink className="size-3" />
                  </a>
                ) : (
                  <span className="ml-auto inline-flex items-center gap-1">
                    <FileArchive className="size-3.5" />
                    {skill.sourceAuthor || 'ZIP 文件'}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setDetailSkill(null);
            setSkillDetail(null);
          }
        }}
      >
        <DialogContent className="flex h-[min(44rem,calc(100vh-2rem))] flex-col overflow-hidden sm:max-w-4xl">
          <DialogHeader className="shrink-0">
            <DialogTitle>{skillDetail?.name || detailSkill?.name || '技能目录'}</DialogTitle>
            <DialogDescription>已导入的技能说明、参考资料和脚本。</DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="grid min-h-0 flex-1 overflow-hidden rounded-lg border border-border sm:grid-cols-[12rem_minmax(0,1fr)]">
              <Skeleton className="h-full rounded-none border-b border-border sm:border-r sm:border-b-0" />
              <Skeleton className="h-full rounded-none" />
            </div>
          ) : skillDetail && selectedFile ? (
            <div className="grid min-h-0 flex-1 overflow-hidden rounded-lg border border-border sm:grid-cols-[12rem_minmax(0,1fr)]">
              <div className="min-h-0 overflow-y-auto border-b border-border bg-muted/30 p-3 sm:border-r sm:border-b-0">
                <div className="mb-2 flex items-center gap-2 px-2 text-xs font-medium text-muted-foreground">
                  <FolderOpen className="size-3.5" />
                  目录
                </div>
                <div className="space-y-1">
                  {skillFile ? (
                    <Button
                      variant={selectedFile.path === skillFile.path ? 'secondary' : 'ghost'}
                      size="sm"
                      className="w-full justify-start gap-2 truncate"
                      onClick={() => setSelectedFilePath(skillFile.path)}
                    >
                      <FileText className="size-3.5 shrink-0" />
                      <span className="truncate">{skillFile.path}</span>
                    </Button>
                  ) : null}
                  {referenceFiles.length > 0 ? (
                    <div className="pt-1">
                      <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                        <FolderOpen className="size-3.5" />
                        references
                      </div>
                      {referenceFiles.map((file) => (
                        <Button
                          key={file.path}
                          variant={selectedFile.path === file.path ? 'secondary' : 'ghost'}
                          size="sm"
                          className="w-full justify-start gap-2 truncate"
                          onClick={() => setSelectedFilePath(file.path)}
                        >
                          <FileText className="size-3.5 shrink-0" />
                          <span className="truncate pl-2">
                            {file.path.replace(/^references\//, '')}
                          </span>
                        </Button>
                      ))}
                    </div>
                  ) : null}
                  {referenceImageFiles.length > 0 ? (
                    <div className="pt-1">
                      <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                        <FolderOpen className="size-3.5" />
                        reference images
                      </div>
                      {referenceImageFiles.map((file) => (
                        <Button
                          key={file.path}
                          variant={selectedFile.path === file.path ? 'secondary' : 'ghost'}
                          size="sm"
                          className="w-full justify-start gap-2 truncate"
                          onClick={() => setSelectedFilePath(file.path)}
                        >
                          <FileImage className="size-3.5 shrink-0" />
                          <span className="truncate pl-2">
                            {file.path.replace(/^references\/images\//, '')}
                          </span>
                        </Button>
                      ))}
                    </div>
                  ) : null}
                  {assetFiles.length > 0 || assetImageFiles.length > 0 ? (
                    <div className="pt-1">
                      <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                        <FolderOpen className="size-3.5" />
                        assets
                      </div>
                      {[...assetFiles, ...assetImageFiles].map((file) => (
                        <Button
                          key={file.path}
                          variant={selectedFile.path === file.path ? 'secondary' : 'ghost'}
                          size="sm"
                          className="w-full justify-start gap-2 truncate"
                          onClick={() => setSelectedFilePath(file.path)}
                        >
                          {file.kind === 'asset_image' ? (
                            <FileImage className="size-3.5 shrink-0" />
                          ) : (
                            <FileText className="size-3.5 shrink-0" />
                          )}
                          <span className="truncate pl-2">
                            {file.path.replace(/^assets\//, '')}
                          </span>
                        </Button>
                      ))}
                    </div>
                  ) : null}
                  {scriptFiles.length > 0 ? (
                    <div className="pt-1">
                      <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                        <FolderOpen className="size-3.5" />
                        scripts
                      </div>
                      {scriptFiles.map((file) => (
                        <Button
                          key={file.path}
                          variant={selectedFile.path === file.path ? 'secondary' : 'ghost'}
                          size="sm"
                          className="w-full justify-start gap-2 truncate"
                          onClick={() => setSelectedFilePath(file.path)}
                        >
                          <FileCode2 className="size-3.5 shrink-0" />
                          <span className="truncate pl-2">
                            {file.path.replace(/^scripts\//, '')}
                          </span>
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex min-w-0 flex-col">
                <div className="border-b border-border px-4 py-3 text-xs font-medium text-muted-foreground">
                  {selectedFile.path}
                </div>
                {selectedFile.kind === 'reference_image' || selectedFile.kind === 'asset_image' ? (
                  <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-muted/20 p-4">
                    {selectedImageLoading ? (
                      <Spinner />
                    ) : selectedImageData ? (
                      <img
                        src={selectedImageData}
                        alt={selectedFile.path}
                        className="max-h-full max-w-full rounded-md object-contain"
                      />
                    ) : null}
                  </div>
                ) : (
                  <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-5 text-foreground">
                    {selectedFile.content}
                  </pre>
                )}
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-border px-4 text-center text-sm text-muted-foreground">
              未找到已导入的技能文件
            </div>
          )}
          <div className="flex min-h-5 shrink-0 items-center justify-between gap-3 text-xs text-muted-foreground">
            {skillDetail ? (
              <>
                <span>{detailFiles.length} 个已导入文件</span>
                {skillDetail.sourceUrl.startsWith('http') ? (
                  <a
                    href={skillDetail.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <Github className="size-3.5" />
                    查看来源
                    <ExternalLink className="size-3" />
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <FileArchive className="size-3.5" />
                    ZIP 文件
                  </span>
                )}
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={tagEditorSkill !== null}
        onOpenChange={(open) => !open && setTagEditorSkill(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑技能标签</DialogTitle>
            <DialogDescription>用标签组织技能，方便在智能体和工作流中选择。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="ai-skill-tags">标签</Label>
              <Input
                id="ai-skill-tags"
                value={tagText}
                onChange={(event) => setTagText(event.target.value)}
                placeholder="例如：智能体，写作"
                disabled={savingTags}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestedSkillTags.map((tag) => {
                const selected = parseSkillTags(tagText).includes(tag);
                return (
                  <Button
                    key={tag}
                    type="button"
                    size="sm"
                    variant={selected ? 'secondary' : 'outline'}
                    disabled={savingTags}
                    onClick={() => {
                      const tags = parseSkillTags(tagText);
                      setTagText(
                        formatSkillTags(
                          selected ? tags.filter((item) => item !== tag) : [...tags, tag],
                        ),
                      );
                    }}
                  >
                    {tag}
                  </Button>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={savingTags} onClick={() => setTagEditorSkill(null)}>
              取消
            </Button>
            <Button disabled={savingTags} onClick={() => void saveTags()}>
              {savingTags ? <Spinner /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={installOpen}
        onOpenChange={(open) => {
          if (installing || resolvingInstall) return;
          setInstallOpen(open);
          if (!open) resetInstallFlow();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>安装技能</DialogTitle>
            <DialogDescription>从公开 GitHub 来源或 ZIP 技能包安装 SKILL.md。</DialogDescription>
          </DialogHeader>
          <Tabs
            value={installSourceType}
            onValueChange={(value) => {
              setInstallSourceType(value as InstallSourceType);
              resetInstallPreview();
            }}
            className="py-2"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="github">
                <Github />
                GitHub
              </TabsTrigger>
              <TabsTrigger value="zip">
                <FileArchive />
                ZIP 文件
              </TabsTrigger>
            </TabsList>
            <TabsContent value="github" className="space-y-2 pt-2">
              <Label htmlFor="ai-skill-install-url">技能来源</Label>
              <Input
                id="ai-skill-install-url"
                value={installURL}
                onChange={(event) => {
                  setInstallURL(event.target.value);
                  resetInstallPreview();
                }}
                placeholder="npx skills add owner/repository --skill skill-name"
                disabled={installing || resolvingInstall}
              />
            </TabsContent>
            <TabsContent value="zip" className="space-y-2 pt-2">
              <Label htmlFor="ai-skill-install-file">ZIP 技能包</Label>
              <Input
                id="ai-skill-install-file"
                type="file"
                accept=".zip,application/zip"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (file && file.size > maxSkillZipBytes) {
                    toast.error('ZIP 文件不能超过 32MB');
                    event.target.value = '';
                    setInstallFile(null);
                  } else {
                    setInstallFile(file);
                  }
                  resetInstallPreview();
                }}
                disabled={installing || resolvingInstall}
              />
              <p className="text-xs text-muted-foreground">最大 32MB</p>
            </TabsContent>
          </Tabs>
          {installPreview ? (
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    发现 {installPreview.skills.length} 个技能
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {installPreview.author || installPreview.repositoryUrl}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setInstallPreview(null);
                    setSelectedInstallPaths([]);
                  }}
                  disabled={installing}
                >
                  重新解析
                </Button>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {installPreview.skills.map((skill) => {
                  const checked = selectedInstallPaths.includes(skill.path);
                  return (
                    <label
                      key={skill.path}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-muted/50 has-checked:border-primary/40 has-checked:bg-primary/5"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(next) => toggleInstallPath(skill.path, next === true)}
                        disabled={installing}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {skill.name}
                        </span>
                        <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {skill.description || skill.path}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          将导入 SKILL.md
                          {skill.referenceCount > 0 ? `、${skill.referenceCount} 份参考资料` : ''}
                          {skill.referenceImageCount > 0
                            ? `、${skill.referenceImageCount} 张参考图`
                            : ''}
                          {skill.assetCount > 0 ? `、${skill.assetCount} 个素材` : ''}
                          {skill.scriptCount > 0 ? `、${skill.scriptCount} 个脚本` : ''}
                        </span>
                        {skill.ignoredFileCount > 0 ? (
                          <span className="mt-1 block text-xs text-muted-foreground">
                            忽略 {skill.ignoredFileCount} 个不支持的文件
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={installing || resolvingInstall}
              onClick={() => setInstallOpen(false)}
            >
              取消
            </Button>
            <Button
              disabled={
                installing ||
                resolvingInstall ||
                (installSourceType === 'zip' ? !installFile : !installURL.trim())
              }
              onClick={() => void install()}
            >
              {installing || resolvingInstall ? <Spinner /> : <Download />}
              {installing
                ? '安装中'
                : resolvingInstall
                  ? '解析中'
                  : installPreview
                    ? '安装已选'
                    : '解析'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
