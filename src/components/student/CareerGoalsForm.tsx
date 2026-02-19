import { useState, useEffect, FormEvent } from 'react'
import { useCareerGoals } from '../../hooks/useCareerGoals'
import { useToast } from '../common/Toast'
import { CAREER_FIELDS, TARGET_TIERS, ADMISSION_TYPES, TargetTier } from '../../types/database'

export default function CareerGoalsForm() {
  const { careerGoals, loading, saveCareerGoals } = useCareerGoals()
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    career_field_1st: '',
    career_detail_1st: '',
    career_field_2nd: '',
    career_detail_2nd: '',
    target_univ_1_name: '',
    target_univ_1_dept: '',
    target_univ_2_name: '',
    target_univ_2_dept: '',
    target_univ_3_name: '',
    target_univ_3_dept: '',
    target_tier: '' as '' | TargetTier,
    admission_hakjong_ratio: 0,
    admission_gyogwa_ratio: 0,
    admission_nonsul_ratio: 0,
    admission_jeongsi_ratio: 0,
    field_keywords: [] as string[],
    special_notes: '',
  })
  const [keywordInput, setKeywordInput] = useState('')

  useEffect(() => {
    if (careerGoals) {
      setForm({
        career_field_1st: careerGoals.career_field_1st,
        career_detail_1st: careerGoals.career_detail_1st,
        career_field_2nd: careerGoals.career_field_2nd,
        career_detail_2nd: careerGoals.career_detail_2nd,
        target_univ_1_name: careerGoals.target_univ_1_name,
        target_univ_1_dept: careerGoals.target_univ_1_dept,
        target_univ_2_name: careerGoals.target_univ_2_name,
        target_univ_2_dept: careerGoals.target_univ_2_dept,
        target_univ_3_name: careerGoals.target_univ_3_name,
        target_univ_3_dept: careerGoals.target_univ_3_dept,
        target_tier: careerGoals.target_tier,
        admission_hakjong_ratio: careerGoals.admission_hakjong_ratio,
        admission_gyogwa_ratio: careerGoals.admission_gyogwa_ratio,
        admission_nonsul_ratio: careerGoals.admission_nonsul_ratio,
        admission_jeongsi_ratio: careerGoals.admission_jeongsi_ratio,
        field_keywords: Array.isArray(careerGoals.field_keywords) ? careerGoals.field_keywords : [],
        special_notes: careerGoals.special_notes,
      })
    }
  }, [careerGoals])

  const totalRatio = form.admission_hakjong_ratio + form.admission_gyogwa_ratio +
    form.admission_nonsul_ratio + form.admission_jeongsi_ratio

  const addKeyword = () => {
    const kw = keywordInput.trim()
    if (!kw) return
    if (form.field_keywords.length >= 3) {
      showToast('키워드는 최대 3개까지 입력 가능합니다.', 'error')
      return
    }
    if (form.field_keywords.includes(kw)) return
    setForm(f => ({ ...f, field_keywords: [...f.field_keywords, kw] }))
    setKeywordInput('')
  }

  const removeKeyword = (index: number) => {
    setForm(f => ({ ...f, field_keywords: f.field_keywords.filter((_, i) => i !== index) }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (totalRatio !== 100 && totalRatio !== 0) {
      showToast('전형 유형 비율의 합이 100%가 되어야 합니다.', 'error')
      return
    }
    setSaving(true)
    try {
      await saveCareerGoals(form)
      showToast('진로 및 목표 정보가 저장되었습니다.')
    } catch {
      showToast('저장에 실패했습니다.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="animate-pulse bg-gray-200 rounded-lg h-96" />
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 희망 진로 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">희망 진로</h3>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">1순위</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                value={form.career_field_1st}
                onChange={e => setForm(f => ({ ...f, career_field_1st: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              >
                <option value="">계열 선택</option>
                {CAREER_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <input
                type="text"
                value={form.career_detail_1st}
                onChange={e => setForm(f => ({ ...f, career_detail_1st: e.target.value }))}
                placeholder="세부 직업/전공"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">2순위</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                value={form.career_field_2nd}
                onChange={e => setForm(f => ({ ...f, career_field_2nd: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              >
                <option value="">계열 선택</option>
                {CAREER_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <input
                type="text"
                value={form.career_detail_2nd}
                onChange={e => setForm(f => ({ ...f, career_detail_2nd: e.target.value }))}
                placeholder="세부 직업/전공"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 목표 대학 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">목표 대학</h3>
        <div className="space-y-4">
          {[1, 2, 3].map(rank => (
            <div key={rank}>
              <p className="text-sm font-medium text-gray-700 mb-2">{rank}지망</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={form[`target_univ_${rank}_name` as keyof typeof form] as string}
                  onChange={e => setForm(f => ({ ...f, [`target_univ_${rank}_name`]: e.target.value }))}
                  placeholder="대학명"
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                />
                <input
                  type="text"
                  value={form[`target_univ_${rank}_dept` as keyof typeof form] as string}
                  onChange={e => setForm(f => ({ ...f, [`target_univ_${rank}_dept`]: e.target.value }))}
                  placeholder="학과명"
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <p className="text-sm font-medium text-gray-700 mb-2">목표 대학 Tier</p>
          <div className="flex flex-wrap gap-2">
            {TARGET_TIERS.map(tier => (
              <button
                type="button"
                key={tier}
                onClick={() => setForm(f => ({ ...f, target_tier: f.target_tier === tier ? '' : tier }))}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  form.target_tier === tier
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tier}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 전형 유형 비율 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">전형 유형 목표 (비율)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(Object.entries(ADMISSION_TYPES) as [string, string][]).map(([key, label]) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form[`admission_${key}_ratio` as keyof typeof form] as number}
                  onChange={e => setForm(f => ({ ...f, [`admission_${key}_ratio`]: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-center"
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
            </div>
          ))}
        </div>
        <p className={`text-sm mt-2 ${totalRatio === 100 || totalRatio === 0 ? 'text-gray-400' : 'text-red-500 font-medium'}`}>
          합계: {totalRatio}% {totalRatio !== 100 && totalRatio !== 0 && '(100%가 되어야 합니다)'}
        </p>
      </div>

      {/* 희망 계열 키워드 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">희망 계열 키워드 (2~3개)</h3>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={keywordInput}
            onChange={e => setKeywordInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }}
            placeholder="키워드 입력 후 Enter"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
          />
          <button
            type="button"
            onClick={addKeyword}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            추가
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {form.field_keywords.map((kw, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm">
              {kw}
              <button type="button" onClick={() => removeKeyword(i)} className="text-purple-400 hover:text-purple-700 ml-1">&times;</button>
            </span>
          ))}
        </div>
      </div>

      {/* 특이사항 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">특이사항</h3>
        <textarea
          value={form.special_notes}
          onChange={e => setForm(f => ({ ...f, special_notes: e.target.value }))}
          rows={4}
          placeholder="특이사항을 자유롭게 입력하세요..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none resize-y"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 transition"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </form>
  )
}
