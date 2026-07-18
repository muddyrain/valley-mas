import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import { GlobalScrollButton } from '@/components/GlobalScrollButton';
import { Toaster } from '@/components/ui/sonner';
import { applyThemeToDocument, useThemeStore } from '@/stores/useThemeStore';
import WorkbenchLayout from './layouts/WorkbenchLayout';
import AIAppConversation from './pages/AIAppConversation';
import AIAppEditor from './pages/AIAppEditor';
import AIResources from './pages/AIResources';
import BlogCreate from './pages/BlogCreate';
import BlogGroupManage from './pages/BlogGroupManage';
import BlogList from './pages/blog/BlogList';
import BlogPost from './pages/blog/BlogPost';
import ClimberLab from './pages/ClimberLab';
import Downloads from './pages/Downloads';
import Favorites from './pages/Favorites';
import Follows from './pages/Follows';
import FormatTools from './pages/FormatTools';
import Guestbook from './pages/Guestbook';
import Home from './pages/Home';
import ImageTextCreate from './pages/ImageTextCreate';
import Login from './pages/Login';
import MyPosts from './pages/MyPosts';
import MyResources from './pages/MyResources';
import MySpace from './pages/MySpace';
import NotFound from './pages/NotFound';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import Register from './pages/Register';
import ResourceDetail from './pages/ResourceDetail';
import Resources from './pages/Resources';
import ScratchLegendLab from './pages/ScratchLegendLab';
import Workbench from './pages/Workbench';
import WorkflowEditor from './pages/WorkflowEditor';
import WorkflowTemplateDetail from './pages/WorkflowTemplateDetail';
import { useAuthStore } from './stores/useAuthStore';

