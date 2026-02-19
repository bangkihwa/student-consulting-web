import { supabase } from './supabase'

export type SchoolLevel = 'middle' | 'high'

export async function generateStudentLoginId(
  schoolLevel: SchoolLevel,
  grade: string
): Promise<string> {
  const prefix = schoolLevel === 'middle' ? 'm' : 'h'
  const gradeCode = grade.padStart(2, '0')
  const idPrefix = `${prefix}${gradeCode}`

  const { data } = await supabase
    .from('sm_students')
    .select('student_login_id')
    .like('student_login_id', `${idPrefix}%`)
    .order('student_login_id', { ascending: false })
    .limit(1)

  let seq = 1
  if (data && data.length > 0) {
    const lastId = data[0].student_login_id
    const lastSeq = parseInt(lastId.slice(3), 10)
    if (!isNaN(lastSeq)) seq = lastSeq + 1
  }

  return `${idPrefix}${String(seq).padStart(3, '0')}`
}

export function formatPhone(value: string): string {
  const nums = value.replace(/\D/g, '')
  if (nums.length <= 3) return nums
  if (nums.length <= 7) return `${nums.slice(0, 3)}-${nums.slice(3)}`
  return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7, 11)}`
}

export function validatePhone(phone: string): boolean {
  return /^01[016789]-?\d{3,4}-?\d{4}$/.test(phone)
}
