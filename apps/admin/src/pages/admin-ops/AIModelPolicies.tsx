import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  message,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import {
  type AdminAIModel,
  type AdminAIModelInput,
  type AIModelCapability,
  createAIModel,
  listAIModels,
  previewAIProviderModels,
  testAIModelConnection,
  updateAIModel,
} from '@/api/operations';

const capabilityOptions: Array<{ value: AIModelCapability; label: string }> = [
  { value: 'text', label: '文本' },
  { value: 'vision', label: '视觉' },
  { value: 'image_generation', label: '生图' },
  { value: 'reference_image', label: '支持参考图' },
  { value: 'embedding', label: '向量' },
  { value: 'tool_call', label: '工具调用' },
];

const imageProtocolOptions = [
  { value: 'auto', label: '自动匹配 Provider（推荐）' },
  { value: 'siliconflow_images', label: 'SiliconFlow Images JSON' },
  { value: 'openai_images', label: 'OpenAI Images（生成 / 编辑）' },
  { value: 'ark_images', label: 'ARK Images JSON' },
];

type ModelForm = AdminAIModelInput;

const verificationLabels: Record<
  AdminAIModel['verificationStatus'],
  { color: string; label: string }
> = {
  unverified: { color: 'default', label: '未验证' },
  partial: { color: 'gold', label: '部分验证' },
  verified: { color: 'green', label: '已验证' },
  failed: { color: 'red', label: '验证失败' },
};
export default function AIModelPolicies() {
  const [models, setModels] = useState<AdminAIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [modelOpen, setModelOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<AdminAIModel | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testingModelID, setTestingModelID] = useState<string>();
  const [modelForm] = Form.useForm<ModelForm>();
  const selectedCapabilities = Form.useWatch('capabilities', modelForm) || [];
  const probesImageGeneration = selectedCapabilities.includes('image_generation');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const modelResult = await listAIModels();
      setModels(modelResult.list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const modelColumns: ColumnsType<AdminAIModel> = [
    {
      title: '模型',
      key: 'model',
      render: (_, item) => (
        <>
          <div>{item.displayName}</div>
          <div className="text-xs text-gray-400">{item.modelId}</div>
        </>
      ),
    },
    { title: 'Provider', dataIndex: 'provider', width: 140 },
    {
      title: '能力',
      dataIndex: 'capabilities',
      render: (values: string[], item) =>
        (Array.isArray(values) ? values : []).map((value) => (
          <Tag
            key={value}
            color={
              item.verifiedCapabilities?.includes(value as AIModelCapability) ? 'green' : undefined
            }
            title={
              item.verifiedCapabilities?.includes(value as AIModelCapability)
                ? '已验证'
                : '已声明，尚未验证'
            }
          >
            {capabilityOptions.find((item) => item.value === value)?.label || value}
          </Tag>
        )),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      width: 100,
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'green' : 'default'}>{enabled ? '启用' : '停用'}</Tag>
      ),
    },
    {
      title: '验证',
      key: 'verification',
      width: 140,
      render: (_, item) => {
        const verification =
          verificationLabels[item.verificationStatus] || verificationLabels.unverified;
        return (
          <div>
            <Tooltip title={item.verificationMessage || undefined}>
              <Tag color={verification.color}>{verification.label}</Tag>
            </Tooltip>
            {item.lastVerifiedAt ? (
              <div className="mt-1 text-xs text-gray-400">
                {new Date(item.lastVerifiedAt).toLocaleString('zh-CN')}
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      title: '操作',
      width: 170,
      render: (_, item) => (
        <Space size={0}>
          <Button
            type="link"
            loading={testingModelID === item.id}
            onClick={() => void testSavedModelConnection(item)}
          >
            检测连接
          </Button>
          <Button type="link" onClick={() => openModel(item)}>
            编辑
          </Button>
        </Space>
      ),
    },
  ];

  const openModel = (item?: AdminAIModel) => {
    setEditingModel(item || null);
    modelForm.setFieldsValue(
      item || {
        provider: 'siliconflow',
        capabilities: ['text'],
        imageProtocol: 'auto',
        enabled: true,
        sortOrder: models.length + 1,
      },
    );
    setModelOpen(true);
  };

  const saveModel = async () => {
    const value = await modelForm.validateFields();
    if (editingModel) await updateAIModel(editingModel.id, value);
    else await createAIModel(value);
    message.success('模型已保存');
    setModelOpen(false);
    await reload();
  };

  const testConnection = async () => {
    const value = await modelForm.validateFields([
      'provider',
      'modelId',
      'capabilities',
      'imageProtocol',
    ]);
    try {
      setTestingConnection(true);
      const result = await testAIModelConnection({
        provider: value.provider,
        modelId: value.modelId,
        capabilities: value.capabilities,
        imageProtocol: value.imageProtocol,
      });
      message.success(`模型调用正常（${result.latencyMs}ms）`);
    } finally {
      setTestingConnection(false);
    }
  };

  const testSavedModelConnection = async (selected: AdminAIModel) => {
    try {
      setTestingModelID(selected.id);
      const result = await testAIModelConnection({
        catalogId: selected.id,
        provider: selected.provider,
        modelId: selected.modelId,
        capabilities: selected.capabilities,
        imageProtocol: selected.imageProtocol,
      });
      message.success(
        `${selected.displayName} 调用正常（${result.latencyMs}ms，${
          result.verificationStatus === 'verified' ? '能力已验证' : '部分能力已验证'
        }）`,
      );
    } finally {
      setTestingModelID(undefined);
      await reload();
    }
  };

  const preview = async (provider: 'siliconflow' | 'amux') => {
    const result = await previewAIProviderModels(provider);
    Modal.info({
      title: `${provider} 模型预览`,
      width: 640,
      content: (
        <div className="mt-4 max-h-96 overflow-auto">
          {result.models.map((item) => (
            <div className="py-1" key={item}>
              {item}
            </div>
          ))}
        </div>
      ),
    });
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">AI 模型目录</h2>
          <p className="mt-1 text-gray-500">管理可选模型、能力标签和连接状态。</p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void reload()}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModel()}>
            添加模型
          </Button>
        </Space>
      </div>
      <Card
        title="模型目录"
        extra={
          <Space>
            <Button onClick={() => void preview('siliconflow')}>预览 SiliconFlow</Button>
            <Button onClick={() => void preview('amux')}>预览 Amux</Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          columns={modelColumns}
          dataSource={models}
          loading={loading}
          pagination={false}
          scroll={{ x: 900 }}
        />
      </Card>
      <Modal
        title={editingModel ? '编辑模型' : '添加模型'}
        open={modelOpen}
        onCancel={() => setModelOpen(false)}
        onOk={() => void saveModel()}
        destroyOnHidden
      >
        <Form form={modelForm} layout="vertical">
          <Form.Item name="provider" label="Provider" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'siliconflow', label: 'SiliconFlow' },
                { value: 'amux', label: 'Amux' },
                { value: 'ark', label: 'ARK（仅 Legacy）' },
              ]}
            />
          </Form.Item>
          <Form.Item name="modelId" label="模型 ID" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="连接检测">
            <Space>
              <Button onClick={() => void testConnection()} loading={testingConnection}>
                检测连接
              </Button>
              <span className="text-xs text-gray-400">
                {probesImageGeneration
                  ? '生图检测会生成一张测试图，可能消耗额度'
                  : '发送最小请求验证模型实际可用，会消耗极少量 token'}
              </span>
            </Space>
          </Form.Item>
          <Form.Item name="displayName" label="显示名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="capabilities" label="能力" rules={[{ required: true }]}>
            <Select
              mode="multiple"
              options={capabilityOptions.map((item) =>
                item.value === 'reference_image'
                  ? { ...item, disabled: !probesImageGeneration }
                  : item,
              )}
              onChange={(values: AIModelCapability[]) => {
                if (!values.includes('image_generation')) {
                  modelForm.setFieldValue(
                    'capabilities',
                    values.filter((value) => value !== 'reference_image'),
                  );
                }
              }}
            />
          </Form.Item>
          {probesImageGeneration ? (
            <Form.Item
              name="imageProtocol"
              label="图片协议"
              rules={[{ required: true }]}
              extra="自动模式按 Provider 选择默认协议；仅在模型文档明确要求时手动指定。"
            >
              <Select options={imageProtocolOptions} />
            </Form.Item>
          ) : null}
          <Form.Item name="sortOrder" label="排序">
            <InputNumber className="w-full" min={0} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
