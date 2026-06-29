import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';

function App() {
    return (
          <AuthProvider>
              <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/" element={<AdminDashboard />} />
              </Routes>
          </AuthProvider>
      );
}

export default App;
