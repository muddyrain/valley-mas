import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, Modal, Space, Switch, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';

interface CreatorRecord {
  id: string;
  name: string;
  code: string;
  resourceCount: number;
  downloadCount: number;
  isActive: boolean;
  createdAt: string;
}

const mockData: CreatorRecord[] = [
  {
    id: '1',
    name: '设计师小王',
    code: 'ABC123',
    resourceCount: 25,
    downloadCount: 580,
    isActive: true,
    createdAt: '2026-01-15',
  },
  {
    id: '2',
    name: '摄影师老李',
    code: 'XYZ789',
    resourceCount: 42,
    downloadCount: 1200,
    isActive: true,
    createdAt: '2026-01-20',
  },
];

export default function Creators() {
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const columns: ColumnsType<CreatorRecord> = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '创作者', dataIndex: 'name' },
    { title: '口令', dataIndex: 'code', render: (code) => <Tag color="blue">{code}</Tag> },
    { title: '资源数', dataIndex: 'resourceCount' },
    { title: '下载量', dataIndex: 'downloadCount' },
    {
      title: '状态',
      dataIndex: 'isActive',
      render: (v) => <Tag color={v ? 'success' : 'default'}>{v ? '启用' : '禁用'}</Tag>,
    },
    { title: '创建时间', dataIndex: 'createdAt' },
    {
      title: '操作',
      key: 'action',
      render: () => (
        <Space>
          <a>编辑</a>
          <a className="text-red-500">删除</a>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">创作者管理</h2>
      <Card>
        <div className="mb-4 flex justify-between">
          <Space>
            <Input placeholder="搜索创作者/口令" prefix={<SearchOutlined />} className="w-64" />
            <Button icon={<SearchOutlined />} type="primary">
              搜索
            </Button>
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
              添加创作者
            </Button>
          </Space>
        </div>
        <Table columns={columns} dataSource={mockData} rowKey="id" />
      </Card>

      <Modal
        title="添加创作者"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="创作者名称" name="name" rules={[{ required: true }]}>
            <Input placeholder="请输入创作者名称" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea placeholder="请输入描述" rows={3} />
          </Form.Item>
          <Form.Item label="口令" name="code" extra="留空则自动生成">
            <Input placeholder="请输入口令（可选）" maxLength={8} />
          </Form.Item>
          <Form.Item label="是否启用" name="isActive" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
