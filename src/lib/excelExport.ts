import * as XLSX from 'xlsx'
import {
  SmStudent, SmCareerGoals,
  SmUploadedFile, SmFileAnalysis,
  SmSubjectRecord, SmActivity,
} from '../types/database'

// ============================================================
// 공통 행 인터페이스 — 모든 데이터 소스를 이 형태로 통일
// ============================================================
interface ExcelRow {
  semester: string       // '1-1', '1-2', ...
  grade: string          // '1학년', '2학년', '3학년'
  category: string       // '자율', '동아리', '진로', '국어', '수학' 등
  activity: string       // 활동/내용 (교과활동, 수행, 발표, 토론 등)
  evaluation: string     // 평가역량 키워드
  topic: string          // 주제/구체적인 내용
  followUp: string       // 후속활동, 소감
  reading: string        // 독서활동
  sortOrder: number      // 카테고리 정렬용
  date: number           // 생성일 정렬용 (timestamp)
}

// 학기 코드 → 학년 텍스트
function semesterToGrade(semester: string): string {
  if (semester.startsWith('1-')) return '1학년'
  if (semester.startsWith('2-')) return '2학년'
  if (semester.startsWith('3-')) return '3학년'
  return ''
}

function dateToSemesterWithEnrollment(dateStr: string, enrollmentYear: number | null): string {
  if (!dateStr) return '1-1'
  const d = new Date(dateStr)
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const sem = month >= 3 && month <= 8 ? 1 : 2
  const baseYear = enrollmentYear || year
  const gradeYear = year - baseYear + 1
  const grade = Math.max(1, Math.min(3, gradeYear))
  return `${grade}-${sem}`
}

// 학기 정렬 순서
const SEMESTER_ORDER = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2']

// 카테고리 정렬 순서 (창체 먼저, 교과 나중)
const CATEGORY_SORT: Record<string, number> = {
  '자율': 0, '동아리': 1, '진로': 2, '봉사': 3,
}

function getCategorySortOrder(cat: string): number {
  return CATEGORY_SORT[cat] ?? 100
}

// ============================================================
// 데이터 소스별 → ExcelRow 변환
// ============================================================

/** AI 분석 파일 데이터 → ExcelRow[] */
function fileAnalysisToRows(
  files: SmUploadedFile[],
  analyses: SmFileAnalysis[]
): ExcelRow[] {
  const analysisMap = new Map<string, SmFileAnalysis>()
  for (const a of analyses) analysisMap.set(a.file_id, a)

  return files
    .filter(f => f.analysis_status === '완료')
    .map(f => {
      const a = analysisMap.get(f.id)
      const isChangche = f.category_main === '창체활동'
      const category = isChangche
        ? (f.changche_type || '').replace('활동', '')
        : (f.gyogwa_subject_name || '교과')
      const activity = isChangche ? (f.changche_sub || '') : (f.gyogwa_sub || '')

      const topicParts = [a?.title, a?.activity_content].filter(Boolean)
      const followParts = [a?.conclusion, a?.research_plan].filter(Boolean)

      return {
        semester: f.semester,
        grade: semesterToGrade(f.semester),
        category,
        activity,
        evaluation: a?.evaluation_competency || '',
        topic: topicParts.join(' - '),
        followUp: followParts.join('\n'),
        reading: a?.reading_activities || '',
        sortOrder: getCategorySortOrder(category),
        date: new Date(f.created_at).getTime(),
      }
    })
}

/** 세특관리웹 sm_subject_records → ExcelRow[] */
function subjectRecordsToRows(records: SmSubjectRecord[]): ExcelRow[] {
  return records.map(r => {
    // 세특 4요소를 주제/내용에 합침
    const topicParts = []
    if (r.seukot_attitude) topicParts.push(`[학습태도] ${r.seukot_attitude}`)
    if (r.seukot_inquiry) topicParts.push(`[탐구] ${r.seukot_inquiry}`)
    if (r.seukot_thinking) topicParts.push(`[사고력] ${r.seukot_thinking}`)

    // 탐구 키워드를 평가에 활용
    const keywords = Array.isArray(r.inquiry_keywords) ? r.inquiry_keywords : []
    const evaluation = keywords.length > 0 ? keywords.join(', ') : ''

    return {
      semester: r.semester,
      grade: semesterToGrade(r.semester),
      category: r.subject_name,
      activity: '교과활동',
      evaluation,
      topic: topicParts.join('\n'),
      followUp: r.seukot_career || '',
      reading: '',
      sortOrder: getCategorySortOrder(r.subject_name),
      date: new Date(r.created_at).getTime(),
    }
  })
}

