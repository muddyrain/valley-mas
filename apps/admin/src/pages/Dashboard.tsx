import {
  CrownOutlined,
  DownloadOutlined,
  EyeOutlined,
  PictureOutlined,
  RiseOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Card, Col, message, Row, Statistic, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { reqGetStats, reqGetTrends, type StatsData, type TrendsData } from '../api/stats';

export default function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [trends, setTrends] = useState<TrendsData | null>(null);

  // 获取统计数据
  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await reqGetStats();
      setStats(data);
    } catch (error) {
      message.error('获取统计数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取趋势数据
  const fetchTrends = useCallback(async () => {
    try {
      const data = await reqGetTrends();
      setTrends(data);
    } catch (error) {
      message.error('获取趋势数据失败');
      console.error(error);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
    void fetchTrends();
  }, [fetchStats, fetchTrends]);

  // 热门资源列表配置
  const resourceColumns: ColumnsType<StatsData['topResources'][0]> = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_, __, index) => <span className="font-bold text-lg">{index + 1}</span>,
    },
    {
      title: '资源',
      dataIndex: 'title',
      render: (title, record) => (
        <div className="flex items-center gap-2">
          <img
            src={record.url}
            alt={title}
            className="w-10 h-10 object-cover rounded"
            onError={(e) => {
              e.currentTarget.src =
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
            }}
          />
          <div>
            <div className="font-medium">{title}</div>
            <Tag color={record.type === 'avatar' ? 'blue' : 'purple'} className="text-xs">
              {record.type === 'avatar' ? '头像' : '壁纸'}
            </Tag>
          </div>
        </div>
      ),
    },
    {
      title: '下载量',
      dataIndex: 'downloadCount',
      width: 100,
      render: (count) => <span className="font-bold text-blue-600">{count.toLocaleString()}</span>,
    },
  ];

  // 热门创作者列表配置
  const creatorColumns: ColumnsType<StatsData['topCreators'][0]> = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_, __, index) => <span className="font-bold text-lg">{index + 1}</span>,
    },
    {
      title: '创作者',
      dataIndex: 'creator',
      render: (creator) => (
        <div className="flex items-center gap-2">
          {creator?.avatar ? (
            <img
              src={creator.avatar}
              alt={creator.name}
              className="w-10 h-10 object-cover rounded-full"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center">
              {creator?.name?.[0] || '?'}
            </div>
          )}
          <div>
            <div className="font-medium">{creator?.name || '未知'}</div>
            <Tag className="text-xs">{creator?.code}</Tag>
          </div>
        </div>
      ),
    },
    {
      title: '资源数',
      dataIndex: 'resourceCount',
      width: 100,
      render: (count) => <span className="font-bold text-green-600">{count}</span>,
    },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">数据概览</h2>

      {/* 核心指标 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="用户总数"
              value={stats?.overview.userCount || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="创作者数"
              value={stats?.overview.creatorCount || 0}
              prefix={<CrownOutlined />}
              suffix={`/ ${stats?.overview.activeCreatorCount || 0} 活跃`}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="资源总数"
              value={stats?.overview.resourceCount || 0}
              prefix={<PictureOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="下载次数"
              value={stats?.overview.downloadCount || 0}
              prefix={<DownloadOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 二级指标 */}
      <Row gutter={[16, 16]} className="mt-4">
        <Col xs={24} sm={12} lg={8}>
          <Card loading={loading}>
            <Statistic
              title="空间访问量"
              value={stats?.overview.accessCount || 0}
              prefix={<EyeOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card loading={loading}>
            <Statistic
              title="头像资源"
              value={stats?.resources.avatar || 0}
              prefix={<PictureOutlined />}
              suffix={`/ ${stats?.resources.total || 0}`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card loading={loading}>
            <Statistic
              title="壁纸资源"
              value={stats?.resources.wallpaper || 0}
              prefix={<PictureOutlined />}
              suffix={`/ ${stats?.resources.total || 0}`}
            />
          </Card>
        </Col>
      </Row>

      {/* 排行榜 */}
      <Row gutter={[16, 16]} className="mt-4">
        <Col xs={24} lg={12}>
          <Card
            title={
              <span>
                <RiseOutlined className="mr-2" />
                热门资源 TOP 5
              </span>
            }
            loading={loading}
          >
            <Table
              columns={resourceColumns}
              dataSource={stats?.topResources || []}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={
              <span>
                <CrownOutlined className="mr-2" />
                活跃创作者 TOP 5
              </span>
            }
            loading={loading}
          >
            <Table
              columns={creatorColumns}
              dataSource={stats?.topCreators || []}
              rowKey="creatorId"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      {/* 趋势图表 */}
      {trends && (
        <Row gutter={[16, 16]} className="mt-4">
          {/* 折线图 - 总览趋势 */}
          <Col xs={24}>
            <Card title="数据趋势（最近 7 天）">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={trends.dates.map((date, index) => ({
                    date,
                    新增用户: trends.series.find((s) => s.name === '新增用户')?.data[index] || 0,
                    新增创作者:
                      trends.series.find((s) => s.name === '新增创作者')?.data[index] || 0,
                    新增资源: trends.series.find((s) => s.name === '新增资源')?.data[index] || 0,
                    下载次数: trends.series.find((s) => s.name === '下载次数')?.data[index] || 0,
                  }))}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="新增用户" stroke="#3f8600" strokeWidth={2} />
                  <Line type="monotone" dataKey="新增创作者" stroke="#cf1322" strokeWidth={2} />
                  <Line type="monotone" dataKey="新增资源" stroke="#1890ff" strokeWidth={2} />
                  <Line type="monotone" dataKey="下载次数" stroke="#722ed1" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </Col>

          {/* 柱状图 - 下载趋势 */}
          <Col xs={24} lg={12}>
            <Card title="下载趋势">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={trends.dates.map((date, index) => ({
                    date,
                    下载次数: trends.series.find((s) => s.name === '下载次数')?.data[index] || 0,
                  }))}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="下载次数" fill="#722ed1" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>

          {/* 面积图 - 用户增长 */}
          <Col xs={24} lg={12}>
            <Card title="用户增长趋势">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart
                  data={trends.dates.map((date, index) => ({
                    date,
                    新增用户: trends.series.find((s) => s.name === '新增用户')?.data[index] || 0,
                    新增创作者:
                      trends.series.find((s) => s.name === '新增创作者')?.data[index] || 0,
                  }))}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="新增用户"
                    stackId="1"
                    stroke="#3f8600"
                    fill="#3f8600"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="新增创作者"
                    stackId="1"
                    stroke="#cf1322"
                    fill="#cf1322"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
}
