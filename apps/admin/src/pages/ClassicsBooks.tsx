import {
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  ImportOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Button,
  Input,
  InputNumber,
  Modal,
  message,
  Popconfirm,
  Progress,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  type AdminChapterItem,
  type AdminClassicsImportJob,
  type AdminClassicsImportJobStatus,
  adminCreateClassicsImportJob,
  adminDeleteBook,
  adminGetClassicsImportJob,
  adminGetClassicsImportJobs,
  adminGetClassicsList,
  adminImportChapters,
  adminRetryClassicsImportJob,
  type ClassicsBook,
} from '@/api/classics';

type ImportMode = 'txt' | 'json';
type ImportStage = 'idle' | 'reading' | 'parsing' | 'uploading' | 'done' | 'failed';

const CATEGORY_OPTIONS = ['诗词', '小说', '散文', '史书', '哲学', '戏曲', '文集', '其他'];
const TXT_CHAPTER_HEADING_RE =
  /^(第[\d零〇一二三四五六七八九十百千万两]+[回章节卷部篇].*|chapter\s+[\divxlcdm]+.*)$/i;

const IMPORT_JOB_STATUS_LABEL: Record<AdminClassicsImportJobStatus, string> = {
  queued: '排队中',
  processing: '处理中',
  success: '已完成',
  failed: '失败',
};

const IMPORT_JOB_STATUS_COLOR: Record<AdminClassicsImportJobStatus, string> = {
  queued: 'default',
  processing: 'processing',
  success: 'success',
  failed: 'error',
};

function parseTxtToChapters(raw: string): AdminChapterItem[] {
  const normalized = raw
    .replace(/\uFEFF/g, '')
    .replace(/\r\n?/g, '\n')
    .trim();
  if (!normalized) return [];

  const lines = normalized.split('\n');
  const chapters: AdminChapterItem[] = [];
  let currentTitle = '';
  let currentLines: string[] = [];
  let hasHeading = false;

  const flush = () => {
    const content = currentLines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (!content) return;
    const fallbackTitle = hasHeading ? `第${chapters.length + 1}章` : '正文';
    chapters.push({ title: currentTitle || fallbackTitle, content });
    currentTitle = '';
    currentLines = [];
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (TXT_CHAPTER_HEADING_RE.test(trimmed)) {
      hasHeading = true;
      if (currentLines.length > 0) flush();
      currentTitle = trimmed;
      continue;
    }
    if (!trimmed && currentLines.length === 0) continue;
    currentLines.push(rawLine.trimEnd());
  }
  if (currentLines.length > 0) flush();
  return chapters;
}

