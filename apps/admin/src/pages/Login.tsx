import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, message } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reqLogin } from '../api/auth';

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const res = await reqLogin(values);

      // Token 已通过 HttpOnly Cookie 存储，无需手动保存
      // 只需保存用户信息到 localStorage
      localStorage.setItem('userInfo', JSON.stringify(res.userInfo));

      // 检查角色权限
      const role = res.userInfo.role;
      if (role !== 'admin' && role !== 'creator') {
        message.error('您没有权限访问管理后台');
        return;
      }

      message.success('登录成功');

      // 根据角色跳转到不同页面
      if (role === 'creator') {
        navigate('/creator-dashboard');
      } else {
        navigate('/');
      }
    } catch (error: unknown) {
      // 错误提示已在 request.ts 中统一处理
      // 这里只需要打印日志用于调试
      console.error('登录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-96 shadow-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600">Valley</h1>
          <p className="text-gray-500 mt-2">创作者·管理后台</p>
        </div>
        <Form onFinish={onFinish} size="large">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              登录
            </Button>
          </Form.Item>
        </Form>

        <div className="mt-4 text-center text-gray-500 text-sm">
          <p>默认账号：admin</p>
          <p>默认密码：admin123</p>
        </div>
      </Card>
    </div>
  );
}
