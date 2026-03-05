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

      message.success('登录成功');

      // 根据角色跳转到不同页面
      const role = res.userInfo.role;
      if (role === 'creator') {
        navigate('/creator-dashboard');
      } else if (role === 'admin') {
        navigate('/dashboard');
      } else {
        // 普通用户跳转到申请页面
        navigate('/apply-creator');
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
          <p>管理员账号：admin/admin123</p>
          <p>创作者账号：creator/creator123</p>
          <p>普通用户：admin1/admin123</p>
        </div>
      </Card>
    </div>
  );
}
