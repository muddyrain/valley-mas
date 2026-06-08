import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  message,
  Popconfirm,
  Space,
  Table,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useMemo, useState } from 'react';
import {
  createResourceTag,
  deleteResourceTag,
  listResourceTags,
  type ResourceTag,
  updateResourceTag,
} from '@/api/operations';
import { formatDateTime, useAdminList } from './shared';

export default function ResourceTags() {
  const [form] = Form.useForm();
  const [editing, setEditing] = useState<ResourceTag | null>(null);
  const [open, setOpen] = useState(false);
  const ops = useAdminList<ResourceTag>(listResourceTags);

  const handleSubmit = useCallback(async () => {
    const values = await form.validateFields();
    if (editing) await updateResourceTag(editing.id, values);
    else await createResourceTag(values);
    message.success(editing ? '已更新' : '已创建');
    setOpen(false);
    void ops.fetchData();
  }, [editing, form, ops.fetchData]);

  const openEdit = useCallback(
    (record: ResourceTag) => {
      setEditing(record);
      form.setFieldsValue(record);
      setOpen(true);
    },
    [form],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteResourceTag(id);
      message.success('已删除');
      void ops.fetchData();
    },
    [ops.fetchData],
  );

  const columns: ColumnsType<ResourceTag> = useMemo(
    () => [
      { title: '名称', dataIndex: 'name' },
      { title: '说明', dataIndex: 'description', render: (value?: string) => value || '-' },
      { title: '资源数', dataIndex: 'resourceCount', width: 100 },
      { title: '创建时间', dataIndex: 'createdAt', width: 180, render: formatDateTime },
      {
        title: '操作',
        key: 'action',
        width: 180,
        render: (_, record) => (
          <Space>
            <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>
              编辑
            </Button>
            <Popconfirm title="确认删除这个标签？" onConfirm={() => handleDelete(record.id)}>
              <Button type="link" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [handleDelete, openEdit],
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="mb-0 text-2xl font-bold">资源标签</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditing(null);
            form.resetFields();
            setOpen(true);
          }}
        >
          新建标签
        </Button>
      </div>
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
      <Modal
        title={editing ? '编辑标签' : '新建标签'}
        open={open}
        onOk={handleSubmit}
        onCancel={() => setOpen(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input maxLength={30} />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={3} maxLength={100} />
          </Form.Item>
          <Form.Item name="resourceCount" label="资源数">
            <InputNumber className="w-full" disabled />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
