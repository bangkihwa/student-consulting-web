import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useStudentSession } from '../../contexts/StudentSessionContext'

export default function StudentLoginPage() {
  const [loginId, setLoginId] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useStudentSession()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(loginId.toLowerCase(), name.trim())
      navigate('/student')
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white rounded-xl shadow-md p-8">
        <Link to="/" className="text-sm text-gray-400 hover:text-gray-600 mb-4 inline-block">
          &larr; 돌아가기
        </Link>
        <h2 className="text-2xl font-bold text-gray-800 mb-6">학생 로그인</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">학생 아이디</label>
            <input
              type="text"
              value={loginId}
              onChange={e => setLoginId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              placeholder="예: h01001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              placeholder="홍길동"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 transition"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p className="text-xs text-gray-400 mt-4 text-center">
          아이디는 담당 컨설턴트에게 문의하세요.
        </p>
      </div>
    </div>
  )
}
