import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import Dashboard from './pages/Dashboard';
import RoomDetail from './pages/RoomDetail';
import Landing from './pages/Landing';
import { Toaster } from './components/Toaster';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/" replace />;
  
  return <>{children}</>;
}

export default function App() {
  const { user, loading } = useAuthStore();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading app...</div>;
  }

  return (
    <BrowserRouter>
      <Toaster />
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Landing />} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/room/:roomId" element={<PrivateRoute><RoomDetail /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
