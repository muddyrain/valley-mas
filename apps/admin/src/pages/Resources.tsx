import {
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
  UploadOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import { formatFileSize } from '@valley/shared';
import type { UploadFile, UploadProps } from 'antd';
import {
  Button,
  Card,
  Form,
  Image,
  Input,
  Modal,
  message,
  Select,
  Space,
  Table,
  Tag,
  Upload,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import { UserCardInfo } from '@/components/UserCardInfo';
import { type Creator, reqGetCreatorList } from '../api/creator';
import {
  type Resource,
  type ResourceType,
  type ResourceVisibility,
  reqDeleteResource,
  reqGetResourceList,
  reqUpdateResource,
  reqUpdateResourceCreator,
  reqUploadResource,
} from '../api/resource';
import { reqGetUserList } from '../api/user';

const visibilityOptions = [
  { label: '私密', value: 'private' },
  { label: '共享', value: 'shared' },
  { label: '公开', value: 'public' },
] satisfies Array<{ label: string; value: ResourceVisibility }>;

const visibilityColorMap: Record<ResourceVisibility, string> = {
  private: 'default',
  shared: 'cyan',
  public: 'green',
};

export default function Resources() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Resource[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [typeFilter, setTypeFilter] = useState<ResourceType | ''>('');
  const [keyword, setKeyword] = useState('');
  const [creatorIdFilter, setCreatorIdFilter] = useState('');
  const [creators, setCreators] = useState<Creator[]>([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadType, setUploadType] = useState<ResourceType>('avatar');
  const [uploadVisibility, setUploadVisibility] = useState<ResourceVisibility>('private');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [creatorModalOpen, setCreatorModalOpen] = useState(false);
  const [currentResource, setCurrentResource] = useState<Resource | null>(null);
  const [creatorForm] = Form.useForm();
  const [users, setUsers] = useState<Array<{ id: string; nickname: string }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  const isCreator = userInfo.role === 'creator';

  useEffect(() => {
    if (isCreator) return;

    const fetchCreators = async () => {
      try {
        const response = await reqGetCreatorList({ page: 1, pageSize: 1000 });
        setCreators(response.list || []);
      } catch (error) {
        console.error('Failed to load creators:', error);
      }
    };

    void fetchCreators();
  }, [isCreator]);

  const fetchResources = useCallback(async () => {
    setLoading(true);
    try {
      const params: {
        page: number;
        pageSize: number;
        type?: ResourceType;
        keyword?: string;
        uploaderId?: string;
      } = { page, pageSize };

      if (typeFilter) params.type = typeFilter;
      if (keyword) params.keyword = keyword;
      if (!isCreator && creatorIdFilter) params.uploaderId = creatorIdFilter;

      const response = await reqGetResourceList(params);
      setData(response.list || []);
      setTotal(response.total || 0);
    } catch (error) {
      console.error('Failed to load resources:', error);
      message.error('获取资源列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, typeFilter, keyword, creatorIdFilter, isCreator]);

  useEffect(() => {
    void fetchResources();
  }, [fetchResources]);

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这个资源吗？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await reqDeleteResource(id);
          message.success('删除成功');
          void fetchResources();
        } catch (error) {
          console.error('Failed to delete resource:', error);
          message.error('删除失败');
        }
      },
    });
  };

  const uploadProps: UploadProps = {
    fileList,
    onChange: ({ fileList }) => setFileList(fileList),
    beforeUpload: (file) => {
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        message.error('只能上传图片文件');
        return false;
      }

      const maxSize = uploadType === 'avatar' ? 2 : 5;
      const isLt = file.size / 1024 / 1024 < maxSize;
      if (!isLt) {
        message.error(`文件大小不能超过 ${maxSize}MB`);
        return false;
      }

      setFileList([file]);
      return false;
    },
    onRemove: () => setFileList([]),
  };

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.error('请选择文件');
      return;
    }

    const file = fileList[0].originFileObj;
    if (!file) {
      message.error('文件无效');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', uploadType);
    formData.append('visibility', uploadVisibility);

    setUploading(true);
    try {
      await reqUploadResource(formData);
      message.success('上传成功');
      setUploadModalOpen(false);
      setFileList([]);
      setUploadVisibility('private');
      void fetchResources();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const openCreatorModal = async (resource: Resource) => {
    setCurrentResource(resource);
    creatorForm.setFieldsValue({ uploaderId: resource.user?.id });
    setCreatorModalOpen(true);

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

  const handleUpdateCreator = async () => {
    if (!currentResource) return;

    try {
      const values = await creatorForm.validateFields();
      await reqUpdateResourceCreator(currentResource.id, values.uploaderId);
      message.success('上传者更新成功');
      setCreatorModalOpen(false);
      void fetchResources();
    } catch (error) {
      console.error('Failed to update creator:', error);
      message.error('更新失败');
    }
  };

  const handleVisibilityChange = async (resource: Resource, visibility: ResourceVisibility) => {
    try {
      await reqUpdateResource(resource.id, { visibility });
      message.success('可见范围已更新');
      setData((prev) =>
        prev.map((item) => (item.id === resource.id ? { ...item, visibility } : item)),
      );
    } catch (error) {
      console.error('Failed to update resource visibility:', error);
      message.error('更新可见范围失败');
    }
  };

  const columns: ColumnsType<Resource> = [
    {
      title: '预览',
      dataIndex: 'url',
      width: 100,
      render: (url) => (
        <Image
          src={url}
          width={60}
          height={60}
          style={{ objectFit: 'cover', borderRadius: 4 }}
          fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
        />
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      width: 240,
      render: (title) => title || '未命名资源',
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      render: (value: ResourceType) => (
        <Tag color={value === 'avatar' ? 'blue' : 'purple'}>
          {value === 'avatar' ? '头像' : '壁纸'}
        </Tag>
      ),
    },
    {
      title: '可见范围',
      dataIndex: 'visibility',
      width: 140,
      render: (value: ResourceVisibility, record) => (
        <Select
          size="small"
          value={value || 'private'}
          options={visibilityOptions}
          onChange={(nextValue) => handleVisibilityChange(record, nextValue)}
          popupMatchSelectWidth={false}
        />
      ),
    },
    {
      title: '上传者',
      dataIndex: 'user',
      width: 160,
      render: (user) => {
        if (!user) return <span className="text-gray-400">未知</span>;
        return <UserCardInfo user={user} />;
      },
    },
    {
      title: '存储目录',
      dataIndex: 'storageKey',
      width: 280,
      ellipsis: true,
      render: (key?: string) => {
        if (!key) return <span className="text-gray-400">-</span>;
        const lastSlash = key.lastIndexOf('/');
        const directory = lastSlash > 0 ? key.substring(0, lastSlash) : key;
        return (
          <span className="font-mono text-xs text-gray-600" title={key}>
            {directory}
          </span>
        );
      },
    },
    {
      title: '大小',
      dataIndex: 'size',
      width: 100,
      render: (size) => formatFileSize(size),
    },
    {
      title: '下载量',
      dataIndex: 'downloadCount',
      width: 100,
      render: (count) => count ?? 0,
    },
    {
      title: '上传时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (date) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Tag color={visibilityColorMap[record.visibility || 'private']}>
            {
              visibilityOptions.find((item) => item.value === (record.visibility || 'private'))
                ?.label
            }
          </Tag>
          {!isCreator && (
            <Button
              type="link"
              size="small"
              icon={<UserSwitchOutlined />}
              onClick={() => openCreatorModal(record)}
            >
              设置上传者
            </Button>
          )}
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">{isCreator ? '我的资源' : '资源管理'}</h2>
      <Card>
        <div className="mb-4 flex justify-between">
          <Space>
            <Input
              placeholder="搜索资源标题"
              prefix={<SearchOutlined />}
              className="w-48"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={() => void fetchResources()}
            />
            <Select
              placeholder="类型"
              className="w-28"
              allowClear
              value={typeFilter || undefined}
              onChange={(value) => setTypeFilter(value || '')}
              options={[
                { label: '头像', value: 'avatar' },
                { label: '壁纸', value: 'wallpaper' },
              ]}
            />
            {!isCreator && (
              <Select
                placeholder="创作者"
                className="w-40"
                allowClear
                showSearch
                value={creatorIdFilter || undefined}
                onChange={(value) => setCreatorIdFilter(value || '')}
                options={creators.map((c) => ({
                  label: c.name,
                  value: c.userId,
                }))}
                filterOption={(input, option) =>
                  String(option?.label ?? '')
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              />
            )}
            <Button icon={<SearchOutlined />} type="primary" onClick={() => void fetchResources()}>
              搜索
            </Button>
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => void fetchResources()}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => setUploadModalOpen(true)}
            >
              上传资源
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (count) => `共 ${count} 条`,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize);
            },
          }}
        />
      </Card>

      <Modal
        title="上传资源"
        open={uploadModalOpen}
        onCancel={() => {
          setUploadModalOpen(false);
          setFileList([]);
          setUploadVisibility('private');
        }}
        onOk={handleUpload}
        confirmLoading={uploading}
        okText="上传"
        cancelText="取消"
        width={600}
      >
        <div className="mb-4">
          <div className="mb-2 block">资源类型</div>
          <Select
            className="w-full"
            value={uploadType}
            onChange={setUploadType}
            options={[
              { label: '头像（最大 2MB）', value: 'avatar' },
              { label: '壁纸（最大 5MB）', value: 'wallpaper' },
            ]}
          />
        </div>
        <div className="mb-4">
          <div className="mb-2 block">可见范围</div>
          <Select
            className="w-full"
            value={uploadVisibility}
            onChange={setUploadVisibility}
            options={visibilityOptions}
          />
        </div>
        <Upload.Dragger {...uploadProps} accept="image/jpeg,image/jpg,image/png,image/webp">
          <p className="mb-4 text-4xl">上传</p>
          <p className="mb-2 text-base">点击或拖拽图片到此处上传</p>
          <p className="text-sm text-gray-400">支持 JPG、PNG、WEBP 格式</p>
          <p className="mt-2 text-sm text-gray-400">
            {uploadType === 'avatar' ? '头像最大 2MB' : '壁纸最大 5MB'}
          </p>
        </Upload.Dragger>
      </Modal>

      <Modal
        title="设置上传者"
        open={creatorModalOpen}
        onOk={handleUpdateCreator}
        onCancel={() => setCreatorModalOpen(false)}
        okText="确定"
        cancelText="取消"
      >
        <Form form={creatorForm} layout="vertical">
          <Form.Item
            name="uploaderId"
            label="选择上传者"
            rules={[{ required: true, message: '请选择上传者' }]}
          >
            <Select
              placeholder="请选择用户"
              loading={loadingUsers}
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              allowClear
              options={users.map((u) => ({ value: u.id, label: u.nickname }))}
            />
          </Form.Item>
          {currentResource && (
            <div className="text-sm text-gray-500">当前资源：{currentResource.title}</div>
          )}
        </Form>
      </Modal>
    </div>
  );
}
