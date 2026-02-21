export interface SmStudent {
  id: string
  student_login_id: string
  access_code: string
  name: string
  grade: string
  enrollment_year: number | null
  graduation_year: number | null
  high_school_name: string
  student_phone: string
  parent_phone: string
  consultant_name: string
  created_by: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SmCareerGoals {
  id: string
  student_id: string
  career_field_1st: string
  career_detail_1st: string
  career_field_2nd: string
  career_detail_2nd: string
  target_univ_1_name: string
  target_univ_1_dept: string
  target_univ_2_name: string
  target_univ_2_dept: string
  target_univ_3_name: string
  target_univ_3_dept: string
  target_tier: '' | '최상위' | '상위' | '중상위' | '중위'
  admission_hakjong_ratio: number
  admission_gyogwa_ratio: number
  admission_nonsul_ratio: number
  admission_jeongsi_ratio: number
  field_keywords: string[]
  special_notes: string
  created_at: string
  updated_at: string
}

export interface SmCareerChangeHistory {
  id: string
  student_id: string
  change_date: string
  previous_career: string
  new_career: string
  reason: string
  created_at: string
  updated_at: string
}

export type TargetTier = '최상위' | '상위' | '중상위' | '중위'

export const TARGET_TIERS: TargetTier[] = ['최상위', '상위', '중상위', '중위']

export const CAREER_FIELDS = [
  '인문', '사회', '경영·경제', '교육', '법학',
  '자연과학', '공학', '의학·보건', '예술·체육',
  '농림·수산', '기타',
] as const

export const ADMISSION_TYPES = {
  hakjong: '학종',
  gyogwa: '교과',
  nonsul: '논술',
  jeongsi: '정시',
} as const

// ============================================================
// 파일 업로드 + AI 분석
// ============================================================

export interface SmUploadedFile {
  id: string
  student_id: string
  uploaded_by: string
  file_name: string
  file_type: 'pdf' | 'docx' | 'jpg' | 'jpeg' | 'png' | 'webp' | 'gif'
  file_size_bytes: number
  storage_path: string
  semester: string
  category_main: '창체활동' | '교과세특'
  changche_type: '자율활동' | '동아리활동' | '진로활동' | '봉사활동' | null
  changche_sub: string
  gyogwa_type: '교과활동(수행)' | '추가활동' | null
  gyogwa_sub: string
  gyogwa_subject_name: string
  bongsa_hours: number | null
  analysis_status: '대기중' | '분석중' | '완료' | '실패'
  analysis_error: string | null
  created_at: string
  updated_at: string
}

export interface SmFileAnalysis {
  id: string
  file_id: string
  student_id: string
  title: string
  activity_content: string
  conclusion: string
  research_plan: string
  reading_activities: string
  evaluation_competency: string
  raw_text: string
  is_edited: boolean
  created_at: string
  updated_at: string
}

export type CategoryMain = '창체활동' | '교과세특'
export type ChangcheType = '자율활동' | '동아리활동' | '진로활동' | '봉사활동'
export type GyogwaType = '교과활동(수행)' | '추가활동'

export const CHANGCHE_TYPES: ChangcheType[] = ['자율활동', '동아리활동', '진로활동', '봉사활동']

export const CHANGCHE_SUBS: Record<ChangcheType, string[]> = {
  '자율활동': ['학급활동', '공동체활동', '진로연계활동', '기타'],
  '동아리활동': ['팀프로젝트', '개인활동', '독서활동', '기타'],
  '진로활동': ['학급활동', '공동체활동', '진로심화활동', '기타'],
  '봉사활동': [],
}

export const GYOGWA_TYPES: GyogwaType[] = ['교과활동(수행)', '추가활동']

export const GYOGWA_SUBS: Record<GyogwaType, string[]> = {
  '교과활동(수행)': ['발표', '토론', '실험', '보고서', '독서', '기타'],
  '추가활동': ['실험', '보고서', '독서', '기타'],
}

export const SEMESTERS = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2'] as const

// ============================================================
// 세특관리웹 — sm_subject_records
// ============================================================

export interface SmSubjectRecord {
  id: string
  student_id: string
  semester: string
  subject_name: string
  achievement_level: 'A' | 'B' | 'C' | 'D' | 'E' | null
  grade_rank: number | null
  raw_score: number | null
  subject_average: number | null
  seukot_attitude: string
  seukot_inquiry: string
  seukot_thinking: string
  seukot_career: string
  inquiry_keywords: string[]
  completion_status: '미작성' | '작성중' | '검토요청' | '수정요청' | '완료'
  admin_feedback: string
  created_at: string
  updated_at: string
}

// ============================================================
// 창체관리웹 / 행특관리웹 — sm_activities, sm_behavior_summary
// ============================================================

export interface SmActivity {
  id: string
  student_id: string
  activity_type: '자율활동' | '동아리활동' | '진로활동'
  activity_name: string
  start_date: string
  end_date: string
  motivation: string
  role_and_process: string
  results: string
  reflection: string
  career_keywords: string[]
  related_seukot: string
  admin_feedback: string
  created_at: string
  updated_at: string
}

// ============================================================
// 성적 요약 — sm_grade_summary
// ============================================================

export interface SmGradeSummary {
  id: string
  student_id: string
  created_by: string
  grades: Record<string, number | null>  // "1-1_전교과": 2.3 등
  created_at: string
  updated_at: string
}

export const GRADE_SEMESTERS = ['1-1', '1-2', '2-1', '2-2', '3-1'] as const
export const GRADE_CATEGORIES = ['전교과', '국영수과사', '국영수과', '국영수사'] as const

export interface SmBehaviorSummary {
  id: string
  student_id: string
  core_keywords: string[]
  character_examples: string
  academic_growth: string
  leadership_examples: string
  career_consistency: string
  homeroom_draft: string
  admin_feedback: string
  created_at: string
  updated_at: string
}
