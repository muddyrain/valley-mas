import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Badge,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Modal,
  message,
  Select,
  Slider,
  Space,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import type { ApplicationStatus, CreatorApplication } from '../api/creator-application';
import {
  reqGetApplicationDetail,
  reqGetApplicationList,
  reqGetCreatorApplicationAuditConfig,
  reqReviewApplication,
  reqUpdateCreatorApplicationAuditConfig,
} from '../api/creator-application';

const { TextArea } = Input;

export default function CreatorApplications() {
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<CreatorApplication[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | undefined>(undefined);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailData, setDetailData] = useState<CreatorApplication | null>(null);

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [currentApplication, setCurrentApplication] = useState<CreatorApplication | null>(null);
  const [reviewForm] = Form.useForm();
  const [auditStrictness, setAuditStrictness] = useState(20);
  const [auditStrictnessLoading, setAuditStrictnessLoading] = useState(false);
  const [savingAuditStrictness, setSavingAuditStrictness] = useState(false);

  // 加载申请列表
  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const response = await reqGetApplicationList({
        page,
        pageSize,
        keyword: keyword || undefined,
        status: statusFilter,
      });

      setDataSource(response.list || []);
      setTotal(response.total || 0);
    } catch {
      message.error('加载申请列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, statusFilter]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const fetchAuditConfig = useCallback(async () => {
    setAuditStrictnessLoading(true);
    try {
      const response = await reqGetCreatorApplicationAuditConfig();
      setAuditStrictness(response.strictness ?? 20);
    } catch {
      message.error('加载 AI 审核配置失败');
    } finally {
      setAuditStrictnessLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuditConfig();
  }, [fetchAuditConfig]);

  const handleSaveAuditStrictness = async () => {
    setSavingAuditStrictness(true);
    try {
      const response = await reqUpdateCreatorApplicationAuditConfig({
        strictness: auditStrictness,
      });
      setAuditStrictness(response.strictness ?? auditStrictness);
      message.success('AI 审核严谨度已更新');
    } catch {
      message.error('保存 AI 审核严谨度失败');
    } finally {
      setSavingAuditStrictness(false);
    }
  };

  // 查看详情
  const handleViewDetail = async (id: string) => {
    try {
      const response = await reqGetApplicationDetail(id);
      setDetailData(response);
      setDetailModalOpen(true);
    } catch {
      message.error('加载详情失败');
    }
  };

  // 打开审核弹窗
  const handleOpenReview = (record: CreatorApplication, status: 'approved' | 'rejected') => {
    setCurrentApplication(record);
    reviewForm.setFieldsValue({ status, reviewNote: '' });
    setReviewModalOpen(true);
  };

  // 提交审核
  const handleSubmitReview = async () => {
    if (!currentApplication) return;

    try {
      const values = await reviewForm.validateFields();
      await reqReviewApplication(currentApplication.id, values);
      message.success('审核成功');
      setReviewModalOpen(false);
      reviewForm.resetFields();
      setCurrentApplication(null);
      fetchList();
    } catch (error) {
      if (error instanceof Error) {
        message.error('审核失败');
      }
    }
  };

  // 状态标签渲染
  const renderStatusTag = (status: ApplicationStatus) => {
    const statusMap = {
      pending: { color: 'processing', text: '待审核' },
      approved: { color: 'success', text: '已通过' },
      rejected: { color: 'error', text: '已拒绝' },
    };
    const config = statusMap[status];
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const strictnessLevelText = (() => {
    if (auditStrictness <= 30) return '宽松（建议新系统初期）';
    if (auditStrictness <= 70) return '适中';
    return '严格';
  })();

  // 表格列定义
  const columns: ColumnsType<CreatorApplication> = [
    {
      title: '申请ID',
      dataIndex: 'id',
      key: 'id',
      width: 180,
      ellipsis: true,
    },
    {
      title: '用户信息',
      key: 'user',
      width: 200,
      render: (_, record) => (
        <div>
          <div>{record.user?.nickname || record.user?.username || '-'}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.user?.username || '-'}</div>
        </div>
      ),
    },
    {
      title: '创作者名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: '申请理由',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: '联系方式',
      key: 'contact',
      width: 200,
      render: (_, record) => (
        <div>
          {record.phone && <div className="text-nowrap">📱 {record.phone}</div>}
          {record.email && <div className="text-nowrap">📧 {record.email}</div>}
          {!record.phone && !record.email && <span style={{ color: '#999' }}>未填写</span>}
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: ApplicationStatus) => renderStatusTag(status),
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (time: string) => new Date(time).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record.id)}
          >
            查看
          </Button>
          {record.status === 'pending' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleOpenReview(record, 'approved')}
                style={{ color: '#52c41a' }}
              >
                通过
              </Button>
              <Button
                type="link"
                size="small"
                icon={<CloseCircleOutlined />}
                onClick={() => handleOpenReview(record, 'rejected')}
                danger
              >
                拒绝
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Card
            size="small"
            title="AI 自动审核设置"
            loading={auditStrictnessLoading}
            extra={
              <Button
                type="primary"
                onClick={handleSaveAuditStrictness}
                loading={savingAuditStrictness}
              >
                保存严谨度
              </Button>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Alert
                type="info"
                showIcon
                message={`当前严谨度：${auditStrictness} / 100（${strictnessLevelText}）`}
                description="严谨度越低，越容易通过；前期建议保持在 20-35。"
              />
              <Slider
                min={0}
                max={100}
                step={1}
                value={auditStrictness}
                onChange={(value) => setAuditStrictness(Array.isArray(value) ? value[0] : value)}
              />
            </Space>
          </Card>

          {/* 筛选区域 */}
          <Space wrap>
            <Input
              placeholder="搜索名称/理由/联系方式"
              prefix={<SearchOutlined />}
              style={{ width: 280 }}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={fetchList}
            />
            <Select
              placeholder="筛选状态"
              style={{ width: 150 }}
              value={statusFilter}
              onChange={setStatusFilter}
              allowClear
            >
              <Select.Option value="pending">待审核</Select.Option>
              <Select.Option value="approved">已通过</Select.Option>
              <Select.Option value="rejected">已拒绝</Select.Option>
            </Select>
            <Button type="primary" icon={<SearchOutlined />} onClick={fetchList}>
              搜索
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchList}>
              刷新
            </Button>
          </Space>

          {/* 统计信息 */}
          <Space size="large">
            <Badge
              count={dataSource.filter((item) => item.status === 'pending').length}
              showZero
              color="blue"
            >
              <span style={{ marginRight: 8 }}>待审核</span>
            </Badge>
            <Badge
              count={dataSource.filter((item) => item.status === 'approved').length}
              showZero
              color="green"
            >
              <span style={{ marginRight: 8 }}>已通过</span>
            </Badge>
            <Badge
              count={dataSource.filter((item) => item.status === 'rejected').length}
              showZero
              color="red"
            >
              <span style={{ marginRight: 8 }}>已拒绝</span>
            </Badge>
          </Space>

          {/* 表格 */}
          <Table
            columns={columns}
            dataSource={dataSource}
            rowKey="id"
            loading={loading}
            scroll={{ x: 1400 }}
            pagination={{
              current: page,
              pageSize: pageSize,
              total: total,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条`,
              onChange: (page, pageSize) => {
                setPage(page);
                setPageSize(pageSize);
              },
            }}
          />
        </Space>
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title="申请详情"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>
            关闭
          </Button>,
        ]}
        width={800}
      >
        {detailData && (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="申请ID" span={2}>
              {detailData.id}
            </Descriptions.Item>
            <Descriptions.Item label="用户ID">{detailData.userId}</Descriptions.Item>
            <Descriptions.Item label="用户名">{detailData.user?.username || '-'}</Descriptions.Item>
            <Descriptions.Item label="用户昵称">
              {detailData.user?.nickname || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="用户角色">{detailData.user?.role || '-'}</Descriptions.Item>
            <Descriptions.Item label="创作者名称" span={2}>
              {detailData.name}
            </Descriptions.Item>
            <Descriptions.Item label="创作者描述" span={2}>
              {detailData.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="申请理由" span={2}>
              {detailData.reason}
            </Descriptions.Item>
            <Descriptions.Item label="联系电话">{detailData.phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="联系邮箱">{detailData.email || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">{renderStatusTag(detailData.status)}</Descriptions.Item>
            <Descriptions.Item label="申请时间">
              {new Date(detailData.createdAt).toLocaleString('zh-CN')}
            </Descriptions.Item>
            {detailData.status !== 'pending' && (
              <>
                <Descriptions.Item label="审核人">
                  {detailData.reviewer?.username || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="审核时间">
                  {detailData.reviewedAt
                    ? new Date(detailData.reviewedAt).toLocaleString('zh-CN')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="审核备注" span={2}>
                  {detailData.reviewNote || '-'}
                </Descriptions.Item>
              </>
            )}
          </Descriptions>
        )}
      </Modal>

      {/* 审核弹窗 */}
      <Modal
        title={reviewForm.getFieldValue('status') === 'approved' ? '通过申请' : '拒绝申请'}
        open={reviewModalOpen}
        onOk={handleSubmitReview}
        onCancel={() => {
          setReviewModalOpen(false);
          reviewForm.resetFields();
          setCurrentApplication(null);
        }}
        okText="确认"
        cancelText="取消"
      >
        {currentApplication && (
          <div>
            <p>
              <strong>申请人：</strong>
              {currentApplication.user?.nickname || currentApplication.user?.username}
            </p>
            <p>
              <strong>创作者名称：</strong>
              {currentApplication.name}
            </p>
            <Form form={reviewForm} layout="vertical" style={{ marginTop: 16 }}>
              <Form.Item name="status" hidden>
                <Input />
              </Form.Item>
              <Form.Item
                label="审核备注"
                name="reviewNote"
                rules={[
                  {
                    max: 500,
                    message: '备注不能超过500字',
                  },
                ]}
              >
                <TextArea
                  rows={4}
                  placeholder={
                    reviewForm.getFieldValue('status') === 'approved'
                      ? '选填：可以留下一些鼓励的话'
                      : '请说明拒绝原因'
                  }
                />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
}
