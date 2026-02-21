import { useState, useEffect } from 'react'
import {
  SmFileAnalysis, SmUploadedFile,
  CategoryMain, ChangcheType, GyogwaType,
  CHANGCHE_TYPES, CHANGCHE_SUBS, GYOGWA_TYPES, GYOGWA_SUBS, SEMESTERS,
} from '../../types/database'

interface Props {
  fileId: string
  file: SmUploadedFile
  getAnalysis: (fileId: string) => Promise<SmFileAnalysis | null>
  onUpdate: (analysisId: string, updates: Partial<SmFileAnalysis>) => Promise<void>
  onUpdateFile: (fileId: string, updates: Partial<SmUploadedFile>) => Promise<void>
  onReanalyze?: (fileId: string) => Promise<void>
}

const ANALYSIS_FIELDS: { key: keyof SmFileAnalysis; label: string; multiline: boolean }[] = [
  { key: 'title', label: '제목', multiline: false },
  { key: 'activity_content', label: '활동내용 (탐구과정 요약)', multiline: true },
  { key: 'conclusion', label: '결론 (결과 및 시사점)', multiline: true },
  { key: 'research_plan', label: '추가탐구계획', multiline: true },
  { key: 'reading_activities', label: '독서활동', multiline: true },
  { key: 'evaluation_competency', label: '평가역량 (AI 분석)', multiline: false },
]

