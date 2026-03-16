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
import { useEffect, useState } from 'react';
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
    loadPosts();
  }, [page, pageSize, status]);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const res: any = await getAdminPosts({
        page,
        pageSize,
        status: status || undefined,
      });
      if (res.code === 0) {
        setPosts(res.data);
        setTotal(res.total);
      }
    } catch (error) {
      console.error('Failed to load posts:', error);
      message.error('加载文章列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res: any = await deletePost(id);
      if (res.code === 0) {
        message.success('删除成功');
        loadPosts();
      } else {
        message.error(res.message || '删除失败');
      }
    } catch (error) {
      console.error('Failed to delete post:', error);
      message.error('删除失败');
    }
  };

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      published: { color: 'green', text: '已发布' },
      draft: { color: 'orange', text: '草稿' },
      archived: { color: 'default', text: '已归档' },
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: Post) => (
        <div>
          <div className="font-medium">{text}</div>
          <div className="text-gray-400 text-sm truncate max-w-md">{record.excerpt}</div>
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
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '浏览',
      dataIndex: 'viewCount',
      key: 'viewCount',
      width: 80,
    },
    {
      title: '发布时间',
      dataIndex: 'publishedAt',
      key: 'publishedAt',
      render: (date: string) => (date ? new Date(date).toLocaleString('zh-CN') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: unknown, record: Post) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => window.open(`/blog/${record.slug}`, '_blank')}
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
            description={`确定要删除文章「${record.title}」吗？`}
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

  const filteredPosts = keyword
    ? posts.filter(
        (post) =>
          post.title.toLowerCase().includes(keyword.toLowerCase()) ||
          post.excerpt.toLowerCase().includes(keyword.toLowerCase()),
      )
    : posts;

  return (
    <div className="p-6">
      <Card>
        <div className="flex items-center justify-between mb-6">
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

        <div className="flex gap-4 mb-6">
          <Input
            placeholder="搜索文章标题或摘要..."
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="max-w-md"
            allowClear
          />
          <Select
            placeholder="全部状态"
            value={status}
            onChange={setStatus}
            allowClear
            className="w-32"
          >
            <Select.Option value="">全部状态</Select.Option>
            <Select.Option value="published">已发布</Select.Option>
            <Select.Option value="draft">草稿</Select.Option>
            <Select.Option value="archived">已归档</Select.Option>
          </Select>
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
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => {
              setPage(page);
              setPageSize(pageSize || 10);
            },
          }}
        />
      </Card>
    </div>
  );
}
