import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { StudentSessionProvider } from './contexts/StudentSessionContext'
import { ToastProvider } from './components/common/Toast'
import ErrorBoundary from './components/common/ErrorBoundary'
import AdminRoute from './guards/AdminRoute'
import StudentRoute from './guards/StudentRoute'
import AdminLayout from './components/layout/AdminLayout'
import StudentLayout from './components/layout/StudentLayout'
import LandingPage from './pages/LandingPage'
import AdminLoginPage from './pages/admin/AdminLoginPage'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminStudentDetail from './pages/admin/AdminStudentDetail'
import StudentLoginPage from './pages/student/StudentLoginPage'
import StudentFormPage from './pages/student/StudentFormPage'

export default function App() {
  return (
    <ErrorBoundary>
    <ToastProvider>
      <AuthProvider>
        <StudentSessionProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />

            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="students/:studentId" element={<AdminStudentDetail />} />
            </Route>

            <Route path="/student/login" element={<StudentLoginPage />} />
            <Route path="/student" element={<StudentRoute><StudentLayout /></StudentRoute>}>
              <Route index element={<StudentFormPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </StudentSessionProvider>
      </AuthProvider>
    </ToastProvider>
    </ErrorBoundary>
  )
}
