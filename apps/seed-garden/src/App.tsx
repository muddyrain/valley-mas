import { Navigate, Route, Routes } from 'react-router-dom';
import Encyclopedia from '@/pages/Encyclopedia';
import Garden from '@/pages/Garden';
import Login from '@/pages/Login';
import PlantDetail from '@/pages/PlantDetail';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/garden" replace />} />
      <Route path="/garden" element={<Garden />} />
      <Route path="/garden/encyclopedia" element={<Encyclopedia />} />
      <Route path="/garden/plant/:id" element={<PlantDetail />} />
      <Route path="/login" element={<Login />} />
    </Routes>
  );
}
