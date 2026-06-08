import { Button, Card, Descriptions, Drawer, Select, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useMemo, useState } from 'react';
import {
  type CodeAccessLog,
  listCodeAccessLogs,
  listOperationLogs,
  listStorageAssets,
  type OperationLog,
  type StorageAsset,
} from '@/api/operations';
import type { AdminListParams, AdminListResponse } from '@/types/api';
import { formatDateTime, useAdminList } from './shared';

type AuditKind = 'operation-logs' | 'code-access-logs' | 'storage-assets';
type AuditRow = OperationLog | CodeAccessLog | StorageAsset;

const titleMap: Record<AuditKind, string> = {
  'operation-logs': '操作日志',
  'code-access-logs': '口令访问日志',
  'storage-assets': '存储资产',
};

export default function AuditLogs({ kind }: { kind: AuditKind }) {
  const [assetDetail, setAssetDetail] = useState<StorageAsset | null>(null);
  const loader = useCallback(
    (params: AdminListParams) => {
      if (kind === 'code-access-logs') return listCodeAccessLogs(params);
      if (kind === 'storage-assets') return listStorageAssets({ ...params, kind: params.type });
      return listOperationLogs(params);
    },
    [kind],
  ) as (params: AdminListParams) => Promise<AdminListResponse<AuditRow>>;

  const ops = useAdminList<AuditRow>(loader);

  const columns: ColumnsType<AuditRow> = useMemo(() => {
    if (kind === 'operation-logs') {
      return [
        { title: '方法', dataIndex: 'method', width: 90 },
        { title: '路径', dataIndex: 'path', ellipsis: true },
        {
          title: '状态',
          dataIndex: 'status',
          width: 90,
          render: (value: number) => <Tag color={value >= 500 ? 'red' : 'green'}>{value}</Tag>,
        },
        {
          title: '耗时',
          dataIndex: 'latencyMs',
          width: 100,
          render: (value: number) => `${value}ms`,
        },
        { title: '用户', dataIndex: 'userId', width: 130 },
        { title: 'IP', dataIndex: 'ip', width: 140 },
        { title: '时间', dataIndex: 'createdAt', width: 180, render: formatDateTime },
      ];
    }
    if (kind === 'code-access-logs') {
      return [
        { title: '口令', dataIndex: 'code', width: 120 },
        { title: '创作者', dataIndex: 'creatorId', width: 160 },
        { title: 'IP', dataIndex: 'ip', width: 150 },
        { title: 'User-Agent', dataIndex: 'userAgent', ellipsis: true },
        { title: '时间', dataIndex: 'createdAt', width: 180, render: formatDateTime },
      ];
    }
    return [
      {
        title: '类型',
        dataIndex: 'kind',
        width: 130,
        render: (value: string) => <Tag>{value}</Tag>,
      },
      { title: 'URL', dataIndex: 'url', ellipsis: true },
      { title: '存储 Key', dataIndex: 'storageKey', ellipsis: true },
      { title: '归属', dataIndex: 'ownerId', width: 150 },
      {
        title: '引用',
        dataIndex: 'referenced',
        width: 100,
        render: (value: boolean, record) => {
          const asset = record as StorageAsset;
          return (
            <Tag color={value ? 'green' : 'orange'}>
              {value ? `已引用 ${asset.referenceCount}` : '未引用'}
            </Tag>
          );
        },
      },
      {
        title: '风险',
        dataIndex: 'risk',
        width: 130,
        render: (value?: string) => (value ? <Tag color="orange">{value}</Tag> : '-'),
      },
      { title: '状态', dataIndex: 'status', width: 120, render: (value?: string) => value || '-' },
      { title: '时间', dataIndex: 'createdAt', width: 180, render: formatDateTime },
      {
        title: '操作',
        key: 'action',
        width: 90,
        render: (_, record) => (
          <Button type="link" onClick={() => setAssetDetail(record as StorageAsset)}>
            详情
          </Button>
        ),
      },
    ];
  }, [kind]);

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">{titleMap[kind]}</h2>
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {ops.searchTools}
          {kind === 'storage-assets' ? (
            <Space wrap>
              <Select
                className="w-36"
                value={ops.type || 'all'}
                options={[
                  { value: 'all', label: '全部资产' },
                  { value: 'resource', label: '资源' },
                  { value: 'avatar', label: '头像' },
                  { value: 'blog-cover', label: '博客封面' },
                ]}
                onChange={(value) =>
                  ops.updateQuery({ type: value === 'all' ? undefined : value, page: 1 })
                }
              />
              <Select
                className="w-40"
                value={ops.risk || 'all'}
                options={[
                  { value: 'all', label: '全部风险' },
                  { value: 'orphan-suspected', label: '疑似孤儿' },
                ]}
                onChange={(value) =>
                  ops.updateQuery({ risk: value === 'all' ? undefined : value, page: 1 })
                }
              />
            </Space>
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
          scroll={{ x: 1100 }}
          onChange={ops.handleTableChange}
        />
      </Card>
      <Drawer
        title="存储资产详情"
        width={640}
        open={Boolean(assetDetail)}
        onClose={() => setAssetDetail(null)}
      >
        {assetDetail ? (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="类型">{assetDetail.kind}</Descriptions.Item>
            <Descriptions.Item label="来源">{assetDetail.source}</Descriptions.Item>
            <Descriptions.Item label="URL">{assetDetail.url}</Descriptions.Item>
            <Descriptions.Item label="存储 Key">{assetDetail.storageKey || '-'}</Descriptions.Item>
            <Descriptions.Item label="归属">{assetDetail.ownerId || '-'}</Descriptions.Item>
            <Descriptions.Item label="引用">
              {assetDetail.referenced ? `已引用 ${assetDetail.referenceCount}` : '未引用'}
            </Descriptions.Item>
            <Descriptions.Item label="风险">{assetDetail.risk || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">{assetDetail.status || '-'}</Descriptions.Item>
            <Descriptions.Item label="时间">
              {formatDateTime(assetDetail.createdAt)}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>
    </div>
  );
}
