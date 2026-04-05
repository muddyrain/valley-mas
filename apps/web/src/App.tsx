import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import Layout from './layouts/Layout';
import AIChat from './pages/AIChat';
import ApplyCreator from './pages/ApplyCreator';
import BlogCreate from './pages/BlogCreate';
import BlogGroupManage from './pages/BlogGroupManage';
import BlogList from './pages/blog/BlogList';
import BlogPost from './pages/blog/BlogPost';
import Creator from './pages/Creator';
import CreatorProfile from './pages/CreatorProfile';
import Favorites from './pages/Favorites';
import Home from './pages/Home';
import ImageTextCreate from './pages/ImageTextCreate';
import Login from './pages/Login';
import MySpace from './pages/MySpace';
import Profile from './pages/Profile';
import Register from './pages/Register';
import ResourceDetail from './pages/ResourceDetail';
import Resources from './pages/Resources';
import TTSStudio from './pages/TTSStudio';

function RouteTitle() {
  const location = useLocation();

  useEffect(() => {
    const pathname = location.pathname;
    let title = 'Valley';

    if (pathname === '/') {
      title = 'Valley | 内容主页';
    } else if (pathname === '/blog') {
      title = '博客与图文 | Valley';
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
    } else if (pathname === '/creators') {
      title = '创作者列表 | Valley';
    } else if (pathname.startsWith('/creator/')) {
      title = '创作者空间 | Valley';
    } else if (pathname === '/favorites') {
      title = '我的收藏 | Valley';
    } else if (pathname === '/profile') {
      title = '个人资料 | Valley';
    } else if (pathname === '/apply-creator') {
      title = '申请创作者 | Valley';
    } else if (pathname === '/tts') {
      title = 'TTS Studio | Valley';
    } else if (pathname === '/ai-chat') {
      title = 'AI Chat | Valley';
    } else if (pathname === '/login') {
      title = '登录 | Valley';
    } else if (pathname === '/register') {
      title = '注册 | Valley';
    }

    document.title = title;
  }, [location.pathname]);

  return null;
}

function App() {
  return (
    <>
      <RouteTitle />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="creators" element={<Creator />} />
          <Route path="creator/:code" element={<CreatorProfile />} />
          <Route path="resources" element={<Resources />} />
          <Route path="resource/:id" element={<ResourceDetail />} />
          <Route path="my-space" element={<MySpace />} />
          <Route path="my-space/image-text" element={<ImageTextCreate />} />
          <Route path="my-space/image-text-edit/:id" element={<ImageTextCreate />} />
          <Route path="my-space/blog-create" element={<BlogCreate />} />
          <Route path="my-space/blog-edit/:id" element={<BlogCreate />} />
          <Route path="my-space/blog-groups" element={<BlogGroupManage />} />
          <Route path="profile" element={<Profile />} />
          <Route path="favorites" element={<Favorites />} />
          <Route path="apply-creator" element={<ApplyCreator />} />
          <Route path="blog" element={<BlogList />} />
          <Route path="blog/:id" element={<BlogPost />} />
          <Route path="tts" element={<TTSStudio />} />
          <Route path="ai-chat" element={<AIChat />} />
        </Route>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
      <Toaster />
    </>
  );
}

export default App;
