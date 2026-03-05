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
  reqDeleteResource,
  reqGetResourceList,
  reqUpdateResourceCreator,
  reqUploadResource,
} from '../api/resource';
import { reqGetUserList } from '../api/user';

export default function Resources() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Resource[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [typeFilter, setTypeFilter] = useState<ResourceType | ''>('');
  const [keyword, setKeyword] = useState('');
  const [creatorIdFilter, setCreatorIdFilter] = useState<string>(''); // 创作者筛选
  const [creators, setCreators] = useState<Creator[]>([]); // 创作者列表
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadType, setUploadType] = useState<ResourceType>('avatar');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);

  // 配置上传者相关状态
  const [creatorModalOpen, setCreatorModalOpen] = useState(false);
  const [currentResource, setCurrentResource] = useState<Resource | null>(null);
  const [creatorForm] = Form.useForm();
  const [users, setUsers] = useState<Array<{ id: string; nickname: string }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // 获取当前用户信息
  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  const isCreator = userInfo.role === 'creator';

  // 加载创作者列表（用于筛选 - 仅管理员使用）
  useEffect(() => {
    // 只有管理员需要加载创作者列表
    if (isCreator) return;

    const fetchCreators = async () => {
      try {
        const response = await reqGetCreatorList({ page: 1, pageSize: 1000 });
        const creatorList = response.list || [];
        setCreators(creatorList);
      } catch (error) {
        console.error('加载创作者列表失败', error);
      }
    };
    fetchCreators();
  }, [isCreator]);

  // 获取资源列表
  const fetchResources = useCallback(async () => {
    setLoading(true);
    try {
      const params: {
        page: number;
        pageSize: number;
        type?: ResourceType;
        keyword?: string;
      } = {
        page,
        pageSize,
      };
      if (typeFilter) params.type = typeFilter;
      if (keyword) params.keyword = keyword;
      // 移除 creatorId 参数，后端自动根据登录用户过滤

      const response = await reqGetResourceList(params);
      setData(response.list || []);
      setTotal(response.total || 0);
    } catch (error) {
      message.error('获取资源列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, typeFilter, keyword]); // 移除 creatorIdFilter 依赖

  // 删除资源
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
          fetchResources();
        } catch (error) {
          message.error('删除失败');
          console.error(error);
        }
      },
    });
  };

  // 上传配置
  const uploadProps: UploadProps = {
    fileList,
    onChange: ({ fileList }) => setFileList(fileList),
    beforeUpload: (file) => {
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        message.error('只能上传图片文件！');
        return false;
      }

      const maxSize = uploadType === 'avatar' ? 2 : 5;
      const isLt = file.size / 1024 / 1024 < maxSize;
      if (!isLt) {
        message.error(`文件大小不能超过 ${maxSize}MB！`);
        return false;
      }

      setFileList([file]);
      return false; // 阻止自动上传
    },
    onRemove: () => setFileList([]),
  };

  // 执行上传
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
    formData.append('file', file); // 后端期望的字段名是 'file'
    formData.append('type', uploadType);

    setUploading(true);
    try {
      await reqUploadResource(formData);
      message.success('上传成功');
      setUploadModalOpen(false);
      setFileList([]);
      fetchResources();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  // 打开配置上传者 Modal
  const openCreatorModal = async (resource: Resource) => {
    setCurrentResource(resource);
    creatorForm.setFieldsValue({ uploaderId: resource.user?.id });
    setCreatorModalOpen(true);

    // 加载用户列表
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

  // 更新上传者
  const handleUpdateCreator = async () => {
    if (!currentResource) return;

    try {
      const values = await creatorForm.validateFields();
      await reqUpdateResourceCreator(currentResource.id, values.uploaderId);
      message.success('上传者更新成功');
      setCreatorModalOpen(false);
      fetchResources();
    } catch (error) {
      message.error('更新失败');
      console.error(error);
    }
  };

  useEffect(() => {
    void fetchResources();
  }, [fetchResources]);

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
      render: (title) => title || '未命名资源',
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      render: (t) => (
        <Tag color={t === 'avatar' ? 'blue' : 'purple'}>{t === 'avatar' ? '头像' : '壁纸'}</Tag>
      ),
    },
    {
      title: '上传者',
      dataIndex: 'user',
      width: 150,
      render: (user) => {
        if (!user) return <span className="text-gray-400">未知</span>;
        return <UserCardInfo user={user} />;
      },
    },
    {
      title: '大小',
      dataIndex: 'size',
      width: 100,
      render: (s) => formatFileSize(s),
    },
    {
      title: '下载量',
      dataIndex: 'downloadCount',
      width: 100,
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
          {!isCreator && (
            <Button
              type="link"
              size="small"
              icon={<UserSwitchOutlined />}
              onClick={() => openCreatorModal(record)}
            >
              配置上传者
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
      <h2 className="text-2xl font-bold mb-6">{isCreator ? '我的资源' : '资源管理'}</h2>
      <Card>
        <div className="mb-4 flex justify-between">
          <Space>
            <Input
              placeholder="搜索资源标题"
              prefix={<SearchOutlined />}
              className="w-48"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={fetchResources}
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
                  value: c.id,
                }))}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            )}
            <Button icon={<SearchOutlined />} type="primary" onClick={fetchResources}>
              搜索
            </Button>
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchResources}>
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
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => {
              setPage(page);
              setPageSize(pageSize);
            },
          }}
        />
      </Card>

      {/* 上传模态框 */}
      <Modal
        title="上传资源"
        open={uploadModalOpen}
        onCancel={() => {
          setUploadModalOpen(false);
          setFileList([]);
        }}
        onOk={handleUpload}
        confirmLoading={uploading}
        okText="上传"
        cancelText="取消"
        width={600}
      >
        <div className="mb-4">
          <div className="block mb-2">资源类型：</div>
          <Select
            className="w-full"
            value={uploadType}
            onChange={setUploadType}
            options={[
              { label: '头像 (最大 2MB)', value: 'avatar' },
              { label: '壁纸 (最大 5MB)', value: 'wallpaper' },
            ]}
          />
        </div>
        <Upload.Dragger {...uploadProps} accept="image/jpeg,image/jpg,image/png,image/webp">
          <p className="text-4xl mb-4">📁</p>
          <p className="text-base mb-2">点击或拖拽图片到此处上传</p>
          <p className="text-gray-400 text-sm">支持 JPG、PNG、WEBP 格式</p>
          <p className="text-gray-400 text-sm mt-2">
            {uploadType === 'avatar' ? '头像最大 2MB' : '壁纸最大 5MB'}
          </p>
        </Upload.Dragger>
      </Modal>

      {/* 配置上传者 Modal */}
      <Modal
        title="配置上传者"
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
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              allowClear
              options={users.map((u) => ({ value: u.id, label: u.nickname }))}
            />
          </Form.Item>
          {currentResource && (
            <div className="text-gray-500 text-sm">当前资源: {currentResource.title}</div>
          )}
        </Form>
      </Modal>
    </div>
  );
}
