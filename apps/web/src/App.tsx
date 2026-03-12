import { Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import Layout from './layouts/Layout';
import Creator from './pages/Creator';
import CreatorProfile from './pages/CreatorProfile';
import Home from './pages/Home';
import Login from './pages/Login';
import MySpace from './pages/MySpace';
import Profile from './pages/Profile';

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="creators" element={<Creator />} />
          <Route path="creator/:code" element={<CreatorProfile />} />
          <Route path="my-space" element={<MySpace />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="/login" element={<Login />} />
      </Routes>
      <Toaster />
    </>
  );
}

export default App;
