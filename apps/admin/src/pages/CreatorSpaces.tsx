import {
  AppstoreOutlined,
  CopyOutlined,
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
  Transfer,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { CreatorSpace } from '../api/creator';
import {
  reqAddResourcesToSpace,
  reqCreateSpace,
  reqDeleteSpace,
  reqGetCreatorDetail,
  reqGetSpaceDetail,
  reqGetSpaceList,
  reqRemoveResourcesFromSpace,
  reqUpdateSpace,
} from '../api/creator';
import { type Resource, reqGetResourceList } from '../api/resource';

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

  // 资源管理相关状态
  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [allResources, setAllResources] = useState<Resource[]>([]);
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);

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

  // 打开资源管理弹窗
  const handleManageResources = async (space: CreatorSpace) => {
    if (!creatorId) return;

    setCurrentSpace(space);
    setResourceLoading(true);
    setResourceModalOpen(true);

    try {
      // 并发加载：空间详情（含已关联资源）+ 该创作者的所有资源
      const [spaceDetail, resourceList] = await Promise.all([
        reqGetSpaceDetail(creatorId, space.id),
        reqGetResourceList({
          page: 1,
          pageSize: 1000,
          creatorId: creatorId, // 只加载该创作者的资源
        }),
      ]);

      // 过滤并设置资源（只显示该创作者的资源）
      const creatorResources = (resourceList.list || []).filter((r) => r.creatorId === creatorId);
      setAllResources(creatorResources);

      // 设置已选中的资源ID
      const selectedIds = (spaceDetail.resources || []).map((r) => r.id);
      setSelectedResourceIds(selectedIds);
    } catch {
      message.error('加载资源列表失败');
      setResourceModalOpen(false);
    } finally {
      setResourceLoading(false);
    }
  };

  // 保存资源关联
  const handleSaveResources = async () => {
    if (!creatorId || !currentSpace) return;

    setResourceLoading(true);
    try {
      // 获取当前空间的资源
      const spaceDetail = await reqGetSpaceDetail(creatorId, currentSpace.id);
      const currentResourceIds = (spaceDetail.resources || []).map((r) => r.id);

      // 计算要添加和移除的资源
      const toAdd = selectedResourceIds.filter((id) => !currentResourceIds.includes(id));
      const toRemove = currentResourceIds.filter((id) => !selectedResourceIds.includes(id));

      // 执行添加和移除操作
      const promises = [];
      if (toAdd.length > 0) {
        promises.push(reqAddResourcesToSpace(creatorId, currentSpace.id, toAdd));
      }
      if (toRemove.length > 0) {
        promises.push(reqRemoveResourcesFromSpace(creatorId, currentSpace.id, toRemove));
      }

      if (promises.length > 0) {
        await Promise.all(promises);
        message.success('保存成功');
      } else {
        message.info('没有变更');
      }

      setResourceModalOpen(false);
      fetchList(); // 刷新列表
    } catch {
      message.error('保存失败');
    } finally {
      setResourceLoading(false);
    }
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
      width: 250,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<AppstoreOutlined />}
            onClick={() => handleManageResources(record)}
          >
            管理资源
          </Button>
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
            label="口令（选填，留空自动生成6位口令）"
            name="code"
            rules={[{ pattern: /^[A-Z0-9]{6}$/, message: '口令必须是6位大写字母或数字' }]}
          >
            <Input
              placeholder="例如：ABC123 或 ABCDEF 或 123456"
              maxLength={6}
              style={{ textTransform: 'uppercase' }}
            />
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

      {/* 资源管理弹窗 */}
      <Modal
        title={`管理空间资源 - ${currentSpace?.title || ''}`}
        open={resourceModalOpen}
        onOk={handleSaveResources}
        onCancel={() => setResourceModalOpen(false)}
        width={800}
        confirmLoading={resourceLoading}
      >
        <div className="mt-4">
          <p className="mb-4 text-gray-600">选择要关联到此空间的资源（仅显示该创作者上传的资源）</p>
          <Transfer
            dataSource={allResources.map((r) => ({
              key: r.id,
              title: r.title,
              description: `类型: ${r.type === 'avatar' ? '头像' : '壁纸'} | 大小: ${(r.size / 1024 / 1024).toFixed(2)}MB`,
            }))}
            targetKeys={selectedResourceIds}
            onChange={(targetKeys) => setSelectedResourceIds(targetKeys as string[])}
            render={(item) => (
              <div>
                <div>{item.title}</div>
                <div className="text-xs text-gray-400">{item.description}</div>
              </div>
            )}
            listStyle={{
              width: 350,
              height: 400,
            }}
            showSearch
            filterOption={(inputValue, item) =>
              item.title?.toLowerCase().includes(inputValue.toLowerCase())
            }
            locale={{
              itemUnit: '项',
              itemsUnit: '项',
              searchPlaceholder: '搜索资源',
              notFoundContent: '列表为空',
            }}
          />
          <div className="mt-4 text-sm text-gray-500">
            已选择 {selectedResourceIds.length} 个资源
          </div>
        </div>
      </Modal>
    </div>
  );
}