/** 창체관리웹 sm_activities → ExcelRow[] */
function activitiesToRows(activities: SmActivity[], enrollmentYear: number | null): ExcelRow[] {
  return activities.map(a => {
    const category = a.activity_type.replace('활동', '')
    const semester = dateToSemesterWithEnrollment(a.start_date, enrollmentYear)

    const topicParts = []
    if (a.motivation) topicParts.push(a.motivation)
    if (a.role_and_process) topicParts.push(a.role_and_process)

    const followParts = []
    if (a.results) followParts.push(a.results)
    if (a.reflection) followParts.push(a.reflection)

    const keywords = Array.isArray(a.career_keywords) ? a.career_keywords : []

    return {
      semester,
      grade: semesterToGrade(semester),
      category,
      activity: a.activity_name,
      evaluation: keywords.join(', '),
      topic: topicParts.join('\n'),
      followUp: followParts.join('\n'),
      reading: '',
      sortOrder: getCategorySortOrder(category),
      date: new Date(a.start_date || a.created_at).getTime(),
    }
  })
}

// ============================================================
// 정렬
// ============================================================
function sortRows(rows: ExcelRow[]): ExcelRow[] {
  return [...rows].sort((a, b) => {
    // 1차: 학기순
    const semA = SEMESTER_ORDER.indexOf(a.semester)
    const semB = SEMESTER_ORDER.indexOf(b.semester)
    if (semA !== semB) return (semA === -1 ? 99 : semA) - (semB === -1 ? 99 : semB)
    // 2차: 카테고리순 (창체 먼저)
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    // 3차: 날짜순
    return a.date - b.date
  })
}

