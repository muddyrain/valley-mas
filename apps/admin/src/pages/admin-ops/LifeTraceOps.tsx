import { Card, Select, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useMemo } from 'react';
import { type LifeTraceOpsRecord, listLifeTraceOps } from '@/api/operations';
import type { AdminListParams } from '@/types/api';
import { formatDateTime, useAdminList } from './shared';

type LifeTraceOpsKind =
  | 'households'
  | 'push-subscriptions'
  | 'push-deliveries'
  | 'ai-conversations'
  | 'holiday-calendars';

const titleMap: Record<LifeTraceOpsKind, string> = {
  households: '家庭空间',
  'push-subscriptions': '推送订阅',
  'push-deliveries': '推送投递',
  'ai-conversations': 'AI 对话',
  'holiday-calendars': '节假日缓存',
};

export default function LifeTraceOps({ kind }: { kind: LifeTraceOpsKind }) {
  const loader = useCallback((params: AdminListParams) => listLifeTraceOps(kind, params), [kind]);
  const ops = useAdminList<LifeTraceOpsRecord>(loader);

  const columns: ColumnsType<LifeTraceOpsRecord> = useMemo(
    () => [
      {
        title: '记录',
        dataIndex: 'title',
        render: (value, record) => (
          <div>
            <div className="font-medium">{value}</div>
            <div className="text-xs text-gray-400">
              {record.userName || record.userId || record.id}
            </div>
          </div>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 140,
        render: (value?: string) => (value ? <Tag>{value}</Tag> : '-'),
      },
      { title: '来源', dataIndex: 'source', width: 180, render: (value?: string) => value || '-' },
      { title: '时间', dataIndex: 'createdAt', width: 180, render: formatDateTime },
    ],
    [],
  );

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">{titleMap[kind]}</h2>
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {ops.searchTools}
          {kind === 'push-deliveries' ? (
            <Select
              className="w-44"
              value={ops.type || 'push-plan-deliveries'}
              options={[
                { value: 'push-plan-deliveries', label: '计划推送' },
                { value: 'push-daily-deliveries', label: '简报推送' },
                { value: 'push-pantry-deliveries', label: '库存推送' },
              ]}
              onChange={(value) => ops.updateQuery({ type: value, page: 1 })}
            />
          ) : null}
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
          expandable={{
            expandedRowRender: (record) => (
              <pre className="m-0 whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs leading-5">
                {JSON.stringify(record.detail, null, 2)}
              </pre>
            ),
          }}
          onChange={ops.handleTableChange}
        />
      </Card>
    </div>
  );
}
