import { message, Spin } from 'antd';
import axios from 'axios';
import { lazy, Suspense, useEffect, useRef } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { reqGetCurrentUser } from './api/auth';

const Layout = lazy(() => import('./layouts/Layout'));
const AIModelPolicies = lazy(() => import('./pages/admin-ops/AIModelPolicies'));
const AIUsageLogs = lazy(() => import('./pages/admin-ops/AIUsageLogs'));
const AuditLogs = lazy(() => import('./pages/admin-ops/AuditLogs'));
const BlogComments = lazy(() => import('./pages/admin-ops/BlogComments'));
const BlogTaxonomy = lazy(() => import('./pages/admin-ops/BlogTaxonomy'));
const GuestbookMessages = lazy(() => import('./pages/admin-ops/GuestbookMessages'));
const LifeTraceOps = lazy(() => import('./pages/admin-ops/LifeTraceOps'));
const MindArenaDebates = lazy(() => import('./pages/admin-ops/MindArenaDebates'));
const Notifications = lazy(() => import('./pages/admin-ops/Notifications'));
const Relations = lazy(() => import('./pages/admin-ops/Relations'));
const ResourceTags = lazy(() => import('./pages/admin-ops/ResourceTags'));
const BlogPostEdit = lazy(() => import('./pages/BlogPostEdit'));
const BlogPosts = lazy(() => import('./pages/BlogPosts'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Feedbacks = lazy(() => import('./pages/Feedbacks'));
const LifeTrace = lazy(() => import('./pages/LifeTrace'));
const Login = lazy(() => import('./pages/Login'));
const Records = lazy(() => import('./pages/Records'));
const Resources = lazy(() => import('./pages/Resources'));
const Users = lazy(() => import('./pages/Users'));

const isConfirmedAuthFailure = (error: unknown) => {
  if (!axios.isAxiosError(error)) return false;
  return error.response?.status === 401 || error.response?.status === 403;
};

// 路由守卫：检查是否已登录
function PrivateRoute({ children }: { children: React.ReactNode }) {
  // 通过 admin_token 判断是否登录（避免与 web Cookie 冲突）
  const token = localStorage.getItem('admin_token');
  return token ? children : <Navigate to="/login" replace />;
}

// Token 验证组件
function TokenValidator() {
  const navigate = useNavigate();
  const isValidatingRef = useRef(false);

  // 验证 token 是否有效
  const validateToken = useRef(async () => {
    if (isValidatingRef.current) return;

    // 检查是否已登录
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    try {
      isValidatingRef.current = true;
      await reqGetCurrentUser();
    } catch (error: unknown) {
      console.error('Token 验证失败:', error);
      if (!isConfirmedAuthFailure(error)) {
        return;
      }
      localStorage.removeItem('admin_token');
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
      <Suspense fallback={<Spin fullscreen size="large" />}>
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
            <Route path="feedbacks" element={<Feedbacks />} />
            <Route path="life-trace" element={<LifeTrace />} />
            <Route path="resources" element={<Resources />} />
            <Route path="records" element={<Records />} />
            <Route path="system-updates" element={<Navigate to="/dashboard" replace />} />
            <Route path="blog-posts" element={<BlogPosts />} />
            <Route path="blog-posts/create" element={<BlogPostEdit />} />
            <Route path="blog-posts/edit/:id" element={<BlogPostEdit />} />
            <Route path="blog-groups" element={<BlogTaxonomy kind="groups" />} />
            <Route path="blog-categories" element={<BlogTaxonomy kind="categories" />} />
            <Route path="blog-tags" element={<BlogTaxonomy kind="tags" />} />
            <Route path="blog-comments" element={<BlogComments />} />
            <Route path="guestbook" element={<GuestbookMessages />} />
            <Route path="resource-tags" element={<ResourceTags />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="relations/favorites" element={<Relations kind="favorites" />} />
            <Route path="relations/follows" element={<Relations kind="follows" />} />
            <Route path="audit/operation-logs" element={<AuditLogs kind="operation-logs" />} />
            <Route path="audit/code-access-logs" element={<AuditLogs kind="code-access-logs" />} />
            <Route path="audit/storage-assets" element={<AuditLogs kind="storage-assets" />} />
            <Route path="ai/usage-logs" element={<AIUsageLogs />} />
            <Route path="ai/models" element={<AIModelPolicies />} />
            <Route path="ai/model-policies" element={<Navigate to="/ai/models" replace />} />
            <Route path="life-trace/households" element={<LifeTraceOps kind="households" />} />
            <Route
              path="life-trace/push-subscriptions"
              element={<LifeTraceOps kind="push-subscriptions" />}
            />
            <Route
              path="life-trace/push-deliveries"
              element={<LifeTraceOps kind="push-deliveries" />}
            />
            <Route
              path="life-trace/ai-conversations"
              element={<LifeTraceOps kind="ai-conversations" />}
            />
            <Route
              path="life-trace/holiday-calendars"
              element={<LifeTraceOps kind="holiday-calendars" />}
            />
            <Route path="mind-arena/debates" element={<MindArenaDebates />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
