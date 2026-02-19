import { Outlet } from 'react-router-dom'
import { useStudentSession } from '../../contexts/StudentSessionContext'
import { useStudentProfile } from '../../hooks/useStudentProfile'

export default function StudentLayout() {
  const { logout } = useStudentSession()
  const { profile } = useStudentProfile()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-green-700">학생 정보 입력</h1>
          <div className="flex items-center gap-4">
            {profile && (
              <span className="text-sm text-gray-500">
                {profile.name || profile.student_login_id}
              </span>
            )}
            <button
              onClick={logout}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1 border border-gray-300 rounded-md"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
