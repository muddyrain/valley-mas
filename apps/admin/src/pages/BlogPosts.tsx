import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Input,
  message,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Post } from '@/api/blog';
import { deletePost, getAdminPosts } from '@/api/blog';

const { Title } = Typography;

export default function BlogPosts() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<string>('');
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    void loadPosts();
  }, [page, pageSize, status]);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const data = await getAdminPosts({
        page,
        pageSize,
        status: status || undefined,
      });
      setPosts(data.list || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to load posts:', error);
      message.error('加载文章列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePost(id);
      message.success('删除成功');
      void loadPosts();
    } catch (error) {
      console.error('Failed to delete post:', error);
      message.error('删除失败');
    }
  };

  const getStatusTag = (value: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      published: { color: 'green', text: '已发布' },
      draft: { color: 'orange', text: '草稿' },
      archived: { color: 'default', text: '已归档' },
    };
    const config = statusMap[value] || { color: 'default', text: value || '-' };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const filteredPosts = useMemo(() => {
    if (!keyword.trim()) return posts;
    const lower = keyword.toLowerCase();
    return posts.filter(
      (post) =>
        post.title.toLowerCase().includes(lower) ||
        (post.excerpt || '').toLowerCase().includes(lower),
    );
  }, [keyword, posts]);

  const columns: ColumnsType<Post> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <div>
          <div className="font-medium">{text}</div>
          <div className="max-w-md truncate text-sm text-gray-400">{record.excerpt || '-'}</div>
        </div>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (category: Post['category']) => category?.name || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (value: string) => getStatusTag(value),
    },
    {
      title: '浏览',
      dataIndex: 'viewCount',
      key: 'viewCount',
      width: 90,
    },
    {
      title: '发布时间',
      dataIndex: 'publishedAt',
      key: 'publishedAt',
      render: (value?: string) => (value ? new Date(value).toLocaleString('zh-CN') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => window.open(`/blog/${record.id}`, '_blank')}
          >
            预览
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => navigate(`/blog-posts/edit/${record.id}`)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description={`确定要删除文章《${record.title}》吗？`}
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <Card>
        <div className="mb-6 flex items-center justify-between">
          <Title level={4} className="!mb-0">
            文章管理
          </Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/blog-posts/create')}
          >
            新建文章
          </Button>
        </div>

        <div className="mb-6 flex gap-4">
          <Input
            placeholder="搜索标题或摘要"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="max-w-md"
            allowClear
          />
          <Select
            placeholder="全部状态"
            value={status}
            onChange={(v) => setStatus(v || '')}
            allowClear
            className="w-36"
            options={[
              { value: '', label: '全部状态' },
              { value: 'published', label: '已发布' },
              { value: 'draft', label: '草稿' },
              { value: 'archived', label: '已归档' },
            ]}
          />
        </div>

        <Table
          columns={columns}
          dataSource={filteredPosts}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (count) => `共 ${count} 条`,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize || 10);
            },
          }}
        />
      </Card>
    </div>
  );
}
