import { EyeOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import {
  Avatar,
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  message,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type AdminUserOperations, getUserOperations } from '@/api/operations';
import type { User } from '../api/user';
import {
  reqCreateUser,
  reqDeleteUser,
  reqGetUserList,
  reqUpdateUser,
  reqUpdateUserStatus,
} from '../api/user';

const countValue = (value: number | undefined) => value || 0;

export default function Users() {
  const [data, setData] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('新增用户');
  const [form] = Form.useForm();
  const [editId, setEditId] = useState<string | null>(null);
  const [currentPlatform, setCurrentPlatform] = useState('wechat');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [userOperations, setUserOperations] = useState<AdminUserOperations | null>(null);

  // 获取用户列表
  const fetchUsers = useCallback(
    async (page = 1, pageSize = 10, kw = '') => {
      setLoading(true);
      try {
        const res = await reqGetUserList({
          page,
          pageSize,
          keyword: kw,
          platform: platformFilter || undefined,
          role: roleFilter || undefined,
        });
        setData(res.list || []);
        setTotal(res.total || 0);
        setPagination({ current: page, pageSize });
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    },
    [platformFilter, roleFilter],
  );

  // 筛选条件变化时，重置到第一页
  useEffect(() => {
    void fetchUsers(1, pagination.pageSize, keyword);
  }, [fetchUsers, keyword, pagination.pageSize]);

  // 初始加载
  useEffect(() => {
    void fetchUsers(1, 10, '');
  }, [fetchUsers]);

  const handleTableChange = useCallback(
    (pag: TablePaginationConfig) => {
      const current = pag.current || 1;
      const pageSize = pag.pageSize || 10;
      setPagination({ current, pageSize });
      void fetchUsers(current, pageSize, keyword);
    },
    [fetchUsers, keyword],
  );

  const handleSearch = useCallback(() => {
    setPagination({ ...pagination, current: 1 });
    void fetchUsers(1, pagination.pageSize, keyword);
  }, [fetchUsers, keyword, pagination]);

  const toggleStatus = useCallback(
    async (id: string, checked: boolean) => {
      try {
        await reqUpdateUserStatus(id, checked);
        message.success('状态更新成功');
        void fetchUsers();
      } catch (e) {
        console.error('Update status failed', e);
        message.error('状态更新失败');
      }
    },
    [fetchUsers],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await reqDeleteUser(id);
        message.success('删除成功');
        void fetchUsers();
      } catch (e) {
        console.error('Delete failed', e);
        message.error('删除失败');
      }
    },
    [fetchUsers],
  );

  const openModal = useCallback(
    (record?: User) => {
      if (record) {
        setModalTitle('编辑用户');
        setEditId(record.id);
        setCurrentPlatform(record.platform);
        form.setFieldsValue(record);
      } else {
        setModalTitle('新增用户');
        setEditId(null);
        setCurrentPlatform('wechat');
        form.resetFields();
        form.setFieldsValue({ platform: 'wechat', role: 'user', isActive: true });
      }
      setIsModalOpen(true);
    },
    [form],
  );

  const handleModalOk = useCallback(async () => {
    try {
      const values = await form.validateFields();
      if (editId) {
        await reqUpdateUser(editId, values);
        message.success('更新成功');
      } else {
        await reqCreateUser(values);
        message.success('创建成功');
      }
      setIsModalOpen(false);
      void fetchUsers();
    } catch (error) {
      console.error('Submit failed', error);
    }
  }, [editId, fetchUsers, form]);

  const openDetail = useCallback(async (record: User) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      setUserOperations(await getUserOperations(record.id));
    } catch (error) {
      console.error('Load user operations failed', error);
      message.error('加载用户运营详情失败');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // 平台标签渲染
  const renderPlatformTag = useCallback((platform: string) => {
    const platformMap: Record<string, { color: string; text: string }> = {
      wechat: { color: 'green', text: '微信' },
      douyin: { color: 'blue', text: '抖音' },
      mini_app: { color: 'purple', text: '小程序' },
    };
    const info = platformMap[platform] || { color: 'default', text: platform };
    return <Tag color={info.color}>{info.text}</Tag>;
  }, []);

  // 角色标签渲染
  const renderRoleTag = useCallback((role: string) => {
    const roleMap: Record<string, { color: string; text: string }> = {
      user: { color: 'default', text: '普通用户' },
      admin: { color: 'red', text: '管理员' },
      creator: { color: 'orange', text: '创作者' },
    };
    const info = roleMap[role] || { color: 'default', text: role };
    return <Tag color={info.color}>{info.text}</Tag>;
  }, []);

  const columns: ColumnsType<User> = useMemo(
    () => [
      { title: 'ID', dataIndex: 'id', width: 80 },
      {
        title: '用户信息',
        key: 'userInfo',
        width: 150,
        render: (_, record) => (
          <div className="w-full flex items-center">
            <Avatar src={record.avatar} size={40} className="flex-shrink-0">
              {record.nickname?.charAt(0)}
            </Avatar>
            <div className="flex-1 overflow-hidden ml-2">
              <Tooltip title={record.nickname}>
                <div className="font-medium truncate">{record.nickname}</div>
              </Tooltip>
              <Tooltip title={record.username}>
                <div className="text-xs text-gray-400 truncate">
                  {record.username?.slice(0, 20)}
                </div>
              </Tooltip>
            </div>
          </div>
        ),
      },
      {
        title: 'openid',
        dataIndex: 'openid',
        width: 150,
      },
      {
        title: '平台',
        dataIndex: 'platform',
        width: 100,
        render: (platform) => renderPlatformTag(platform),
      },
      {
        title: '角色',
        dataIndex: 'role',
        width: 100,
        render: (role) => renderRoleTag(role),
      },
      {
        title: '状态',
        dataIndex: 'isActive',
        width: 100,
        render: (isActive, record) => (
          <Switch checked={isActive} onChange={(checked) => toggleStatus(record.id, checked)} />
        ),
      },
      {
        title: '注册时间',
        dataIndex: 'createdAt',
        width: 180,
        render: (val) => new Date(val).toLocaleString(),
      },
      {
        title: '操作',
        key: 'action',
        width: 190,
        fixed: 'right',
        render: (_, record) => (
          <Space>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openDetail(record)}
            >
              详情
            </Button>
            <a onClick={() => openModal(record)}>编辑</a>
            <Popconfirm title="确认删除该用户吗？" onConfirm={() => handleDelete(record.id)}>
              <a className="text-red-500">删除</a>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [handleDelete, openDetail, openModal, renderPlatformTag, renderRoleTag, toggleStatus],
  );

  const summary = userOperations?.summary ?? {};
  const lifeTrace = userOperations?.lifeTrace ?? {};

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">用户管理</h2>
      <Card>
        <div className="mb-4 flex justify-between items-center">
          <Space>
            <Input
              placeholder="搜索用户昵称/OpenID"
              prefix={<SearchOutlined />}
              className="w-64"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
            />
            <Select
              placeholder="选择平台"
              className="w-32"
              value={platformFilter}
              onChange={setPlatformFilter}
              allowClear
              options={[
                { value: '', label: '全部平台' },
                { value: 'wechat', label: '微信' },
                { value: 'douyin', label: '抖音' },
                { value: 'mini_app', label: '小程序' },
              ]}
            />
            <Select
              placeholder="选择角色"
              className="w-32"
              value={roleFilter}
              onChange={setRoleFilter}
              allowClear
              options={[
                { value: '', label: '全部角色' },
                { value: 'user', label: '普通用户' },
                { value: 'admin', label: '管理员' },
                { value: 'creator', label: '创作者' },
              ]}
            />
            <Button icon={<SearchOutlined />} type="primary" onClick={handleSearch}>
              搜索
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => void fetchUsers()}>
              刷新
            </Button>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            新增用户
          </Button>
        </div>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title={modalTitle}
        open={isModalOpen}
        onOk={handleModalOk}
        onCancel={() => setIsModalOpen(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="nickname"
            label="昵称"
            rules={[{ required: true, message: '请输入昵称' }]}
          >
            <Input placeholder="请输入用户昵称" />
          </Form.Item>

          <Form.Item name="avatar" label="头像URL">
            <Input placeholder="请输入头像URL" />
          </Form.Item>

          <Form.Item
            name="platform"
            label="平台"
            initialValue="wechat"
            rules={[{ required: true, message: '请选择平台' }]}
          >
            <Select
              onChange={setCurrentPlatform}
              options={[
                { value: 'wechat', label: '微信小程序' },
                { value: 'douyin', label: '抖音小程序' },
                { value: 'mini_app', label: '其他小程序' },
              ]}
            />
          </Form.Item>

          {currentPlatform === 'wechat' && (
            <>
              <Form.Item
                name="wechatOpenid"
                label="微信OpenID"
                rules={[{ required: true, message: '请输入微信OpenID' }]}
              >
                <Input placeholder="微信用户唯一标识" />
              </Form.Item>
              <Form.Item name="wechatUnionid" label="微信UnionID">
                <Input placeholder="微信开放平台唯一标识（可选）" />
              </Form.Item>
            </>
          )}

          {currentPlatform === 'douyin' && (
            <>
              <Form.Item
                name="douyinOpenid"
                label="抖音OpenID"
                rules={[{ required: true, message: '请输入抖音OpenID' }]}
              >
                <Input placeholder="抖音用户唯一标识" />
              </Form.Item>
              <Form.Item name="douyinUnionid" label="抖音UnionID">
                <Input placeholder="抖音开放平台唯一标识（可选）" />
              </Form.Item>
              <Form.Item name="douyinNickname" label="抖音昵称">
                <Input placeholder="抖音昵称" />
              </Form.Item>
              <Form.Item name="douyinGender" label="性别">
                <Select
                  placeholder="选择性别"
                  options={[
                    { value: 0, label: '未知' },
                    { value: 1, label: '男' },
                    { value: 2, label: '女' },
                  ]}
                />
              </Form.Item>
            </>
          )}

          <Form.Item
            name="openid"
            label="通用OpenID"
            rules={[{ required: true, message: '请输入OpenID' }]}
          >
            <Input placeholder="平台用户唯一标识" />
          </Form.Item>

          <Form.Item name="unionid" label="通用UnionID">
            <Input placeholder="开放平台唯一标识（可选）" />
          </Form.Item>

          <Form.Item name="role" label="角色" initialValue="user">
            <Select
              options={[
                { value: 'user', label: '普通用户' },
                { value: 'admin', label: '管理员' },
                { value: 'creator', label: '创作者' },
              ]}
            />
          </Form.Item>

          <Form.Item name="phone" label="手机号">
            <Input placeholder="手机号（可选）" />
          </Form.Item>

          <Form.Item name="email" label="邮箱">
            <Input placeholder="邮箱（可选）" />
          </Form.Item>

          <Form.Item name="isActive" label="状态" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="用户运营详情"
        open={detailOpen}
        width={760}
        onClose={() => setDetailOpen(false)}
        loading={detailLoading}
      >
        {userOperations ? (
          <Tabs
            items={[
              {
                key: 'profile',
                label: '资料',
                children: (
                  <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label="昵称">
                      {userOperations.user.nickname || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="用户名">
                      {userOperations.user.username || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="角色">
                      {userOperations.user.role || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="平台">
                      {userOperations.user.platform || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="OpenID">
                      {userOperations.user.openid || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="注册时间">
                      {userOperations.user.createdAt
                        ? new Date(userOperations.user.createdAt).toLocaleString('zh-CN')
                        : '-'}
                    </Descriptions.Item>
                  </Descriptions>
                ),
              },
              {
                key: 'activity',
                label: '互动',
                children: (
                  <Descriptions column={2} bordered size="small">
                    <Descriptions.Item label="下载">
                      {countValue(summary.downloads)}
                    </Descriptions.Item>
                    <Descriptions.Item label="收藏">
                      {countValue(summary.favorites)}
                    </Descriptions.Item>
                    <Descriptions.Item label="关注">
                      {countValue(summary.follows)}
                    </Descriptions.Item>
                    <Descriptions.Item label="通知">
                      {countValue(summary.notifications)}
                    </Descriptions.Item>
                    <Descriptions.Item label="评论">
                      {countValue(summary.comments)}
                    </Descriptions.Item>
                    <Descriptions.Item label="留言">
                      {countValue(summary.guestbook)}
                    </Descriptions.Item>
                  </Descriptions>
                ),
              },
              {
                key: 'notifications',
                label: '通知',
                children: (
                  <Table
                    size="small"
                    rowKey="id"
                    dataSource={userOperations.notifications}
                    pagination={false}
                    columns={[
                      { title: '标题', dataIndex: 'title' },
                      { title: '类型', dataIndex: 'type', width: 120 },
                      {
                        title: '状态',
                        dataIndex: 'isRead',
                        width: 90,
                        render: (value: boolean) => (value ? '已读' : '未读'),
                      },
                    ]}
                  />
                ),
              },
              {
                key: 'comments',
                label: '留言/评论',
                children: (
                  <Space direction="vertical" className="w-full">
                    <Table
                      size="small"
                      rowKey="id"
                      dataSource={userOperations.comments}
                      pagination={false}
                      columns={[
                        { title: '评论', dataIndex: 'content' },
                        { title: '文章', dataIndex: ['post', 'title'], width: 180 },
                      ]}
                    />
                    <Table
                      size="small"
                      rowKey="id"
                      dataSource={userOperations.guestbookMessages}
                      pagination={false}
                      columns={[
                        { title: '留言', dataIndex: 'content' },
                        { title: '状态', dataIndex: 'status', width: 100 },
                      ]}
                    />
                  </Space>
                ),
              },
              {
                key: 'lifeTrace',
                label: 'Life Trace',
                children: (
                  <Descriptions column={2} bordered size="small">
                    <Descriptions.Item label="计划">
                      {countValue(lifeTrace.plans)}
                    </Descriptions.Item>
                    <Descriptions.Item label="踪迹">
                      {countValue(lifeTrace.traces)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Pantry">
                      {countValue(lifeTrace.pantryItems)}
                    </Descriptions.Item>
                    <Descriptions.Item label="AI 对话">
                      {countValue(lifeTrace.aiConversations)}
                    </Descriptions.Item>
                  </Descriptions>
                ),
              },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
}
