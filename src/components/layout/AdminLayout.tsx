import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function AdminLayout() {
  const { user, signOut } = useAuth()
  const location = useLocation()

  return (
    <div className="min-h-screen bg-gradient-page">
      <header className="bg-gradient-to-r from-rose-900 via-rose-800 to-rose-900 border-b border-rose-700/50 shadow-nav sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/admin" className="flex items-center gap-2 text-lg font-bold text-white">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-xs font-black text-rose-900">SD</span>
              학생 세부자료 관리
            </Link>
            <nav className="flex gap-4">
              <Link
                to="/admin"
                className={`text-sm font-medium transition-colors ${
                  location.pathname === '/admin' ? 'text-amber-400' : 'text-rose-200/70 hover:text-white'
                }`}
              >
                학생 목록
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-rose-300">{user?.email}</span>
            <button
              onClick={signOut}
              className="text-sm text-rose-300/70 hover:text-white transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
