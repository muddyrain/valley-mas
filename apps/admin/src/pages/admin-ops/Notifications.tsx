import { CheckOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, Modal, message, Select, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useMemo, useState } from 'react';
import {
  createNotification,
  listNotifications,
  type UserNotification,
  updateNotificationReadState,
} from '@/api/operations';
import type { AdminListParams } from '@/types/api';
import { formatDateTime, useAdminList } from './shared';

export default function Notifications() {
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const loader = useCallback(
    (params: AdminListParams) => listNotifications({ ...params, isRead: params.status }),
    [],
  );
  const ops = useAdminList<UserNotification>(loader);

  const handleCreate = useCallback(async () => {
    const values = await form.validateFields();
    await createNotification(values);
    message.success('已发送');
    setOpen(false);
    form.resetFields();
    void ops.fetchData();
  }, [form, ops.fetchData]);

  const handleReadState = useCallback(
    async (record: UserNotification) => {
      await updateNotificationReadState(record.id, !record.isRead);
      message.success(record.isRead ? '已标记未读' : '已标记已读');
      void ops.fetchData();
    },
    [ops.fetchData],
  );

  const columns: ColumnsType<UserNotification> = useMemo(
    () => [
      {
        title: '通知',
        dataIndex: 'title',
        render: (value, record) => (
          <div>
            <div className="font-medium">{value}</div>
            <div className="max-w-2xl whitespace-pre-wrap text-xs text-gray-500">
              {record.content}
            </div>
          </div>
        ),
      },
      { title: '用户', dataIndex: 'userId', width: 180 },
      { title: '类型', dataIndex: 'type', width: 130, render: (value) => <Tag>{value}</Tag> },
      {
        title: '状态',
        dataIndex: 'isRead',
        width: 110,
        render: (value: boolean) =>
          value ? <Tag color="green">已读</Tag> : <Tag color="orange">未读</Tag>,
      },
      { title: '时间', dataIndex: 'createdAt', width: 180, render: formatDateTime },
      {
        title: '操作',
        key: 'action',
        width: 120,
        render: (_, record) => (
          <Button type="link" icon={<CheckOutlined />} onClick={() => handleReadState(record)}>
            {record.isRead ? '未读' : '已读'}
          </Button>
        ),
      },
    ],
    [handleReadState],
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="mb-0 text-2xl font-bold">通知管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          发送通知
        </Button>
      </div>
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {ops.searchTools}
          <Select
            className="w-32"
            value={ops.status || 'all'}
            options={[
              { value: 'all', label: '全部' },
              { value: 'false', label: '未读' },
              { value: 'true', label: '已读' },
            ]}
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
      <Modal
        title="发送通知"
        open={open}
        onOk={handleCreate}
        onCancel={() => setOpen(false)}
        okText="发送"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" initialValues={{ type: 'admin' }}>
          <Form.Item
            name="userId"
            label="用户 ID"
            rules={[{ required: true, message: '请输入用户 ID' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="type" label="类型">
            <Input />
          </Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="content"
            label="内容"
            rules={[{ required: true, message: '请输入内容' }]}
          >
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
