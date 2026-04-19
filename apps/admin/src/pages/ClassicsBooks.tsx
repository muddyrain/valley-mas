import {
  DeleteOutlined,
  EditOutlined,
  ImportOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Button, Form, Input, Modal, message, Popconfirm, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  adminDeleteBook,
  adminGetClassicsList,
  adminImportChapters,
  type ClassicsBook,
} from '@/api/classics';

export default function ClassicsBooks() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ClassicsBook[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [keywordInput, setKeywordInput] = useState('');

  // 导入章节 Modal
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importBook, setImportBook] = useState<ClassicsBook | null>(null);
  const [importJson, setImportJson] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importForm] = Form.useForm();

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGetClassicsList({ page, pageSize, keyword: keyword || undefined });
      setData(res.list || []);
      setTotal(res.total || 0);
    } catch {
      message.error('获取名著列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleDelete = async (id: number) => {
    try {
      await adminDeleteBook(id);
      message.success('删除成功');
      fetchList();
    } catch {
      message.error('删除失败');
    }
  };

  const openImport = (book: ClassicsBook) => {
    setImportBook(book);
    setImportJson('');
    importForm.resetFields();
    setImportModalOpen(true);
  };

  const handleImport = async () => {
    if (!importBook) return;
    let chapters: { title: string; content: string }[];
    try {
      chapters = JSON.parse(importJson);
      if (!Array.isArray(chapters)) throw new Error('应为数组');
    } catch {
      message.error('JSON 格式不正确，应为 [{title, content}, ...] 数组');
      return;
    }
    const editionId = importBook.editions?.[0]?.id;
    if (!editionId) {
      message.error('该书尚无版本，请先编辑书目添加版本');
      return;
    }
    setImportLoading(true);
    try {
      await adminImportChapters(importBook.id, editionId, { chapters });
      message.success(`成功导入 ${chapters.length} 章`);
      setImportModalOpen(false);
      fetchList();
    } catch {
      message.error('导入失败');
    } finally {
      setImportLoading(false);
    }
  };

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
    {
      title: '分类',
      dataIndex: 'category',
      width: 100,
    },
    {
      title: '朝代',
      dataIndex: 'dynasty',
      width: 100,
    },
    {
      title: '章节数',
      dataIndex: 'chapterCount',
      width: 80,
      align: 'center',
    },
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
            onConfirm={() => handleDelete(record.id)}
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
        <h1 className="text-xl font-semibold">名著管理</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/classics-books/create')}
        >
          新建书目
        </Button>
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

      {/* 导入章节 Modal */}
      <Modal
        title={`导入章节 — ${importBook?.title ?? ''}`}
        open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
        onOk={handleImport}
        okText="开始导入"
        confirmLoading={importLoading}
        width={700}
      >
        <p className="mb-2 text-sm text-gray-500">
          粘贴 JSON 数组，格式：{' '}
          <code className="rounded bg-gray-100 px-1">
            {'[{"title":"第一回","content":"..."},...]'}
          </code>
        </p>
        <Input.TextArea
          rows={14}
          placeholder='[{"title": "第一回", "content": "章节正文..."}]'
          value={importJson}
          onChange={(e) => setImportJson(e.target.value)}
        />
      </Modal>
    </div>
  );
}
