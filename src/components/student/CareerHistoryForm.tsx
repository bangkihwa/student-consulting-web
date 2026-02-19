import { useState, FormEvent } from 'react'
import { useCareerHistory } from '../../hooks/useCareerHistory'
import { useToast } from '../common/Toast'

export default function CareerHistoryForm() {
  const { history, loading, addHistory, deleteHistory } = useCareerHistory()
  const { showToast } = useToast()
  const [showAddForm, setShowAddForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [newEntry, setNewEntry] = useState({
    change_date: new Date().toISOString().split('T')[0],
    previous_career: '',
    new_career: '',
    reason: '',
  })

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!newEntry.previous_career || !newEntry.new_career) {
      showToast('이전 진로와 변경 진로를 입력해주세요.', 'error')
      return
    }
    setSaving(true)
    try {
      await addHistory(newEntry)
      showToast('진로 변경 이력이 추가되었습니다.')
      setNewEntry({
        change_date: new Date().toISOString().split('T')[0],
        previous_career: '',
        new_career: '',
        reason: '',
      })
      setShowAddForm(false)
    } catch {
      showToast('추가에 실패했습니다.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteHistory(id)
      showToast('이력이 삭제되었습니다.')
      setDeleteConfirm(null)
    } catch {
      showToast('삭제에 실패했습니다.', 'error')
    }
  }

  if (loading) {
    return <div className="animate-pulse bg-gray-200 rounded-lg h-64" />
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">진로 변경 이력</h3>
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition"
          >
            {showAddForm ? '취소' : '+ 이력 추가'}
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleAdd} className="bg-green-50 rounded-lg p-4 mb-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">변경 날짜</label>
                <input
                  type="date"
                  value={newEntry.change_date}
                  onChange={e => setNewEntry(n => ({ ...n, change_date: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">이전 진로</label>
                <input
                  type="text"
                  value={newEntry.previous_career}
                  onChange={e => setNewEntry(n => ({ ...n, previous_career: e.target.value }))}
                  required
                  placeholder="이전 희망 진로"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">변경 진로</label>
                <input
                  type="text"
                  value={newEntry.new_career}
                  onChange={e => setNewEntry(n => ({ ...n, new_career: e.target.value }))}
                  required
                  placeholder="새로운 희망 진로"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">변경 사유 (선택)</label>
              <input
                type="text"
                value={newEntry.reason}
                onChange={e => setNewEntry(n => ({ ...n, reason: e.target.value }))}
                placeholder="변경 사유를 입력하세요"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? '추가 중...' : '추가'}
              </button>
            </div>
          </form>
        )}

        {history.length === 0 ? (
          <p className="text-gray-400 text-center py-8">진로 변경 이력이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {history.map(item => (
              <div key={item.id} className="border-l-4 border-green-400 pl-4 py-3 flex items-start justify-between group">
                <div>
                  <p className="text-xs text-gray-400 mb-1">{item.change_date}</p>
                  <p className="text-sm">
                    <span className="text-gray-500">{item.previous_career}</span>
                    <span className="mx-2 text-gray-400">&rarr;</span>
                    <span className="font-medium text-gray-800">{item.new_career}</span>
                  </p>
                  {item.reason && <p className="text-xs text-gray-500 mt-1">사유: {item.reason}</p>}
                </div>
                <div>
                  {deleteConfirm === item.id ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-xs px-2 py-1 bg-red-600 text-white rounded"
                      >
                        확인
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(item.id)}
                      className="text-xs px-2 py-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"
                    >
                      삭제
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
