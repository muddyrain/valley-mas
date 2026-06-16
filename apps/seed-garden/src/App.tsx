import { Navigate, Route, Routes } from 'react-router-dom';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/garden" replace />} />
      <Route
        path="/garden"
        element={
          <div className="min-h-screen flex items-center justify-center text-garden-ink">
            语种园占位页（M3 替换）
          </div>
        }
      />
    </Routes>
  );
}
