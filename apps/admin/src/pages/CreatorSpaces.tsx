import { CopyOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  message,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { CreatorSpace } from '../api/creator';
import {
  reqCreateSpace,
  reqDeleteSpace,
  reqGetCreatorDetail,
  reqGetSpaceList,
  reqUpdateSpace,
} from '../api/creator';

export default function CreatorSpaces() {
  const { creatorId } = useParams<{ creatorId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<CreatorSpace[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>(undefined);

  const [creatorName, setCreatorName] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'create' | 'edit'>('create');
  const [currentSpace, setCurrentSpace] = useState<CreatorSpace | null>(null);
  const [form] = Form.useForm();

  // 加载创作者信息
  useEffect(() => {
    if (creatorId) {
      reqGetCreatorDetail(creatorId)
        .then((data) => {
          setCreatorName(data.name);
        })
        .catch(() => {
          message.error('加载创作者信息失败');
        });
    }
  }, [creatorId]);

  // 加载空间列表
  const fetchList = useCallback(async () => {
    if (!creatorId) return;

    setLoading(true);
    try {
      const response = await reqGetSpaceList(creatorId, {
        page,
        pageSize,
        keyword: keyword || undefined,
        isActive: statusFilter,
      });
      setDataSource(response.list || []);
      setTotal(response.total || 0);
    } catch {
      message.error('加载空间列表失败');
    } finally {
      setLoading(false);
    }
  }, [creatorId, page, pageSize, keyword, statusFilter]);

  // 初始加载
  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // 搜索
  const handleSearch = () => {
    setPage(1);
    fetchList();
  };

  // 打开创建弹窗
  const handleCreate = () => {
    setModalType('create');
    setCurrentSpace(null);
    form.resetFields();
    setModalOpen(true);
  };

  // 打开编辑弹窗
  const handleEdit = async (record: CreatorSpace) => {
    setModalType('edit');
    setCurrentSpace(record);
    form.setFieldsValue({
      title: record.title,
      description: record.description,
      banner: record.banner,
      code: record.code,
      isActive: record.isActive,
    });
    setModalOpen(true);
  };

  // 提交表单
  const handleSubmit = async () => {
    if (!creatorId) return;

    try {
      const values = await form.validateFields();
      if (modalType === 'create') {
        await reqCreateSpace(creatorId, values);
        message.success('创建成功');
      } else if (currentSpace) {
        await reqUpdateSpace(creatorId, currentSpace.id, values);
        message.success('更新成功');
      }
      setModalOpen(false);
      fetchList();
    } catch {
      message.error(modalType === 'create' ? '创建失败' : '更新失败');
    }
  };

  // 删除空间
  const handleDelete = async (id: string) => {
    if (!creatorId) return;

    try {
      await reqDeleteSpace(creatorId, id);
      message.success('删除成功');
      fetchList();
    } catch {
      message.error('删除失败');
    }
  };

  // 复制口令
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    message.success('口令已复制到剪贴板');
  };

  const columns: ColumnsType<CreatorSpace> = [
    {
      title: '空间名称',
      dataIndex: 'title',
      width: 200,
    },
    {
      title: '口令',
      dataIndex: 'code',
      width: 120,
      render: (code) => (
        <Space>
          <Tag color="blue">{code}</Tag>
          <Tooltip title="复制口令">
            <Button
              type="link"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleCopyCode(code)}
            />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      width: 250,
      ellipsis: true,
    },
    {
      title: '资源数',
      dataIndex: 'resourceCount',
      width: 100,
      render: (count) => count || 0,
    },
    {
      title: '下载量',
      dataIndex: 'downloadCount',
      width: 100,
      render: (count) => count || 0,
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      width: 100,
      render: (isActive) => (
        <Tag color={isActive ? 'success' : 'default'}>{isActive ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (time) => new Date(time).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除该空间吗？"
            description="此操作不可恢复"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" danger size="small">
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Button onClick={() => navigate('/creators')} className="mb-2">
            ← 返回创作者列表
          </Button>
          <h2 className="text-2xl font-bold">{creatorName} - 空间管理</h2>
        </div>
      </div>

      <Card>
        <div className="mb-4 flex justify-between">
          <Space>
            <Input
              placeholder="搜索空间"
              prefix={<SearchOutlined />}
              className="w-64"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={handleSearch}
            />
            <Select
              placeholder="状态筛选"
              className="w-32"
              allowClear
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { label: '全部', value: undefined },
                { label: '启用', value: true },
                { label: '禁用', value: false },
              ]}
            />
            <Button icon={<SearchOutlined />} type="primary" onClick={handleSearch}>
              搜索
            </Button>
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchList}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              创建空间
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={dataSource}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1300 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => {
              setPage(page);
              setPageSize(pageSize);
            },
          }}
        />
      </Card>

      {/* 创建/编辑弹窗 */}
      <Modal
        title={modalType === 'create' ? '创建空间' : '编辑空间'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        width={600}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            label="空间名称"
            name="title"
            rules={[{ required: true, message: '请输入空间名称' }]}
          >
            <Input placeholder="例如：精选头像合集" />
          </Form.Item>

          <Form.Item
            label="口令（选填，留空自动生成4位口令）"
            name="code"
            rules={[{ pattern: /^[a-z0-9]{4}$/, message: '口令必须是4位小写字母或数字' }]}
          >
            <Input placeholder="例如：abc1" maxLength={4} />
          </Form.Item>

          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} placeholder="空间描述" />
          </Form.Item>

          <Form.Item label="横幅图片" name="banner">
            <Input placeholder="横幅图片 URL" />
          </Form.Item>

          <Form.Item label="状态" name="isActive" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
