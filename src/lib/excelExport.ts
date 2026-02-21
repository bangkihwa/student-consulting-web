import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import {
  SmStudent, SmCareerGoals,
  SmUploadedFile, SmFileAnalysis,
  SmSubjectRecord, SmActivity,
} from '../types/database'

// ============================================================
// 공통 행 인터페이스
// ============================================================
interface ExcelRow {
  semester: string
  grade: string
  category: string
  activity: string
  evaluation: string
  topic: string
  followUp: string
  reading: string
  sortOrder: number
  date: number
}

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

const SEMESTER_ORDER = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2']

const CATEGORY_SORT: Record<string, number> = {
  '자율': 0, '동아리': 1, '진로': 2, '봉사': 3,
}

function getCategorySortOrder(cat: string): number {
  return CATEGORY_SORT[cat] ?? 100
}

// ============================================================
// 데이터 변환
// ============================================================
function fileAnalysisToRows(files: SmUploadedFile[], analyses: SmFileAnalysis[]): ExcelRow[] {
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

function subjectRecordsToRows(records: SmSubjectRecord[]): ExcelRow[] {
  return records.map(r => {
    const topicParts = []
    if (r.seukot_attitude) topicParts.push(`[학습태도] ${r.seukot_attitude}`)
    if (r.seukot_inquiry) topicParts.push(`[탐구] ${r.seukot_inquiry}`)
    if (r.seukot_thinking) topicParts.push(`[사고력] ${r.seukot_thinking}`)

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

function sortRows(rows: ExcelRow[]): ExcelRow[] {
  return [...rows].sort((a, b) => {
    const semA = SEMESTER_ORDER.indexOf(a.semester)
    const semB = SEMESTER_ORDER.indexOf(b.semester)
    if (semA !== semB) return (semA === -1 ? 99 : semA) - (semB === -1 ? 99 : semB)
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    return a.date - b.date
  })
}

// ============================================================
// 스타일 상수
// ============================================================
const COLORS = {
  headerBg: 'FF2D1B69',       // 진한 남보라
  headerFont: 'FFFFFFFF',
  titleBg: 'FF4A3C8C',        // 중간 보라
  titleFont: 'FFFFFFFF',
  gradeBg: 'FFF0EBFF',        // 연보라
  gradeFont: 'FF2D1B69',
  subHeaderBg: 'FFE8E3F5',    // 매우 연한 보라
  subHeaderFont: 'FF3B2D7A',
  dataHeaderBg: 'FF1E3A5F',   // 진한 남색
  dataHeaderFont: 'FFFFFFFF',
  changcheBg: 'FFEEF7EE',     // 연초록
  gyogwaBg: 'FFEEF3FF',       // 연파랑
  borderMedium: 'FFB8B0D9',   // 보라 계열 테두리
  borderLight: 'FFD4CEE8',    // 연한 보라 테두리
  borderDark: 'FF2D1B69',
  white: 'FFFFFFFF',
  textDark: 'FF1A1A2E',
  textMedium: 'FF4A4A6A',
  accentGold: 'FFFFD700',
  accentAmber: 'FFFFB347',
  semesterColors: [
    'FFDCE4FF',  // 1학년: 연파랑
    'FFDCF5E0',  // 2학년: 연초록
    'FFFFF3DC',  // 3학년: 연노랑
  ] as string[],
}

const thinBorder: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: COLORS.borderLight } }
const mediumBorder: Partial<ExcelJS.Border> = { style: 'medium', color: { argb: COLORS.borderMedium } }
const thickBorder: Partial<ExcelJS.Border> = { style: 'medium', color: { argb: COLORS.borderDark } }

const allThinBorders: Partial<ExcelJS.Borders> = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }
const allMediumBorders: Partial<ExcelJS.Borders> = { top: mediumBorder, bottom: mediumBorder, left: mediumBorder, right: mediumBorder }

function headerFont(size = 11, bold = true): Partial<ExcelJS.Font> {
  return { name: 'Noto Sans KR', size, bold, color: { argb: COLORS.headerFont } }
}

function bodyFont(size = 10, bold = false): Partial<ExcelJS.Font> {
  return { name: 'Noto Sans KR', size, bold, color: { argb: COLORS.textDark } }
}

// ============================================================
// 메인 함수
// ============================================================
export async function exportStudentExcel(
  student: SmStudent,
  careerGoals: SmCareerGoals | null,
  files: SmUploadedFile[],
  analyses: SmFileAnalysis[],
  subjectRecords: SmSubjectRecord[] = [],
  activities: SmActivity[] = [],
) {
  const allRows: ExcelRow[] = [
    ...fileAnalysisToRows(files, analyses),
    ...subjectRecordsToRows(subjectRecords),
    ...activitiesToRows(activities, student.enrollment_year),
  ]
  const sorted = sortRows(allRows)

  const careerText = careerGoals
    ? `${careerGoals.career_field_1st} ${careerGoals.career_detail_1st}`.trim()
    : ''

  const wb = new ExcelJS.Workbook()
  wb.creator = '생기부 컨설팅'
  wb.created = new Date()

  const ws = wb.addWorksheet(student.name || '학생', {
    properties: { defaultRowHeight: 22 },
    views: [{ state: 'frozen', ySplit: 8 }],
  })

  // 칼럼 너비
  ws.columns = [
    { width: 10 },  // A: 학기
    { width: 14 },  // B: 창체/교과세특
    { width: 14 },  // C: 활동/내용
    { width: 5 },   // D
    { width: 5 },   // E
    { width: 20 },  // F: 평가
    { width: 5 },   // G
    { width: 5 },   // H
    { width: 45 },  // I: 주제/구체적인 내용
    { width: 38 },  // J: 후속활동
    { width: 5 },   // K
    { width: 5 },   // L
    { width: 5 },   // M
    { width: 28 },  // N: 독서활동
    { width: 5 },   // O
    { width: 5 },   // P
    { width: 5 },   // Q
    { width: 5 },   // R
  ]

  // ============================================================
  // ROW 1: 학생 기본 정보 (헤더 바)
  // ============================================================
  const row1 = ws.addRow([
    student.high_school_name || '', '', student.name || '',
    '', '', '', '',
    '동아리', '', '진로희망', '', careerText,
    '', '', '', '', '', '',
  ])
  row1.height = 30
  // A1: 학교명
  const cellA1 = ws.getCell('A1')
  cellA1.font = { name: 'Noto Sans KR', size: 13, bold: true, color: { argb: COLORS.white } }
  cellA1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } }
  cellA1.alignment = { vertical: 'middle', horizontal: 'center' }
  cellA1.border = allMediumBorders
  ws.mergeCells('A1:B1')

  // C1: 학생명
  const cellC1 = ws.getCell('C1')
  cellC1.font = { name: 'Noto Sans KR', size: 14, bold: true, color: { argb: COLORS.accentGold } }
  cellC1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } }
  cellC1.alignment = { vertical: 'middle', horizontal: 'center' }
  cellC1.border = allMediumBorders
  ws.mergeCells('C1:G1')

  // H1: 동아리 라벨
  const cellH1 = ws.getCell('H1')
  cellH1.font = headerFont(10)
  cellH1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } }
  cellH1.alignment = { vertical: 'middle', horizontal: 'center' }
  cellH1.border = allMediumBorders
  ws.mergeCells('H1:I1')

  // J1: 진로희망 라벨
  const cellJ1 = ws.getCell('J1')
  cellJ1.font = headerFont(10)
  cellJ1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } }
  cellJ1.alignment = { vertical: 'middle', horizontal: 'center' }
  cellJ1.border = allMediumBorders

  // K1: 진로 텍스트 값
  ws.mergeCells('K1:R1')
  const cellK1 = ws.getCell('K1')
  cellK1.value = careerText
  cellK1.font = { name: 'Noto Sans KR', size: 11, bold: true, color: { argb: COLORS.accentAmber } }
  cellK1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } }
  cellK1.alignment = { vertical: 'middle', horizontal: 'left' }
  cellK1.border = allMediumBorders
  // Clear L1 value since it was in the original row data
  ws.getCell('L1').value = null

  // ============================================================
  // ROW 2: 구분 헤더
  // ============================================================
  const row2 = ws.addRow([
    '구분', '', '1학년', '', '2학년', '', '3학년', '전체',
    '', '선택과목 조합', '', '', '', '', '', '', '', '',
  ])
  row2.height = 24
  for (let c = 1; c <= 18; c++) {
    const cell = ws.getCell(2, c)
    cell.font = headerFont(9)
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.dataHeaderBg } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = allMediumBorders
  }
  ws.mergeCells('A2:B2')
  ws.mergeCells('C2:D2')
  ws.mergeCells('E2:F2')
  ws.mergeCells('J2:R2')

  // ============================================================
  // ROW 3: 학기 구분
  // ============================================================
  const row3 = ws.addRow([
    '', '', '1학기', '2학기', '1학기', '2학기', '1학기', '',
    '', '', '', '', '', '', '', '', '', '',
  ])
  row3.height = 22
  for (let c = 1; c <= 18; c++) {
    const cell = ws.getCell(3, c)
    cell.font = bodyFont(9, true)
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.subHeaderBg } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = allThinBorders
  }
  ws.mergeCells('A3:B3')

  // ============================================================
  // ROW 4~7: 성적표 빈 행
  // ============================================================
  const gradeLabels = [
    ['최종 교과', '전교과'],
    ['', '국영수과사'],
    ['', '국영수과'],
    ['', '국영수사'],
  ]
  for (const [labelA, labelB] of gradeLabels) {
    const row = ws.addRow([labelA, labelB, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''])
    row.height = 22
    for (let c = 1; c <= 18; c++) {
      const cell = ws.getCell(row.number, c)
      cell.font = bodyFont(9, c <= 2)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.gradeBg } }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.border = allThinBorders
    }
  }

  // ============================================================
  // ROW 8: 데이터 헤더
  // ============================================================
  const dataHeaderRow = ws.addRow([
    '학기', '창체/교과세특', '활동/내용', '', '',
    '평가', '', '',
    '주제/구체적인 내용',
    '후속활동, 소감', '', '', '',
    '독서활동', '', '', '', '',
  ])
  dataHeaderRow.height = 28
  for (let c = 1; c <= 18; c++) {
    const cell = ws.getCell(dataHeaderRow.number, c)
    cell.font = headerFont(10)
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.dataHeaderBg } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = { top: thickBorder, bottom: thickBorder, left: mediumBorder, right: mediumBorder }
  }
  ws.mergeCells(`C${dataHeaderRow.number}:E${dataHeaderRow.number}`)
  ws.mergeCells(`F${dataHeaderRow.number}:H${dataHeaderRow.number}`)
  ws.mergeCells(`J${dataHeaderRow.number}:M${dataHeaderRow.number}`)
  ws.mergeCells(`N${dataHeaderRow.number}:R${dataHeaderRow.number}`)

  // ============================================================
  // 데이터 행
  // ============================================================
  const dataStartRow = dataHeaderRow.number + 1

  for (let i = 0; i < sorted.length; i++) {
    const d = sorted[i]
    const row = ws.addRow([
      d.grade,
      d.category,
      d.activity, '', '',
      d.evaluation, '', '',
      d.topic,
      d.followUp, '', '', '',
      d.reading, '', '', '', '',
    ])

    const rowNum = row.number
    const gradeIdx = d.grade === '1학년' ? 0 : d.grade === '2학년' ? 1 : 2
    const semBgColor = COLORS.semesterColors[gradeIdx] || COLORS.white
    const isChangche = d.sortOrder < 100

    for (let c = 1; c <= 18; c++) {
      const cell = ws.getCell(rowNum, c)

      // 배경색: 학기색 (A열), 창체/교과 구분색 (나머지)
      if (c === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: semBgColor } }
        cell.font = bodyFont(10, true)
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      } else if (c === 2) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isChangche ? COLORS.changcheBg : COLORS.gyogwaBg } }
        cell.font = bodyFont(10, true)
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.white } }
        cell.font = bodyFont(9)
        cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true }
      }

      cell.border = {
        top: thinBorder,
        bottom: thinBorder,
        left: (c === 1 || c === 3 || c === 6 || c === 9 || c === 10 || c === 14) ? mediumBorder : thinBorder,
        right: (c === 2 || c === 5 || c === 8 || c === 9 || c === 13 || c === 18) ? mediumBorder : thinBorder,
      }
    }

    // 행 높이: 내용 길이에 따라 자동 조절
    const maxLen = Math.max(d.topic.length, d.followUp.length, d.reading.length)
    row.height = Math.max(22, Math.min(80, 22 + Math.floor(maxLen / 30) * 14))

    // 셀 병합
    ws.mergeCells(`C${rowNum}:E${rowNum}`)
    ws.mergeCells(`F${rowNum}:H${rowNum}`)
    ws.mergeCells(`J${rowNum}:M${rowNum}`)
    ws.mergeCells(`N${rowNum}:R${rowNum}`)
  }

  // ============================================================
  // 학기 셀 병합 (Col A)
  // ============================================================
  if (sorted.length > 0) {
    let start = dataStartRow
    let current = sorted[0].grade

    for (let i = 1; i <= sorted.length; i++) {
      const next = i < sorted.length ? sorted[i].grade : ''
      if (next !== current) {
        if (dataStartRow + i - 1 > start) {
          ws.mergeCells(`A${start}:A${dataStartRow + i - 1}`)
        }
        // 학기 구분선: 굵은 테두리
        for (let c = 1; c <= 18; c++) {
          const cell = ws.getCell(dataStartRow + i - 1, c)
          cell.border = {
            ...cell.border,
            bottom: thickBorder,
          }
        }
        start = dataStartRow + i
        current = next
      }
    }
  }

  // ============================================================
  // 카테고리 셀 병합 (Col B)
  // ============================================================
  if (sorted.length > 0) {
    let catStart = dataStartRow
    let currentCat = sorted[0].category
    let currentGrade = sorted[0].grade

    for (let i = 1; i <= sorted.length; i++) {
      const nextCat = i < sorted.length ? sorted[i].category : ''
      const nextGrade = i < sorted.length ? sorted[i].grade : ''
      if (nextCat !== currentCat || nextGrade !== currentGrade) {
        if (dataStartRow + i - 1 > catStart) {
          ws.mergeCells(`B${catStart}:B${dataStartRow + i - 1}`)
        }
        catStart = dataStartRow + i
        currentCat = nextCat
        currentGrade = nextGrade
      }
    }
  }

  // ============================================================
  // 파일 다운로드
  // ============================================================
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const fileName = `${student.name || student.student_login_id} 생기부 정리자료.xlsx`
  saveAs(blob, fileName)
}
