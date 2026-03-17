import { Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import Layout from './layouts/Layout';
import ApplyCreator from './pages/ApplyCreator';
import BlogList from './pages/blog/BlogList';
import BlogPost from './pages/blog/BlogPost';
import Creator from './pages/Creator';
import CreatorProfile from './pages/CreatorProfile';
import Favorites from './pages/Favorites';
import Home from './pages/Home';
import Login from './pages/Login';
import MySpace from './pages/MySpace';
import Profile from './pages/Profile';
import Register from './pages/Register';
import ResourceDetail from './pages/ResourceDetail';
import Resources from './pages/Resources';

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
          <Route path="profile" element={<Profile />} />
          <Route path="favorites" element={<Favorites />} />
          <Route path="apply-creator" element={<ApplyCreator />} />
          <Route path="blog" element={<BlogList />} />
          <Route path="blog/:id" element={<BlogPost />} />
        </Route>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
      <Toaster />
    </>
  );
}

export default App;
