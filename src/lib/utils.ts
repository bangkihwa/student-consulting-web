import { supabase } from './supabase'

export type SchoolLevel = 'middle' | 'high'

export async function generateStudentLoginId(
  schoolLevel: SchoolLevel,
  grade: string
): Promise<string> {
  const prefix = schoolLevel === 'middle' ? 'm' : 'h'
  const gradeCode = grade.padStart(2, '0')
  const idPrefix = `${prefix}${gradeCode}`

  const { data, error } = await supabase.rpc('sm_generate_student_login_id', {
    p_prefix: idPrefix,
  })

  if (error) throw new Error(error.message)
  return data as string
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
