import { Link } from 'react-router-dom'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">입시 컨설팅 관리</h1>
        <p className="text-gray-500 mb-10">학생 세부자료 입력 시스템</p>

        <div className="flex flex-col gap-4">
          <Link
            to="/admin/login"
            className="block w-full py-4 px-6 bg-blue-600 text-white rounded-xl text-lg font-semibold hover:bg-blue-700 transition shadow-md"
          >
            관리자 로그인
          </Link>
          <Link
            to="/student/login"
            className="block w-full py-4 px-6 bg-green-600 text-white rounded-xl text-lg font-semibold hover:bg-green-700 transition shadow-md"
          >
            학생 로그인
          </Link>
        </div>
      </div>
    </div>
  )
}
