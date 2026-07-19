import {
  BookOpenText,
  Eye,
  FileText,
  FolderPlus,
  MoreHorizontal,
  RotateCw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  type AIKnowledgeBase,
  type AIKnowledgeChunkPreview,
  type AIKnowledgeDocument,
  createAIKnowledgeBase,
  deleteAIKnowledgeDocument,
  getAPIErrorMessage,
  listAIKnowledgeBases,
  listAIKnowledgeDocumentChunks,
  listAIKnowledgeDocuments,
  retryAIKnowledgeDocument,
  uploadAIKnowledgeDocument,
} from '@/api/aiWorkbench';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

const documentFailureMessage: Record<string, string> = {
  PGVECTOR_NOT_INSTALLED: '数据库尚未启用 pgvector 扩展',
  RAG_POSTGRES_REQUIRED: '知识库检索需要 PostgreSQL',
  ARK_EMBEDDING_NOT_CONFIGURED: '尚未配置向量模型',
  ARK_NOT_CONFIGURED: '尚未配置 ARK 服务',
  ARK_EMBEDDING_FAILED: '向量模型调用失败',
  KNOWLEDGE_VECTOR_STORE_FAILED: '向量无法写入数据库',
  KNOWLEDGE_CHUNKS_MISSING: '文档分段不存在',
  DOCUMENT_PARSE_FAILED: 'PDF 未包含可解析文本',
};

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${Math.ceil(sizeBytes / 1024)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDocumentType(document: AIKnowledgeDocument) {
  const extension = document.name.split('.').pop()?.trim();
  return extension
    ? extension.toUpperCase()
    : document.mimeType.split('/').pop()?.toUpperCase() || '文件';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function getDocumentStatus(document: AIKnowledgeDocument) {
  if (document.status === 'ready') return { label: '已就绪', variant: 'secondary' as const };
  if (document.status === 'failed') return { label: '处理失败', variant: 'destructive' as const };
  if (document.status === 'indexing')
    return { label: `索引中 ${document.indexProgress}%`, variant: 'outline' as const };
  return { label: '等待处理', variant: 'outline' as const };
}

function getDocumentSourceLabel(source: AIKnowledgeDocument['source']) {
  return source === 'upload' ? '上传文件' : '未知来源';
}

export default function KnowledgeBases({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bases, setBases] = useState<AIKnowledgeBase[]>([]);
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const [documents, setDocuments] = useState<AIKnowledgeDocument[]>([]);
  const documentsRef = useRef<AIKnowledgeDocument[]>([]);
  const completionTimersRef = useRef(new Map<string, number[]>());
  const [completionProgresses, setCompletionProgresses] = useState<Record<string, number>>({});
  const [loadingBases, setLoadingBases] = useState(true);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [retryingID, setRetryingID] = useState<string | null>(null);
  const [deletingID, setDeletingID] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AIKnowledgeDocument | null>(null);
  const [previewTarget, setPreviewTarget] = useState<{
    knowledgeBaseID: string;
    document: AIKnowledgeDocument;
  } | null>(null);
  const [previewChunks, setPreviewChunks] = useState<AIKnowledgeChunkPreview[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const selectedBase = bases.find((base) => base.id === selectedID) || null;
  const baseSearch = searchParams.get('knowledge_base') || '';
  const documentSearch = searchParams.get('knowledge_document') || '';
  const visibleBases = useMemo(
    () =>
      bases.filter((base) =>
        base.name.toLocaleLowerCase().includes(baseSearch.toLocaleLowerCase()),
      ),
    [baseSearch, bases],
  );
  const visibleDocuments = useMemo(
    () =>
      documents.filter((document) =>
        document.name.toLocaleLowerCase().includes(documentSearch.toLocaleLowerCase()),
      ),
    [documentSearch, documents],
  );
  const selectedBaseSize = useMemo(
    () => documents.reduce((total, document) => total + document.sizeBytes, 0),
    [documents],
  );

  const updateSearchParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value.trim()) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const clearCompletionProgress = useCallback((documentID: string) => {
    for (const timer of completionTimersRef.current.get(documentID) || []) {
      window.clearTimeout(timer);
    }
    completionTimersRef.current.delete(documentID);
    setCompletionProgresses((current) => {
      if (!(documentID in current)) return current;
      const next = { ...current };
      delete next[documentID];
      return next;
    });
  }, []);

  const showCompletionProgress = useCallback(
    (document: AIKnowledgeDocument, previous: AIKnowledgeDocument) => {
      clearCompletionProgress(document.id);
      const initialProgress = Math.min(
        99,
        Math.max(80, Number.isFinite(previous.indexProgress) ? previous.indexProgress : 0),
      );
      setCompletionProgresses((current) => ({ ...current, [document.id]: initialProgress }));
      const completeTimer = window.setTimeout(() => {
        setCompletionProgresses((current) => ({ ...current, [document.id]: 100 }));
      }, 80);
      const dismissTimer = window.setTimeout(() => {
        clearCompletionProgress(document.id);
      }, 1200);
      completionTimersRef.current.set(document.id, [completeTimer, dismissTimer]);
    },
    [clearCompletionProgress],
  );

  const replaceDocuments = useCallback(
    (nextDocuments: AIKnowledgeDocument[]) => {
      const previousByID = new Map(documentsRef.current.map((document) => [document.id, document]));
      documentsRef.current = nextDocuments;
      setDocuments(nextDocuments);
      for (const document of nextDocuments) {
        const previous = previousByID.get(document.id);
        if (document.status === 'ready' && previous && previous.status !== 'ready') {
          showCompletionProgress(document, previous);
        }
      }
    },
    [showCompletionProgress],
  );

  useEffect(
    () => () => {
      for (const timers of completionTimersRef.current.values()) {
        for (const timer of timers) window.clearTimeout(timer);
      }
    },
    [],
  );

  useEffect(() => {
    const loadBases = async () => {
      try {
        setLoadingBases(true);
        const { list } = await listAIKnowledgeBases();
        setBases(list);
        setSelectedID((current) => current ?? list[0]?.id ?? null);
      } catch (error) {
        toast.error(getAPIErrorMessage(error, '加载知识库失败'));
      } finally {
        setLoadingBases(false);
      }
    };
    void loadBases();
  }, []);

  useEffect(() => {
    if (!selectedID) {
      replaceDocuments([]);
      return;
    }
    let active = true;
    setLoadingDocuments(true);
    const loadDocuments = async (showError: boolean) => {
      try {
        const { list } = await listAIKnowledgeDocuments(selectedID);
        if (active) replaceDocuments(list);
      } catch (error) {
        if (active && showError) toast.error(getAPIErrorMessage(error, '加载文档失败'));
      } finally {
        if (active) setLoadingDocuments(false);
      }
    };
    void loadDocuments(true);
    const timer = window.setInterval(() => void loadDocuments(false), 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [replaceDocuments, selectedID]);

  useEffect(() => {
    if (!previewTarget) {
      setPreviewChunks([]);
      return;
    }
    let active = true;
    setLoadingPreview(true);
    void listAIKnowledgeDocumentChunks(previewTarget.knowledgeBaseID, previewTarget.document.id)
      .then(({ list }) => {
        if (active) setPreviewChunks(list);
      })
      .catch((error) => {
        if (active) toast.error(getAPIErrorMessage(error, '加载文档详情失败'));
      })
      .finally(() => {
        if (active) setLoadingPreview(false);
      });
    return () => {
      active = false;
    };
  }, [previewTarget]);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('请输入知识库名称');
      return;
    }
    try {
      setCreating(true);
      const base = await createAIKnowledgeBase({
        name: name.trim(),
        description: description.trim(),
      });
      setBases((items) => [base, ...items]);
      setSelectedID(base.id);
      setName('');
      setDescription('');
      setCreateOpen(false);
      toast.success('知识库已创建');
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '创建知识库失败'));
    } finally {
      setCreating(false);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedID) return;
    if (!/\.(md|markdown|txt|pdf)$/i.test(file.name)) {
      toast.error('仅支持 Markdown、TXT 或 PDF 文档');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('单个文档不能超过 2MB');
      return;
    }
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      const { document } = await uploadAIKnowledgeDocument(selectedID, formData);
      replaceDocuments([document, ...documentsRef.current]);
      toast.success('文档已加入知识库');
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '上传文档失败'));
    } finally {
      setUploading(false);
    }
  };

  const handleRetry = async (documentID: string) => {
    if (!selectedID) return;
    try {
      setRetryingID(documentID);
      const { document } = await retryAIKnowledgeDocument(selectedID, documentID);
      replaceDocuments(
        documentsRef.current.map((item) => (item.id === documentID ? document : item)),
      );
      toast.success('已重新开始处理资料');
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '重试失败'));
    } finally {
      setRetryingID(null);
    }
  };

  const handleDelete = async () => {
    if (!selectedID || !deleteTarget) return;
    try {
      setDeletingID(deleteTarget.id);
      await deleteAIKnowledgeDocument(selectedID, deleteTarget.id);
      clearCompletionProgress(deleteTarget.id);
      replaceDocuments(documentsRef.current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success('文档已删除');
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '删除文档失败'));
    } finally {
      setDeletingID(null);
    }
  };

  return (
    <div className={embedded ? '' : 'min-h-screen bg-background'}>
      <div className={embedded ? '' : 'mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 md:px-8'}>
        {!embedded && (
          <Card className="mb-8 bg-card/80 shadow-sm ring-foreground/7">
            <CardContent className="flex flex-col gap-5 p-8 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Badge variant="outline" className="mb-4">
                  <BookOpenText className="mr-2 h-3.5 w-3.5" />
                  AI 工作台
                </Badge>
                <h1 className="mb-2 text-3xl font-semibold text-foreground">知识库</h1>
                <p className="text-muted-foreground">整理智能体可使用的私有资料</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => navigate('/workbench')}>
                  返回工作台
                </Button>
                <Button onClick={() => setCreateOpen(true)}>
                  <FolderPlus className="mr-2 h-4 w-4" />
                  新建知识库
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <Card className="overflow-hidden border-border shadow-none">
            <CardHeader className="gap-4 border-b border-border px-5 py-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">知识库</CardTitle>
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label="新建知识库"
                  onClick={() => setCreateOpen(true)}
                >
                  <FolderPlus />
                </Button>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={baseSearch}
                  onChange={(event) => updateSearchParam('knowledge_base', event.target.value)}
                  placeholder="搜索知识库"
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent className="min-h-96 space-y-2 px-3 py-4">
              {loadingBases ? (
                <>
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </>
              ) : visibleBases.length === 0 ? (
                <p className="px-3 py-8 text-sm text-muted-foreground">没有匹配的知识库</p>
              ) : (
                visibleBases.map((base) => {
                  const selected = base.id === selectedID;
                  const documentCount = selected ? documents.length : undefined;
                  return (
                    <Button
                      key={base.id}
                      variant="ghost"
                      size="lg"
                      className={`min-h-14 w-full justify-start gap-3 rounded-lg px-3.5 py-2.5 text-left whitespace-normal ${
                        selected
                          ? 'bg-accent text-accent-foreground hover:bg-accent'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => setSelectedID(base.id)}
                    >
                      <BookOpenText
                        className={`size-5 shrink-0 ${selected ? 'text-primary' : 'text-muted-foreground'}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium leading-5">{base.name}</span>
                        <span className="mt-1 block line-clamp-2 text-xs leading-4 font-normal text-muted-foreground">
                          {selected && documentCount !== undefined
                            ? `${documentCount} 个文档 · ${formatFileSize(selectedBaseSize)}`
                            : base.description || '未添加说明'}
                        </span>
                      </span>
                    </Button>
                  );
                })
              )}
            </CardContent>
            <div className="border-t border-border px-5 py-4 text-sm text-muted-foreground">
              共 {bases.length} 个知识库
            </div>
          </Card>

          <Card className="overflow-hidden border-border shadow-none">
            <CardHeader className="flex-row items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div className="flex min-w-0 items-center gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <BookOpenText className="size-6" />
                </span>
                <div className="min-w-0">
                  <CardTitle className="truncate text-xl">
                    {selectedBase?.name || '选择一个知识库'}
                  </CardTitle>
                  {selectedBase && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {documents.length} 个文档 · {formatFileSize(selectedBaseSize)}
                    </p>
                  )}
                  {selectedBase?.description && (
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {selectedBase.description}
                    </p>
                  )}
                </div>
              </div>
              {selectedBase && (
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="icon-sm" aria-label="知识库操作">
                    <MoreHorizontal />
                  </Button>
                  <Input
                    id="knowledge-document-upload"
                    className="sr-only"
                    type="file"
                    accept=".md,.markdown,.txt,.pdf,text/markdown,text/plain,application/pdf"
                    disabled={uploading}
                    onChange={handleUpload}
                  />
                  <Button
                    render={<label htmlFor="knowledge-document-upload" />}
                    disabled={uploading}
                  >
                    <Upload className="mr-2 size-4" />
                    {uploading ? '上传中...' : '上传文档'}
                  </Button>
                </div>
              )}
            </CardHeader>
            <div className="flex flex-col gap-3 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-72">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={documentSearch}
                  onChange={(event) => updateSearchParam('knowledge_document', event.target.value)}
                  placeholder="搜索文档"
                  className="pl-9"
                />
              </div>
              <p className="text-sm text-muted-foreground">按更新时间排序</p>
            </div>
            {!selectedBase ? (
              <div className="py-24 text-center text-sm text-muted-foreground">
                新建或选择一个知识库
              </div>
            ) : loadingDocuments ? (
              <div className="space-y-3 p-6">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : documents.length === 0 ? (
              <div className="py-24 text-center">
                <FileText className="mx-auto mb-3 size-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">暂无文档</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-6">文档名称</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>处理状态</TableHead>
                    <TableHead>大小</TableHead>
                    <TableHead>更新时间</TableHead>
                    <TableHead className="w-24 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleDocuments.map((document) => {
                    const canStartIndexing =
                      document.status === 'pending_embedding' ||
                      (document.status === 'failed' &&
                        document.errorCode !== 'DOCUMENT_PARSE_FAILED');
                    const isIndexing =
                      document.status === 'pending' ||
                      document.status === 'pending_embedding' ||
                      document.status === 'indexing';
                    const completedIndexing = completionProgresses[document.id] !== undefined;
                    return (
                      <TableRow key={document.id}>
                        <TableCell className="max-w-0 px-6">
                          <div className="flex min-w-0 items-center gap-3">
                            <FileText className="size-5 shrink-0 text-primary" />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">
                                {document.name}
                              </p>
                              {isIndexing && (
                                <p className="mt-0.5 text-xs text-muted-foreground">正在建立索引</p>
                              )}
                              {completedIndexing && !isIndexing && (
                                <p className="mt-0.5 text-xs text-muted-foreground">索引完成</p>
                              )}
                              {document.status === 'failed' && (
                                <p className="mt-0.5 text-xs text-destructive">
                                  {documentFailureMessage[document.errorCode] || '资料处理失败'}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {getDocumentType(document)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getDocumentStatus(document).variant}>
                            {getDocumentStatus(document).label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatFileSize(document.sizeBytes)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(document.updatedAt)}
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`查看 ${document.name} 详情`}
                              onClick={() =>
                                setPreviewTarget({ knowledgeBaseID: selectedBase.id, document })
                              }
                            >
                              <Eye />
                            </Button>
                            {canStartIndexing && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`处理 ${document.name}`}
                                disabled={retryingID === document.id}
                                onClick={() => void handleRetry(document.id)}
                              >
                                <RotateCw
                                  className={retryingID === document.id ? 'animate-spin' : ''}
                                />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`删除 ${document.name}`}
                              disabled={deletingID === document.id}
                              onClick={() => setDeleteTarget(document)}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            {selectedBase && documents.length > 0 && (
              <div className="border-t border-border px-6 py-4 text-sm text-muted-foreground">
                共 {visibleDocuments.length} 个文档
              </div>
            )}
          </Card>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建知识库</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="知识库名称"
            />
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="资料说明（可选）"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={creating} onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button disabled={creating} onClick={handleCreate}>
              {creating ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deletingID) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>删除文档</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            删除后将同时清理该文档的索引分段，且无法恢复。
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={Boolean(deletingID)}
              onClick={() => setDeleteTarget(null)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={Boolean(deletingID)}
              onClick={() => void handleDelete()}
            >
              {deletingID ? '删除中...' : '删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(previewTarget)}
        onOpenChange={(open) => {
          if (!open) setPreviewTarget(null);
        }}
      >
        <DialogContent className="flex h-[min(44rem,82vh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="border-b border-border px-6 py-5">
            <DialogTitle className="truncate pr-8">{previewTarget?.document.name}</DialogTitle>
          </DialogHeader>
          {previewTarget && (
            <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)]">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-border px-6 py-5 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">来源</dt>
                  <dd className="mt-1 font-medium">
                    {getDocumentSourceLabel(previewTarget.document.source)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">处理状态</dt>
                  <dd className="mt-1">
                    <Badge variant={getDocumentStatus(previewTarget.document).variant}>
                      {getDocumentStatus(previewTarget.document).label}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">分段</dt>
                  <dd className="mt-1 font-medium">{previewTarget.document.chunkCount} 段</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">更新时间</dt>
                  <dd className="mt-1 font-medium">
                    {formatDate(previewTarget.document.updatedAt)}
                  </dd>
                </div>
              </dl>
              <div className="min-h-0 px-6 py-5">
                <h3 className="mb-3 text-sm font-medium">片段预览</h3>
                {loadingPreview ? (
                  <div className="space-y-3">
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                  </div>
                ) : previewChunks.length === 0 ? (
                  <div className="flex h-36 items-center justify-center rounded-lg border border-border text-sm text-muted-foreground">
                    暂无可预览的片段
                  </div>
                ) : (
                  <ScrollArea className="h-full pr-4">
                    <div className="space-y-3 pb-1">
                      {previewChunks.map((chunk) => (
                        <article key={chunk.id} className="rounded-lg border border-border p-4">
                          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                            <span>片段 {chunk.position + 1}</span>
                            <span>{chunk.tokenCount} 字符</span>
                          </div>
                          <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                            {chunk.content}
                          </p>
                        </article>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="border-t border-border px-6 py-4">
            <Button variant="outline" onClick={() => setPreviewTarget(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
