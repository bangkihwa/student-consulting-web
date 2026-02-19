import { Navigate } from 'react-router-dom'
import { useStudentSession } from '../contexts/StudentSessionContext'

export default function StudentRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useStudentSession()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/student/login" replace />
  return <>{children}</>
}
