import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { SmStudent, SmCareerGoals, SmCareerChangeHistory, SmSubjectRecord, SmActivity, SmBehaviorSummary, ADMISSION_TYPES } from '../../types/database'
import { useFileUpload } from '../../hooks/useFileUpload'
import { exportStudentExcel } from '../../lib/excelExport'
import FileUploadSection from '../../components/admin/FileUploadSection'
import FileList from '../../components/admin/FileList'
import FileAnalysisCard from '../../components/admin/FileAnalysisCard'

// ============================================================
// 접기/펼치기 섹션 컴포넌트
// ============================================================
function CollapsibleSection({
  title,
  defaultOpen = true,
  badge,
  children,
}: {
  title: string
  defaultOpen?: boolean
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="glass-card-solid overflow-hidden mb-5 animate-fade-in-up animate-fill-both">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-rose-50/30 transition-colors"
      >
        <h3 className="section-title">{title}</h3>
        <div className="flex items-center gap-2">
          {badge}
          <svg
            className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="px-6 pb-5 border-t border-rose-100/50">
          {children}
        </div>
      )}
    </section>
  )
}

export default function AdminStudentDetail() {
  const { studentId } = useParams<{ studentId: string }>()
  const [student, setStudent] = useState<SmStudent | null>(null)
  const [careerGoals, setCareerGoals] = useState<SmCareerGoals | null>(null)
  const [careerHistory, setCareerHistory] = useState<SmCareerChangeHistory[]>([])
  const [subjectRecords, setSubjectRecords] = useState<SmSubjectRecord[]>([])
  const [activities, setActivities] = useState<SmActivity[]>([])
  const [behaviorSummary, setBehaviorSummary] = useState<SmBehaviorSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 파일 업로드 관련
  const { files, uploadFile, deleteFile, deleteBatch, getAnalysis, getAllAnalyses, updateAnalysis, updateFileMetadata, reanalyzeFile } = useFileUpload(studentId)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const handleUpload = async (file: File) => {
    setUploading(true)
    setUploadError(null)
    try {
      const result = await uploadFile(file)
      // 첫 번째 항목을 선택
      if (result.files && result.files.length > 0) {
        setSelectedFileId(result.files[0].id)
      }
    } catch (err: any) {
      setUploadError(err.message || '업로드 실패')
      throw err
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteBatch = async (storagePath: string) => {
    try {
      await deleteBatch(storagePath)
      setSelectedFileId(null)
    } catch (err: any) {
      alert(`일괄 삭제 실패: ${err.message}`)
    }
  }

  const handleDeleteFile = async (fileId: string) => {
    try {
      await deleteFile(fileId)
      if (selectedFileId === fileId) setSelectedFileId(null)
    } catch (err: any) {
      alert(`삭제 실패: ${err.message}`)
    }
  }

  const stableGetAnalysis = useCallback(getAnalysis, [getAnalysis])

  const handleExportExcel = async () => {
    if (!student || !studentId) return
    setExporting(true)
    try {
      const [analyses, subjectRes, activitiesRes] = await Promise.all([
        getAllAnalyses(),
        supabase.from('sm_subject_records').select('*').eq('student_id', studentId),
        supabase.from('sm_activities').select('*').eq('student_id', studentId),
      ])

      await exportStudentExcel(
        student,
        careerGoals,
        files,
        analyses,
        subjectRes.data || [],
        activitiesRes.data || [],
      )
    } catch (err: any) {
      alert(`엑셀 다운로드 실패: ${err.message}`)
    } finally {
      setExporting(false)
    }
  }

  const handleReanalyze = async (fileId: string) => {
    try {
      await reanalyzeFile(fileId)
    } catch (err: any) {
      alert(`재분석 실패: ${err.message}`)
    }
  }

  useEffect(() => {
    if (!studentId) return
    const fetchData = async () => {
      setLoading(true)
      setError(null)

      const studentRes = await supabase
        .from('sm_students')
        .select('*')
        .eq('id', studentId)
        .maybeSingle()

      if (studentRes.error) {
        setError(studentRes.error.message)
        setLoading(false)
        return
      }
      if (!studentRes.data) {
        setError('학생 정보를 찾을 수 없습니다.')
        setLoading(false)
        return
      }

      setStudent(studentRes.data)

      const [goalsRes, historyRes, subjectRes, activitiesRes, behaviorRes] = await Promise.all([
        supabase.from('sm_career_goals').select('*').eq('student_id', studentId).maybeSingle(),
        supabase.from('sm_career_change_history').select('*').eq('student_id', studentId).order('change_date', { ascending: false }),
        supabase.from('sm_subject_records').select('*').eq('student_id', studentId).order('semester').order('subject_name'),
        supabase.from('sm_activities').select('*').eq('student_id', studentId).order('start_date', { ascending: false }),
        supabase.from('sm_behavior_summary').select('*').eq('student_id', studentId).maybeSingle(),
      ])
      if (goalsRes.data) setCareerGoals(goalsRes.data)
      if (historyRes.data) setCareerHistory(historyRes.data)
      if (subjectRes.data) setSubjectRecords(subjectRes.data)
      if (activitiesRes.data) setActivities(activitiesRes.data)
      if (behaviorRes.data) setBehaviorSummary(behaviorRes.data)
      setLoading(false)
    }
    fetchData()
  }, [studentId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600" />
      </div>
    )
  }

  if (error || !student) {
    return (
      <div className="text-center py-20">
        <Link to="/admin" className="text-sm text-rose-600 hover:text-rose-800 mb-4 inline-block font-medium">
          &larr; 학생 목록으로
        </Link>
        <p className="text-red-500 mb-2">{error || '학생 정보를 찾을 수 없습니다.'}</p>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      {/* 뒤로가기 */}
      <Link to="/admin" className="text-sm text-rose-600 hover:text-rose-800 mb-4 inline-flex items-center gap-1 font-medium transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        학생 목록으로
      </Link>

      {/* 프로필 헤더 */}
      <div className="glass-card-solid p-6 mb-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-rose-500/25">
          {(student.name || '?')[0]}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-800">
              {student.name || student.student_login_id}
            </h2>
            <span className={`px-2.5 py-1 text-xs rounded-full font-medium border ${
              student.is_active
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-50 text-slate-500 border-slate-200'
            }`}>
              {student.is_active ? '활성' : '비활성'}
            </span>
            {student.grade && (
              <span className="px-2.5 py-1 text-xs rounded-full font-medium bg-rose-50 text-rose-700 border border-rose-200">
                {student.grade}학년
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5 font-mono">{student.student_login_id}</p>
        </div>
        {/* 엑셀 다운로드 */}
        <button
          onClick={handleExportExcel}
          disabled={exporting}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-xl hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all duration-200 active:scale-[0.98]"
        >
          {exporting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              다운로드 중...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              엑셀 다운로드
            </>
          )}
        </button>
      </div>

      {/* 기본 신상 정보 — 접기/펼치기 */}
      <CollapsibleSection title="기본 신상 정보" defaultOpen={false}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          <InfoRow label="이름" value={student.name} />
          <InfoRow label="학년" value={student.grade ? `${student.grade}학년` : ''} />
          <InfoRow label="아이디" value={student.student_login_id} />
          <InfoRow label="입학 연도" value={student.enrollment_year?.toString()} />
          <InfoRow label="졸업 예정 연도" value={student.graduation_year?.toString()} />
          <InfoRow label="고등학교" value={student.high_school_name} />
          <InfoRow label="학생 연락처" value={student.student_phone} />
          <InfoRow label="학부모 연락처" value={student.parent_phone} />
          <InfoRow label="담당 컨설턴트" value={student.consultant_name} />
        </div>
      </CollapsibleSection>

      {/* 진로 및 목표 — 접기/펼치기 */}
      <CollapsibleSection title="진로 및 목표 정보" defaultOpen={false}>
        {careerGoals ? (
          <div className="space-y-5 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow label="희망 진로 1순위" value={`${careerGoals.career_field_1st} ${careerGoals.career_detail_1st}`.trim()} />
              <InfoRow label="희망 진로 2순위" value={`${careerGoals.career_field_2nd} ${careerGoals.career_detail_2nd}`.trim()} />
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-500 mb-2">목표 대학</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <UnivCard rank="1지망" name={careerGoals.target_univ_1_name} dept={careerGoals.target_univ_1_dept} />
                <UnivCard rank="2지망" name={careerGoals.target_univ_2_name} dept={careerGoals.target_univ_2_dept} />
                <UnivCard rank="3지망" name={careerGoals.target_univ_3_name} dept={careerGoals.target_univ_3_dept} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow label="목표 대학 Tier" value={careerGoals.target_tier} />
              <div>
                <p className="text-sm font-semibold text-slate-500 mb-1">전형 유형 비율</p>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(ADMISSION_TYPES).map(([key, label]) => {
                    const ratio = careerGoals[`admission_${key}_ratio` as keyof SmCareerGoals] as number
                    return ratio > 0 ? (
                      <span key={key} className="px-2.5 py-1 bg-rose-50 text-rose-700 text-xs rounded-lg font-medium border border-rose-100">
                        {label} {ratio}%
                      </span>
                    ) : null
                  })}
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-500 mb-1">희망 계열 키워드</p>
              <div className="flex gap-2 flex-wrap">
                {(Array.isArray(careerGoals.field_keywords) ? careerGoals.field_keywords : []).map((kw: string, i: number) => (
                  <span key={i} className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-sm font-medium border border-amber-100">
                    {kw}
                  </span>
                ))}
                {(!Array.isArray(careerGoals.field_keywords) || careerGoals.field_keywords.length === 0) && (
                  <span className="text-slate-400 text-sm">미입력</span>
                )}
              </div>
            </div>

            <InfoRow label="특이사항" value={careerGoals.special_notes} />
          </div>
        ) : (
          <p className="text-slate-400 pt-4">아직 입력된 진로 목표 정보가 없습니다.</p>
        )}
      </CollapsibleSection>

      {/* 진로 변경 이력 */}
      <CollapsibleSection title="진로 변경 이력" defaultOpen={false} badge={
        careerHistory.length > 0 ? (
          <span className="px-2 py-0.5 text-xs rounded-full bg-rose-100 text-rose-700 font-medium">{careerHistory.length}건</span>
        ) : undefined
      }>
        {careerHistory.length > 0 ? (
          <div className="space-y-3 pt-4">
            {careerHistory.map(item => (
              <div key={item.id} className="border-l-3 border-l-rose-400 pl-4 py-2 bg-rose-50/30 rounded-r-lg" style={{ borderLeftWidth: '3px' }}>
                <p className="text-xs text-slate-400 mb-1">{item.change_date}</p>
                <p className="text-sm">
                  <span className="text-slate-500">{item.previous_career}</span>
                  <span className="mx-2 text-slate-400">&rarr;</span>
                  <span className="font-medium text-slate-800">{item.new_career}</span>
                </p>
                {item.reason && <p className="text-xs text-slate-500 mt-1">사유: {item.reason}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 pt-4">진로 변경 이력이 없습니다.</p>
        )}
      </CollapsibleSection>

      {/* 교과 세특 기록 */}
      <CollapsibleSection title="교과 세특 기록" badge={
        subjectRecords.length > 0 ? (
          <span className="px-2 py-0.5 text-xs rounded-full bg-teal-100 text-teal-700 font-medium">{subjectRecords.length}건</span>
        ) : undefined
      }>
        {subjectRecords.length > 0 ? (
          <div className="space-y-5 pt-4">
            {(() => {
              const bySemester = new Map<string, SmSubjectRecord[]>()
              for (const r of subjectRecords) {
                const list = bySemester.get(r.semester) || []
                list.push(r)
                bySemester.set(r.semester, list)
              }
              return Array.from(bySemester.entries()).map(([sem, records]) => (
                <div key={sem}>
                  <h4 className="text-sm font-bold text-teal-700 mb-3 flex items-center gap-2">
                    <span className="w-1 h-4 bg-gradient-to-b from-teal-500 to-cyan-500 rounded-full inline-block" />
                    {sem.replace('-', '학년 ')}학기
                  </h4>
                  <div className="space-y-2">
                    {records.map(r => (
                      <div key={r.id} className="border border-slate-100 rounded-xl p-4 hover:shadow-card transition-shadow bg-white/50">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="font-semibold text-slate-800">{r.subject_name}</span>
                          {r.achievement_level && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-teal-50 text-teal-700 font-medium border border-teal-100">
                              성취도 {r.achievement_level}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium border ${
                            r.completion_status === '완료' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            r.completion_status === '검토요청' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            r.completion_status === '수정요청' ? 'bg-red-50 text-red-700 border-red-200' :
                            'bg-slate-50 text-slate-500 border-slate-200'
                          }`}>
                            {r.completion_status}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          {r.seukot_attitude && (
                            <div className="bg-slate-50/50 rounded-lg px-3 py-2">
                              <span className="text-teal-600 font-medium text-xs">[학습태도]</span>
                              <p className="text-slate-700 mt-0.5">{r.seukot_attitude}</p>
                            </div>
                          )}
                          {r.seukot_inquiry && (
                            <div className="bg-slate-50/50 rounded-lg px-3 py-2">
                              <span className="text-teal-600 font-medium text-xs">[탐구]</span>
                              <p className="text-slate-700 mt-0.5">{r.seukot_inquiry}</p>
                            </div>
                          )}
                          {r.seukot_thinking && (
                            <div className="bg-slate-50/50 rounded-lg px-3 py-2">
                              <span className="text-teal-600 font-medium text-xs">[사고력]</span>
                              <p className="text-slate-700 mt-0.5">{r.seukot_thinking}</p>
                            </div>
                          )}
                          {r.seukot_career && (
                            <div className="bg-slate-50/50 rounded-lg px-3 py-2">
                              <span className="text-teal-600 font-medium text-xs">[진로연계]</span>
                              <p className="text-slate-700 mt-0.5">{r.seukot_career}</p>
                            </div>
                          )}
                        </div>
                        {Array.isArray(r.inquiry_keywords) && r.inquiry_keywords.length > 0 && (
                          <div className="flex gap-1.5 mt-3 flex-wrap">
                            {r.inquiry_keywords.map((kw, i) => (
                              <span key={i} className="px-2.5 py-0.5 text-xs bg-teal-50 text-teal-600 rounded-full font-medium border border-teal-100">{kw}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            })()}
          </div>
        ) : (
          <p className="text-slate-400 pt-4">입력된 교과 세특 기록이 없습니다.</p>
        )}
      </CollapsibleSection>

      {/* 창체활동 기록 */}
      <CollapsibleSection title="창체활동 기록" badge={
        activities.length > 0 ? (
          <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-700 font-medium">{activities.length}건</span>
        ) : undefined
      }>
        {activities.length > 0 ? (
          <div className="space-y-3 pt-4">
            {activities.map(a => (
              <div key={a.id} className="border border-slate-100 rounded-xl p-4 hover:shadow-card transition-shadow bg-white/50">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className={`px-2.5 py-0.5 text-xs rounded-full font-semibold border ${
                    a.activity_type === '자율활동' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    a.activity_type === '동아리활동' ? 'bg-violet-50 text-violet-700 border-violet-200' :
                    'bg-orange-50 text-orange-700 border-orange-200'
                  }`}>
                    {a.activity_type.replace('활동', '')}
                  </span>
                  <span className="font-semibold text-slate-800">{a.activity_name}</span>
                  {a.start_date && (
                    <span className="text-xs text-slate-400 font-mono">
                      {a.start_date}{a.end_date && a.end_date !== a.start_date ? ` ~ ${a.end_date}` : ''}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  {a.motivation && (
                    <div className="bg-slate-50/50 rounded-lg px-3 py-2">
                      <span className="text-indigo-600 font-medium text-xs">동기</span>
                      <p className="text-slate-700 mt-0.5">{a.motivation}</p>
                    </div>
                  )}
                  {a.role_and_process && (
                    <div className="bg-slate-50/50 rounded-lg px-3 py-2">
                      <span className="text-indigo-600 font-medium text-xs">역할/과정</span>
                      <p className="text-slate-700 mt-0.5">{a.role_and_process}</p>
                    </div>
                  )}
                  {a.results && (
                    <div className="bg-slate-50/50 rounded-lg px-3 py-2">
                      <span className="text-indigo-600 font-medium text-xs">결과</span>
                      <p className="text-slate-700 mt-0.5">{a.results}</p>
                    </div>
                  )}
                  {a.reflection && (
                    <div className="bg-slate-50/50 rounded-lg px-3 py-2">
                      <span className="text-indigo-600 font-medium text-xs">성찰</span>
                      <p className="text-slate-700 mt-0.5">{a.reflection}</p>
                    </div>
                  )}
                </div>
                {Array.isArray(a.career_keywords) && a.career_keywords.length > 0 && (
                  <div className="flex gap-1.5 mt-3 flex-wrap">
                    {a.career_keywords.map((kw, i) => (
                      <span key={i} className="px-2.5 py-0.5 text-xs bg-indigo-50 text-indigo-600 rounded-full font-medium border border-indigo-100">{kw}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 pt-4">입력된 창체활동 기록이 없습니다.</p>
        )}
      </CollapsibleSection>

      {/* 행동특성 종합의견 */}
      <CollapsibleSection title="행동특성 종합의견">
        {behaviorSummary ? (
          <div className="space-y-4 pt-4">
            {Array.isArray(behaviorSummary.core_keywords) && behaviorSummary.core_keywords.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-slate-500 mb-2">핵심 키워드</p>
                <div className="flex gap-2 flex-wrap">
                  {behaviorSummary.core_keywords.map((kw, i) => (
                    <span key={i} className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-sm font-medium border border-amber-100">{kw}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {behaviorSummary.character_examples && (
                <div className="bg-slate-50/50 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-rose-600 mb-1">인성 사례</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{behaviorSummary.character_examples}</p>
                </div>
              )}
              {behaviorSummary.academic_growth && (
                <div className="bg-slate-50/50 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-rose-600 mb-1">학업 성장</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{behaviorSummary.academic_growth}</p>
                </div>
              )}
              {behaviorSummary.leadership_examples && (
                <div className="bg-slate-50/50 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-rose-600 mb-1">리더십 사례</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{behaviorSummary.leadership_examples}</p>
                </div>
              )}
              {behaviorSummary.career_consistency && (
                <div className="bg-slate-50/50 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-rose-600 mb-1">진로 일관성</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{behaviorSummary.career_consistency}</p>
                </div>
              )}
            </div>
            {behaviorSummary.homeroom_draft && (
              <div className="bg-rose-50/30 border border-rose-100 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-rose-600 mb-1">담임 소견 초안</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{behaviorSummary.homeroom_draft}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-slate-400 pt-4">입력된 행동특성 종합의견이 없습니다.</p>
        )}
      </CollapsibleSection>

      {/* 활동 보고서 업로드 & AI 분석 */}
      <section className="glass-card-solid overflow-hidden mb-5 animate-fade-in-up animate-fill-both">
        <div className="px-6 py-4">
          <h3 className="section-title">활동 보고서 업로드 & AI 분석</h3>
        </div>
        <div className="px-6 pb-5 border-t border-rose-100/50 space-y-4 pt-4">
          <FileUploadSection onUpload={handleUpload} uploading={uploading} />
          {uploadError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
              {uploadError}
            </div>
          )}
          <FileList
            files={files}
            selectedFileId={selectedFileId}
            onSelect={setSelectedFileId}
            onDelete={handleDeleteFile}
            onDeleteBatch={handleDeleteBatch}
          />
          {selectedFileId && files.find(f => f.id === selectedFileId)?.analysis_status === '완료' && (
            <FileAnalysisCard
              fileId={selectedFileId}
              file={files.find(f => f.id === selectedFileId)!}
              getAnalysis={stableGetAnalysis}
              onUpdate={updateAnalysis}
              onUpdateFile={updateFileMetadata}
              onReanalyze={handleReanalyze}
            />
          )}
          {selectedFileId && files.find(f => f.id === selectedFileId)?.analysis_status === '실패' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6">
              <p className="text-sm text-red-600 mb-3">
                분석 실패: {files.find(f => f.id === selectedFileId)?.analysis_error || '알 수 없는 오류'}
              </p>
              <button
                onClick={() => handleReanalyze(selectedFileId)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors"
              >
                재분석
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 mb-0.5 uppercase tracking-wider">{label}</p>
      <p className="text-sm text-slate-800 font-medium">{value || <span className="text-slate-300">미입력</span>}</p>
    </div>
  )
}

function UnivCard({ rank, name, dept }: { rank: string; name: string; dept: string }) {
  const hasData = name || dept
  return (
    <div className="bg-rose-50/30 border border-rose-100 rounded-xl p-3">
      <p className="text-xs text-rose-400 font-semibold mb-1">{rank}</p>
      {hasData ? (
        <>
          <p className="text-sm font-semibold text-slate-800">{name}</p>
          <p className="text-xs text-slate-500">{dept}</p>
        </>
      ) : (
        <p className="text-sm text-slate-300">미입력</p>
      )}
    </div>
  )
}
