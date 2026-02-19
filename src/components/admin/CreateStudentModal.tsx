import { useState, FormEvent } from 'react'
import { SchoolLevel } from '../../lib/utils'

interface Props {
  isOpen: boolean
  onClose: () => void
  onCreate: (schoolLevel: SchoolLevel, grade: string, consultantName: string, name: string) => Promise<{ student_login_id: string; name: string }>
}

export default function CreateStudentModal({ isOpen, onClose, onCreate }: Props) {
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel>('high')
  const [grade, setGrade] = useState('1')
  const [consultantName, setConsultantName] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ student_login_id: string; name: string } | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('학생 이름을 입력해주세요.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const data = await onCreate(schoolLevel, grade, consultantName, name)
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '생성에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setResult(null)
    setSchoolLevel('high')
    setGrade('1')
    setConsultantName('')
    setName('')
    setError('')
    onClose()
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  if (result) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl p-8 max-w-sm w-full">
          <h3 className="text-lg font-bold text-gray-800 mb-4">학생 계정이 생성되었습니다</h3>

          <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">학생 아이디</p>
              <div className="flex items-center gap-2">
                <span className="text-xl font-mono font-bold text-blue-700">{result.student_login_id}</span>
                <button
                  onClick={() => copyToClipboard(result.student_login_id)}
                  className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  복사
                </button>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">학생 이름</p>
              <span className="text-lg font-bold text-gray-800">{result.name}</span>
            </div>
          </div>

          <p className="text-xs text-gray-400 mb-4">
            학생에게 아이디를 전달해주세요. 로그인 시 아이디와 이름을 입력합니다.
          </p>

          <button
            onClick={handleClose}
            className="w-full py-2 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-900"
          >
            확인
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-8 max-w-sm w-full">
        <h3 className="text-lg font-bold text-gray-800 mb-6">학생 계정 생성</h3>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">학생 이름</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="홍길동"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">학교 구분</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSchoolLevel('middle')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                  schoolLevel === 'middle'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                중학교
              </button>
              <button
                type="button"
                onClick={() => setSchoolLevel('high')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                  schoolLevel === 'high'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                고등학교
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">학년</label>
            <select
              value={grade}
              onChange={e => setGrade(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="1">1학년</option>
              <option value="2">2학년</option>
              <option value="3">3학년</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">담당 컨설턴트</label>
            <input
              type="text"
              value={consultantName}
              onChange={e => setConsultantName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="컨설턴트명"
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
            생성될 아이디 예시: <span className="font-mono font-bold text-blue-600">
              {schoolLevel === 'middle' ? 'm' : 'h'}{grade.padStart(2, '0')}001
            </span>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '생성 중...' : '생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
