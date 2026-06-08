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
  Select,
  Space,
  Table,
  Tabs,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useMemo, useState } from 'react';
import {
  type BlogCategory,
  type BlogGroup,
  type BlogTag,
  createBlogCategory,
  createBlogGroup,
  createBlogTag,
  deleteBlogCategory,
  deleteBlogGroup,
  deleteBlogTag,
  listBlogCategories,
  listBlogGroups,
  listBlogTags,
  updateBlogCategory,
  updateBlogGroup,
  updateBlogTag,
} from '@/api/operations';
import { formatDateTime, useAdminList } from './shared';

type TaxonomyKind = 'categories' | 'tags' | 'groups';

const titleMap: Record<TaxonomyKind, string> = {
  categories: '博客分类',
  tags: '博客标签',
  groups: '博客分组',
};

export default function BlogTaxonomy({ kind }: { kind: TaxonomyKind }) {
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BlogCategory | BlogTag | BlogGroup | null>(null);

  const loader = useCallback(
    async (params: Parameters<typeof listBlogCategories>[0]) => {
      if (kind === 'tags') return listBlogTags(params);
      if (kind === 'groups') {
        const list = await listBlogGroups({ groupType: params.type });
        return { list, total: list.length, page: 1, pageSize: list.length || 20 };
      }
      return listBlogCategories(params);
    },
    [kind],
  );

  const ops = useAdminList<BlogCategory | BlogTag | BlogGroup>(loader);

  const openCreate = useCallback(() => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ groupType: 'blog', sortOrder: 0 });
    setModalOpen(true);
  }, [form]);

  const openEdit = useCallback(
    (record: BlogCategory | BlogTag | BlogGroup) => {
      setEditing(record);
      form.setFieldsValue(record);
      setModalOpen(true);
    },
    [form],
  );

  const handleSubmit = useCallback(async () => {
    const values = await form.validateFields();
    if (kind === 'categories') {
      if (editing) await updateBlogCategory(editing.id, values);
      else await createBlogCategory(values);
    } else if (kind === 'tags') {
      if (editing) await updateBlogTag(editing.id, values);
      else await createBlogTag(values);
    } else if (editing) {
      await updateBlogGroup(editing.id, values);
    } else {
      await createBlogGroup(values);
    }
    message.success(editing ? '已更新' : '已创建');
    setModalOpen(false);
    void ops.fetchData();
  }, [editing, form, kind, ops.fetchData]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (kind === 'categories') await deleteBlogCategory(id);
      else if (kind === 'tags') await deleteBlogTag(id);
      else await deleteBlogGroup(id);
      message.success('已删除');
      void ops.fetchData();
    },
    [kind, ops.fetchData],
  );

  const columns: ColumnsType<BlogCategory | BlogTag | BlogGroup> = useMemo(
    () => [
      {
        title: '名称',
        dataIndex: 'name',
        render: (value, record) => (
          <div>
            <div className="font-medium">{value}</div>
            <div className="font-mono text-xs text-gray-400">{record.slug}</div>
          </div>
        ),
      },
      ...(kind === 'groups'
        ? [
            {
              title: '类型',
              dataIndex: 'groupType',
              width: 120,
              render: (value: string) => (
                <Tag color={value === 'image_text' ? 'magenta' : 'blue'}>
                  {value === 'image_text' ? '图文' : '博客'}
                </Tag>
              ),
            },
          ]
        : []),
      {
        title: '说明',
        dataIndex: 'description',
        ellipsis: true,
        render: (value?: string) => value || '-',
      },
      {
        title: '内容数',
        dataIndex: 'postCount',
        width: 100,
        render: (value?: number) => value ?? 0,
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        width: 180,
        render: formatDateTime,
      },
      {
        title: '操作',
        key: 'action',
        width: 160,
        render: (_, record) => (
          <Space>
            <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>
              编辑
            </Button>
            <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
              <Button type="link" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [handleDelete, kind, openEdit],
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="mb-0 text-2xl font-bold">{titleMap[kind]}</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新建
        </Button>
      </div>
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {kind === 'groups' ? (
            <Tabs
              activeKey={ops.type || ''}
              onChange={(key) => ops.updateQuery({ type: key || undefined, page: 1 })}
              items={[
                { key: '', label: '全部' },
                { key: 'blog', label: '博客' },
                { key: 'image_text', label: '图文' },
              ]}
            />
          ) : (
            ops.searchTools
          )}
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
        title={editing ? '编辑条目' : '新建条目'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="slug"
            label="标识"
            rules={[{ required: kind !== 'groups', message: '请输入标识' }]}
          >
            <Input disabled={kind === 'groups'} />
          </Form.Item>
          {kind === 'groups' ? (
            <Form.Item name="groupType" label="类型">
              <Select
                options={[
                  { value: 'blog', label: '博客' },
                  { value: 'image_text', label: '图文' },
                ]}
              />
            </Form.Item>
          ) : null}
          {kind !== 'tags' ? (
            <Form.Item name="description" label="说明">
              <Input.TextArea rows={3} />
            </Form.Item>
          ) : null}
          {kind === 'categories' || kind === 'groups' ? (
            <Form.Item name="sortOrder" label="排序">
              <InputNumber className="w-full" />
            </Form.Item>
          ) : null}
        </Form>
      </Modal>
    </div>
  );
}
