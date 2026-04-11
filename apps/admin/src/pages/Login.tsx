import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, message } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reqLogin } from '../api/auth';
import BrandLogo from '../components/BrandLogo';

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const res = await reqLogin({ ...values, loginType: 'password' });

      // 保存 token 到 localStorage（使用独立 key，避免与 web 端 Cookie 冲突）
      localStorage.setItem('admin_token', res.token);
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
          <div className="mb-3 flex justify-center">
            <BrandLogo iconClassName="h-12 w-12" wordmarkClassName="text-[1.32rem]" />
          </div>
          <p className="text-gray-500 mt-2">创作者·管理后台</p>
        </div>
        <Form onFinish={onFinish} size="large">
          <Form.Item
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="请输入邮箱" />
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
      </Card>
    </div>
  );
}
