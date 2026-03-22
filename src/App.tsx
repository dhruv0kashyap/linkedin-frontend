import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import Navbar from './components/layout/Navbar';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ProfileSetupPage from './pages/ProfileSetupPage';
import FeedPage from './pages/FeedPage';
import ProfilePage from './pages/ProfilePage';
import JobsPage from './pages/JobsPage';
import ConnectionsPage from './pages/ConnectionsPage';
import NotificationsPage from './pages/NotificationsPage';
import './styles/global.css';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>
    <Navbar />
    <main style={{ minHeight: 'calc(100vh - 52px)', paddingBottom: 40 }}>
      {children}
    </main>
  </>
);

const App: React.FC = () => (
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* Profile setup (protected, no navbar) */}
        <Route path="/profile/setup" element={<ProtectedRoute><ProfileSetupPage /></ProtectedRoute>} />

        {/* Protected with navbar */}
        <Route path="/feed" element={<ProtectedRoute><Layout><FeedPage /></Layout></ProtectedRoute>} />
        <Route path="/profile/:id" element={<ProtectedRoute><Layout><ProfilePage /></Layout></ProtectedRoute>} />
        <Route path="/connections" element={<ProtectedRoute><Layout><ConnectionsPage /></Layout></ProtectedRoute>} />
        <Route path="/jobs" element={<ProtectedRoute><Layout><JobsPage /></Layout></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Layout><NotificationsPage /></Layout></ProtectedRoute>} />

        {/* Defaults */}
        <Route path="/" element={<Navigate to="/feed" replace />} />
        <Route path="*" element={<Navigate to="/feed" replace />} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
