import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import {
  Avatar,
  Button,
  Card,
  Descriptions,
  Image,
  Input,
  Modal,
  message,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Feedback, FeedbackStatus } from '../api/feedback';
import { reqGetFeedbackList, reqUpdateFeedbackStatus } from '../api/feedback';

const statusLabels: Record<FeedbackStatus, string> = {
  open: '待处理',
  resolved: '已解决',
};

function parsePositiveNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatDateTime(value?: string) {
  if (!value) {
    return '-';
  }
  return new Date(value).toLocaleString();
}

function getUserName(record: Feedback) {
  return record.user?.nickname || record.user?.username || record.userId;
}

export default function Feedbacks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<Feedback[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [keywordDraft, setKeywordDraft] = useState(searchParams.get('keyword') ?? '');
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);

  const page = parsePositiveNumber(searchParams.get('page'), 1);
  const pageSize = parsePositiveNumber(searchParams.get('pageSize'), 10);
  const status = (searchParams.get('status') || 'open') as FeedbackStatus | 'all';
  const app = searchParams.get('app') || 'life-trace';
  const keyword = searchParams.get('keyword') ?? '';

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

  const fetchFeedbacks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reqGetFeedbackList({
        page,
        pageSize,
        status,
        app,
        keyword: keyword || undefined,
      });
      setData(res.list || []);
      setTotal(res.total || 0);
    } catch (error) {
      console.error('Fetch feedbacks failed', error);
    } finally {
      setLoading(false);
    }
  }, [app, keyword, page, pageSize, status]);

  useEffect(() => {
    setKeywordDraft(keyword);
  }, [keyword]);

  useEffect(() => {
    void fetchFeedbacks();
  }, [fetchFeedbacks]);

  const handleTableChange = (pagination: TablePaginationConfig) => {
    updateQuery({
      page: pagination.current || 1,
      pageSize: pagination.pageSize || 10,
    });
  };

  const handleSearch = () => {
    updateQuery({ keyword: keywordDraft.trim() || undefined, page: 1 });
  };

  const handleStatusChange = useCallback(
    async (record: Feedback, nextStatus: FeedbackStatus) => {
      try {
        const updated = await reqUpdateFeedbackStatus(record.id, nextStatus);
        message.success(nextStatus === 'resolved' ? '已标记解决' : '已重新打开');
        setData((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        setSelectedFeedback((prev) => (prev?.id === updated.id ? updated : prev));
        void fetchFeedbacks();
      } catch (error) {
        console.error('Update feedback status failed', error);
        message.error('状态更新失败');
      }
    },
    [fetchFeedbacks],
  );

  const columns: ColumnsType<Feedback> = useMemo(
    () => [
      {
        title: '反馈人',
        key: 'user',
        width: 190,
        render: (_, record) => (
          <div className="flex min-w-0 items-center">
            <Avatar src={record.user?.avatar} size={36}>
              {getUserName(record).charAt(0)}
            </Avatar>
            <div className="ml-2 min-w-0 flex-1">
              <Tooltip title={getUserName(record)}>
                <div className="truncate font-medium">{getUserName(record)}</div>
              </Tooltip>
              <div className="truncate text-xs text-gray-400">ID: {record.userId}</div>
            </div>
          </div>
        ),
      },
      {
        title: '应用',
        dataIndex: 'app',
        width: 120,
        render: (value) => <Tag color={value === 'life-trace' ? 'cyan' : 'default'}>{value}</Tag>,
      },
      {
        title: '内容',
        dataIndex: 'content',
        ellipsis: true,
        render: (value) => (
          <Tooltip title={value}>
            <span>{value}</span>
          </Tooltip>
        ),
      },
      {
        title: '图片',
        dataIndex: 'imageUrls',
        width: 90,
        render: (urls: string[]) => (urls?.length ? `${urls.length} 张` : '无'),
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        render: (value: FeedbackStatus) => (
          <Tag color={value === 'resolved' ? 'green' : 'orange'}>{statusLabels[value]}</Tag>
        ),
      },
      {
        title: '反馈时间',
        dataIndex: 'createdAt',
        width: 180,
        render: (value) => formatDateTime(value),
      },
      {
        title: '操作',
        key: 'action',
        width: 180,
        fixed: 'right',
        render: (_, record) => (
          <Space>
            <a onClick={() => setSelectedFeedback(record)}>查看</a>
            {record.status === 'resolved' ? (
              <Popconfirm
                title="确认重新打开这条反馈吗？"
                onConfirm={() => handleStatusChange(record, 'open')}
              >
                <a>重新打开</a>
              </Popconfirm>
            ) : (
              <Popconfirm
                title="确认标记这条反馈为已解决吗？"
                onConfirm={() => handleStatusChange(record, 'resolved')}
              >
                <a>标记解决</a>
              </Popconfirm>
            )}
          </Space>
        ),
      },
    ],
    [handleStatusChange],
  );

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">问题反馈</h2>
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Space wrap>
            <Input
              placeholder="搜索内容/反馈人"
              prefix={<SearchOutlined />}
              className="w-64"
              value={keywordDraft}
              onChange={(event) => setKeywordDraft(event.target.value)}
              onPressEnter={handleSearch}
              allowClear
            />
            <Select
              className="w-32"
              value={status}
              onChange={(value) => updateQuery({ status: value, page: 1 })}
              options={[
                { value: 'open', label: '待处理' },
                { value: 'resolved', label: '已解决' },
                { value: 'all', label: '全部状态' },
              ]}
            />
            <Select
              className="w-36"
              value={app}
              onChange={(value) => updateQuery({ app: value, page: 1 })}
              options={[
                { value: 'life-trace', label: 'Life Trace' },
                { value: 'all', label: '全部应用' },
              ]}
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
              搜索
            </Button>
          </Space>
          <Button icon={<ReloadOutlined />} onClick={() => void fetchFeedbacks()}>
            刷新
          </Button>
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (nextTotal) => `共 ${nextTotal} 条`,
          }}
          scroll={{ x: 1100 }}
          onChange={handleTableChange}
        />
      </Card>

      <Modal
        title="反馈详情"
        open={Boolean(selectedFeedback)}
        width={760}
        footer={null}
        onCancel={() => setSelectedFeedback(null)}
      >
        {selectedFeedback ? (
          <div className="space-y-5">
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="反馈人">{getUserName(selectedFeedback)}</Descriptions.Item>
              <Descriptions.Item label="用户 ID">{selectedFeedback.userId}</Descriptions.Item>
              <Descriptions.Item label="应用">{selectedFeedback.app}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={selectedFeedback.status === 'resolved' ? 'green' : 'orange'}>
                  {statusLabels[selectedFeedback.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="反馈时间">
                {formatDateTime(selectedFeedback.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="解决时间">
                {formatDateTime(selectedFeedback.resolvedAt)}
              </Descriptions.Item>
              <Descriptions.Item label="反馈内容">
                <div className="whitespace-pre-wrap leading-6">{selectedFeedback.content}</div>
              </Descriptions.Item>
            </Descriptions>

            {selectedFeedback.imageUrls?.length ? (
              <div>
                <div className="mb-2 font-medium">反馈图片</div>
                <Image.PreviewGroup>
                  <div className="grid grid-cols-3 gap-3">
                    {selectedFeedback.imageUrls.map((url) => (
                      <Image
                        key={url}
                        src={url}
                        alt="反馈图片"
                        className="rounded-lg object-cover"
                        height={140}
                      />
                    ))}
                  </div>
                </Image.PreviewGroup>
              </div>
            ) : null}

            <Space>
              {selectedFeedback.status === 'resolved' ? (
                <Button onClick={() => handleStatusChange(selectedFeedback, 'open')}>
                  重新打开
                </Button>
              ) : (
                <Button
                  type="primary"
                  onClick={() => handleStatusChange(selectedFeedback, 'resolved')}
                >
                  标记解决
                </Button>
              )}
              <Button onClick={() => setSelectedFeedback(null)}>关闭</Button>
            </Space>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
