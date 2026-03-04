import { Line } from '@ant-design/charts';
import {
  DownloadOutlined,
  EyeOutlined,
  FileImageOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import { Card, Col, Image, Row, Statistic, Table, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { type CreatorStats, reqGetCreatorStats } from '../api/creator';

const { Title } = Typography;

export default function CreatorDashboard() {
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [loading, setLoading] = useState(false);

  // 加载统计数据
  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const data = await reqGetCreatorStats();
        setStats(data);
      } catch (error) {
        console.error('加载统计数据失败', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (!stats) {
    return <div>加载中...</div>;
  }

  // 下载趋势图配置
  const downloadConfig = {
    data: stats.downloadTrend,
    xField: 'date',
    yField: 'count',
    point: {
      size: 5,
      shape: 'diamond',
    },
    label: {
      style: {
        fill: '#aaa',
      },
    },
  };

  // 访问趋势图配置
  const viewConfig = {
    data: stats.viewTrend,
    xField: 'date',
    yField: 'count',
    point: {
      size: 5,
      shape: 'diamond',
    },
    label: {
      style: {
        fill: '#aaa',
      },
    },
  };

  // 热门资源表格列
  const columns = [
    {
      title: '预览',
      dataIndex: 'thumbnailUrl',
      key: 'thumbnailUrl',
      width: 80,
      render: (url: string, record: CreatorStats['topResources'][0]) => (
        <Image
          src={url || record.url}
          alt={record.title}
          width={60}
          height={60}
          style={{ objectFit: 'cover', borderRadius: 4 }}
        />
      ),
    },
    {
      title: '资源名称',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color={type === 'avatar' ? 'blue' : 'green'}>
          {type === 'avatar' ? '头像' : '壁纸'}
        </Tag>
      ),
    },
    {
      title: '下载量',
      dataIndex: 'downloadCount',
      key: 'downloadCount',
      sorter: (a: CreatorStats['topResources'][0], b: CreatorStats['topResources'][0]) =>
        a.downloadCount - b.downloadCount,
      render: (count: number) => (
        <span>
          <DownloadOutlined /> {count}
        </span>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* 创作者信息 */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img
            src={stats.creatorInfo.avatar}
            alt={stats.creatorInfo.name}
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              objectFit: 'cover',
              marginRight: 20,
            }}
          />
          <div>
            <Title level={3} style={{ margin: 0 }}>
              {stats.creatorInfo.name}
            </Title>
            <p style={{ color: '#666', margin: '8px 0 0 0' }}>
              {stats.creatorInfo.description || '暂无描述'}
            </p>
          </div>
        </div>
      </Card>

      {/* 核心指标卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总资源数"
              value={stats.totalResources}
              prefix={<FileImageOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总空间数"
              value={stats.totalSpaces}
              prefix={<FolderOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总下载量"
              value={stats.totalDownloads}
              prefix={<DownloadOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总访问量"
              value={stats.totalViews}
              prefix={<EyeOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 今日数据 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="今日数据">
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="今日下载"
                  value={stats.todayDownloads}
                  prefix={<DownloadOutlined />}
                />
              </Col>
              <Col span={12}>
                <Statistic title="今日访问" value={stats.todayViews} prefix={<EyeOutlined />} />
              </Col>
            </Row>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="近7天数据">
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="下载量"
                  value={stats.last7DaysDownloads}
                  prefix={<DownloadOutlined />}
                />
              </Col>
              <Col span={12}>
                <Statistic title="访问量" value={stats.last7DaysViews} prefix={<EyeOutlined />} />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* 趋势图表 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="下载趋势（近7天）">
            <Line {...downloadConfig} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="访问趋势（近7天）">
            <Line {...viewConfig} />
          </Card>
        </Col>
      </Row>

      {/* 热门资源 */}
      <Card title="热门资源 Top 5">
        <Table
          columns={columns}
          dataSource={stats.topResources}
          rowKey="id"
          pagination={false}
          loading={loading}
        />
      </Card>
    </div>
  );
}
