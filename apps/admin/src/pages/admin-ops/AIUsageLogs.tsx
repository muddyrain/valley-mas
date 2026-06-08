import { EyeOutlined } from '@ant-design/icons';
import { Button, Card, Descriptions, Drawer, Select, Space, Statistic, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type AdminAIUsageLog,
  type AdminAIUsageSummary,
  getAIUsageSummary,
  listAIUsageLogs,
} from '@/api/operations';
import type { AdminListParams } from '@/types/api';
import { formatDateTime, useAdminList } from './shared';

const statusColor: Record<string, string> = {
  success: 'green',
  failed: 'red',
};

function percent(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

export default function AIUsageLogs() {
  const [detail, setDetail] = useState<AdminAIUsageLog | null>(null);
  const [summary, setSummary] = useState<AdminAIUsageSummary | null>(null);
  const loader = useCallback((params: AdminListParams) => listAIUsageLogs(params), []);
  const ops = useAdminList<AdminAIUsageLog>(loader);

  useEffect(() => {
    void getAIUsageSummary({
      status: ops.status || undefined,
      type: ops.type || undefined,
      userId: ops.userId || undefined,
    }).then(setSummary);
  }, [ops.status, ops.type, ops.userId]);

  const columns: ColumnsType<AdminAIUsageLog> = useMemo(
    () => [
      {
        title: '功能',
        dataIndex: 'feature',
        render: (value: string, record) => (
          <div>
            <div className="font-medium">{value}</div>
            <div className="text-xs text-gray-400">
              {record.provider} / {record.model || '-'}
            </div>
          </div>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        render: (value: string) => <Tag color={statusColor[value] || 'default'}>{value}</Tag>,
      },
      { title: '用户', dataIndex: 'userId', width: 140, render: (value?: string) => value || '-' },
      {
        title: '字符',
        key: 'chars',
        width: 130,
        render: (_, record) => `${record.promptChars} / ${record.responseChars}`,
      },
      { title: 'Token', dataIndex: 'totalTokens', width: 100 },
      {
        title: '耗时',
        dataIndex: 'latencyMs',
        width: 100,
        render: (value: number) => `${value}ms`,
      },
      { title: '时间', dataIndex: 'createdAt', width: 180, render: formatDateTime },
      {
        title: '操作',
        key: 'action',
        width: 90,
        render: (_, record) => (
          <Button type="link" icon={<EyeOutlined />} onClick={() => setDetail(record)}>
            详情
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">AI 调用审计</h2>
      <Space direction="vertical" className="w-full" size="large">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <Statistic title="调用数" value={summary?.calls || 0} />
          </Card>
          <Card>
            <Statistic title="失败数" value={summary?.failures || 0} />
          </Card>
          <Card>
            <Statistic title="失败率" value={percent(summary?.failureRate || 0)} />
          </Card>
          <Card>
            <Statistic
              title="平均耗时"
              value={Math.round(summary?.avgLatencyMs || 0)}
              suffix="ms"
            />
          </Card>
        </div>
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            {ops.searchTools}
            <Space wrap>
              <Select
                className="w-36"
                value={ops.status || 'all'}
                options={[
                  { value: 'all', label: '全部状态' },
                  { value: 'success', label: '成功' },
                  { value: 'failed', label: '失败' },
                ]}
                onChange={(value) =>
                  ops.updateQuery({ status: value === 'all' ? undefined : value, page: 1 })
                }
              />
              <Select
                className="w-52"
                value={ops.type || 'all'}
                options={[
                  { value: 'all', label: '全部功能' },
                  { value: 'valley-ai-chat', label: 'Valley AI Chat' },
                  { value: 'life-trace-today-advice', label: 'Today Advice' },
                  { value: 'life-trace-weekly-review', label: 'Weekly Review' },
                  { value: 'life-trace-recipe', label: 'Recipe' },
                  { value: 'life-trace-image', label: 'Image' },
                  { value: 'life-trace-pantry-photo', label: 'Pantry Photo' },
                ]}
                onChange={(value) =>
                  ops.updateQuery({ type: value === 'all' ? undefined : value, page: 1 })
                }
              />
            </Space>
          </div>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={ops.data}
            loading={ops.loading}
            pagination={{
              current: ops.page,
              pageSize: ops.pageSize,
              total: ops.total,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
            scroll={{ x: 1100 }}
            onChange={ops.handleTableChange}
          />
        </Card>
      </Space>

      <Drawer
        title="AI 调用详情"
        width={640}
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
      >
        {detail ? (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="功能">{detail.feature}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusColor[detail.status] || 'default'}>{detail.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="模型">
              {detail.provider} / {detail.model || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="用户">{detail.userId || '-'}</Descriptions.Item>
            <Descriptions.Item label="流式">{detail.stream ? '是' : '否'}</Descriptions.Item>
            <Descriptions.Item label="字符">
              {detail.promptChars} / {detail.responseChars}
            </Descriptions.Item>
            <Descriptions.Item label="Token">
              {detail.promptTokens} / {detail.completionTokens} / {detail.totalTokens}
            </Descriptions.Item>
            <Descriptions.Item label="耗时">{detail.latencyMs}ms</Descriptions.Item>
            <Descriptions.Item label="错误">{detail.errorMessage || '-'}</Descriptions.Item>
            <Descriptions.Item label="时间">{formatDateTime(detail.createdAt)}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>
    </div>
  );
}
