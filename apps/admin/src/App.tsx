import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './layouts/Layout';
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
  return userInfo ? <>{children}</> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
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
          <Route path="resources" element={<Resources />} />
          <Route path="records" element={<Records />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
