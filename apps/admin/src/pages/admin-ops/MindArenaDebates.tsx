import { EyeOutlined } from '@ant-design/icons';
import { Button, Card, Descriptions, Drawer, message, Select, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useMemo, useState } from 'react';
import { getMindArenaDebate, listMindArenaDebates, type MindArenaDebate } from '@/api/operations';
import type { AdminListParams } from '@/types/api';
import { formatDateTime, useAdminList } from './shared';

const statusColor: Record<string, string> = {
  created: 'default',
  running: 'blue',
  done: 'green',
  failed: 'red',
};

export default function MindArenaDebates() {
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<MindArenaDebate | null>(null);
  const loader = useCallback(
    (params: AdminListParams) => listMindArenaDebates({ ...params, mode: params.type }),
    [],
  );
  const ops = useAdminList<MindArenaDebate>(loader);

  const openDetail = useCallback(async (record: MindArenaDebate) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      setDetail(await getMindArenaDebate(record.id));
    } catch (error) {
      console.error('Load debate detail failed', error);
      message.error('加载辩论详情失败');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const columns: ColumnsType<MindArenaDebate> = useMemo(
    () => [
      {
        title: '议题',
        dataIndex: 'topic',
        render: (value, record) => (
          <div>
            <div className="font-medium">{value}</div>
            <div className="font-mono text-xs text-gray-400">{record.id}</div>
          </div>
        ),
      },
      { title: '模式', dataIndex: 'mode', width: 120, render: (value) => <Tag>{value}</Tag> },
      {
        title: '状态',
        dataIndex: 'status',
        width: 110,
        render: (value: string) => <Tag color={statusColor[value] || 'default'}>{value}</Tag>,
      },
      { title: '人格', dataIndex: 'personaCount', width: 90 },
      { title: '回合', dataIndex: 'currentRound', width: 90 },
      { title: '更新时间', dataIndex: 'updatedAt', width: 180, render: formatDateTime },
      {
        title: '操作',
        key: 'action',
        width: 110,
        render: (_, record) => (
          <Button type="link" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
            详情
          </Button>
        ),
      },
    ],
    [openDetail],
  );

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Mind Arena 辩论</h2>
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {ops.searchTools}
          <Space wrap>
            <Select
              className="w-32"
              value={ops.status || 'all'}
              options={[
                { value: 'all', label: '全部状态' },
                { value: 'created', label: 'created' },
                { value: 'running', label: 'running' },
                { value: 'done', label: 'done' },
                { value: 'failed', label: 'failed' },
              ]}
              onChange={(value) =>
                ops.updateQuery({ status: value === 'all' ? undefined : value, page: 1 })
              }
            />
            <Select
              className="w-32"
              value={ops.type || 'all'}
              options={[
                { value: 'all', label: '全部模式' },
                { value: 'serious', label: 'serious' },
                { value: 'funny', label: 'funny' },
                { value: 'sharp', label: 'sharp' },
                { value: 'wild', label: 'wild' },
                { value: 'workplace', label: 'workplace' },
                { value: 'emotion', label: 'emotion' },
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
          onChange={ops.handleTableChange}
        />
      </Card>

      <Drawer
        title="辩论详情"
        width={820}
        open={detailOpen}
        loading={detailLoading}
        onClose={() => setDetailOpen(false)}
      >
        {detail ? (
          <Space direction="vertical" className="w-full" size="large">
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="议题">{detail.topic}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColor[detail.status] || 'default'}>{detail.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="赢家">{detail.result?.winner || '-'}</Descriptions.Item>
              <Descriptions.Item label="建议">
                {detail.result?.finalAdvice || detail.error || '-'}
              </Descriptions.Item>
            </Descriptions>
            <Table
              size="small"
              rowKey="id"
              dataSource={detail.messages}
              pagination={false}
              columns={[
                { title: '回合', dataIndex: 'round', width: 80 },
                { title: '人格', dataIndex: 'personaName', width: 130 },
                { title: '发言', dataIndex: 'content' },
              ]}
            />
            <Table
              size="small"
              rowKey={(record) => record.personaId || record.persona}
              dataSource={detail.result?.scores || []}
              pagination={false}
              columns={[
                { title: '人格', dataIndex: 'persona' },
                { title: '分数', dataIndex: 'score', width: 100 },
              ]}
            />
          </Space>
        ) : null}
      </Drawer>
    </div>
  );
}
