import { Route, Routes } from 'react-router-dom';
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

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="creators" element={<Creator />} />
          <Route path="creator/:code" element={<CreatorProfile />} />
          <Route path="resources" element={<Resources />} />
          <Route path="resource/:id" element={<ResourceDetail />} />
          <Route path="my-space" element={<MySpace />} />
          <Route path="my-space/image-text" element={<ImageTextCreate />} />
          <Route path="my-space/blog-create" element={<BlogCreate />} />
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
