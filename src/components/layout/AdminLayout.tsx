import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function AdminLayout() {
  const { user, signOut } = useAuth()
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/admin" className="text-xl font-bold text-blue-700">
              입시 컨설팅 관리
            </Link>
            <nav className="flex gap-4">
              <Link
                to="/admin"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  isActive('/admin')
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                학생 관리
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{user?.email}</span>
            <button
              onClick={signOut}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1 border border-gray-300 rounded-md"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
