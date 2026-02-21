import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStudents } from '../../hooks/useStudents'
import CreateStudentModal from '../../components/admin/CreateStudentModal'
import { useToast } from '../../components/common/Toast'

export default function AdminDashboard() {
  const { students, loading, error, createStudent, deleteStudent, toggleActive, searchStudents } = useStudents()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const { showToast } = useToast()

  const handleCreate = async (schoolLevel: 'middle' | 'high', grade: string, consultantName: string, name: string) => {
    const student = await createStudent(schoolLevel, grade, consultantName, name)
    showToast('학생 계정이 생성되었습니다.')
    return student
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteStudent(id)
      showToast('학생이 삭제되었습니다.')
      setDeleteConfirm(null)
    } catch {
      showToast('삭제에 실패했습니다.', 'error')
    }
  }

  const handleToggleActive = async (id: string, current: boolean) => {
    try {
      await toggleActive(id, !current)
      showToast(!current ? '계정이 활성화되었습니다.' : '계정이 비활성화되었습니다.')
    } catch {
      showToast('상태 변경에 실패했습니다.', 'error')
    }
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    searchStudents(query)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="section-title text-2xl">학생 관리</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-gradient-to-r from-rose-600 to-rose-700 text-white rounded-xl font-semibold hover:from-rose-500 hover:to-rose-600 shadow-lg shadow-rose-600/20 transition-all duration-200 active:scale-[0.98]"
        >
          + 학생 계정 생성
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={e => handleSearch(e.target.value)}
          placeholder="이름, 학교명, 아이디로 검색..."
          className="input-field max-w-md"
        />
      </div>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      {students.length === 0 ? (
        <div className="glass-card-solid p-12 text-center text-slate-400">
          <p className="text-lg mb-2">등록된 학생이 없습니다</p>
          <p className="text-sm">위의 "학생 계정 생성" 버튼으로 학생을 추가하세요.</p>
        </div>
      ) : (
        <div className="glass-card-solid overflow-hidden">
          <table className="w-full">
            <thead className="bg-rose-50/50 border-b border-rose-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-rose-800 uppercase tracking-wider">아이디</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-rose-800 uppercase tracking-wider">이름</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-rose-800 uppercase tracking-wider">학년</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-rose-800 uppercase tracking-wider">학교</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-rose-800 uppercase tracking-wider">담당</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-rose-800 uppercase tracking-wider">상태</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-rose-800 uppercase tracking-wider">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-50">
              {students.map(student => (
                <tr key={student.id} className="hover:bg-rose-50/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono text-rose-700">{student.student_login_id}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{student.name || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{student.grade}학년</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{student.high_school_name || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{student.consultant_name}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(student.id, student.is_active)}
                      className={`px-2.5 py-1 text-xs rounded-full font-medium border transition-colors ${
                        student.is_active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}
                    >
                      {student.is_active ? '활성' : '비활성'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/admin/students/${student.id}`}
                        className="text-xs px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg hover:bg-rose-100 font-medium transition-colors"
                      >
                        상세
                      </Link>
                      {deleteConfirm === student.id ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleDelete(student.id)}
                            className="text-xs px-2 py-1.5 bg-red-600 text-white rounded-lg font-medium"
                          >
                            확인
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="text-xs px-2 py-1.5 bg-slate-200 text-slate-600 rounded-lg font-medium"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(student.id)}
                          className="text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-medium transition-colors"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateStudentModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreate}
      />
    </div>
  )
}
