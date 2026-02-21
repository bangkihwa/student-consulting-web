import { useState, useEffect } from 'react'
import { SmFileAnalysis } from '../../types/database'

interface Props {
  fileId: string
  getAnalysis: (fileId: string) => Promise<SmFileAnalysis | null>
  onUpdate: (analysisId: string, updates: Partial<SmFileAnalysis>) => Promise<void>
  onReanalyze?: (fileId: string) => Promise<void>
}

const FIELDS: { key: keyof SmFileAnalysis; label: string; multiline: boolean }[] = [
  { key: 'title', label: '제목', multiline: false },
  { key: 'activity_content', label: '활동내용 (탐구과정 요약)', multiline: true },
  { key: 'conclusion', label: '결론 (결과 및 시사점)', multiline: true },
  { key: 'research_plan', label: '추가탐구계획', multiline: true },
  { key: 'reading_activities', label: '독서활동', multiline: true },
  { key: 'evaluation_competency', label: '평가역량 (AI 분석)', multiline: false },
]

export default function FileAnalysisCard({ fileId, getAnalysis, onUpdate, onReanalyze }: Props) {
  const [analysis, setAnalysis] = useState<SmFileAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [reanalyzing, setReanalyzing] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getAnalysis(fileId).then(data => {
      if (!cancelled) {
        setAnalysis(data)
        setLoading(false)
      }
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [fileId, getAnalysis])

  const handleEdit = (field: string, currentValue: string) => {
    setEditingField(field)
    setEditValue(currentValue)
  }

  const handleSave = async () => {
    if (!analysis || !editingField) return
    setSaving(true)
    try {
      await onUpdate(analysis.id, { [editingField]: editValue })
      setAnalysis(prev => prev ? { ...prev, [editingField]: editValue, is_edited: true } : prev)
      setEditingField(null)
    } catch (err) {
      alert(`저장 실패: ${err}`)
    }
    setSaving(false)
  }

  const handleCancel = () => {
    setEditingField(null)
    setEditValue('')
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        </div>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <p className="text-gray-400 text-sm">분석 결과가 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">AI 분석 결과</h3>
        <div className="flex items-center gap-2">
          {analysis.is_edited && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">수정됨</span>
          )}
          {onReanalyze && (
            <button
              onClick={async () => {
                setReanalyzing(true)
                try {
                  await onReanalyze(fileId)
                } finally {
                  setReanalyzing(false)
                }
              }}
              disabled={reanalyzing}
              className="px-3 py-1 text-xs text-orange-600 border border-orange-300 rounded-md hover:bg-orange-50 disabled:opacity-50"
            >
              {reanalyzing ? '재분석 중...' : '재분석'}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {FIELDS.map(({ key, label, multiline }) => {
          const value = analysis[key] as string
          const isEditing = editingField === key

          return (
            <div key={key} className="group">
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-gray-500">{label}</label>
                {!isEditing && (
                  <button
                    onClick={() => handleEdit(key, value)}
                    className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition"
                  >
                    수정
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-2">
                  {multiline ? (
                    <textarea
                      className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={4}
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                    />
                  ) : (
                    <input
                      type="text"
                      className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                    />
                  )}
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={handleCancel}
                      className="px-3 py-1 text-xs text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                      disabled={saving}
                    >
                      취소
                    </button>
                    <button
                      onClick={handleSave}
                      className="px-3 py-1 text-xs text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                      disabled={saving}
                    >
                      {saving ? '저장 중...' : '저장'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className={`text-sm ${value ? 'text-gray-800' : 'text-gray-400'} whitespace-pre-wrap`}>
                  {value || '(없음)'}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
