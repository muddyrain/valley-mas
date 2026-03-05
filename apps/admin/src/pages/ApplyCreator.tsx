import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  message,
  Result,
  Space,
  Spin,
  Tag,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import type { CreatorApplication } from '../api/creator-application';
import { reqGetMyApplication, reqSubmitApplication } from '../api/creator-application';

const { TextArea } = Input;

export default function ApplyCreator() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [application, setApplication] = useState<CreatorApplication | null>(null);
  const [hasApplication, setHasApplication] = useState(false);

  // 加载我的申请状态
  const fetchMyApplication = useCallback(async () => {
    setLoading(true);
    try {
      const response = await reqGetMyApplication();
      // 如果返回null，说明没有申请记录
      if (response === null) {
        setHasApplication(false);
        setApplication(null);
      } else {
        setApplication(response);
        setHasApplication(true);
      }
    } catch {
      // 只有真正的错误才提示
      message.error('加载申请状态失败');
      setHasApplication(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyApplication();
  }, [fetchMyApplication]);

  // 提交申请
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await reqSubmitApplication(values);
      message.success('申请提交成功，请等待管理员审核');
      form.resetFields();
      fetchMyApplication();
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      if (err?.response?.data?.message) {
        message.error(err.response.data.message);
      } else if (error instanceof Error) {
        message.error('提交失败，请重试');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 状态标签渲染
  const renderStatusTag = (status: string) => {
    const statusMap = {
      pending: { color: 'processing', text: '待审核', icon: <Spin size="small" /> },
      approved: { color: 'success', text: '已通过', icon: <CheckCircleOutlined /> },
      rejected: { color: 'error', text: '已拒绝', icon: <CloseCircleOutlined /> },
    };
    const config = statusMap[status as keyof typeof statusMap];
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  // 已有申请记录
  if (hasApplication && application) {
    // 审核通过
    if (application.status === 'approved') {
      return (
        <Card>
          <Result
            status="success"
            title="您已成为创作者！"
            subTitle="恭喜您的申请已通过审核，现在可以开始创作了"
            extra={[
              <Button type="primary" key="dashboard" href="/creator-dashboard">
                前往创作者中心
              </Button>,
            ]}
          >
            <Descriptions column={1} bordered>
              <Descriptions.Item label="创作者名称">{application.name}</Descriptions.Item>
              <Descriptions.Item label="申请时间">
                {new Date(application.createdAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
              <Descriptions.Item label="审核时间">
                {application.reviewedAt
                  ? new Date(application.reviewedAt).toLocaleString('zh-CN')
                  : '-'}
              </Descriptions.Item>
              {application.reviewNote && (
                <Descriptions.Item label="审核备注">{application.reviewNote}</Descriptions.Item>
              )}
            </Descriptions>
          </Result>
        </Card>
      );
    }

    // 审核中
    if (application.status === 'pending') {
      return (
        <Card>
          <Result
            status="info"
            title="申请审核中"
            subTitle="您的创作者申请正在审核中，请耐心等待"
            extra={[
              <Button key="refresh" onClick={fetchMyApplication}>
                刷新状态
              </Button>,
            ]}
          >
            <Descriptions column={1} bordered>
              <Descriptions.Item label="状态">
                {renderStatusTag(application.status)}
              </Descriptions.Item>
              <Descriptions.Item label="创作者名称">{application.name}</Descriptions.Item>
              <Descriptions.Item label="申请理由">{application.reason}</Descriptions.Item>
              <Descriptions.Item label="申请时间">
                {new Date(application.createdAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
            </Descriptions>
          </Result>
        </Card>
      );
    }

    // 审核被拒绝
    if (application.status === 'rejected') {
      return (
        <Card>
          <Result
            status="error"
            title="申请未通过"
            subTitle="很遗憾，您的创作者申请未通过审核"
            extra={[
              <Button
                type="primary"
                key="reapply"
                onClick={() => {
                  setHasApplication(false);
                  setApplication(null);
                }}
              >
                重新申请
              </Button>,
            ]}
          >
            <Descriptions column={1} bordered>
              <Descriptions.Item label="创作者名称">{application.name}</Descriptions.Item>
              <Descriptions.Item label="申请时间">
                {new Date(application.createdAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
              <Descriptions.Item label="审核时间">
                {application.reviewedAt
                  ? new Date(application.reviewedAt).toLocaleString('zh-CN')
                  : '-'}
              </Descriptions.Item>
              {application.reviewNote && (
                <Descriptions.Item label="拒绝原因">
                  <Alert message={application.reviewNote} type="error" showIcon />
                </Descriptions.Item>
              )}
            </Descriptions>
          </Result>
        </Card>
      );
    }
  }

  // 申请表单
  return (
    <Card title="申请成为创作者" bordered={false}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Alert
          message="成为创作者后，您可以上传和管理自己的资源，创建专属空间，并通过广告分成获得收益。"
          type="info"
          showIcon
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            name: '',
            description: '',
            avatar: '',
            reason: '',
            phone: '',
            email: '',
          }}
        >
          <Form.Item
            label="创作者名称"
            name="name"
            rules={[
              { required: true, message: '请输入创作者名称' },
              { min: 2, max: 50, message: '名称长度为2-50个字符' },
            ]}
          >
            <Input placeholder="请输入您的创作者名称" />
          </Form.Item>

          <Form.Item
            label="创作者描述"
            name="description"
            rules={[{ max: 500, message: '描述不能超过500字' }]}
          >
            <TextArea
              rows={3}
              placeholder="简单介绍一下您的创作风格或特长"
              showCount
              maxLength={500}
            />
          </Form.Item>

          <Form.Item label="头像URL" name="avatar" extra="可选，如不填写将使用您的账号头像">
            <Input placeholder="https://example.com/avatar.jpg" />
          </Form.Item>

          <Form.Item
            label="申请理由"
            name="reason"
            rules={[
              { required: true, message: '请填写申请理由' },
              { min: 10, max: 500, message: '申请理由长度为10-500个字符' },
            ]}
          >
            <TextArea
              rows={4}
              placeholder="请说明您为什么想成为创作者，以及您准备提供什么类型的内容"
              showCount
              maxLength={500}
            />
          </Form.Item>

          <Form.Item
            label="联系电话"
            name="phone"
            rules={[
              {
                pattern: /^1[3-9]\d{9}$/,
                message: '请输入正确的手机号',
              },
            ]}
          >
            <Input placeholder="选填，方便我们联系您" />
          </Form.Item>

          <Form.Item
            label="联系邮箱"
            name="email"
            rules={[
              {
                type: 'email',
                message: '请输入正确的邮箱地址',
              },
            ]}
          >
            <Input placeholder="选填，方便我们联系您" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={submitting}>
                提交申请
              </Button>
              <Button onClick={() => form.resetFields()}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Space>
    </Card>
  );
}
