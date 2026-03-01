import { CrownOutlined, DownloadOutlined, PictureOutlined, UserOutlined } from '@ant-design/icons';
import { Card, Col, Row, Statistic } from 'antd';

export default function Dashboard() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">数据概览</h2>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="用户总数" value={1234} prefix={<UserOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="创作者数" value={56} prefix={<CrownOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="资源总数" value={892} prefix={<PictureOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="下载次数" value={12580} prefix={<DownloadOutlined />} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="mt-4">
        <Col xs={24} lg={12}>
          <Card title="近7天下载趋势">
            <div className="h-64 flex items-center justify-center text-gray-400">
              图表区域（可集成 ECharts）
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="资源类型分布">
            <div className="h-64 flex items-center justify-center text-gray-400">
              图表区域（可集成 ECharts）
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