// ============================================================
// 메인 함수
// ============================================================
export function exportStudentExcel(
  student: SmStudent,
  careerGoals: SmCareerGoals | null,
  files: SmUploadedFile[],
  analyses: SmFileAnalysis[],
  subjectRecords: SmSubjectRecord[] = [],
  activities: SmActivity[] = [],
) {
  // 모든 데이터 소스 → 통합 ExcelRow
  const allRows: ExcelRow[] = [
    ...fileAnalysisToRows(files, analyses),
    ...subjectRecordsToRows(subjectRecords),
    ...activitiesToRows(activities, student.enrollment_year),
  ]

  const sorted = sortRows(allRows)

  // 진로 텍스트
  const careerText = careerGoals
    ? `${careerGoals.career_field_1st} ${careerGoals.career_detail_1st}`.trim()
    : ''

  // ========================
  // 워크시트 데이터 구성
  // ========================
  const sheetRows: (string | number)[][] = []

  // Row 0: 학교명, 학생명, 동아리, 진로희망
  sheetRows.push([
    student.high_school_name || '', '', student.name || '',
    '', '', '', '',
    '동아리', '', '진로희망', '', careerText,
    '', '', '', '', '', '', '', ''
  ])

  // Row 1: 구분 헤더
  sheetRows.push([
    '구분', '', '1학년', '', '2학년', '', '3학년', '전체',
    '', '국/수/영/탐1/탐2/한국사/외국어',
    '', '', '', '', '', '', '', '', '', ''
  ])

  // Row 2: 학기 구분
  sheetRows.push([
    '', '', '1학기', '2학기', '1학기', '2학기', '1학기', '',
    '', '', '', '', '', '', '', '', '', '', '', ''
  ])

  // Row 3~6: 성적표 빈 행 (수동 입력용)
  sheetRows.push(['최종            교과', '전교과', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''])
  sheetRows.push(['', '국영수과사', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''])
  sheetRows.push(['', '국영수과', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''])
  sheetRows.push(['', '국영수사', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''])

  // Row 7: 데이터 헤더
  sheetRows.push([
    '학기', '창체/교과세특', '활동/내용', '', '',
    '평가', '', '',
    '주제/구체적인 내용',
    '후속활동, 소감', '', '', '',
    '독서활동', '', '', '', '', '', ''
  ])

  // Row 8+: 데이터 행
  for (const row of sorted) {
    sheetRows.push([
      row.grade,
      row.category,
      row.activity, '', '',
      row.evaluation, '', '',
      row.topic,
      row.followUp, '', '', '',
      row.reading, '', '', '', '', '', ''
    ])
  }

  // ========================
  // 워크시트 생성
  // ========================
  const ws = XLSX.utils.aoa_to_sheet(sheetRows)

  // 셀 병합 설정
  const merges: XLSX.Range[] = []

  // 헤더 영역 병합
  merges.push({ s: { r: 7, c: 2 }, e: { r: 7, c: 4 } })   // 활동/내용
  merges.push({ s: { r: 7, c: 5 }, e: { r: 7, c: 7 } })   // 평가
  merges.push({ s: { r: 7, c: 9 }, e: { r: 7, c: 12 } })  // 후속활동
  merges.push({ s: { r: 7, c: 13 }, e: { r: 7, c: 17 } })  // 독서활동

  // 데이터 행 병합
  const dataStartRow = 8
  for (let i = 0; i < sorted.length; i++) {
    const r = dataStartRow + i
    merges.push({ s: { r, c: 2 }, e: { r, c: 4 } })
    merges.push({ s: { r, c: 5 }, e: { r, c: 7 } })
    merges.push({ s: { r, c: 9 }, e: { r, c: 12 } })
    merges.push({ s: { r, c: 13 }, e: { r, c: 17 } })
  }

  // 학기 셀 병합 (Col A)
  if (sorted.length > 0) {
    let start = dataStartRow
    let current = sorted[0].grade

    for (let i = 1; i <= sorted.length; i++) {
      const next = i < sorted.length ? sorted[i].grade : ''
      if (next !== current) {
        if (dataStartRow + i - 1 > start) {
          merges.push({ s: { r: start, c: 0 }, e: { r: dataStartRow + i - 1, c: 0 } })
        }
        start = dataStartRow + i
        current = next
      }
    }
  }

  // 카테고리 셀 병합 (Col B)
  if (sorted.length > 0) {
    let catStart = dataStartRow
    let currentCat = sorted[0].category
    let currentGrade = sorted[0].grade

    for (let i = 1; i <= sorted.length; i++) {
      const nextCat = i < sorted.length ? sorted[i].category : ''
      const nextGrade = i < sorted.length ? sorted[i].grade : ''
      if (nextCat !== currentCat || nextGrade !== currentGrade) {
        if (dataStartRow + i - 1 > catStart) {
          merges.push({ s: { r: catStart, c: 1 }, e: { r: dataStartRow + i - 1, c: 1 } })
        }
        catStart = dataStartRow + i
        currentCat = nextCat
        currentGrade = nextGrade
      }
    }
  }

  ws['!merges'] = merges

  // 칼럼 너비 설정
  ws['!cols'] = [
    { wch: 8 },   // A: 학기
    { wch: 12 },  // B: 창체/교과세특
    { wch: 12 },  // C: 활동/내용
    { wch: 5 },   // D
    { wch: 5 },   // E
    { wch: 18 },  // F: 평가
    { wch: 5 },   // G
    { wch: 5 },   // H
    { wch: 40 },  // I: 주제/구체적인 내용
    { wch: 35 },  // J: 후속활동
    { wch: 5 },   // K
    { wch: 5 },   // L
    { wch: 5 },   // M
    { wch: 25 },  // N: 독서활동
    { wch: 5 },   // O
    { wch: 5 },   // P
    { wch: 5 },   // Q
    { wch: 5 },   // R
    { wch: 5 },   // S
    { wch: 5 },   // T
  ]

  // 워크북 생성 + 다운로드
  const wb = XLSX.utils.book_new()
  const sheetName = student.name || '학생'
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  const fileName = `${student.name || student.student_login_id} 생기부 정리자료.xlsx`
  XLSX.writeFile(wb, fileName)
}
