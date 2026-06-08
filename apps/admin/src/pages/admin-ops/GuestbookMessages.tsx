import { DeleteOutlined, PushpinOutlined } from '@ant-design/icons';
import { Button, Card, message, Popconfirm, Select, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useMemo } from 'react';
import {
  deleteGuestbookMessage,
  type GuestbookMessage,
  listGuestbookMessages,
  updateGuestbookPin,
  updateGuestbookStatus,
} from '@/api/operations';
import { formatDateTime, useAdminList } from './shared';

const statusOptions: Array<{ value: GuestbookMessage['status']; label: string }> = [
  { value: 'approved', label: '已通过' },
  { value: 'hidden', label: '已隐藏' },
  { value: 'rejected', label: '已拒绝' },
];

function statusTag(status: GuestbookMessage['status']) {
  const color = status === 'approved' ? 'green' : status === 'hidden' ? 'orange' : 'red';
  const label = statusOptions.find((item) => item.value === status)?.label || status;
  return <Tag color={color}>{label}</Tag>;
}

export default function GuestbookMessages() {
  const ops = useAdminList<GuestbookMessage>(listGuestbookMessages);

  const handleStatus = useCallback(
    async (record: GuestbookMessage, status: GuestbookMessage['status']) => {
      await updateGuestbookStatus(record.id, status);
      message.success('状态已更新');
      void ops.fetchData();
    },
    [ops.fetchData],
  );

  const handlePin = useCallback(
    async (record: GuestbookMessage) => {
      await updateGuestbookPin(record.id, !record.isPinned);
      message.success(record.isPinned ? '已取消置顶' : '已置顶');
      void ops.fetchData();
    },
    [ops.fetchData],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteGuestbookMessage(id);
      message.success('已删除');
      void ops.fetchData();
    },
    [ops.fetchData],
  );

  const columns: ColumnsType<GuestbookMessage> = useMemo(
    () => [
      {
        title: '留言',
        dataIndex: 'content',
        render: (value, record) => (
          <div>
            <div className="max-w-2xl whitespace-pre-wrap">{value}</div>
            <div className="mt-1 text-xs text-gray-400">
              {record.nickname} {record.userId ? `· ID ${record.userId}` : ''}
            </div>
          </div>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 170,
        render: (value: GuestbookMessage['status'], record) => (
          <Select
            size="small"
            value={value}
            options={statusOptions}
            onChange={(next) => handleStatus(record, next)}
          />
        ),
      },
      {
        title: '置顶',
        dataIndex: 'isPinned',
        width: 90,
        render: (value: boolean) => (value ? <Tag color="blue">置顶</Tag> : <Tag>普通</Tag>),
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
        width: 180,
        render: (_, record) => (
          <Space>
            {statusTag(record.status)}
            <Button type="link" icon={<PushpinOutlined />} onClick={() => handlePin(record)}>
              {record.isPinned ? '取消' : '置顶'}
            </Button>
            <Popconfirm title="确认删除这条留言？" onConfirm={() => handleDelete(record.id)}>
              <Button type="link" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [handleDelete, handlePin, handleStatus],
  );

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">访客留言</h2>
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {ops.searchTools}
          <Select
            className="w-36"
            value={ops.status || 'all'}
            options={[{ value: 'all', label: '全部状态' }, ...statusOptions]}
            onChange={(value) =>
              ops.updateQuery({ status: value === 'all' ? undefined : value, page: 1 })
            }
          />
        </div>
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
