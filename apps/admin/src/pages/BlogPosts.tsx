import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Button, Card, message, Popconfirm, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Post, PostType } from '@/api/blog';
import { deletePost, getAdminPosts } from '@/api/blog';
import { useAdminList } from '@/hooks/useAdminList';
import { toBlogPostListParams } from '@/utils/adminListParams';

const { Title } = Typography;

const postTypeMap: Record<PostType, { color: string; text: string }> = {
  blog: { color: 'blue', text: '博客' },
  image_text: { color: 'magenta', text: '图文' },
};

export default function BlogPosts() {
  const navigate = useNavigate();
  const loadPosts = useCallback(
    (params: Parameters<typeof toBlogPostListParams>[0]) =>
      getAdminPosts(toBlogPostListParams(params)),
    [],
  );
  const ops = useAdminList<Post>(loadPosts, {
    defaultPageSize: 10,
    searchPlaceholder: '搜索标题或摘要',
  });

  const handleDelete = async (id: string) => {
    try {
      await deletePost(id);
      message.success('删除成功');
      void ops.fetchData();
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

  const getVisibilityTag = (value: string) => {
    const visibilityMap: Record<string, { color: string; text: string }> = {
      private: { color: 'default', text: '私密' },
      shared: { color: 'cyan', text: '共享' },
      public: { color: 'green', text: '公开' },
    };
    const config = visibilityMap[value] || { color: 'default', text: value || '-' };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

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
      title: '类型',
      dataIndex: 'postType',
      key: 'postType',
      width: 90,
      render: (value: PostType) => {
        const config = postTypeMap[value] || postTypeMap.blog;
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (category: Post['category']) => category?.name || '-',
    },
    {
      title: '作者',
      dataIndex: 'author',
      key: 'author',
      width: 160,
      render: (author: Post['author']) => (
        <span className="inline-flex items-center gap-1 text-gray-700">
          <UserOutlined className="text-gray-400" />
          {author?.nickname || '-'}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (value: string) => getStatusTag(value),
    },
    {
      title: '可见范围',
      dataIndex: 'visibility',
      key: 'visibility',
      width: 100,
      render: (value: string) => getVisibilityTag(value),
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
            description={`确定要删除《${record.title}》吗？`}
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
            内容管理
          </Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/blog-posts/create')}
          >
            新建内容
          </Button>
        </div>

        <div className="mb-6 flex flex-wrap gap-4">
          {ops.searchTools}
          <Select
            placeholder="全部类型"
            value={ops.type || undefined}
            onChange={(value) => ops.updateQuery({ type: value || undefined, page: 1 })}
            allowClear
            className="w-36"
            options={[
              { value: '', label: '全部类型' },
              { value: 'blog', label: '博客' },
              { value: 'image_text', label: '图文' },
            ]}
          />
          <Select
            placeholder="全部状态"
            value={ops.status || undefined}
            onChange={(value) => ops.updateQuery({ status: value || undefined, page: 1 })}
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
          dataSource={ops.data}
          rowKey="id"
          loading={ops.loading}
          pagination={{
            current: ops.page,
            pageSize: ops.pageSize,
            total: ops.total,
            showSizeChanger: true,
            showTotal: (count) => `共 ${count} 条`,
          }}
          onChange={ops.handleTableChange}
        />
      </Card>
    </div>
  );
}
