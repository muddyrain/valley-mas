import { message } from 'antd';
import { useEffect, useRef } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { reqGetCurrentUser } from './api/auth';
import Layout from './layouts/Layout';
import CreatorSpaces from './pages/CreatorSpaces';
import Creators from './pages/Creators';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Records from './pages/Records';
import Resources from './pages/Resources';
import Users from './pages/Users';

// 路由守卫：检查是否已登录
function PrivateRoute({ children }: { children: React.ReactNode }) {
  // Cookie 中的 token 无法通过 JavaScript 访问（HttpOnly）
  // 所以通过检查 userInfo 来判断是否登录
  const userInfo = localStorage.getItem('userInfo');
  return userInfo ? children : <Navigate to="/login" replace />;
}

// Token 验证组件
function TokenValidator() {
  const navigate = useNavigate();
  const isValidatingRef = useRef(false);

  // 验证 token 是否有效
  const validateToken = useRef(async () => {
    // 如果正在验证，跳过
    if (isValidatingRef.current) return;

    // 检查是否已登录
    const userInfo = localStorage.getItem('userInfo');
    if (!userInfo) return;

    try {
      isValidatingRef.current = true;
      await reqGetCurrentUser();
      // Token 有效，无需操作
    } catch (error: unknown) {
      // Token 失效或过期
      console.error('Token 验证失败:', error);
      localStorage.removeItem('userInfo');
      message.warning('登录已过期，请重新登录');
      navigate('/login', { replace: true });
    } finally {
      isValidatingRef.current = false;
    }
  }).current;

  useEffect(() => {
    // 监听窗口激活事件（从后台切换回来）
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('🔍 页面激活，验证 Token...');
        validateToken();
      }
    };

    // 监听窗口焦点事件（从其他应用切换回来）
    const handleFocus = () => {
      console.log('🔍 窗口获得焦点，验证 Token...');
      validateToken();
    };

    // 添加事件监听
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // 清理事件监听
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [validateToken]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <TokenValidator />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="users" element={<Users />} />
          <Route path="creators" element={<Creators />} />
          <Route path="creators/:creatorId/spaces" element={<CreatorSpaces />} />
          <Route path="resources" element={<Resources />} />
          <Route path="records" element={<Records />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
