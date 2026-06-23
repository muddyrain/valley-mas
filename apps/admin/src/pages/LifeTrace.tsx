import {
  BellOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  MessageOutlined,
  ReloadOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  Avatar,
  Button,
  Card,
  Col,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  type LifeTraceOverview,
  type LifeTraceRecordRow,
  type LifeTraceRecordType,
  type LifeTraceUserRow,
  reqGetLifeTraceOverview,
  reqGetLifeTraceRecords,
  reqGetLifeTraceUsers,
} from '../api/life-trace';

const recordTypeOptions: Array<{ value: LifeTraceRecordType; label: string }> = [
  { value: 'plans', label: '计划' },
  { value: 'traces', label: '踪迹' },
  { value: 'pantry', label: '库存' },
  { value: 'weekly-reviews', label: '周报' },
  { value: 'ai-conversations', label: 'AI 对话' },
  { value: 'push-subscriptions', label: '推送订阅' },
  { value: 'push-plan-deliveries', label: '计划推送' },
  { value: 'push-daily-deliveries', label: '简报推送' },
  { value: 'push-pantry-deliveries', label: '库存推送' },
];

function parsePositiveNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatDateTime(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function displayUserName(record: LifeTraceUserRow) {
  return record.nickname || record.username || record.userId;
}

function statusColor(status?: string) {
  switch (status) {
    case 'completed':
    case 'resolved':
    case 'sent':
    case 'active':
    case 'normal':
      return 'green';
    case 'open':
    case 'pending':
    case 'expiring':
      return 'orange';
    case 'expired':
    case 'failed':
    case 'inactive':
      return 'red';
    default:
      return 'blue';
  }
}

function detailPreview(detail: Record<string, unknown>) {
  const entries = Object.entries(detail).filter(([, value]) => value !== '' && value != null);
  if (!entries.length) return '-';
  return entries
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
    .join(' / ');
}

export default function LifeTrace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [overview, setOverview] = useState<LifeTraceOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [users, setUsers] = useState<LifeTraceUserRow[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersLoading, setUsersLoading] = useState(false);
  const [records, setRecords] = useState<LifeTraceRecordRow[]>([]);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [userKeywordDraft, setUserKeywordDraft] = useState(searchParams.get('userKeyword') ?? '');
  const [recordKeywordDraft, setRecordKeywordDraft] = useState(
    searchParams.get('recordKeyword') ?? '',
  );

  const view = searchParams.get('view') || 'overview';
  const userPage = parsePositiveNumber(searchParams.get('userPage'), 1);
  const userPageSize = parsePositiveNumber(searchParams.get('userPageSize'), 10);
  const userKeyword = searchParams.get('userKeyword') ?? '';
  const recordType = (searchParams.get('recordType') || 'plans') as LifeTraceRecordType;
  const recordPage = parsePositiveNumber(searchParams.get('recordPage'), 1);
  const recordPageSize = parsePositiveNumber(searchParams.get('recordPageSize'), 10);
  const recordKeyword = searchParams.get('recordKeyword') ?? '';
  const recordUserId = searchParams.get('recordUserId') ?? '';
  const recordStatus = searchParams.get('recordStatus') ?? 'all';

  const updateQuery = useCallback(
    (updates: Record<string, string | number | undefined>) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === '') {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      });
      setSearchParams(next, { replace: false });
    },
    [searchParams, setSearchParams],
  );

  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const res = await reqGetLifeTraceOverview();
      setOverview(res.overview);
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await reqGetLifeTraceUsers({
        page: userPage,
        pageSize: userPageSize,
        keyword: userKeyword || undefined,
      });
      setUsers(res.list || []);
      setUsersTotal(res.total || 0);
    } finally {
      setUsersLoading(false);
    }
  }, [userKeyword, userPage, userPageSize]);

  const fetchRecords = useCallback(async () => {
    setRecordsLoading(true);
    try {
      const res = await reqGetLifeTraceRecords({
        type: recordType,
        page: recordPage,
        pageSize: recordPageSize,
        keyword: recordKeyword || undefined,
        userId: recordUserId || undefined,
        status: recordStatus === 'all' ? undefined : recordStatus,
      });
      setRecords(res.list || []);
      setRecordsTotal(res.total || 0);
    } finally {
      setRecordsLoading(false);
    }
  }, [recordKeyword, recordPage, recordPageSize, recordStatus, recordType, recordUserId]);

  useEffect(() => {
    void fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    if (view === 'users') {
      void fetchUsers();
    }
  }, [fetchUsers, view]);

  useEffect(() => {
    if (view === 'records') {
      void fetchRecords();
    }
  }, [fetchRecords, view]);

  useEffect(() => {
    setUserKeywordDraft(userKeyword);
  }, [userKeyword]);

  useEffect(() => {
    setRecordKeywordDraft(recordKeyword);
  }, [recordKeyword]);

  const userColumns: ColumnsType<LifeTraceUserRow> = useMemo(
    () => [
      {
        title: '用户',
        key: 'user',
        width: 240,
        render: (_, record) => (
          <div className="flex min-w-0 items-center">
            <Avatar src={record.avatar} size={40}>
              {displayUserName(record).charAt(0)}
            </Avatar>
            <div className="ml-2 min-w-0">
              <Tooltip title={displayUserName(record)}>
                <div className="truncate font-medium">{displayUserName(record)}</div>
              </Tooltip>
              <div className="truncate text-xs text-gray-400">ID: {record.userId}</div>
            </div>
          </div>
        ),
      },
      {
        title: '偏好',
        key: 'settings',
        width: 180,
        render: (_, record) => (
          <Space size={4} wrap>
            <Tag>{record.city || '未设置城市'}</Tag>
            <Tag>{record.commuteMethod || '未设置通勤'}</Tag>
            <Tag>{record.dailyBriefTime || '无简报'}</Tag>
          </Space>
        ),
      },
      {
        title: '生活数据',
        key: 'lifeData',
        render: (_, record) => (
          <Space size={4} wrap>
            <Tag color="blue">计划 {record.plans}</Tag>
            <Tag color="green">踪迹 {record.traces}</Tag>
            <Tag color="cyan">库存 {record.pantryItems}</Tag>
            <Tag color="orange">待办 {record.openPlans}</Tag>
          </Space>
        ),
      },
      {
        title: 'AI / 反馈 / 推送',
        key: 'signals',
        width: 230,
        render: (_, record) => (
          <Space size={4} wrap>
            <Tag color="geekblue">AI {record.aiConversations}</Tag>
            <Tag color={record.feedbacks > 0 ? 'orange' : 'default'}>反馈 {record.feedbacks}</Tag>
            <Tag color={record.notificationReady ? 'green' : 'default'}>
              推送 {record.pushSubscriptions}
            </Tag>
          </Space>
        ),
      },
      {
        title: '最近活动',
        dataIndex: 'latestActivityAt',
        width: 180,
        render: (value?: string) => formatDateTime(value),
      },
      {
        title: '操作',
        key: 'action',
        width: 100,
        render: (_, record) => (
          <a
            onClick={() =>
              updateQuery({
                view: 'records',
                recordUserId: record.userId,
                recordPage: 1,
              })
            }
          >
            查记录
          </a>
        ),
      },
    ],
    [updateQuery],
  );

  const recordColumns: ColumnsType<LifeTraceRecordRow> = useMemo(
    () => [
      {
        title: '用户',
        key: 'user',
        width: 190,
        render: (_, record) => (
          <div>
            <div className="font-medium">{record.userName}</div>
            <div className="text-xs text-gray-400">ID: {record.userId}</div>
          </div>
        ),
      },
      {
        title: '记录',
        key: 'record',
        render: (_, record) => (
          <div>
            <div className="font-medium">{record.title || record.id}</div>
            <div className="text-xs text-gray-400">{detailPreview(record.detail)}</div>
          </div>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 120,
        render: (value?: string) =>
          value ? <Tag color={statusColor(value)}>{value}</Tag> : <span>-</span>,
      },
      {
        title: '来源',
        dataIndex: 'source',
        width: 120,
        render: (value?: string) => value || '-',
      },
      {
        title: '时间',
        dataIndex: 'createdAt',
        width: 180,
        render: (value?: string) => formatDateTime(value),
      },
    ],
    [],
  );

  const handleUserTableChange = (pagination: TablePaginationConfig) => {
    updateQuery({
      userPage: pagination.current || 1,
      userPageSize: pagination.pageSize || 10,
    });
  };

  const handleRecordTableChange = (pagination: TablePaginationConfig) => {
    updateQuery({
      recordPage: pagination.current || 1,
      recordPageSize: pagination.pageSize || 10,
    });
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="mb-1 text-2xl font-bold">Life Trace 管理</h2>
          <p className="text-sm text-gray-500">查看 Life Trace 用户、生活数据、AI 和推送记录。</p>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            void fetchOverview();
            if (view === 'users') void fetchUsers();
            if (view === 'records') void fetchRecords();
          }}
        >
          刷新
        </Button>
      </div>

      <Tabs
        activeKey={view}
        onChange={(key) => updateQuery({ view: key, userPage: 1, recordPage: 1 })}
        items={[
          {
            key: 'overview',
            label: '数据概览',
            children: (
              <div className="space-y-4">
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={12} lg={6}>
                    <Card loading={overviewLoading}>
                      <Statistic
                        title="偏好用户"
                        value={overview?.settings || 0}
                        prefix={<UserOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card loading={overviewLoading}>
                      <Statistic
                        title="计划总数"
                        value={overview?.plans || 0}
                        suffix={`/ ${overview?.openPlans || 0} 待办`}
                        prefix={<ClockCircleOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card loading={overviewLoading}>
                      <Statistic
                        title="生活踪迹"
                        value={overview?.traces || 0}
                        prefix={<CheckCircleOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card loading={overviewLoading}>
                      <Statistic
                        title="库存条目"
                        value={overview?.pantryItems || 0}
                        suffix={`/ ${overview?.expiredPantryItems || 0} 过期`}
                        prefix={<DatabaseOutlined />}
                      />
                    </Card>
                  </Col>
                </Row>

                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={12} lg={6}>
                    <Card loading={overviewLoading}>
                      <Statistic
                        title="AI 对话 / 消息"
                        value={overview?.aiConversations || 0}
                        suffix={`/ ${overview?.aiMessages || 0}`}
                        prefix={<MessageOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card loading={overviewLoading}>
                      <Statistic
                        title="反馈总数"
                        value={overview?.feedbacks || 0}
                        suffix={`/ ${overview?.openFeedbacks || 0} 待处理`}
                        prefix={<MessageOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card loading={overviewLoading}>
                      <Statistic
                        title="推送订阅"
                        value={overview?.pushSubscriptions || 0}
                        prefix={<BellOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card loading={overviewLoading}>
                      <Statistic
                        title="推送异常"
                        value={overview?.pushErrors || 0}
                        prefix={<BellOutlined />}
                        valueStyle={{
                          color: overview?.pushErrors ? '#cf1322' : undefined,
                        }}
                      />
                    </Card>
                  </Col>
                </Row>
              </div>
            ),
          },
          {
            key: 'users',
            label: '用户概览',
            children: (
              <Card>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <Space wrap>
                    <Input
                      className="w-72"
                      allowClear
                      prefix={<SearchOutlined />}
                      placeholder="搜索昵称 / 用户名 / OpenID / 邮箱"
                      value={userKeywordDraft}
                      onChange={(event) => setUserKeywordDraft(event.target.value)}
                      onPressEnter={() =>
                        updateQuery({
                          userKeyword: userKeywordDraft.trim() || undefined,
                          userPage: 1,
                        })
                      }
                    />
                    <Button
                      type="primary"
                      icon={<SearchOutlined />}
                      onClick={() =>
                        updateQuery({
                          userKeyword: userKeywordDraft.trim() || undefined,
                          userPage: 1,
                        })
                      }
                    >
                      搜索
                    </Button>
                  </Space>
                  <Button icon={<ReloadOutlined />} onClick={() => void fetchUsers()}>
                    刷新
                  </Button>
                </div>
                <Table
                  rowKey="userId"
                  columns={userColumns}
                  dataSource={users}
                  loading={usersLoading}
                  pagination={{
                    current: userPage,
                    pageSize: userPageSize,
                    total: usersTotal,
                    showSizeChanger: true,
                    showTotal: (nextTotal) => `共 ${nextTotal} 个用户`,
                  }}
                  scroll={{ x: 1100 }}
                  onChange={handleUserTableChange}
                />
              </Card>
            ),
          },
          {
            key: 'records',
            label: '记录查询',
            children: (
              <Card>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <Space wrap>
                    <Select
                      className="w-44"
                      value={recordType}
                      options={recordTypeOptions}
                      onChange={(value) =>
                        updateQuery({ recordType: value, recordPage: 1, recordStatus: 'all' })
                      }
                    />
                    <Input
                      className="w-56"
                      allowClear
                      placeholder="用户 ID"
                      value={recordUserId}
                      onChange={(event) =>
                        updateQuery({ recordUserId: event.target.value.trim(), recordPage: 1 })
                      }
                    />
                    <Input
                      className="w-64"
                      allowClear
                      prefix={<SearchOutlined />}
                      placeholder="搜索标题 / 内容 / 位置"
                      value={recordKeywordDraft}
                      onChange={(event) => setRecordKeywordDraft(event.target.value)}
                      onPressEnter={() =>
                        updateQuery({
                          recordKeyword: recordKeywordDraft.trim() || undefined,
                          recordPage: 1,
                        })
                      }
                    />
                    <Select
                      className="w-32"
                      value={recordStatus}
                      onChange={(value) => updateQuery({ recordStatus: value, recordPage: 1 })}
                      options={[
                        { value: 'all', label: '全部状态' },
                        { value: 'open', label: 'open' },
                        { value: 'completed', label: 'completed' },
                        { value: 'active', label: 'active' },
                        { value: 'sent', label: 'sent' },
                        { value: 'expired', label: 'expired' },
                        { value: 'failed', label: 'failed' },
                      ]}
                    />
                    <Button
                      type="primary"
                      icon={<SearchOutlined />}
                      onClick={() =>
                        updateQuery({
                          recordKeyword: recordKeywordDraft.trim() || undefined,
                          recordPage: 1,
                        })
                      }
                    >
                      搜索
                    </Button>
                  </Space>
                  <Button icon={<ReloadOutlined />} onClick={() => void fetchRecords()}>
                    刷新
                  </Button>
                </div>
                <Table
                  rowKey="id"
                  columns={recordColumns}
                  dataSource={records}
                  loading={recordsLoading}
                  pagination={{
                    current: recordPage,
                    pageSize: recordPageSize,
                    total: recordsTotal,
                    showSizeChanger: true,
                    showTotal: (nextTotal) => `共 ${nextTotal} 条记录`,
                  }}
                  expandable={{
                    expandedRowRender: (record) => (
                      <pre className="m-0 whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs leading-5">
                        {JSON.stringify(record.detail, null, 2)}
                      </pre>
                    ),
                  }}
                  scroll={{ x: 980 }}
                  onChange={handleRecordTableChange}
                />
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
