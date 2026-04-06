import { DownloadOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import {
  Avatar,
  Button,
  Card,
  DatePicker,
  Image,
  Input,
  message,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import type { DownloadRecord, DownloadRecordListParams } from '../api/record';
import { exportDownloadRecords, getDownloadRecords } from '../api/record';

const { RangePicker } = DatePicker;

interface RecordFilters {
  keyword: string;
  resourceId: string;
  creatorId: string;
  userId: string;
  resourceType: string;
  dateRange: [Dayjs, Dayjs] | null;
}

const createInitialFilters = (): RecordFilters => ({
  keyword: '',
  resourceId: '',
  creatorId: '',
  userId: '',
  resourceType: '',
  dateRange: null,
});

export default function Records() {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<DownloadRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState<RecordFilters>(() => createInitialFilters());
  const [appliedFilters, setAppliedFilters] = useState<RecordFilters>(() => createInitialFilters());
  const [exporting, setExporting] = useState(false);

  // 统一把筛选状态映射到接口参数，保证列表查询和导出 CSV 用的是同一套条件。
  const buildParams = useCallback(
    (currentPage: number, currentPageSize: number): DownloadRecordListParams => {
      const params: DownloadRecordListParams = {
        page: currentPage,
        pageSize: currentPageSize,
      };

      if (appliedFilters.keyword.trim()) params.keyword = appliedFilters.keyword.trim();
      if (appliedFilters.resourceId.trim()) params.resourceId = appliedFilters.resourceId.trim();
      if (appliedFilters.creatorId.trim()) params.creatorId = appliedFilters.creatorId.trim();
      if (appliedFilters.userId.trim()) params.userId = appliedFilters.userId.trim();
      if (appliedFilters.resourceType) params.resourceType = appliedFilters.resourceType;
      if (appliedFilters.dateRange) {
        params.dateFrom = appliedFilters.dateRange[0].startOf('day').format('YYYY-MM-DD HH:mm:ss');
        params.dateTo = appliedFilters.dateRange[1].endOf('day').format('YYYY-MM-DD HH:mm:ss');
      }

      return params;
    },
    [appliedFilters],
  );

  // 加载数据
  const loadRecords = useCallback(async () => {
    try {
      setLoading(true);
      const params = buildParams(page, pageSize);
      const res = await getDownloadRecords(params);
      setRecords(res.list);
      setTotal(res.total);
    } catch (error) {
      message.error('加载下载记录失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [buildParams, page, pageSize]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const handleSearch = () => {
    setPage(1);
    setAppliedFilters(filters);
  };

  const handleReset = () => {
    const next = createInitialFilters();
    setFilters(next);
    setAppliedFilters(next);
    setPage(1);
    setPageSize(10);
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const blob = await exportDownloadRecords(buildParams(1, pageSize));
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `download-records-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch (error) {
      console.error(error);
      message.error('导出下载记录失败');
    } finally {
      setExporting(false);
    }
  };

  // 管理后台需要明确区分“下载用户”和“创作者”，避免误把创作者当成实际下载者展示。
  const downloadColumns: ColumnsType<DownloadRecord> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 180,
      ellipsis: true,
    },
    {
      title: '用户',
      dataIndex: 'user',
      width: 150,
      render: (_, record) => (
        <Space>
          <Avatar src={record.user?.avatar} size="small">
            {record.user?.nickname?.[0] || '匿'}
          </Avatar>
          <div className="leading-5">
            <div>{record.user?.nickname || (record.userId === '0' ? '匿名下载' : '未知用户')}</div>
            <div className="text-xs text-gray-400">{record.userId}</div>
          </div>
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
            src={resource?.url}
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
            <Tag color={resource?.type === 'avatar' ? 'blue' : 'purple'} className="text-xs">
              {resource?.type === 'avatar'
                ? '头像'
                : resource?.type === 'wallpaper'
                  ? '壁纸'
                  : resource?.type || '未知类型'}
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
          <div className="leading-5">
            <div>{creator?.user?.nickname || '未知'}</div>
            <div className="text-xs text-gray-400">{creator?.code || '-'}</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'IP 地址',
      dataIndex: 'ip',
      width: 130,
    },
    {
      title: 'User-Agent',
      dataIndex: 'userAgent',
      width: 240,
      ellipsis: true,
      render: (value: string) => (
        <Tooltip title={value}>
          <span>{value || '-'}</span>
        </Tooltip>
      ),
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
      <Card className="mb-4">
        <Space wrap size={[12, 12]}>
          <Input
            allowClear
            value={filters.keyword}
            onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))}
            onPressEnter={handleSearch}
            prefix={<SearchOutlined />}
            placeholder="搜索资源标题 / 创作者 / 下载用户 / IP"
            style={{ width: 280 }}
          />
          <Input
            allowClear
            value={filters.resourceId}
            onChange={(e) => setFilters((prev) => ({ ...prev, resourceId: e.target.value }))}
            placeholder="资源 ID"
            style={{ width: 180 }}
          />
          <Input
            allowClear
            value={filters.creatorId}
            onChange={(e) => setFilters((prev) => ({ ...prev, creatorId: e.target.value }))}
            placeholder="创作者 ID"
            style={{ width: 180 }}
          />
          <Input
            allowClear
            value={filters.userId}
            onChange={(e) => setFilters((prev) => ({ ...prev, userId: e.target.value }))}
            placeholder="下载用户 ID"
            style={{ width: 180 }}
          />
          <Select
            allowClear
            value={filters.resourceType || undefined}
            onChange={(value) => setFilters((prev) => ({ ...prev, resourceType: value || '' }))}
            placeholder="资源类型"
            style={{ width: 140 }}
            options={[
              { label: '头像', value: 'avatar' },
              { label: '壁纸', value: 'wallpaper' },
            ]}
          />
          <RangePicker
            value={filters.dateRange}
            onChange={(value) =>
              setFilters((prev) => ({
                ...prev,
                dateRange: value ? ([value[0], value[1]] as [Dayjs, Dayjs]) : null,
              }))
            }
            allowEmpty={[true, true]}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            筛选
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport} loading={exporting}>
            导出 CSV
          </Button>
        </Space>
      </Card>

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
          scroll={{ x: 1400 }}
        />
      </Card>
    </div>
  );
}
