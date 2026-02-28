import { Table, Card, Input, Button, Space, Tag, Image, Select, Upload, Modal } from 'antd'
import { SearchOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useState } from 'react'
import { formatFileSize } from '@valley/shared'

interface ResourceRecord {
  id: string
  title: string
  type: 'avatar' | 'wallpaper'
  creator: string
  url: string
  size: number
  downloadCount: number
  createdAt: string
}

const mockData: ResourceRecord[] = [
  { id: '1', title: '可爱卡通头像', type: 'avatar', creator: '设计师小王', url: 'https://placeholder.co/100', size: 102400, downloadCount: 128, createdAt: '2026-02-20' },
  { id: '2', title: '风景壁纸', type: 'wallpaper', creator: '摄影师老李', url: 'https://placeholder.co/100', size: 512000, downloadCount: 256, createdAt: '2026-02-21' },
]

export default function Resources() {
  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  const columns: ColumnsType<ResourceRecord> = [
    { title: '预览', dataIndex: 'url', width: 80, render: (url) => <Image src={url} width={50} height={50} /> },
    { title: '标题', dataIndex: 'title' },
    { title: '类型', dataIndex: 'type', render: (t) => <Tag color={t === 'avatar' ? 'blue' : 'purple'}>{t === 'avatar' ? '头像' : '壁纸'}</Tag> },
    { title: '创作者', dataIndex: 'creator' },
    { title: '大小', dataIndex: 'size', render: (s) => formatFileSize(s) },
    { title: '下载量', dataIndex: 'downloadCount' },
    { title: '上传时间', dataIndex: 'createdAt' },
    {
      title: '操作',
      key: 'action',
      render: () => (
        <Space>
          <a>编辑</a>
          <a className="text-red-500">删除</a>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">资源管理</h2>
      <Card>
        <div className="mb-4 flex justify-between">
          <Space>
            <Input placeholder="搜索资源" prefix={<SearchOutlined />} className="w-48" />
            <Select placeholder="类型" className="w-28" allowClear options={[{ label: '头像', value: 'avatar' }, { label: '壁纸', value: 'wallpaper' }]} />
            <Button icon={<SearchOutlined />} type="primary">搜索</Button>
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />}>刷新</Button>
            <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadModalOpen(true)}>上传资源</Button>
          </Space>
        </div>
        <Table columns={columns} dataSource={mockData} rowKey="id" />
      </Card>

      <Modal title="上传资源" open={uploadModalOpen} onCancel={() => setUploadModalOpen(false)} footer={null} width={600}>
        <Upload.Dragger multiple accept="image/*">
          <p className="text-4xl mb-4">📁</p>
          <p>点击或拖拽图片到此处上传</p>
          <p className="text-gray-400 text-sm">支持 JPG、PNG、GIF 格式</p>
        </Upload.Dragger>
      </Modal>
    </div>
  )
}
