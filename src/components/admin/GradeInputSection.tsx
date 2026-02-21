import { useState, useEffect } from 'react'
import { GRADE_SEMESTERS, GRADE_CATEGORIES } from '../../types/database'

interface Props {
  grades: Record<string, number | null>
  onSave: (grades: Record<string, number | null>) => Promise<void>
}

const SEMESTER_LABELS: Record<string, string> = {
  '1-1': '1-1',
  '1-2': '1-2',
  '2-1': '2-1',
  '2-2': '2-2',
  '3-1': '3-1',
}

export default function GradeInputSection({ grades, onSave }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const d: Record<string, string> = {}
    for (const sem of GRADE_SEMESTERS) {
      for (const cat of GRADE_CATEGORIES) {
        const key = `${sem}_${cat}`
        d[key] = grades[key] != null ? String(grades[key]) : ''
      }
    }
    setDraft(d)
  }, [grades])

  const handleChange = (key: string, value: string) => {
    // 숫자만 허용 (소수점 포함)
    if (value && !/^\d*\.?\d*$/.test(value)) return
    setDraft(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const result: Record<string, number | null> = {}
      for (const [key, val] of Object.entries(draft)) {
        result[key] = val ? parseFloat(val) : null
      }
      await onSave(result)
      setEditing(false)
    } catch (err: any) {
      alert(`저장 실패: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // 전체 평균 계산
  const calcTotal = (cat: string): string => {
    const vals: number[] = []
    for (const sem of GRADE_SEMESTERS) {
      const key = `${sem}_${cat}`
      const v = draft[key]
      if (v && !isNaN(parseFloat(v))) vals.push(parseFloat(v))
    }
    if (vals.length === 0) return ''
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-slate-600">성적 등급 평균</h4>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
          >
            수정
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 text-xs font-medium text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        )}
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600 w-28">구분</th>
            {GRADE_SEMESTERS.map(sem => (
              <th key={sem} className="border border-slate-200 px-3 py-2 text-center font-semibold text-slate-600 w-20">
                {SEMESTER_LABELS[sem]}
              </th>
            ))}
            <th className="border border-slate-200 px-3 py-2 text-center font-semibold text-slate-600 w-20 bg-amber-50">
              전체
            </th>
          </tr>
        </thead>
        <tbody>
          {GRADE_CATEGORIES.map(cat => (
            <tr key={cat} className="hover:bg-slate-50">
              <td className="border border-slate-200 px-3 py-2 font-medium text-slate-700">{cat}</td>
              {GRADE_SEMESTERS.map(sem => {
                const key = `${sem}_${cat}`
                return (
                  <td key={key} className="border border-slate-200 px-1 py-1 text-center">
                    {editing ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        value={draft[key] || ''}
                        onChange={e => handleChange(key, e.target.value)}
                        className="w-full text-center text-sm py-1 px-1 border border-slate-200 rounded focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                        placeholder="-"
                      />
                    ) : (
                      <span className={`text-sm ${draft[key] ? 'text-slate-800 font-medium' : 'text-slate-300'}`}>
                        {draft[key] || '-'}
                      </span>
                    )}
                  </td>
                )
              })}
              <td className="border border-slate-200 px-3 py-2 text-center bg-amber-50">
                <span className={`text-sm font-semibold ${calcTotal(cat) ? 'text-amber-700' : 'text-slate-300'}`}>
                  {calcTotal(cat) || '-'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
