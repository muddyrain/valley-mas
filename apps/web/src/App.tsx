import type { ReactNode } from 'react';
import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router-dom';
import BlockingLoadingSurface from '@/components/BlockingLoadingSurface';
import { GlobalScrollButton } from '@/components/GlobalScrollButton';
import { Toaster } from '@/components/ui/sonner';
import { isDevInspectorEnabled } from '@/config/devInspector';
import { useTheme } from '@/hooks/useTheme';
import { applyThemeToDocument } from '@/stores/useThemeStore';
import YujiPublicLayout from './layouts/YujiPublicLayout';
import YujiAbout from './pages/YujiAbout';
import YujiArticle from './pages/YujiArticle';
import YujiArticles from './pages/YujiArticles';
import YujiGallery from './pages/YujiGallery';
import YujiHome from './pages/YujiHome';
import YujiImage from './pages/YujiImage';
import YujiSearch from './pages/YujiSearch';
import { useAuthStore } from './stores/useAuthStore';

const InspectorRuntime = import.meta.env.DEV
  ? lazy(() =>
      import('@valley/devbox-inspector-runtime').then((module) => ({
        default: module.InspectorRuntime,
      })),
    )
  : null;
const PrivateLabLayout = lazy(() => import('./layouts/PrivateLabLayout'));
const WorkbenchLayout = lazy(() => import('./layouts/WorkbenchLayout'));
const StudioLayout = lazy(() => import('./layouts/StudioLayout'));
const AIImageStudio = lazy(() => import('./pages/AIImageStudio'));
const AIResources = lazy(() => import('./pages/AIResources'));
const BlogCreate = lazy(() => import('./pages/BlogCreate'));
const BlogGroupManage = lazy(() => import('./pages/BlogGroupManage'));
const ClimberLab = lazy(() => import('./pages/ClimberLab'));
const Downloads = lazy(() => import('./pages/Downloads'));
const Favorites = lazy(() => import('./pages/Favorites'));
const Follows = lazy(() => import('./pages/Follows'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const FormatTools = lazy(() => import('./pages/FormatTools'));
const ImageTextCreate = lazy(() => import('./pages/ImageTextCreate'));
const Login = lazy(() => import('./pages/Login'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Profile = lazy(() => import('./pages/Profile'));
const Register = lazy(() => import('./pages/Register'));
const ScratchLegendLab = lazy(() => import('./pages/ScratchLegendLab'));
const StudioArticles = lazy(() => import('./pages/StudioArticles'));
const StudioHome = lazy(() => import('./pages/StudioHome'));
const StudioImageCreator = lazy(() => import('./pages/StudioImageCreator'));
const StudioImageImport = lazy(() => import('./pages/StudioImageImport'));
const StudioImageLibrary = lazy(() => import('./pages/StudioImageLibrary'));
const WorkflowEditor = lazy(() => import('./pages/WorkflowEditor'));
const WorkflowTemplateDetail = lazy(() => import('./pages/WorkflowTemplateDetail'));

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

function LegacyPublicDetailRedirect({ kind }: { kind: 'article' | 'image' }) {
  const { id } = useParams<{ id: string }>();
  const detailId = id || '';
  const target = kind === 'article' ? `/articles/${detailId}` : `/gallery/image/${detailId}`;
  return <Navigate to={target} replace />;
}

function LegacyStudioArticleRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/studio/articles/${id || ''}`} replace />;
}

function RouteTitle() {
  const location = useLocation();

  useEffect(() => {
    const pathname = location.pathname;
    let title = '雨迹';

    if (pathname === '/') {
      title = '雨迹 · by @muddyrain | 文章与影像';
    } else if (pathname === '/articles') {
      title = '文章 | 雨迹';
    } else if (pathname.startsWith('/articles/')) {
      title = '文章 | 雨迹';
    } else if (pathname === '/gallery') {
      title = '图库 | 雨迹';
    } else if (pathname.startsWith('/gallery/image/')) {
      title = '影像 | 雨迹';
    } else if (pathname === '/about') {
      title = '关于 | 雨迹';
    } else if (pathname === '/search') {
      title = '搜索 | 雨迹';
    } else if (pathname === '/studio') {
      title = '创作室 | 雨迹';
    } else if (pathname === '/studio/articles') {
      title = '文章库 | 雨迹';
    } else if (pathname === '/studio/articles/new') {
      title = '写文章 | 雨迹';
    } else if (pathname.startsWith('/studio/articles/')) {
      title = '编辑文章 | 雨迹';
    } else if (pathname === '/studio/images/import') {
      title = '图片导入 | 雨迹';
    } else if (pathname === '/studio/images/library') {
      title = '图片库 | 雨迹';
    } else if (pathname === '/studio/images') {
      title = 'AI 图片 | 雨迹';
    } else if (pathname === '/studio/columns') {
      title = '专栏管理 | 雨迹';
    } else if (pathname === '/workbench') {
      title = '工作流资源 | 雨迹实验室';
    } else if (pathname.startsWith('/workbench/images')) {
      title = '图片进阶 | 雨迹实验室';
    } else if (pathname === '/workbench/resources') {
      title = 'AI 资源 | 雨迹实验室';
    } else if (pathname.startsWith('/workbench/templates/')) {
      title = '工作流模板 | 雨迹实验室';
    } else if (pathname.startsWith('/workbench/create')) {
      title = '创建工作流 | 雨迹实验室';
    } else if (pathname.startsWith('/workbench/edit')) {
      title = '编辑工作流 | 雨迹实验室';
    } else if (pathname === '/tools/format') {
      title = '实用工具 | Valley';
    } else if (pathname === '/labs/climber') {
      title = '玩具攀爬实验场 | Valley';
    } else if (pathname === '/labs/scratch-legend') {
      title = '刮刮传说 | Valley';
    } else if (pathname === '/my-space') {
      title = '创作室 | 雨迹';
    } else if (pathname === '/my-space/image-text') {
      title = '创建图文 | Valley';
    } else if (pathname.startsWith('/my-space/image-text-edit/')) {
      title = '编辑图文 | Valley';
    } else if (pathname === '/my-space/blog-create') {
      title = '写文章 | 雨迹';
    } else if (pathname.startsWith('/my-space/blog-edit/')) {
      title = '编辑文章 | 雨迹';
    } else if (pathname === '/my-space/blog-groups') {
      title = '专栏管理 | 雨迹';
    } else if (pathname === '/my-space/resources') {
      title = '图片库 | 雨迹';
    } else if (
      pathname === '/my-space/posts' ||
      pathname === '/my-space/blogs' ||
      pathname === '/my-space/comments'
    ) {
      title = '文章库 | 雨迹';
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
    } else if (pathname === '/forgot-password') {
      title = '找回密码 | Valley';
    } else {
      title = '页面未找到 | Valley';
    }

    document.title = title;
  }, [location.pathname]);

  return null;
}

function ThemeController() {
  const { resolvedMode } = useTheme();

  useEffect(() => {
    applyThemeToDocument(resolvedMode);
  }, [resolvedMode]);

  return null;
}

function App() {
  return (
    <>
      <ThemeController />
      <RouteTitle />
      <Suspense
        fallback={
          <BlockingLoadingSurface
            show
            title="正在打开页面"
            hint="很快就好"
            className="min-h-screen"
          />
        }
      >
        <Routes>
          <Route path="/" element={<YujiPublicLayout />}>
            <Route index element={<YujiHome />} />
            <Route path="articles" element={<YujiArticles />} />
            <Route path="articles/:id" element={<YujiArticle />} />
            <Route path="gallery" element={<YujiGallery />} />
            <Route path="gallery/image/:id" element={<YujiImage />} />
            <Route path="about" element={<YujiAbout />} />
            <Route path="search" element={<YujiSearch />} />
          </Route>

          <Route path="/blog" element={<Navigate to="/articles" replace />} />
          <Route path="/blog/:id" element={<LegacyPublicDetailRedirect kind="article" />} />
          <Route path="/resources" element={<Navigate to="/gallery" replace />} />
          <Route path="/resource/:id" element={<LegacyPublicDetailRedirect kind="image" />} />
          <Route path="/updates" element={<Navigate to="/" replace />} />

          <Route
            path="/studio"
            element={
              <RequireAuth>
                <StudioLayout />
              </RequireAuth>
            }
          >
            <Route index element={<StudioHome />} />
            <Route path="articles" element={<StudioArticles />} />
            <Route path="articles/new" element={<BlogCreate />} />
            <Route path="articles/:id" element={<BlogCreate />} />
            <Route path="images/import" element={<StudioImageImport />} />
            <Route path="images/library" element={<StudioImageLibrary />} />
            <Route path="images" element={<StudioImageCreator />} />
            <Route path="columns" element={<BlogGroupManage />} />
          </Route>

          <Route
            path="/workbench"
            element={
              <RequireAuth>
                <PrivateLabLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/workbench/resources?tab=workflows" replace />} />
            <Route path="create" element={<WorkflowEditorWithKey />} />
            <Route path="images" element={<Navigate to="/studio/images" replace />} />
            <Route path="images/advanced" element={<AIImageStudio />} />
            <Route path="resources" element={<AIResources />} />
            <Route
              path="workflows"
              element={<Navigate to="/workbench/resources?tab=workflows" replace />}
            />
            <Route path="templates/:templateId" element={<WorkflowTemplateDetail />} />
            <Route path="edit" element={<WorkflowEditorWithKey />} />
            <Route
              path="knowledge"
              element={<Navigate to="/workbench/resources?tab=knowledge" replace />}
            />
          </Route>

          <Route element={<WorkbenchLayout />}>
            <Route path="my-space" element={<Navigate to="/studio" replace />} />
            <Route path="my-space/image-text" element={<ImageTextCreate />} />
            <Route path="my-space/image-text-edit/:id" element={<ImageTextCreate />} />
            <Route
              path="my-space/blog-create"
              element={<Navigate to="/studio/articles/new" replace />}
            />
            <Route path="my-space/blog-edit/:id" element={<LegacyStudioArticleRedirect />} />
            <Route path="my-space/blog-groups" element={<BlogGroupManage />} />
            <Route
              path="my-space/resources"
              element={<Navigate to="/studio/images/library" replace />}
            />
            <Route path="my-space/posts" element={<Navigate to="/studio/articles" replace />} />
            <Route path="my-space/blogs" element={<Navigate to="/studio/articles" replace />} />
            <Route path="my-space/comments" element={<Navigate to="/studio/articles" replace />} />
            <Route path="my-space/followers" element={<Navigate to="/follows" replace />} />
            <Route path="my-space/albums" element={<Navigate to="/my-space/resources" replace />} />
            <Route path="profile" element={<Profile />} />
            <Route path="favorites" element={<Favorites />} />
            <Route path="follows" element={<Follows />} />
            <Route path="downloads" element={<Downloads />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="tools/format" element={<FormatTools />} />
            <Route path="labs/climber" element={<ClimberLab />} />
            <Route path="labs/scratch-legend" element={<ScratchLegendLab />} />
          </Route>
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      {InspectorRuntime ? (
        <Suspense fallback={null}>
          <InspectorRuntime
            enabled={isDevInspectorEnabled(import.meta.env.VITE_DEVBOX_INSPECTOR_ENABLED)}
            workspaceRoot={import.meta.env.VITE_INSPECTOR_WORKSPACE_ROOT || ''}
          />
        </Suspense>
      ) : null}
      <GlobalScrollButton />
      <Toaster />
    </>
  );
}

export default App;
