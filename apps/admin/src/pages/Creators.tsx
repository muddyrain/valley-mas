import {
  AppstoreOutlined,
  CopyOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
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
import { useNavigate } from 'react-router-dom';
import type { Creator } from '../api/creator';
import {
  reqCreateCreator,
  reqDeleteCreator,
  reqGetCreatorDetail,
  reqGetCreatorList,
  reqToggleCreatorStatus,
  reqUpdateCreator,
} from '../api/creator';
import type { User } from '../api/user';
import { reqGetUserList } from '../api/user';

export default function Creators() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<Creator[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>(undefined);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'create' | 'edit'>('create');
  const [currentCreator, setCurrentCreator] = useState<Creator | null>(null);

  // 获取当前用户信息
  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  const isCreator = userInfo.role === 'creator';
  const [form] = Form.useForm();

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailData, setDetailData] = useState<Creator | null>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // 加载创作者列表
  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const response = await reqGetCreatorList({
        page,
        pageSize,
        keyword: keyword || undefined,
        isActive: statusFilter,
      });

      // 如果是创作者角色,只显示自己的数据
      let list = response.list || [];
      if (isCreator && userInfo.id) {
        list = list.filter((creator) => creator.userId === userInfo.id);
      }

      setDataSource(list);
      setTotal(isCreator ? list.length : response.total || 0);
    } catch {
      message.error('加载创作者列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, statusFilter, isCreator, userInfo.id]);

  // 加载用户列表（用于创建创作者时选择用户）
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await reqGetUserList({ page: 1, pageSize: 100 });
      setUsers(response.list || []);
    } catch {
      message.error('加载用户列表失败');
    } finally {
      setLoadingUsers(false);
    }
  };

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
    setCurrentCreator(null);
    form.resetFields();
    fetchUsers();
    setModalOpen(true);
  };

  // 打开编辑弹窗
  const handleEdit = async (record: Creator) => {
    setModalType('edit');
    setCurrentCreator(record);
    form.setFieldsValue({
      userId: record.userId,
      name: record.name,
      description: record.description,
      avatar: record.avatar,
      code: record.code,
      isActive: record.isActive,
    });
    setModalOpen(true);
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (modalType === 'create') {
        await reqCreateCreator(values);
        message.success('创建成功');
      } else if (currentCreator) {
        await reqUpdateCreator(currentCreator.id, values);
        message.success('更新成功');
      }
      setModalOpen(false);
      fetchList();
    } catch {
      message.error(modalType === 'create' ? '创建失败' : '更新失败');
    }
  };

  // 删除创作者
  const handleDelete = async (id: string) => {
    try {
      await reqDeleteCreator(id);
      message.success('删除成功');
      fetchList();
    } catch {
      message.error('删除失败');
    }
  };

  // 切换状态
  const handleToggleStatus = async (record: Creator) => {
    try {
      await reqToggleCreatorStatus(record.id);
      message.success('状态更新成功');
      fetchList();
    } catch {
      message.error('状态更新失败');
    }
  };

  // 复制口令
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    message.success('口令已复制到剪贴板');
  };

  // 查看详情
  const handleViewDetail = async (id: string) => {
    try {
      const data = await reqGetCreatorDetail(id);
      setDetailData(data);
      setDetailModalOpen(true);
    } catch {
      message.error('加载详情失败');
    }
  };

  const columns: ColumnsType<Creator> = [
    {
      title: '创作者信息',
      dataIndex: 'name',
      width: 200,
      render: (name, record) => (
        <div className="w-full flex flex-col">
          <Tooltip title={`创作者名称: ${name}`}>
            <div className="font-medium truncate">{name}</div>
          </Tooltip>
          <Tooltip title={`创作者ID: ${record.id}`}>
            <div className="text-xs text-blue-500 truncate">ID: {record.id}</div>
          </Tooltip>
        </div>
      ),
    },
    {
      title: '关联账号',
      dataIndex: 'username',
      width: 200,
      render: (username, record) => (
        <div className="w-full flex flex-col">
          <Tooltip title={`用户昵称: ${record.userNickname}`}>
            <div className="font-medium truncate">{record.userNickname}</div>
          </Tooltip>
          <Tooltip title={`账号: ${username}`}>
            <div className="text-xs text-gray-400 truncate">{username?.slice(0, 20)}</div>
          </Tooltip>
          <Tooltip title={`用户ID: ${record.userId}`}>
            <div className="text-xs text-green-600 truncate">User ID: {record.userId}</div>
          </Tooltip>
        </div>
      ),
    },
    {
      title: '口令',
      dataIndex: 'code',
      width: 150,
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
      width: 200,
      ellipsis: true,
    },
    {
      title: '空间数',
      dataIndex: 'spaceCount',
      width: 100,
      render: (count) => count || 0,
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
      render: (isActive, record) =>
        isCreator ? (
          <Tag color={isActive ? 'green' : 'red'}>{isActive ? '启用' : '禁用'}</Tag>
        ) : (
          <Switch
            checked={isActive}
            onChange={() => handleToggleStatus(record)}
            checkedChildren="启用"
            unCheckedChildren="禁用"
          />
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
      width: 250,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          {!isCreator && (
            <Tooltip title="查看详情">
              <Button
                type="link"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handleViewDetail(record.id)}
              />
            </Tooltip>
          )}
          <Tooltip title="管理空间">
            <Button
              type="link"
              size="small"
              icon={<AppstoreOutlined />}
              onClick={() => navigate(`/creators/${record.id}/spaces`)}
            >
              空间
            </Button>
          </Tooltip>
          {!isCreator && (
            <>
              <Button type="link" size="small" onClick={() => handleEdit(record)}>
                编辑
              </Button>
              <Popconfirm
                title="确定要删除该创作者吗？"
                description="此操作不可恢复"
                onConfirm={() => handleDelete(record.id)}
              >
                <Button type="link" danger size="small">
                  删除
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">{isCreator ? '我的空间管理' : '创作者管理'}</h2>
      <Card>
        <div className="mb-4 flex justify-between">
          <Space>
            {!isCreator && (
              <>
                <Input
                  placeholder="搜索创作者"
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
              </>
            )}
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchList}>
              刷新
            </Button>
            {!isCreator && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                添加创作者
              </Button>
            )}
          </Space>
        </div>
        <Table
          columns={columns}
          dataSource={dataSource}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1700 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
      </Card>

      {/* 创建/编辑弹窗 */}
      <Modal
        title={modalType === 'create' ? '添加创作者' : '编辑创作者'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        width={600}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          {modalType === 'create' && (
            <Form.Item
              label="选择用户"
              name="userId"
              rules={[{ required: true, message: '请选择用户' }]}
            >
              <Select
                placeholder="请选择用户"
                loading={loadingUsers}
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={users.map((u) => ({
                  value: u.id,
                  label: `${u.nickname} (${u.platform})`,
                }))}
              />
            </Form.Item>
          )}

          <Form.Item
            label="创作者名称"
            name="name"
            rules={[{ required: true, message: '请输入创作者名称' }]}
          >
            <Input placeholder="请输入创作者名称" maxLength={50} />
          </Form.Item>

          <Form.Item label="描述" name="description">
            <Input.TextArea placeholder="请输入描述" rows={3} maxLength={255} />
          </Form.Item>

          <Form.Item label="头像 URL" name="avatar">
            <Input placeholder="请输入头像 URL（可选）" />
          </Form.Item>

          <Form.Item label="口令" name="code" extra="留空则自动生成 4 位字母数字组合">
            <Input placeholder="请输入口令（可选）" maxLength={20} />
          </Form.Item>

          <Form.Item label="是否启用" name="isActive" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情弹窗 */}
      <Modal
        title="创作者详情"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        {detailData && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-gray-500 text-sm mb-1">创作者 ID</div>
                <div className="font-medium text-blue-600">{detailData.id}</div>
              </div>
              <div>
                <div className="text-gray-500 text-sm mb-1">关联用户 ID</div>
                <div className="font-medium text-green-600">{detailData.userId}</div>
              </div>
              <div>
                <div className="text-gray-500 text-sm mb-1">创作者名称</div>
                <div className="font-medium">{detailData.name}</div>
              </div>
              <div>
                <div className="text-gray-500 text-sm mb-1">口令</div>
                <div className="flex items-center">
                  <Tag color="blue">{detailData.code}</Tag>
                  <Button
                    type="link"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => handleCopyCode(detailData.code)}
                  />
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-sm mb-1">状态</div>
                <div>
                  <Tag color={detailData.isActive ? 'success' : 'default'}>
                    {detailData.isActive ? '启用' : '禁用'}
                  </Tag>
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-sm mb-1">空间数量</div>
                <div className="font-medium">{detailData.spaceCount || 0}</div>
              </div>
              <div>
                <div className="text-gray-500 text-sm mb-1">资源数量</div>
                <div className="font-medium">{detailData.resourceCount || 0}</div>
              </div>
              <div>
                <div className="text-gray-500 text-sm mb-1">下载量</div>
                <div className="font-medium">{detailData.downloadCount || 0}</div>
              </div>
            </div>

            {detailData.description && (
              <div>
                <div className="text-gray-500 text-sm mb-1">描述</div>
                <div className="text-gray-700">{detailData.description}</div>
              </div>
            )}

            {detailData.avatar && (
              <div>
                <div className="text-gray-500 text-sm mb-1">头像</div>
                <img
                  src={detailData.avatar}
                  alt="avatar"
                  className="w-20 h-20 rounded-full object-cover"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <div className="text-gray-500 text-sm mb-1">创建时间</div>
                <div className="text-gray-700 text-sm">
                  {new Date(detailData.createdAt).toLocaleString('zh-CN')}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-sm mb-1">更新时间</div>
                <div className="text-gray-700 text-sm">
                  {new Date(detailData.updatedAt).toLocaleString('zh-CN')}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
