import { useState, useEffect, FormEvent } from 'react'
import { useStudentProfile } from '../../hooks/useStudentProfile'
import { useToast } from '../common/Toast'
import { formatPhone } from '../../lib/utils'

export default function PersonalInfoForm() {
  const { profile, loading, updateProfile } = useStudentProfile()
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    enrollment_year: '',
    graduation_year: '',
    high_school_name: '',
    student_phone: '',
    parent_phone: '',
  })

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name || '',
        enrollment_year: profile.enrollment_year?.toString() || '',
        graduation_year: profile.graduation_year?.toString() || '',
        high_school_name: profile.high_school_name || '',
        student_phone: profile.student_phone || '',
        parent_phone: profile.parent_phone || '',
      })
    }
  }, [profile])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateProfile({
        name: form.name,
        enrollment_year: form.enrollment_year ? parseInt(form.enrollment_year) : undefined,
        graduation_year: form.graduation_year ? parseInt(form.graduation_year) : undefined,
        high_school_name: form.high_school_name,
        student_phone: form.student_phone,
        parent_phone: form.parent_phone,
      })
      showToast('기본 정보가 저장되었습니다.')
    } catch (err) {
      showToast('저장에 실패했습니다.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="animate-pulse bg-gray-200 rounded-lg h-64" />
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">기본 신상 정보</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              placeholder="홍길동"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">학년 / 아이디</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={profile?.grade ? `${profile.grade}학년` : ''}
                disabled
                className="w-24 px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-500"
              />
              <input
                type="text"
                value={profile?.student_login_id || ''}
                disabled
                className="flex-1 px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">입학 연도</label>
            <input
              type="number"
              value={form.enrollment_year}
              onChange={e => setForm(f => ({ ...f, enrollment_year: e.target.value }))}
              min="2020"
              max="2035"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              placeholder="2024"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">졸업 예정 연도</label>
            <input
              type="number"
              value={form.graduation_year}
              onChange={e => setForm(f => ({ ...f, graduation_year: e.target.value }))}
              min="2020"
              max="2035"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              placeholder="2027"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">재학 중인 고등학교명</label>
            <input
              type="text"
              value={form.high_school_name}
              onChange={e => setForm(f => ({ ...f, high_school_name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              placeholder="OO고등학교"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">학생 연락처 (휴대폰)</label>
            <input
              type="tel"
              value={form.student_phone}
              onChange={e => setForm(f => ({ ...f, student_phone: formatPhone(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              placeholder="010-1234-5678"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">학부모 연락처</label>
            <input
              type="tel"
              value={form.parent_phone}
              onChange={e => setForm(f => ({ ...f, parent_phone: formatPhone(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              placeholder="010-1234-5678"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">담당 컨설턴트</label>
            <input
              type="text"
              value={profile?.consultant_name || ''}
              disabled
              className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-500"
            />
          </div>
        </div>
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