export default function ClassicsBooks() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ClassicsBook[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [keywordInput, setKeywordInput] = useState('');

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importBook, setImportBook] = useState<ClassicsBook | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('txt');
  const [importJson, setImportJson] = useState('');
  const [importTxt, setImportTxt] = useState('');
  const [txtChapterPreviewCount, setTxtChapterPreviewCount] = useState(0);
  const [importStage, setImportStage] = useState<ImportStage>('idle');
  const [importProgress, setImportProgress] = useState(0);
  const [importStageText, setImportStageText] = useState('待开始：请选择 TXT 或粘贴 JSON');
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [jobLoading, setJobLoading] = useState(false);
  const [jobTitle, setJobTitle] = useState('');
  const [jobCategory, setJobCategory] = useState('其他');
  const [jobDynasty, setJobDynasty] = useState('');
  const [jobAuthorNames, setJobAuthorNames] = useState('');
  const [jobEditionLabel, setJobEditionLabel] = useState('TXT 导入版');
  const [jobTranslator, setJobTranslator] = useState('');
  const [jobPublishYear, setJobPublishYear] = useState<number | null>(null);
  const [jobIsPublished, setJobIsPublished] = useState(false);
  const [jobSourceFileName, setJobSourceFileName] = useState('');
  const [jobTxtContent, setJobTxtContent] = useState('');
  const [trackingJob, setTrackingJob] = useState<AdminClassicsImportJob | null>(null);
  const [jobList, setJobList] = useState<AdminClassicsImportJob[]>([]);
  const [jobListLoading, setJobListLoading] = useState(false);
  const jobFileInputRef = useRef<HTMLInputElement | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedToastGuardRef = useRef<Set<number>>(new Set());

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const fetchJobs = useCallback(async () => {
    setJobListLoading(true);
    try {
      const res = await adminGetClassicsImportJobs({ limit: 8 });
      setJobList(res.list || []);
    } catch {
      message.error('获取导入任务失败');
    } finally {
      setJobListLoading(false);
    }
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGetClassicsList({ page, pageSize, keyword: keyword || undefined });
      setData(res.list || []);
      setTotal(res.total || 0);
    } catch {
      message.error('获取阅读库列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const pollImportJob = useCallback(
    (jobId: number) => {
      stopPolling();

      const tick = async () => {
        try {
          const latest = await adminGetClassicsImportJob(jobId);
          setTrackingJob(latest);
          setJobList((prev) => prev.map((item) => (item.id === latest.id ? latest : item)));
          if (latest.status === 'success') {
            stopPolling();
            if (!finishedToastGuardRef.current.has(jobId)) {
              finishedToastGuardRef.current.add(jobId);
              message.success(`任务 #${jobId} 导入完成`);
            }
            void fetchList();
            void fetchJobs();
          } else if (latest.status === 'failed') {
            stopPolling();
            if (!finishedToastGuardRef.current.has(jobId)) {
              finishedToastGuardRef.current.add(jobId);
              message.error(`任务 #${jobId} 导入失败`);
            }
            void fetchJobs();
          }
        } catch {
          stopPolling();
        }
      };

      void tick();
      pollingRef.current = setInterval(() => {
        void tick();
      }, 2000);
    },
    [fetchJobs, fetchList, stopPolling],
  );

  const handleDelete = async (id: number) => {
    try {
      await adminDeleteBook(id);
      message.success('删除成功');
      void fetchList();
    } catch {
      message.error('删除失败');
    }
  };

  const updateTxtPreview = useCallback((raw: string) => {
    const chapters = parseTxtToChapters(raw);
    setTxtChapterPreviewCount(chapters.length);
    return chapters;
  }, []);

  const openImport = (book: ClassicsBook) => {
    setImportBook(book);
    setImportMode('txt');
    setImportJson('');
    setImportTxt('');
    setTxtChapterPreviewCount(0);
    setImportStage('idle');
    setImportProgress(0);
    setImportStageText('待开始：请选择 TXT 或粘贴 JSON');
    setImportModalOpen(true);
  };

  const handlePickTxtFile = () => {
    fileInputRef.current?.click();
  };

  const handleTxtFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportStage('reading');
    setImportProgress(12);
    setImportStageText(`步骤 1/4：正在读取文件 ${file.name} ...`);
    try {
      const text = await file.text();
      setImportTxt(text);
      setImportStage('parsing');
      setImportProgress(30);
      setImportStageText('步骤 2/4：正在分析章节标题并切分正文 ...');
      const chapters = updateTxtPreview(text);
      if (chapters.length === 0) {
        setImportStage('failed');
        setImportProgress(0);
        setImportStageText('未识别到正文，请检查 TXT 内容是否为空。');
        message.error('TXT 文件为空或无法识别正文');
        return;
      }
      setImportStage('idle');
      setImportProgress(0);
      setImportStageText(`已识别 ${chapters.length} 章，点击“开始导入”写入阅读库。`);
      message.success(`TXT 识别完成：共 ${chapters.length} 章`);
    } catch {
      setImportStage('failed');
      setImportProgress(0);
      setImportStageText('读取 TXT 文件失败，请重试。');
      message.error('读取 TXT 文件失败');
    } finally {
      event.target.value = '';
    }
  };

  const handleImport = async () => {
    if (!importBook) return;

    const editionId = importBook.editions?.[0]?.id;
    if (!editionId) {
      message.error('该书尚无版本，请先编辑书目添加版本');
      return;
    }

    let chapters: AdminChapterItem[] = [];
    setImportStage('parsing');
    setImportProgress(28);
    setImportStageText(
      importMode === 'txt'
        ? '步骤 2/4：正在解析 TXT 并生成章节列表 ...'
        : '步骤 2/4：正在校验 JSON 结构 ...',
    );

    if (importMode === 'txt') {
      chapters = updateTxtPreview(importTxt);
      if (chapters.length === 0) {
        setImportStage('failed');
        setImportProgress(0);
        setImportStageText('TXT 解析失败：未识别出可导入章节。');
        message.error('TXT 解析失败，请检查章节标题或正文内容');
        return;
      }
    } else {
      try {
        const parsed = JSON.parse(importJson);
        if (!Array.isArray(parsed)) throw new Error('应为数组');
        chapters = parsed
          .map((item: unknown, idx: number) => {
            const row = item as { title?: unknown; content?: unknown };
            const content = String(row.content ?? '').trim();
            const title = String(row.title ?? '').trim() || `第${idx + 1}章`;
            return { title, content };
          })
          .filter((item) => item.content.length > 0);
      } catch {
        setImportStage('failed');
        setImportProgress(0);
        setImportStageText('JSON 校验失败：请使用 [{title, content}, ...] 格式。');
        message.error('JSON 格式不正确，应为 [{title, content}, ...] 数组');
        return;
      }
      if (chapters.length === 0) {
        setImportStage('failed');
        setImportProgress(0);
        setImportStageText('JSON 中没有可导入的有效正文。');
        message.error('JSON 数据为空或章节 content 为空');
        return;
      }
    }

    setImportLoading(true);
    setImportStage('uploading');
    setImportProgress(66);
    setImportStageText('步骤 3/4：正在写入数据库并刷新章节统计（大文件可能需要 10~90 秒）...');
    try {
      const res = await adminImportChapters(importBook.id, editionId, { chapters });
      setImportStage('done');
      setImportProgress(100);
      setImportStageText('步骤 4/4：导入完成，章节与字数统计已更新。');
      const imported = res?.imported ?? chapters.length;
      const totalWords =
        res?.totalWords ?? chapters.reduce((sum, ch) => sum + ch.content.length, 0);
      message.success(`成功导入 ${imported} 章，约 ${totalWords.toLocaleString()} 字`);
      setImportModalOpen(false);
      void fetchList();
    } catch {
      setImportStage('failed');
      setImportProgress(100);
      setImportStageText('导入失败：数据库写入异常，请稍后重试。');
      message.error('导入失败');
    } finally {
      setImportLoading(false);
    }
  };

  const openCreateJobModal = () => {
    setJobTitle('');
    setJobCategory('其他');
    setJobDynasty('');
    setJobAuthorNames('');
    setJobEditionLabel('TXT 导入版');
    setJobTranslator('');
    setJobPublishYear(null);
    setJobIsPublished(false);
    setJobSourceFileName('');
    setJobTxtContent('');
    setTrackingJob(null);
    setJobModalOpen(true);
  };

  const handlePickJobTxtFile = () => {
    jobFileInputRef.current?.click();
  };

  const handleJobTxtFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setJobSourceFileName(file.name);
      setJobTxtContent(text);
      message.success('TXT 文件已载入，可直接开始导入任务');
    } catch {
      message.error('读取 TXT 文件失败');
    } finally {
      event.target.value = '';
    }
  };

  const handleCreateJob = async () => {
    const txtContent = jobTxtContent.trim();
    if (!txtContent) {
      message.error('请先上传或粘贴 TXT 正文');
      return;
    }

    const authorNames = jobAuthorNames
      .split(/[,，、]/)
      .map((item) => item.trim())
      .filter(Boolean);

    setJobLoading(true);
    try {
      const job = await adminCreateClassicsImportJob({
        title: jobTitle || undefined,
        category: jobCategory || undefined,
        dynasty: jobDynasty || undefined,
        authorNames: authorNames.length > 0 ? authorNames : undefined,
        editionLabel: jobEditionLabel || undefined,
        translator: jobTranslator || undefined,
        publishYear: jobPublishYear ?? undefined,
        isPublished: jobIsPublished,
        sourceFileName: jobSourceFileName || undefined,
        txtContent,
      });
      setTrackingJob(job);
      setJobModalOpen(true);
      message.success(`导入任务 #${job.id} 已创建`);
      void fetchJobs();
      pollImportJob(job.id);
    } catch {
      message.error('创建导入任务失败');
    } finally {
      setJobLoading(false);
    }
  };

  const handleRetryJob = async (jobId: number) => {
    try {
      const job = await adminRetryClassicsImportJob(jobId);
      setTrackingJob(job);
      finishedToastGuardRef.current.delete(jobId);
      message.success(`任务 #${jobId} 已重新排队`);
      void fetchJobs();
      pollImportJob(jobId);
    } catch {
      message.error('重试任务失败');
    }
  };

  const importJobProgress = trackingJob?.progress ?? 0;
  const importJobStage = trackingJob?.stage ?? '待创建：填写书目信息并粘贴 TXT 正文';
  const importJobStatusLabel = trackingJob ? IMPORT_JOB_STATUS_LABEL[trackingJob.status] : '未开始';

  const jobColumns: ColumnsType<AdminClassicsImportJob> = useMemo(
    () => [
      {
        title: '任务',
        dataIndex: 'id',
        width: 90,
        render: (id: number) => `#${id}`,
      },
      {
        title: '来源文件',
        dataIndex: 'sourceFileName',
        width: 220,
        render: (name?: string) => name || '-',
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        render: (status: AdminClassicsImportJobStatus) => (
          <Tag color={IMPORT_JOB_STATUS_COLOR[status]}>{IMPORT_JOB_STATUS_LABEL[status]}</Tag>
        ),
      },
      {
        title: '进度',
        dataIndex: 'progress',
        width: 140,
        render: (progress: number) => `${progress}%`,
      },
      {
        title: '结果',
        key: 'result',
        render: (_, record) =>
          record.status === 'success'
            ? `书ID ${record.createdBookId} / ${record.importedChapters}章`
            : record.errorMessage || '-',
      },
      {
        title: '操作',
        key: 'action',
        width: 110,
        render: (_, record) =>
          record.status === 'failed' ? (
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => void handleRetryJob(record.id)}
            >
              重试
            </Button>
          ) : (
            <span className="text-xs text-slate-400">-</span>
          ),
      },
    ],
    [],
  );

  const columns: ColumnsType<ClassicsBook> = [
    {
      title: '书名',
      dataIndex: 'title',
      width: 180,
      render: (title: string, record) => (
        <span
          className="cursor-pointer text-blue-600 hover:underline"
          onClick={() => navigate(`/classics-books/edit/${record.id}`)}
        >
          {title}
        </span>
      ),
    },
    {
      title: '作者',
      dataIndex: 'authorNames',
      width: 120,
      render: (names: string[]) => names?.join('、') || '-',
    },
    { title: '分类', dataIndex: 'category', width: 100 },
    { title: '朝代', dataIndex: 'dynasty', width: 100 },
    { title: '章节数', dataIndex: 'chapterCount', width: 80, align: 'center' },
    {
      title: '字数',
      dataIndex: 'wordCount',
      width: 100,
      align: 'right',
      render: (n: number) => (n ? n.toLocaleString() : '-'),
    },
    {
      title: '状态',
      dataIndex: 'isPublished',
      width: 90,
      align: 'center',
      render: (published: boolean) =>
        published ? <Tag color="green">已发布</Tag> : <Tag color="default">草稿</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => navigate(`/classics-books/edit/${record.id}`)}
          >
            编辑
          </Button>
          <Button size="small" icon={<ImportOutlined />} onClick={() => openImport(record)}>
            导入章节
          </Button>
          <Popconfirm
            title="确认删除该书目？"
            onConfirm={() => void handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">阅读库管理</h1>
        <Space>
          <Button icon={<UploadOutlined />} onClick={openCreateJobModal}>
            TXT 自动建书
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/classics-books/create')}
          >
            新建书目
          </Button>
        </Space>
      </div>

      <div className="mb-4 flex gap-2">
        <Input
          placeholder="搜索书名"
          prefix={<SearchOutlined />}
          value={keywordInput}
          onChange={(e) => setKeywordInput(e.target.value)}
          onPressEnter={() => {
            setKeyword(keywordInput);
            setPage(1);
          }}
          style={{ width: 220 }}
        />
        <Button
          onClick={() => {
            setKeyword(keywordInput);
            setPage(1);
          }}
        >
          搜索
        </Button>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={data}
        columns={columns}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">最近导入任务</h3>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            loading={jobListLoading}
            onClick={() => void fetchJobs()}
          >
            刷新
          </Button>
        </div>
        <Table
          rowKey="id"
          loading={jobListLoading}
          dataSource={jobList}
          columns={jobColumns}
          pagination={false}
          size="small"
          locale={{ emptyText: '暂无导入任务' }}
        />
      </div>

      <Modal
        title={`导入章节到已有书目 — ${importBook?.title ? importBook.title : ''}`}
        open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
        onOk={() => void handleImport()}
        okText="开始导入"
        confirmLoading={importLoading}
        width={700}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <Radio.Group
            optionType="button"
            buttonStyle="solid"
            value={importMode}
            onChange={(e) => setImportMode(e.target.value as ImportMode)}
          >
            <Radio.Button value="txt">TXT 自动拆章</Radio.Button>
            <Radio.Button value="json">JSON 章节数组</Radio.Button>
          </Radio.Group>
          <Button
            icon={<UploadOutlined />}
            onClick={handlePickTxtFile}
            disabled={importMode !== 'txt' || importLoading}
          >
            选择 TXT 文件
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            onChange={handleTxtFileChange}
          />
        </div>

        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600">
          <p className="font-medium text-slate-700">导入流程（大文件可能耗时 10~90 秒）</p>
          <p>1/4 读取文件与基础校验</p>
          <p>2/4 解析章节标题并切分正文</p>
          <p>3/4 写入阅读库章节（最长耗时步骤）</p>
          <p>4/4 更新章节数与总字数统计</p>
        </div>

        {importMode === 'txt' ? (
          <>
            <p className="mb-2 text-sm text-gray-500">
              支持上传或粘贴 TXT，系统会自动识别“第X章/回”或 “Chapter X” 作为章节标题。
            </p>
            <Input.TextArea
              rows={12}
              placeholder="可直接粘贴 TXT 正文，或点击右上角“选择 TXT 文件”"
              value={importTxt}
              onChange={(e) => {
                const next = e.target.value;
                setImportTxt(next);
                updateTxtPreview(next);
              }}
            />
            <p className="mt-2 text-xs text-slate-500">
              预估章节数：{txtChapterPreviewCount > 0 ? `${txtChapterPreviewCount} 章` : '尚未识别'}
            </p>
          </>
        ) : (
          <>
            <p className="mb-2 text-sm text-gray-500">
              粘贴 JSON 数组，格式：
              <code className="ml-1 rounded bg-gray-100 px-1">
                {'[{"title":"第一回","content":"..."},...]'}
              </code>
            </p>
            <Input.TextArea
              rows={12}
              placeholder='[{"title": "第一回", "content": "章节正文..."}]'
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
            />
          </>
        )}

        <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
            <FileTextOutlined />
            <span>{importStageText}</span>
          </div>
          <Progress
            percent={importProgress}
            size="small"
            status={
              importStage === 'failed'
                ? 'exception'
                : importStage === 'done'
                  ? 'success'
                  : undefined
            }
          />
        </div>
      </Modal>

      <Modal
        title="TXT 自动建书导入任务"
        open={jobModalOpen}
        onCancel={() => setJobModalOpen(false)}
        onOk={() => void handleCreateJob()}
        okText="创建导入任务"
        confirmLoading={jobLoading}
        width={780}
      >
        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600">
          <p className="font-medium text-slate-700">任务流程（RLIB-2 + RLIB-3）</p>
          <p>1/4 读取导入内容</p>
          <p>2/4 解析 TXT 章节</p>
          <p>3/4 自动创建书目与默认版本</p>
          <p>4/4 写入章节并更新统计（可在任务列表追踪并重试）</p>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <Input
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="书名（可空，系统可自动推断）"
          />
          <Select
            value={jobCategory}
            onChange={setJobCategory}
            options={CATEGORY_OPTIONS.map((item) => ({ label: item, value: item }))}
          />
          <Input
            value={jobDynasty}
            onChange={(e) => setJobDynasty(e.target.value)}
            placeholder="朝代 / 时代（如：近现代）"
          />
          <Input
            value={jobAuthorNames}
            onChange={(e) => setJobAuthorNames(e.target.value)}
            placeholder="作者（多位用逗号分隔）"
          />
          <Input
            value={jobEditionLabel}
            onChange={(e) => setJobEditionLabel(e.target.value)}
            placeholder="版本标签（如：TXT 导入版）"
          />
          <Input
            value={jobTranslator}
            onChange={(e) => setJobTranslator(e.target.value)}
            placeholder="译者（可空）"
          />
          <InputNumber
            value={jobPublishYear ?? undefined}
            onChange={(value) => setJobPublishYear(typeof value === 'number' ? value : null)}
            min={1000}
            max={2100}
            style={{ width: '100%' }}
            placeholder="出版年份（可空）"
          />
          <div className="flex items-center justify-between rounded-md border border-slate-200 px-3">
            <span className="text-sm text-slate-600">创建后立即发布</span>
            <Switch checked={jobIsPublished} onChange={setJobIsPublished} />
          </div>
        </div>

        <div className="mb-2 flex items-center justify-between">
          <Input
            value={jobSourceFileName}
            onChange={(e) => setJobSourceFileName(e.target.value)}
            placeholder="来源文件名（可空）"
          />
          <Button
            icon={<UploadOutlined />}
            className="ml-2 shrink-0"
            onClick={handlePickJobTxtFile}
          >
            选择 TXT 文件
          </Button>
          <input
            ref={jobFileInputRef}
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            onChange={handleJobTxtFileChange}
          />
        </div>

        <Input.TextArea
          rows={10}
          value={jobTxtContent}
          onChange={(e) => setJobTxtContent(e.target.value)}
          placeholder="粘贴 TXT 正文，或使用“选择 TXT 文件”"
        />

        <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
            <span>{importJobStage}</span>
            <span>
              {trackingJob ? `任务 #${trackingJob.id} · ${importJobStatusLabel}` : '未开始'}
            </span>
          </div>
          <Progress
            percent={importJobProgress}
            size="small"
            status={
              trackingJob?.status === 'failed'
                ? 'exception'
                : trackingJob?.status === 'success'
                  ? 'success'
                  : undefined
            }
          />
          {trackingJob?.errorMessage && (
            <p className="mt-2 text-xs text-rose-600">{trackingJob.errorMessage}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
