import { AppstoreOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Card, Form, Image, Input, Modal, message, Space, Switch, Transfer } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { CreatorSpace } from '../api/creator';
import {
  reqAddResourcesToSpace,
  reqCreateSpace,
  reqDeleteSpace,
  reqGetCreatorDetail,
  reqGetSpaceDetail,
  reqRemoveResourcesFromSpace,
  reqUpdateSpace,
} from '../api/creator';
import type { Resource } from '../api/resource';
import { reqGetResourceList } from '../api/resource';

export default function CreatorSpaces() {
  const { creatorId } = useParams<{ creatorId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [space, setSpace] = useState<CreatorSpace | null>(null);
  const [creatorName, setCreatorName] = useState('');
  const [creatorCode, setCreatorCode] = useState('');
  const [form] = Form.useForm();

  // 资源管理相关状态
  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [allResources, setAllResources] = useState<Resource[]>([]);
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);

  // 加载创作者信息和空间
  const fetchData = async () => {
    if (!creatorId) return;

    setLoading(true);
    try {
      const [creator] = await Promise.all([reqGetCreatorDetail(creatorId)]);
      setCreatorName(creator.name);
      setCreatorCode(creator.code);

      try {
        const spaceData = await reqGetSpaceDetail(creatorId);
        setSpace(spaceData);
        form.setFieldsValue({
          title: spaceData.title,
          description: spaceData.description,
          banner: spaceData.banner,
          isActive: spaceData.isActive,
        });
      } catch {
        setSpace(null);
        form.resetFields();
      }
    } catch {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchData();
  }, [creatorId]);

  // 提交表单
  const handleSubmit = async () => {
    if (!creatorId) return;

    try {
      const values = await form.validateFields();
      if (space) {
        await reqUpdateSpace(creatorId, values);
        message.success('更新成功');
      } else {
        await reqCreateSpace(creatorId, values);
        message.success('创建成功');
      }
      fetchData();
    } catch {
      message.error(space ? '更新失败' : '创建失败');
    }
  };

  // 删除空间
  const handleDelete = async () => {
    if (!creatorId || !space) return;

    try {
      await reqDeleteSpace(creatorId);
      message.success('删除成功');
      setSpace(null);
      form.resetFields();
    } catch {
      message.error('删除失败');
    }
  };

  // 打开资源管理弹窗
  const handleManageResources = async () => {
    if (!creatorId || !space) return;

    setResourceLoading(true);
    setResourceModalOpen(true);

    try {
      const [spaceDetail, resourceList] = await Promise.all([
        reqGetSpaceDetail(creatorId),
        reqGetResourceList({
          page: 1,
          pageSize: 1000,
        }),
      ]);

      setAllResources(resourceList.list || []);
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
    if (!creatorId || !space) return;

    setResourceLoading(true);
    try {
      const spaceDetail = await reqGetSpaceDetail(creatorId);
      const currentResourceIds = (spaceDetail.resources || []).map((r) => r.id);

      const toAdd = selectedResourceIds.filter((id) => !currentResourceIds.includes(id));
      const toRemove = currentResourceIds.filter((id) => !selectedResourceIds.includes(id));

      const promises = [];
      if (toAdd.length > 0) {
        promises.push(reqAddResourcesToSpace(creatorId, toAdd));
      }
      if (toRemove.length > 0) {
        promises.push(reqRemoveResourcesFromSpace(creatorId, toRemove));
      }

      if (promises.length > 0) {
        await Promise.all(promises);
        message.success('保存成功');
      } else {
        message.info('没有变更');
      }

      setResourceModalOpen(false);
      fetchData();
    } catch {
      message.error('保存失败');
    } finally {
      setResourceLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Button onClick={() => navigate('/creators')} className="mb-2">
          ← 返回创作者列表
        </Button>
        <h2 className="text-2xl font-bold">{creatorName} - 空间管理</h2>
        <p className="text-gray-600 mt-2">
          创作者口令: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{creatorCode}</span>
        </p>
      </div>

      <Card>
        <div className="mb-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold">{space ? '编辑空间' : '创建空间'}</h3>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchData}>
              刷新
            </Button>
            {space && (
              <Button type="primary" icon={<AppstoreOutlined />} onClick={handleManageResources}>
                管理资源
              </Button>
            )}
          </Space>
        </div>

        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            label="空间名称"
            name="title"
            rules={[{ required: true, message: '请输入空间名称' }]}
          >
            <Input placeholder="例如：精选头像合集" />
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

          <Form.Item>
            <Space>
              <Button type="primary" onClick={handleSubmit} loading={loading}>
                {space ? '更新' : '创建'}
              </Button>
              {space && (
                <Button danger onClick={handleDelete}>
                  删除
                </Button>
              )}
            </Space>
          </Form.Item>
        </Form>

        {space && space.banner && (
          <div className="mt-6">
            <h4 className="text-md font-semibold mb-2">横幅预览</h4>
            <Image src={space.banner} alt="横幅" style={{ maxWidth: '100%', maxHeight: '300px' }} />
          </div>
        )}
      </Card>

      {/* 资源管理弹窗 */}
      <Modal
        title={`管理空间资源 - ${space?.title || ''}`}
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
              url: r.url,
              description: `类型: ${r.type === 'avatar' ? '头像' : '壁纸'} | 大小: ${(r.size / 1024 / 1024).toFixed(2)}MB`,
            }))}
            targetKeys={selectedResourceIds}
            onChange={(targetKeys) => setSelectedResourceIds(targetKeys as string[])}
            render={(item) => (
              <div className="flex items-center">
                <Image src={item.url} alt={item.title} width={50} height={50} />
                <div className="ml-2">
                  <div>{item.title}</div>
                  <div className="text-xs text-gray-400">{item.description}</div>
                </div>
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