export default function FileAnalysisCard({ fileId, file, getAnalysis, onUpdate, onUpdateFile, onReanalyze }: Props) {
  const [analysis, setAnalysis] = useState<SmFileAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [reanalyzing, setReanalyzing] = useState(false)
  const [editingClassification, setEditingClassification] = useState(false)
  const [classForm, setClassForm] = useState({
    semester: '',
    category_main: '창체활동' as CategoryMain,
    changche_type: null as ChangcheType | null,
    changche_sub: '',
    gyogwa_type: null as GyogwaType | null,
    gyogwa_sub: '',
    gyogwa_subject_name: '',
    bongsa_hours: null as number | null,
  })

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

  const startEditClassification = () => {
    setClassForm({
      semester: file.semester || '',
      category_main: file.category_main || '창체활동',
      changche_type: file.changche_type || null,
      changche_sub: file.changche_sub || '',
      gyogwa_type: file.gyogwa_type || null,
      gyogwa_sub: file.gyogwa_sub || '',
      gyogwa_subject_name: file.gyogwa_subject_name || '',
      bongsa_hours: file.bongsa_hours,
    })
    setEditingClassification(true)
  }

  const saveClassification = async () => {
    setSaving(true)
    try {
      await onUpdateFile(fileId, {
        semester: classForm.semester,
        category_main: classForm.category_main,
        changche_type: classForm.changche_type,
        changche_sub: classForm.changche_sub,
        gyogwa_type: classForm.gyogwa_type,
        gyogwa_sub: classForm.gyogwa_sub,
        gyogwa_subject_name: classForm.gyogwa_subject_name,
        bongsa_hours: classForm.bongsa_hours,
      })
      setEditingClassification(false)
    } catch (err) {
      alert(`분류 수정 실패: ${err}`)
    }
    setSaving(false)
  }

  const updateClass = (patch: Partial<typeof classForm>) => {
    setClassForm(prev => ({ ...prev, ...patch }))
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

  const getSemesterLabel = (s: string) => s ? s.replace('-', '학년 ') + '학기' : '미분류'
  const getCategoryDisplay = () => {
    if (file.category_main === '창체활동') {
      const parts = [file.changche_type, file.changche_sub].filter(Boolean)
      return { main: '창체활동', detail: parts.join(' > ') || '' }
    }
    const parts = [file.gyogwa_subject_name, file.gyogwa_type, file.gyogwa_sub].filter(Boolean)
    return { main: '교과세특', detail: parts.join(' > ') || '' }
  }

  const catDisplay = getCategoryDisplay()

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
      {/* AI 분류 결과 섹션 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">AI 자동 분류</h3>
          {!editingClassification && (
            <button
              onClick={startEditClassification}
              className="px-3 py-1 text-xs text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50"
            >
              분류 수정
            </button>
          )}
        </div>

        {editingClassification ? (
          <div className="space-y-3 bg-gray-50 rounded-lg p-4">
            {/* 학기 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">학기</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={classForm.semester}
                onChange={e => updateClass({ semester: e.target.value })}
              >
                <option value="">미분류</option>
                {SEMESTERS.map(s => (
                  <option key={s} value={s}>{s.replace('-', '학년 ')}학기</option>
                ))}
              </select>
            </div>

            {/* 대분류 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">대분류</label>
              <div className="flex gap-2">
                {(['창체활동', '교과세특'] as CategoryMain[]).map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => updateClass({
                      category_main: cat,
                      changche_type: null, changche_sub: '',
                      gyogwa_type: null, gyogwa_sub: '', gyogwa_subject_name: '',
                      bongsa_hours: null,
                    })}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-sm font-medium transition ${
                      classForm.category_main === cat
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* 창체활동 세부 */}
            {classForm.category_main === '창체활동' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">활동 유형</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CHANGCHE_TYPES.map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => updateClass({ changche_type: type, changche_sub: '', bongsa_hours: type === '봉사활동' ? null : classForm.bongsa_hours })}
                        className={`py-1.5 px-2 rounded-lg text-xs font-medium transition ${
                          classForm.changche_type === type
                            ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-500'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                {classForm.changche_type && classForm.changche_type !== '봉사활동' && CHANGCHE_SUBS[classForm.changche_type].length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">세부 유형</label>
                    <div className="flex flex-wrap gap-1">
                      {CHANGCHE_SUBS[classForm.changche_type].map(sub => (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => updateClass({ changche_sub: sub })}
                          className={`py-1 px-2.5 rounded-full text-xs font-medium transition ${
                            classForm.changche_sub === sub
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                          }`}
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {classForm.changche_type === '봉사활동' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">봉사 시간</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={classForm.bongsa_hours ?? ''}
                      onChange={e => updateClass({ bongsa_hours: e.target.value ? parseFloat(e.target.value) : null })}
                    />
                  </div>
                )}
              </>
            )}

            {/* 교과세특 세부 */}
            {classForm.category_main === '교과세특' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">교과명</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="예: 수학, 영어, 물리학1"
                    value={classForm.gyogwa_subject_name}
                    onChange={e => updateClass({ gyogwa_subject_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">활동 유형</label>
                  <div className="flex gap-2">
                    {GYOGWA_TYPES.map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => updateClass({ gyogwa_type: type, gyogwa_sub: '' })}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition ${
                          classForm.gyogwa_type === type
                            ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-500'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                {classForm.gyogwa_type && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">세부 유형</label>
                    <div className="flex flex-wrap gap-1">
                      {GYOGWA_SUBS[classForm.gyogwa_type].map(sub => (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => updateClass({ gyogwa_sub: sub })}
                          className={`py-1 px-2.5 rounded-full text-xs font-medium transition ${
                            classForm.gyogwa_sub === sub
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                          }`}
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setEditingClassification(false)}
                className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={saving}
              >
                취소
              </button>
              <button
                onClick={saveClassification}
                className="px-3 py-1.5 text-xs text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                disabled={saving}
              >
                {saving ? '저장 중...' : '분류 저장'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <span className="px-2.5 py-1 text-xs rounded-lg bg-purple-50 text-purple-700 font-medium border border-purple-100">
              {getSemesterLabel(file.semester)}
            </span>
            <span className={`px-2.5 py-1 text-xs rounded-lg font-medium border ${
              file.category_main === '창체활동'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                : 'bg-blue-50 text-blue-700 border-blue-100'
            }`}>
              {catDisplay.main}
            </span>
            {catDisplay.detail && (
              <span className="px-2.5 py-1 text-xs rounded-lg bg-gray-50 text-gray-600 font-medium border border-gray-200">
                {catDisplay.detail}
              </span>
            )}
          </div>
        )}
      </div>

      {/* AI 분석 결과 섹션 */}
      <div>
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
          {ANALYSIS_FIELDS.map(({ key, label, multiline }) => {
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
    </div>
  )
}
