import { Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import Layout from './layouts/Layout';
import Creator from './pages/Creator';
import CreatorProfile from './pages/CreatorProfile';
import Home from './pages/Home';
import Login from './pages/Login';

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="creator" element={<Creator />} />
          <Route path="creator/:code" element={<CreatorProfile />} />
        </Route>
        <Route path="/login" element={<Login />} />
      </Routes>
      <Toaster />
    </>
  );
}

export default App;
