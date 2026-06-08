import { Card, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useMemo } from 'react';
import {
  listFavorites,
  listFollows,
  type RelationFavorite,
  type RelationFollow,
} from '@/api/operations';
import type { AdminListParams, AdminListResponse } from '@/types/api';
import { formatDateTime, useAdminList } from './shared';

type RelationKind = 'favorites' | 'follows';
type RelationRow = RelationFavorite | RelationFollow;

export default function Relations({ kind }: { kind: RelationKind }) {
  const loader = useCallback(
    (params: AdminListParams) =>
      kind === 'favorites' ? listFavorites(params) : listFollows(params),
    [kind],
  ) as (params: AdminListParams) => Promise<AdminListResponse<RelationRow>>;
  const ops = useAdminList<RelationRow>(loader);

  const columns: ColumnsType<RelationRow> = useMemo(
    () => [
      {
        title: '用户',
        dataIndex: 'user',
        width: 220,
        render: (user: RelationRow['user'], record) =>
          user?.nickname || ('userId' in record ? record.userId : '-'),
      },
      {
        title: kind === 'favorites' ? '资源' : '创作者',
        key: 'target',
        render: (_, record) => {
          if ('resource' in record) {
            return (
              <div>
                <div>{record.resource?.title || record.resourceId}</div>
                {record.resource?.type ? <Tag>{record.resource.type}</Tag> : null}
              </div>
            );
          }
          if ('creator' in record) {
            return record.creator?.user?.nickname || record.creator?.code || record.creatorId;
          }
          return '-';
        },
      },
      { title: '时间', dataIndex: 'createdAt', width: 180, render: formatDateTime },
    ],
    [kind],
  );

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">{kind === 'favorites' ? '收藏关系' : '关注关系'}</h2>
      <Card>
        <div className="mb-4">{ops.searchTools}</div>
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
    </div>
  );
}