function WorkflowEditorWithKey() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  return <WorkflowEditor key={`${location.pathname}-${location.search}-${id ?? 'none'}`} />;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    const redirectPath = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirectPath)}`} replace />;
  }

  return children;
}

function RouteTitle() {
  const location = useLocation();

  useEffect(() => {
    const pathname = location.pathname;
    let title = 'Valley';

    if (pathname === '/') {
      title = 'Valley | 内容首页';
    } else if (pathname === '/workbench') {
      title = '项目 | Valley';
    } else if (pathname === '/workbench/resources') {
      title = 'AI 资源 | Valley';
    } else if (pathname.startsWith('/workbench/templates/')) {
      title = '工作流模板 | Valley';
    } else if (pathname.startsWith('/workbench/create')) {
      title = '创建工作流 | Valley';
    } else if (pathname.startsWith('/workbench/edit')) {
      title = '编辑工作流 | Valley';
    } else if (pathname.includes('/conversations/')) {
      title = '私有会话 | Valley';
    } else if (pathname.startsWith('/workbench/apps/')) {
      title = '编辑 AI 应用 | Valley';
    } else if (pathname === '/blog') {
      title = '博客与图文 | Valley';
    } else if (pathname === '/guestbook') {
      title = '访客留言墙 | Valley';
    } else if (pathname === '/tools/format') {
      title = '格式转换工具 | Valley';
    } else if (pathname === '/labs/climber') {
      title = '玩具攀爬实验场 | Valley';
    } else if (pathname === '/labs/scratch-legend') {
      title = '刮刮传说 | Valley';
    } else if (pathname.startsWith('/blog/')) {
      title = '内容详情 | Valley';
    } else if (pathname === '/resources') {
      title = '资源整理 | Valley';
    } else if (pathname.startsWith('/resource/')) {
      title = '资源详情 | Valley';
    } else if (pathname === '/my-space') {
      title = '我的创作空间 | Valley';
    } else if (pathname === '/my-space/image-text') {
      title = '创建图文 | Valley';
    } else if (pathname.startsWith('/my-space/image-text-edit/')) {
      title = '编辑图文 | Valley';
    } else if (pathname === '/my-space/blog-create') {
      title = '创建博客 | Valley';
    } else if (pathname.startsWith('/my-space/blog-edit/')) {
      title = '编辑博客 | Valley';
    } else if (pathname === '/my-space/blog-groups') {
      title = '博客分组管理 | Valley';
    } else if (pathname === '/my-space/resources') {
      title = '资源管理 | Valley';
    } else if (pathname === '/my-space/posts') {
      title = '内容管理 | Valley';
    } else if (pathname === '/favorites') {
      title = '我的收藏 | Valley';
    } else if (pathname === '/follows') {
      title = '我的关注 | Valley';
    } else if (pathname === '/downloads') {
      title = '下载记录 | Valley';
    } else if (pathname === '/notifications') {
      title = '通知中心 | Valley';
    } else if (pathname === '/profile') {
      title = '个人资料 | Valley';
    } else if (pathname === '/login') {
      title = '登录 | Valley';
    } else if (pathname === '/register') {
      title = '注册 | Valley';
    } else {
      title = '页面未找到 | Valley';
    }

    document.title = title;
  }, [location.pathname]);

  return null;
}

function ThemeController() {
  const mode = useThemeStore((state) => state.mode);

  useEffect(() => {
    applyThemeToDocument(mode);
  }, [mode]);

  return null;
}

function App() {
  return (
    <>
      <ThemeController />
      <RouteTitle />
      <Routes>
        <Route path="/" element={<WorkbenchLayout />}>
          <Route index element={<Home />} />
          <Route
            path="workbench"
            element={
              <RequireAuth>
                <Workbench />
              </RequireAuth>
            }
          />
          <Route
            path="workbench/create"
            element={
              <RequireAuth>
                <WorkflowEditorWithKey />
              </RequireAuth>
            }
          />
          <Route
            path="workbench/resources"
            element={
              <RequireAuth>
                <AIResources />
              </RequireAuth>
            }
          />
          <Route
            path="workbench/workflows"
            element={<Navigate to="/workbench/resources?tab=workflows" replace />}
          />
          <Route
            path="workbench/templates/:templateId"
            element={
              <RequireAuth>
                <WorkflowTemplateDetail />
              </RequireAuth>
            }
          />
          <Route
            path="workbench/edit"
            element={
              <RequireAuth>
                <WorkflowEditorWithKey />
              </RequireAuth>
            }
          />
          <Route
            path="workbench/apps/:appId/conversations/:conversationId"
            element={
              <RequireAuth>
                <AIAppConversation />
              </RequireAuth>
            }
          />
          <Route
            path="workbench/apps/:appId"
            element={
              <RequireAuth>
                <AIAppEditor />
              </RequireAuth>
            }
          />
          <Route
            path="workbench/knowledge"
            element={<Navigate to="/workbench/resources?tab=knowledge" replace />}
          />
          <Route path="resources" element={<Resources />} />
          <Route path="resource/:id" element={<ResourceDetail />} />
          <Route path="my-space" element={<MySpace />} />
          <Route path="my-space/image-text" element={<ImageTextCreate />} />
          <Route path="my-space/image-text-edit/:id" element={<ImageTextCreate />} />
          <Route path="my-space/blog-create" element={<BlogCreate />} />
          <Route path="my-space/blog-edit/:id" element={<BlogCreate />} />
          <Route path="my-space/blog-groups" element={<BlogGroupManage />} />
          <Route path="my-space/resources" element={<MyResources />} />
          <Route path="my-space/posts" element={<MyPosts />} />
          <Route path="my-space/blogs" element={<Navigate to="/my-space/posts" replace />} />
          <Route path="my-space/comments" element={<Navigate to="/my-space/posts" replace />} />
          <Route path="my-space/followers" element={<Navigate to="/follows" replace />} />
          <Route path="my-space/albums" element={<Navigate to="/my-space/resources" replace />} />
          <Route path="profile" element={<Profile />} />
          <Route path="favorites" element={<Favorites />} />
          <Route path="follows" element={<Follows />} />
          <Route path="downloads" element={<Downloads />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="updates" element={<Navigate to="/" replace />} />
          <Route path="blog" element={<BlogList />} />
          <Route path="guestbook" element={<Guestbook />} />
          <Route path="tools/format" element={<FormatTools />} />
          <Route path="labs/climber" element={<ClimberLab />} />
          <Route path="labs/scratch-legend" element={<ScratchLegendLab />} />
          <Route path="blog/:id" element={<BlogPost />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="/forgot-password" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
      <GlobalScrollButton />
      <Toaster />
    </>
  );
}

export default App;
