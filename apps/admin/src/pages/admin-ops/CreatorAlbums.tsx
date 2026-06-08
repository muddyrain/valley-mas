import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { Button, Card, Form, Image, Input, Modal, message, Popconfirm, Space, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useMemo, useState } from 'react';
import {
  type CreatorAlbum,
  deleteCreatorAlbum,
  listCreatorAlbums,
  updateCreatorAlbum,
} from '@/api/operations';
import { formatDateTime, useAdminList } from './shared';

export default function CreatorAlbums() {
  const [form] = Form.useForm();
  const [editing, setEditing] = useState<CreatorAlbum | null>(null);
  const ops = useAdminList<CreatorAlbum>(listCreatorAlbums);

  const handleSubmit = useCallback(async () => {
    if (!editing) return;
    const values = await form.validateFields();
    await updateCreatorAlbum(editing.id, values);
    message.success('已更新');
    setEditing(null);
    void ops.fetchData();
  }, [editing, form, ops.fetchData]);

  const openEdit = useCallback(
    (record: CreatorAlbum) => {
      setEditing(record);
      form.setFieldsValue(record);
    },
    [form],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteCreatorAlbum(id);
      message.success('已删除');
      void ops.fetchData();
    },
    [ops.fetchData],
  );

  const columns: ColumnsType<CreatorAlbum> = useMemo(
    () => [
      {
        title: '封面',
        dataIndex: 'coverResource',
        width: 90,
        render: (cover?: CreatorAlbum['coverResource']) =>
          cover?.url ? (
            <Image src={cover.url} width={56} height={56} className="object-cover" />
          ) : (
            '-'
          ),
      },
      {
        title: '专辑',
        dataIndex: 'name',
        render: (value, record) => (
          <div>
            <div className="font-medium">{value}</div>
            <div className="text-xs text-gray-400">{record.description || '-'}</div>
          </div>
        ),
      },
      {
        title: '创作者',
        dataIndex: 'creator',
        width: 180,
        render: (creator: CreatorAlbum['creator'], record) =>
          creator?.user?.nickname || creator?.code || record.creatorId,
      },
      { title: '更新时间', dataIndex: 'updatedAt', width: 180, render: formatDateTime },
      {
        title: '操作',
        key: 'action',
        width: 180,
        render: (_, record) => (
          <Space>
            <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>
              编辑
            </Button>
            <Popconfirm title="确认删除这个专辑？" onConfirm={() => handleDelete(record.id)}>
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
      <h2 className="mb-6 text-2xl font-bold">创作者专辑</h2>
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
        title="编辑专辑"
        open={Boolean(editing)}
        onOk={handleSubmit}
        onCancel={() => setEditing(null)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
