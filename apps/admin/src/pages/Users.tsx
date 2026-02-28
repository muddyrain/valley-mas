import { Table, Card, Input, Button, Space } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

interface UserRecord {
  id: string;
  nickname: string;
  openid: string;
  createdAt: string;
  downloadCount: number;
}

const mockData: UserRecord[] = [
  {
    id: '1',
    nickname: '用户A',
    openid: 'oXXXX1',
    createdAt: '2026-02-20 10:00:00',
    downloadCount: 15,
  },
  {
    id: '2',
    nickname: '用户B',
    openid: 'oXXXX2',
    createdAt: '2026-02-21 14:30:00',
    downloadCount: 8,
  },
];

const columns: ColumnsType<UserRecord> = [
  { title: 'ID', dataIndex: 'id', width: 80 },
  { title: '昵称', dataIndex: 'nickname' },
  { title: 'OpenID', dataIndex: 'openid', ellipsis: true },
  {
    title: '下载次数',
    dataIndex: 'downloadCount',
    sorter: (a, b) => a.downloadCount - b.downloadCount,
  },
  { title: '注册时间', dataIndex: 'createdAt' },
  {
    title: '操作',
    key: 'action',
    width: 120,
    render: () => (
      <Space>
        <a>查看</a>
        <a className="text-red-500">禁用</a>
      </Space>
    ),
  },
];

export default function Users() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">用户管理</h2>
      <Card>
        <div className="mb-4 flex justify-between">
          <Space>
            <Input placeholder="搜索用户" prefix={<SearchOutlined />} className="w-64" />
            <Button icon={<SearchOutlined />} type="primary">
              搜索
            </Button>
          </Space>
          <Button icon={<ReloadOutlined />}>刷新</Button>
        </div>
        <Table columns={columns} dataSource={mockData} rowKey="id" />
      </Card>
    </div>
  );
}
