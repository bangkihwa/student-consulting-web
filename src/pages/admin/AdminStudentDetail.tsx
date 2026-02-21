import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { SmStudent, SmCareerGoals, SmCareerChangeHistory, SmSubjectRecord, SmActivity, SmBehaviorSummary, ADMISSION_TYPES } from '../../types/database'
import { useFileUpload } from '../../hooks/useFileUpload'
import { exportStudentExcel } from '../../lib/excelExport'
import FileUploadSection from '../../components/admin/FileUploadSection'
import FileList from '../../components/admin/FileList'
import FileAnalysisCard from '../../components/admin/FileAnalysisCard'

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
  const { files, uploadFile, deleteFile, getAnalysis, getAllAnalyses, updateAnalysis, reanalyzeFile } = useFileUpload(studentId)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const handleUpload = async (file: File, metadata: Parameters<typeof uploadFile>[1]) => {
    setUploading(true)
    setUploadError(null)
    try {
      const result = await uploadFile(file, metadata)
      setSelectedFileId(result.file.id)
    } catch (err: any) {
      setUploadError(err.message || '업로드 실패')
      throw err
    } finally {
      setUploading(false)
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
      // 모든 데이터 소스 병렬 조회
      const [analyses, subjectRes, activitiesRes] = await Promise.all([
        getAllAnalyses(),
        supabase.from('sm_subject_records').select('*').eq('student_id', studentId),
        supabase.from('sm_activities').select('*').eq('student_id', studentId),
      ])

      exportStudentExcel(
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (error || !student) {
    return (
      <div className="text-center py-20">
        <Link to="/admin" className="text-sm text-blue-600 hover:text-blue-800 mb-4 inline-block">
          &larr; 학생 목록으로
        </Link>
        <p className="text-red-500 mb-2">{error || '학생 정보를 찾을 수 없습니다.'}</p>
      </div>
    )
  }

  return (
    <div>
      <Link to="/admin" className="text-sm text-blue-600 hover:text-blue-800 mb-4 inline-block">
        &larr; 학생 목록으로
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          {student.name || student.student_login_id}
        </h2>
        <span className={`px-2 py-1 text-xs rounded-full font-medium ${
          student.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {student.is_active ? '활성' : '비활성'}
        </span>
      </div>

      {/* 기본 정보 */}
      <section className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">기본 신상 정보</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      </section>

      {/* 진로 및 목표 */}
      <section className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">진로 및 목표 정보</h3>
        {careerGoals ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow label="희망 진로 1순위" value={`${careerGoals.career_field_1st} ${careerGoals.career_detail_1st}`.trim()} />
              <InfoRow label="희망 진로 2순위" value={`${careerGoals.career_field_2nd} ${careerGoals.career_detail_2nd}`.trim()} />
            </div>

            <div>
              <p className="text-sm font-medium text-gray-500 mb-2">목표 대학</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <UnivCard rank="1지망" name={careerGoals.target_univ_1_name} dept={careerGoals.target_univ_1_dept} />
                <UnivCard rank="2지망" name={careerGoals.target_univ_2_name} dept={careerGoals.target_univ_2_dept} />
                <UnivCard rank="3지망" name={careerGoals.target_univ_3_name} dept={careerGoals.target_univ_3_dept} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow label="목표 대학 Tier" value={careerGoals.target_tier} />
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">전형 유형 비율</p>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(ADMISSION_TYPES).map(([key, label]) => {
                    const ratio = careerGoals[`admission_${key}_ratio` as keyof SmCareerGoals] as number
                    return ratio > 0 ? (
                      <span key={key} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md">
                        {label} {ratio}%
                      </span>
                    ) : null
                  })}
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">희망 계열 키워드</p>
              <div className="flex gap-2">
                {(Array.isArray(careerGoals.field_keywords) ? careerGoals.field_keywords : []).map((kw: string, i: number) => (
                  <span key={i} className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm">
                    {kw}
                  </span>
                ))}
                {(!Array.isArray(careerGoals.field_keywords) || careerGoals.field_keywords.length === 0) && (
                  <span className="text-gray-400 text-sm">미입력</span>
                )}
              </div>
            </div>

            <InfoRow label="특이사항" value={careerGoals.special_notes} />
          </div>
        ) : (
          <p className="text-gray-400">아직 입력된 진로 목표 정보가 없습니다.</p>
        )}
      </section>

      {/* 진로 변경 이력 */}
      <section className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">진로 변경 이력</h3>
        {careerHistory.length > 0 ? (
          <div className="space-y-3">
            {careerHistory.map(item => (
              <div key={item.id} className="border-l-4 border-blue-400 pl-4 py-2">
                <p className="text-xs text-gray-400 mb-1">{item.change_date}</p>
                <p className="text-sm">
                  <span className="text-gray-500">{item.previous_career}</span>
                  <span className="mx-2 text-gray-400">&rarr;</span>
                  <span className="font-medium text-gray-800">{item.new_career}</span>
                </p>
                {item.reason && <p className="text-xs text-gray-500 mt-1">사유: {item.reason}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400">진로 변경 이력이 없습니다.</p>
        )}
      </section>

      {/* 교과 세특 기록 */}
      <section className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">교과 세특 기록</h3>
        {subjectRecords.length > 0 ? (
          <div className="space-y-4">
            {(() => {
              const bySemester = new Map<string, SmSubjectRecord[]>()
              for (const r of subjectRecords) {
                const list = bySemester.get(r.semester) || []
                list.push(r)
                bySemester.set(r.semester, list)
              }
              return Array.from(bySemester.entries()).map(([sem, records]) => (
                <div key={sem}>
                  <h4 className="text-sm font-semibold text-blue-700 mb-2 border-b border-blue-100 pb-1">
                    {sem.replace('-', '학년 ')}학기
                  </h4>
                  <div className="space-y-3">
                    {records.map(r => (
                      <div key={r.id} className="border border-gray-100 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-gray-800">{r.subject_name}</span>
                          {r.achievement_level && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700">
                              성취도 {r.achievement_level}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            r.completion_status === '완료' ? 'bg-green-50 text-green-700' :
                            r.completion_status === '검토요청' ? 'bg-amber-50 text-amber-700' :
                            r.completion_status === '수정요청' ? 'bg-red-50 text-red-700' :
                            'bg-gray-50 text-gray-500'
                          }`}>
                            {r.completion_status}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          {r.seukot_attitude && (
                            <div><span className="text-gray-500">[학습태도]</span> <span className="text-gray-800">{r.seukot_attitude}</span></div>
                          )}
                          {r.seukot_inquiry && (
                            <div><span className="text-gray-500">[탐구]</span> <span className="text-gray-800">{r.seukot_inquiry}</span></div>
                          )}
                          {r.seukot_thinking && (
                            <div><span className="text-gray-500">[사고력]</span> <span className="text-gray-800">{r.seukot_thinking}</span></div>
                          )}
                          {r.seukot_career && (
                            <div><span className="text-gray-500">[진로연계]</span> <span className="text-gray-800">{r.seukot_career}</span></div>
                          )}
                        </div>
                        {Array.isArray(r.inquiry_keywords) && r.inquiry_keywords.length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {r.inquiry_keywords.map((kw, i) => (
                              <span key={i} className="px-2 py-0.5 text-xs bg-indigo-50 text-indigo-600 rounded-full">{kw}</span>
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
          <p className="text-gray-400">입력된 교과 세특 기록이 없습니다.</p>
        )}
      </section>

      {/* 창체활동 기록 */}
      <section className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">창체활동 기록</h3>
        {activities.length > 0 ? (
          <div className="space-y-3">
            {activities.map(a => (
              <div key={a.id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                    a.activity_type === '자율활동' ? 'bg-green-50 text-green-700' :
                    a.activity_type === '동아리활동' ? 'bg-purple-50 text-purple-700' :
                    'bg-orange-50 text-orange-700'
                  }`}>
                    {a.activity_type.replace('활동', '')}
                  </span>
                  <span className="font-medium text-gray-800">{a.activity_name}</span>
                  {a.start_date && (
                    <span className="text-xs text-gray-400">
                      {a.start_date}{a.end_date && a.end_date !== a.start_date ? ` ~ ${a.end_date}` : ''}
                    </span>
                  )}
                </div>
                <div className="space-y-1 text-sm">
                  {a.motivation && (
                    <div><span className="text-gray-500 font-medium">동기:</span> <span className="text-gray-800">{a.motivation}</span></div>
                  )}
                  {a.role_and_process && (
                    <div><span className="text-gray-500 font-medium">역할/과정:</span> <span className="text-gray-800">{a.role_and_process}</span></div>
                  )}
                  {a.results && (
                    <div><span className="text-gray-500 font-medium">결과:</span> <span className="text-gray-800">{a.results}</span></div>
                  )}
                  {a.reflection && (
                    <div><span className="text-gray-500 font-medium">성찰:</span> <span className="text-gray-800">{a.reflection}</span></div>
                  )}
                </div>
                {Array.isArray(a.career_keywords) && a.career_keywords.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {a.career_keywords.map((kw, i) => (
                      <span key={i} className="px-2 py-0.5 text-xs bg-purple-50 text-purple-600 rounded-full">{kw}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400">입력된 창체활동 기록이 없습니다.</p>
        )}
      </section>

      {/* 행동특성 종합의견 */}
      <section className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">행동특성 종합의견</h3>
        {behaviorSummary ? (
          <div className="space-y-4">
            {Array.isArray(behaviorSummary.core_keywords) && behaviorSummary.core_keywords.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">핵심 키워드</p>
                <div className="flex gap-2 flex-wrap">
                  {behaviorSummary.core_keywords.map((kw, i) => (
                    <span key={i} className="px-3 py-1 bg-teal-50 text-teal-700 rounded-full text-sm">{kw}</span>
                  ))}
                </div>
              </div>
            )}
            {behaviorSummary.character_examples && (
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">인성 사례</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{behaviorSummary.character_examples}</p>
              </div>
            )}
            {behaviorSummary.academic_growth && (
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">학업 성장</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{behaviorSummary.academic_growth}</p>
              </div>
            )}
            {behaviorSummary.leadership_examples && (
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">리더십 사례</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{behaviorSummary.leadership_examples}</p>
              </div>
            )}
            {behaviorSummary.career_consistency && (
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">진로 일관성</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{behaviorSummary.career_consistency}</p>
              </div>
            )}
            {behaviorSummary.homeroom_draft && (
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">담임 소견 초안</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{behaviorSummary.homeroom_draft}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-400">입력된 행동특성 종합의견이 없습니다.</p>
        )}
      </section>

      {/* 활동 보고서 업로드 & AI 분석 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">활동 보고서 업로드 & AI 분석</h3>
          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
        <FileUploadSection onUpload={handleUpload} uploading={uploading} />
        {uploadError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
            {uploadError}
          </div>
        )}
        <FileList
          files={files}
          selectedFileId={selectedFileId}
          onSelect={setSelectedFileId}
          onDelete={handleDeleteFile}
        />
        {selectedFileId && files.find(f => f.id === selectedFileId)?.analysis_status === '완료' && (
          <FileAnalysisCard
            fileId={selectedFileId}
            getAnalysis={stableGetAnalysis}
            onUpdate={updateAnalysis}
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
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
            >
              재분석
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm text-gray-800">{value || <span className="text-gray-400">미입력</span>}</p>
    </div>
  )
}

function UnivCard({ rank, name, dept }: { rank: string; name: string; dept: string }) {
  const hasData = name || dept
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-400 mb-1">{rank}</p>
      {hasData ? (
        <>
          <p className="text-sm font-medium text-gray-800">{name}</p>
          <p className="text-xs text-gray-500">{dept}</p>
        </>
      ) : (
        <p className="text-sm text-gray-400">미입력</p>
      )}
    </div>
  )
}
