import { Avatar, Card, Image, message, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import type { DownloadRecord, DownloadRecordListParams } from '../api/record';
import { getDownloadRecords } from '../api/record';

export default function Records() {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<DownloadRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 加载数据
  const loadRecords = useCallback(async () => {
    try {
      setLoading(true);
      const params: DownloadRecordListParams = {
        page,
        pageSize,
      };

      // 如果有关键词,可以根据需要添加具体筛选
      // 这里简单起见,暂不处理关键词搜索
      // 可以后续添加具体的筛选字段下拉选择

      const res = await getDownloadRecords(params);
      setRecords(res.list);
      setTotal(res.total);
    } catch (error) {
      message.error('加载下载记录失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // 处理搜索 - 暂时移除,后续可添加高级筛选
  // const handleSearch = (value: string) => {
  //   setKeyword(value);
  //   setPage(1);
  // };

  const downloadColumns: ColumnsType<DownloadRecord> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 180,
      ellipsis: true,
    },
    {
      title: '用户',
      dataIndex: 'creator',
      width: 150,
      render: (creator) => (
        <Space>
          <Avatar src={creator?.user?.avatar} size="small">
            {creator?.user?.nickname?.[0]}
          </Avatar>
          <span>{creator?.user?.nickname || '未知用户'}</span>
        </Space>
      ),
    },
    {
      title: '资源',
      dataIndex: 'resource',
      width: 250,
      render: (resource) => (
        <Space>
          <Image
            src={resource?.thumbnailUrl || resource?.url}
            alt={resource?.title}
            width={40}
            height={40}
            style={{ objectFit: 'cover', borderRadius: 4 }}
            preview={{
              src: resource?.url,
            }}
          />
          <div>
            <div className="font-medium">{resource?.title || '未知资源'}</div>
            <Tag color="blue" className="text-xs">
              {resource?.type === 'avatar' ? '头像' : '壁纸'}
            </Tag>
          </div>
        </Space>
      ),
    },
    {
      title: '创作者',
      dataIndex: 'creator',
      width: 150,
      render: (creator) => (
        <Space>
          <Avatar src={creator?.user?.avatar} size="small">
            {creator?.user?.nickname?.[0]}
          </Avatar>
          <span>{creator?.user?.nickname || '未知'}</span>
        </Space>
      ),
    },
    {
      title: 'IP 地址',
      dataIndex: 'ip',
      width: 130,
    },
    {
      title: '下载时间',
      dataIndex: 'createdAt',
      width: 170,
      render: (time) => new Date(time).toLocaleString('zh-CN'),
    },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">下载记录</h2>
      <Card>
        <Table
          columns={downloadColumns}
          dataSource={records}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, pageSize) => {
              setPage(page);
              setPageSize(pageSize);
            },
          }}
        />
      </Card>
    </div>
  );
}
