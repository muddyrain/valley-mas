import { Table, Card, Tabs, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'

interface DownloadRecord {
  id: string
  user: string
  resource: string
  creator: string
  downloadedAt: string
}

interface UploadRecord {
  id: string
  creator: string
  resource: string
  type: 'avatar' | 'wallpaper'
  uploadedAt: string
}

const downloadData: DownloadRecord[] = [
  { id: '1', user: '用户A', resource: '可爱卡通头像', creator: '设计师小王', downloadedAt: '2026-02-28 10:30:00' },
  { id: '2', user: '用户B', resource: '风景壁纸', creator: '摄影师老李', downloadedAt: '2026-02-28 11:45:00' },
]

const uploadData: UploadRecord[] = [
  { id: '1', creator: '设计师小王', resource: '可爱卡通头像', type: 'avatar', uploadedAt: '2026-02-20 10:00:00' },
  { id: '2', creator: '摄影师老李', resource: '风景壁纸', type: 'wallpaper', uploadedAt: '2026-02-21 14:30:00' },
]

const downloadColumns: ColumnsType<DownloadRecord> = [
  { title: 'ID', dataIndex: 'id', width: 80 },
  { title: '用户', dataIndex: 'user' },
  { title: '资源', dataIndex: 'resource' },
  { title: '创作者', dataIndex: 'creator' },
  { title: '下载时间', dataIndex: 'downloadedAt' },
]

const uploadColumns: ColumnsType<UploadRecord> = [
  { title: 'ID', dataIndex: 'id', width: 80 },
  { title: '创作者', dataIndex: 'creator' },
  { title: '资源', dataIndex: 'resource' },
  { title: '类型', dataIndex: 'type', render: (t) => <Tag color={t === 'avatar' ? 'blue' : 'purple'}>{t === 'avatar' ? '头像' : '壁纸'}</Tag> },
  { title: '上传时间', dataIndex: 'uploadedAt' },
]

export default function Records() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">记录管理</h2>
      <Card>
        <Tabs items={[
          { key: 'download', label: '下载记录', children: <Table columns={downloadColumns} dataSource={downloadData} rowKey="id" /> },
          { key: 'upload', label: '上传记录', children: <Table columns={uploadColumns} dataSource={uploadData} rowKey="id" /> },
        ]} />
      </Card>
    </div>
  )
}
