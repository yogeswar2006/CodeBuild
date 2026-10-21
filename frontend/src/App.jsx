
import { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/useAuthStore';
import PageLoader from './components/PageLoader';
import LoginPage from './pages/loginPage';
import Dashboard from './pages/dashboard';
import RegisterPage from './pages/registerPage';
import { Navigate,Routes,Route } from 'react-router';




export default function App() {
  const { isCheckingAuth, authUser, checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  if (isCheckingAuth) return <PageLoader />

  return (

    <div >
      <Routes>
        <Route path="/dashboard" element={authUser ? <Dashboard /> : <Navigate to={"/login"} />} />
        <Route path="/login" element={!authUser ? <LoginPage /> : <Navigate to={"/dashboard"} />} />
        <Route path="/register" element={!authUser ? <RegisterPage /> : <Navigate to={"/dashboard"} />} />
      </Routes>

      <Toaster />
    </div>

  )
}
