import { BookOpenText, FileText, FolderPlus, RotateCw, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  type AIKnowledgeBase,
  type AIKnowledgeDocument,
  createAIKnowledgeBase,
  deleteAIKnowledgeDocument,
  getAPIErrorMessage,
  listAIKnowledgeBases,
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
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

const documentStatus: Record<AIKnowledgeDocument['status'], string> = {
  pending: '待处理',
  pending_embedding: '资料准备中',
  indexing: '索引中',
  ready: '已索引',
  failed: '处理失败',
};

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

export default function KnowledgeBases() {
  const navigate = useNavigate();
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
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const selectedBase = bases.find((base) => base.id === selectedID) || null;

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
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 md:px-8">
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

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Card className="bg-card/80 shadow-sm ring-foreground/7">
            <CardHeader>
              <CardTitle className="text-base">我的知识库</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loadingBases ? (
                <>
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </>
              ) : bases.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">还没有知识库</p>
              ) : (
                bases.map((base) => (
                  <Button
                    key={base.id}
                    variant={selectedID === base.id ? 'secondary' : 'ghost'}
                    className="h-auto w-full justify-start rounded-lg px-3 py-3 text-left hover:bg-accent focus-visible:bg-accent"
                    onClick={() => setSelectedID(base.id)}
                  >
                    <BookOpenText className="mr-3 h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{base.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {base.description || '未添加说明'}
                      </span>
                    </span>
                  </Button>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/80 shadow-sm ring-foreground/7">
            <CardHeader className="flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base">
                  {selectedBase ? selectedBase.name : '选择一个知识库'}
                </CardTitle>
                {selectedBase?.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{selectedBase.description}</p>
                )}
              </div>
              {selectedBase && (
                <>
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
                    <Upload className="mr-2 h-4 w-4" />
                    {uploading ? '上传中...' : '上传文档'}
                  </Button>
                </>
              )}
            </CardHeader>
            <CardContent>
              {!selectedBase ? (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  新建或选择一个知识库
                </p>
              ) : loadingDocuments ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : documents.length === 0 ? (
                <div className="py-16 text-center">
                  <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">暂无文档</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((document) =>
                    (() => {
                      const canStartIndexing =
                        document.status === 'pending_embedding' ||
                        (document.status === 'failed' &&
                          document.errorCode !== 'DOCUMENT_PARSE_FAILED');
                      const isIndexing =
                        document.status === 'pending' ||
                        document.status === 'pending_embedding' ||
                        document.status === 'indexing';
                      const completionProgress = completionProgresses[document.id];
                      const showProgress = isIndexing || completionProgress !== undefined;
                      const progress =
                        completionProgress ??
                        (document.status === 'ready'
                          ? 100
                          : Math.min(
                              99,
                              Math.max(
                                0,
                                Number.isFinite(document.indexProgress)
                                  ? document.indexProgress
                                  : 0,
                              ),
                            ));
                      return (
                        <div
                          key={document.id}
                          className="flex items-center gap-3 rounded-xl border border-border/55 bg-muted/20 p-4 shadow-sm transition-colors hover:bg-muted/35"
                        >
                          <FileText className="h-5 w-5 shrink-0 text-primary" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{document.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(document.sizeBytes)} · {document.chunkCount} 个分段
                            </p>
                            {showProgress && (
                              <Progress value={progress} className="mt-2 max-w-sm gap-1.5">
                                <ProgressLabel className="text-xs text-muted-foreground">
                                  {completionProgress !== undefined ? '索引完成' : '正在建立索引'}
                                </ProgressLabel>
                                <ProgressValue className="text-xs" />
                              </Progress>
                            )}
                            {document.status === 'failed' && (
                              <p className="mt-1 text-xs text-destructive">
                                {documentFailureMessage[document.errorCode] ||
                                  '资料处理失败，可重新尝试'}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
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
                          <Badge variant={document.status === 'failed' ? 'destructive' : 'outline'}>
                            {documentStatus[document.status]}
                          </Badge>
                        </div>
                      );
                    })(),
                  )}
                </div>
              )}
            </CardContent>
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
    </div>
  );
}
