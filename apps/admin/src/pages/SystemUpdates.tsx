import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Form, Input, Modal, message, Popconfirm, Select, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import {
  reqCreateSystemUpdate,
  reqDeleteSystemUpdate,
  reqGetSystemUpdateList,
  reqUpdateSystemUpdate,
  type SaveSystemUpdatePayload,
  type SystemUpdateItem,
  type SystemUpdateStatus,
} from '@/api/system-update';

const statusOptions = [
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
];

export default function SystemUpdates() {
  const [form] = Form.useForm<SaveSystemUpdatePayload>();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<SystemUpdateItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<SystemUpdateStatus | ''>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SystemUpdateItem | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const response = await reqGetSystemUpdateList({
        page,
        pageSize,
        keyword: keyword || undefined,
        status: statusFilter || undefined,
      });
      setData(response.list || []);
      setTotal(response.total || 0);
    } catch {
      message.error('获取系统更新日志失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, statusFilter]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const openCreateModal = () => {
    setEditingItem(null);
    form.setFieldsValue({
      title: '',
      content: '',
      status: 'draft',
    });
    setModalOpen(true);
  };

  const openEditModal = (item: SystemUpdateItem) => {
    setEditingItem(item);
    form.setFieldsValue({
      title: item.title,
      content: item.content,
      status: item.status,
      publishedAt: item.publishedAt,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload: SaveSystemUpdatePayload = {
        title: values.title,
        content: values.content,
        status: values.status,
      };

      if (values.status === 'published') {
        payload.publishedAt = editingItem?.publishedAt || new Date().toISOString();
      }

      setSubmitting(true);
      if (editingItem) {
        await reqUpdateSystemUpdate(editingItem.id, payload);
        message.success('更新成功');
      } else {
        await reqCreateSystemUpdate(payload);
        message.success('创建成功');
      }
      setModalOpen(false);
      await fetchList();
    } catch {
      // antd 表单会提示
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await reqDeleteSystemUpdate(id);
      message.success('删除成功');
      await fetchList();
    } catch {
      message.error('删除失败');
    }
  };

  const columns: ColumnsType<SystemUpdateItem> = [
    {
      title: '标题',
      dataIndex: 'title',
      width: 260,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: SystemUpdateStatus) =>
        value === 'published' ? <Tag color="green">已发布</Tag> : <Tag>草稿</Tag>,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 180,
      render: (value: string) => new Date(value).toLocaleString('zh-CN'),
    },
    {
      title: '发布时间',
      dataIndex: 'publishedAt',
      width: 180,
      render: (value?: string) => (value ? new Date(value).toLocaleString('zh-CN') : '-'),
    },
    {
      title: '内容',
      dataIndex: 'content',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      width: 170,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除这条更新日志吗？"
            okText="删除"
            cancelText="取消"
            onConfirm={() => void handleDelete(record.id)}
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          allowClear
          placeholder="搜索标题或内容"
          prefix={<SearchOutlined />}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={() => {
            setPage(1);
            void fetchList();
          }}
          style={{ width: 260 }}
        />
        <Select
          allowClear
          placeholder="状态筛选"
          options={statusOptions}
          value={statusFilter || undefined}
          onChange={(value) => {
            setStatusFilter((value as SystemUpdateStatus) || '');
            setPage(1);
          }}
          style={{ width: 140 }}
        />
        <Button
          onClick={() => {
            setPage(1);
            void fetchList();
          }}
        >
          查询
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
          新增更新
        </Button>
      </div>

      <Table<SystemUpdateItem>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={data}
        scroll={{ x: 1100 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (value) => `共 ${value} 条`,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          },
        }}
      />

      <Modal
        title={editingItem ? '编辑系统更新' : '新增系统更新'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleSave()}
        confirmLoading={submitting}
        destroyOnClose
        width={700}
        okText={editingItem ? '保存' : '创建'}
        cancelText="取消"
      >
        <Form<SaveSystemUpdatePayload> form={form} layout="vertical">
          <Form.Item
            name="title"
            label="更新标题"
            rules={[{ required: true, message: '请输入更新标题' }]}
          >
            <Input maxLength={120} showCount placeholder="例如：资源页新增标签筛选" />
          </Form.Item>

          <Form.Item
            name="content"
            label="更新内容"
            rules={[{ required: true, message: '请输入更新内容' }]}
          >
            <Input.TextArea
              rows={6}
              maxLength={2000}
              showCount
              placeholder="这里写面向用户的更新说明，不要写文件名和内部实现细节。"
            />
          </Form.Item>

          <Form.Item
            name="status"
            label="发布状态"
            rules={[{ required: true, message: '请选择发布状态' }]}
            initialValue="draft"
          >
            <Select options={statusOptions} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
