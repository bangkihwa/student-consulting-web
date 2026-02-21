import * as XLSX from 'xlsx'
import { SmStudent, SmCareerGoals, SmUploadedFile, SmFileAnalysis } from '../types/database'

interface FileWithAnalysis {
  file: SmUploadedFile
  analysis: SmFileAnalysis | null
}

// 학기 코드 → 학년 텍스트
function semesterToGrade(semester: string): string {
  if (semester.startsWith('1-')) return '1학년'
  if (semester.startsWith('2-')) return '2학년'
  if (semester.startsWith('3-')) return '3학년'
  return ''
}

// 학기 정렬 순서
const SEMESTER_ORDER = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2']

// 카테고리 정렬 순서 (창체 먼저, 교과 나중)
const CATEGORY_ORDER = ['자율', '동아리', '진로', '봉사']

function getCategoryLabel(file: SmUploadedFile): string {
  if (file.category_main === '창체활동') {
    // 자율활동 → 자율, 동아리활동 → 동아리
    return (file.changche_type || '').replace('활동', '')
  }
  // 교과세특: 교과명 사용
  return file.gyogwa_subject_name || '교과'
}

function getActivityLabel(file: SmUploadedFile): string {
  if (file.category_main === '창체활동') {
    return file.changche_sub || ''
  }
  return file.gyogwa_sub || ''
}

function sortFiles(items: FileWithAnalysis[]): FileWithAnalysis[] {
  return [...items].sort((a, b) => {
    // 1차: 학기순
    const semA = SEMESTER_ORDER.indexOf(a.file.semester)
    const semB = SEMESTER_ORDER.indexOf(b.file.semester)
    if (semA !== semB) return semA - semB

    // 2차: 카테고리순 (창체 먼저)
    const catA = getCategoryLabel(a.file)
    const catB = getCategoryLabel(b.file)
    const catOrderA = CATEGORY_ORDER.indexOf(catA)
    const catOrderB = CATEGORY_ORDER.indexOf(catB)
    const ordA = catOrderA >= 0 ? catOrderA : 100
    const ordB = catOrderB >= 0 ? catOrderB : 100
    if (ordA !== ordB) return ordA - ordB

    // 같은 카테고리면 생성순
    return new Date(a.file.created_at).getTime() - new Date(b.file.created_at).getTime()
  })
}

