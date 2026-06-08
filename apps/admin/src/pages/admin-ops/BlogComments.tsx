import { DeleteOutlined } from '@ant-design/icons';
import { Button, Card, message, Popconfirm, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useMemo } from 'react';
import { type BlogComment, deleteBlogComment, listBlogComments } from '@/api/operations';
import { formatDateTime, useAdminList } from './shared';

export default function BlogComments() {
  const ops = useAdminList<BlogComment>(listBlogComments);

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteBlogComment(id);
      message.success('已删除');
      void ops.fetchData();
    },
    [ops],
  );

  const columns: ColumnsType<BlogComment> = useMemo(
    () => [
      {
        title: '评论',
        dataIndex: 'content',
        render: (value, record) => (
          <div>
            <div className="max-w-xl whitespace-pre-wrap">{value}</div>
            <div className="mt-1 text-xs text-gray-400">
              用户：{record.user?.nickname || record.userId}
            </div>
          </div>
        ),
      },
      {
        title: '内容',
        dataIndex: 'post',
        width: 240,
        render: (post: BlogComment['post'], record) => (
          <div>
            <div>{post?.title || record.postId}</div>
            {post?.postType ? <Tag>{post.postType}</Tag> : null}
          </div>
        ),
      },
      {
        title: '时间',
        dataIndex: 'createdAt',
        width: 180,
        render: formatDateTime,
      },
      {
        title: '操作',
        key: 'action',
        width: 120,
        render: (_, record) => (
          <Space>
            <Popconfirm title="确认删除这条评论？" onConfirm={() => handleDelete(record.id)}>
              <Button type="link" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [handleDelete],
  );

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">评论管理</h2>
      <Card>
        <div className="mb-4">{ops.searchTools}</div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={ops.data}
          loading={ops.loading}
          pagination={{
            current: ops.page,
            pageSize: ops.pageSize,
            total: ops.total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          onChange={ops.handleTableChange}
        />
      </Card>
    </div>
  );
}
