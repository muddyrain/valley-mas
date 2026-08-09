import { Card, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo } from 'react';
import { listResourceTagStats, type ResourceTagStat } from '@/api/operations';
import { useAdminList } from '@/hooks/useAdminList';

export default function ResourceTags() {
  const ops = useAdminList<ResourceTagStat>(listResourceTagStats);

  const columns: ColumnsType<ResourceTagStat> = useMemo(
    () => [
      { title: '标签名', dataIndex: 'name' },
      {
        title: '资源数',
        dataIndex: 'resourceCount',
        width: 160,
        sorter: (a, b) => a.resourceCount - b.resourceCount,
      },
    ],
    [],
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="mb-1 text-2xl font-bold">资源标签统计</h2>
          <p className="mb-0 text-sm text-gray-500">
            汇总当前资源实际使用的标签名及数量，仅用于查看，不再维护标签库。
          </p>
        </div>
      </div>
      <Card>
        <div className="mb-4">{ops.searchTools}</div>
        <Table
          rowKey="name"
          columns={columns}
          dataSource={ops.data}
          loading={ops.loading}
          pagination={{
            current: ops.page,
            pageSize: ops.pageSize,
            total: ops.total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个标签`,
          }}
          onChange={ops.handleTableChange}
        />
      </Card>
    </div>
  );
}