export function exportStudentExcel(
  student: SmStudent,
  careerGoals: SmCareerGoals | null,
  files: SmUploadedFile[],
  analyses: SmFileAnalysis[]
) {
  // 분석 결과를 file_id로 매핑
  const analysisMap = new Map<string, SmFileAnalysis>()
  for (const a of analyses) {
    analysisMap.set(a.file_id, a)
  }

  // 분석 완료된 파일만 필터 + 분석 데이터 연결
  const items: FileWithAnalysis[] = files
    .filter(f => f.analysis_status === '완료')
    .map(f => ({ file: f, analysis: analysisMap.get(f.id) || null }))

  const sorted = sortFiles(items)

  // 진로 텍스트
  const careerText = careerGoals
    ? `${careerGoals.career_field_1st} ${careerGoals.career_detail_1st}`.trim()
    : ''

  // ========================
  // 워크시트 데이터 구성
  // ========================
  const rows: (string | number)[][] = []

  // Row 0: 학교명, 학생명, 동아리, 진로희망
  rows.push([
    student.high_school_name || '', '', student.name || '',
    '', '', '', '',
    '동아리', '', '진로희망', '', careerText,
    '', '', '', '', '', '', '', ''
  ])

  // Row 1: 구분 헤더
  rows.push([
    '구분', '', '1학년', '', '2학년', '', '3학년', '전체',
    '', '국/수/영/탐1/탐2/한국사/외국어',
    '', '', '', '', '', '', '', '', '', ''
  ])

  // Row 2: 학기 구분
  rows.push([
    '', '', '1학기', '2학기', '1학기', '2학기', '1학기', '',
    '', '',
    '', '', '', '', '', '', '', '', '', ''
  ])

  // Row 3~6: 성적표 빈 행 (수동 입력용)
  rows.push(['최종            교과', '전교과', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''])
  rows.push(['', '국영수과사', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''])
  rows.push(['', '국영수과', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''])
  rows.push(['', '국영수사', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''])

  // Row 7: 데이터 헤더
  rows.push([
    '학기', '창체/교과세특', '활동/내용', '', '',
    '평가', '', '',
    '주제/구체적인 내용',
    '후속활동, 소감', '', '', '',
    '독서활동', '', '', '', '', '', ''
  ])

  // Row 8+: 데이터 행
  for (const item of sorted) {
    const { file, analysis } = item
    const category = getCategoryLabel(file)
    const activity = getActivityLabel(file)
    const evaluation = analysis?.evaluation_competency || ''

    // 주제 + 활동내용 합침
    const topicParts = [analysis?.title, analysis?.activity_content].filter(Boolean)
    const topic = topicParts.join(' - ')

    // 후속활동 + 연구계획 합침
    const followUpParts = [analysis?.conclusion, analysis?.research_plan].filter(Boolean)
    const followUp = followUpParts.join('\n')

    const reading = analysis?.reading_activities || ''

    rows.push([
      semesterToGrade(file.semester),
      category,
      activity, '', '',
      evaluation, '', '',
      topic,
      followUp, '', '', '',
      reading, '', '', '', '', '', ''
    ])
  }

  // ========================
  // 워크시트 생성
  // ========================
  const ws = XLSX.utils.aoa_to_sheet(rows)

  // 셀 병합 설정
  const merges: XLSX.Range[] = []

  // 헤더 영역 병합
  // Row 7 헤더: 활동/내용(C~E), 평가(F~H), 후속활동(J~M), 독서활동(N~R)
  merges.push({ s: { r: 7, c: 2 }, e: { r: 7, c: 4 } })   // 활동/내용
  merges.push({ s: { r: 7, c: 5 }, e: { r: 7, c: 7 } })   // 평가
  merges.push({ s: { r: 7, c: 9 }, e: { r: 7, c: 12 } })  // 후속활동
  merges.push({ s: { r: 7, c: 13 }, e: { r: 7, c: 17 } })  // 독서활동

  // 데이터 행 병합
  const dataStartRow = 8
  for (let i = 0; i < sorted.length; i++) {
    const r = dataStartRow + i
    // 각 행: 활동/내용(C~E), 평가(F~H), 후속활동(J~M), 독서활동(N~R)
    merges.push({ s: { r, c: 2 }, e: { r, c: 4 } })
    merges.push({ s: { r, c: 5 }, e: { r, c: 7 } })
    merges.push({ s: { r, c: 9 }, e: { r, c: 12 } })
    merges.push({ s: { r, c: 13 }, e: { r, c: 17 } })
  }

  // 학기 셀 병합 (Col A: 같은 학기 연속)
  if (sorted.length > 0) {
    let gradeStart = dataStartRow
    let currentGrade = semesterToGrade(sorted[0].file.semester)

    for (let i = 1; i <= sorted.length; i++) {
      const nextGrade = i < sorted.length ? semesterToGrade(sorted[i].file.semester) : ''
      if (nextGrade !== currentGrade) {
        if (i - (gradeStart - dataStartRow) > 1) {
          merges.push({
            s: { r: gradeStart, c: 0 },
            e: { r: dataStartRow + i - 1, c: 0 }
          })
        }
        gradeStart = dataStartRow + i
        currentGrade = nextGrade
      }
    }
  }

  // 카테고리 셀 병합 (Col B: 같은 학기 내 같은 카테고리 연속)
  if (sorted.length > 0) {
    let catStart = dataStartRow
    let currentCat = getCategoryLabel(sorted[0].file)
    let currentSem = sorted[0].file.semester

    for (let i = 1; i <= sorted.length; i++) {
      const nextCat = i < sorted.length ? getCategoryLabel(sorted[i].file) : ''
      const nextSem = i < sorted.length ? sorted[i].file.semester : ''
      // 학기가 바뀌거나 카테고리가 바뀌면 병합
      if (nextCat !== currentCat || nextSem !== currentSem) {
        if (dataStartRow + i - 1 > catStart) {
          merges.push({
            s: { r: catStart, c: 1 },
            e: { r: dataStartRow + i - 1, c: 1 }
          })
        }
        catStart = dataStartRow + i
        currentCat = nextCat
        currentSem = nextSem
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
