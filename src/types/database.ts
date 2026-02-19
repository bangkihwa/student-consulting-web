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
