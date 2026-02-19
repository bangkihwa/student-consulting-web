import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { SmStudent } from '../types/database'
import { generateStudentLoginId, SchoolLevel } from '../lib/utils'

export function useStudents() {
  const { user } = useAuth()
  const [students, setStudents] = useState<SmStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStudents = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error: err } = await supabase
      .from('sm_students')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })

    if (err) {
      setError(err.message)
    } else {
      setStudents(data || [])
      setError(null)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchStudents()
  }, [fetchStudents])

  const createStudent = async (schoolLevel: SchoolLevel, grade: string, consultantName: string, name: string) => {
    if (!user) throw new Error('로그인이 필요합니다.')
    if (!name.trim()) throw new Error('학생 이름을 입력해주세요.')
    const loginId = await generateStudentLoginId(schoolLevel, grade)

    const { data, error: err } = await supabase
      .from('sm_students')
      .insert({
        student_login_id: loginId,
        access_code: '',
        grade,
        consultant_name: consultantName,
        name: name.trim(),
        created_by: user.id,
      })
      .select()
      .single()

    if (err) throw new Error(err.message)
    setStudents(prev => [data, ...prev])
    return data as SmStudent
  }

  const deleteStudent = async (id: string) => {
    const { error: err } = await supabase
      .from('sm_students')
      .delete()
      .eq('id', id)

    if (err) throw new Error(err.message)
    setStudents(prev => prev.filter(s => s.id !== id))
  }

  const toggleActive = async (id: string, isActive: boolean) => {
    const { error: err } = await supabase
      .from('sm_students')
      .update({ is_active: isActive })
      .eq('id', id)

    if (err) throw new Error(err.message)
    setStudents(prev => prev.map(s => s.id === id ? { ...s, is_active: isActive } : s))
  }

  const searchStudents = (query: string) => {
    if (!query.trim()) {
      fetchStudents()
      return
    }
    const lower = query.toLowerCase()
    setStudents(prev =>
      prev.filter(s =>
        s.name.toLowerCase().includes(lower) ||
        s.high_school_name.toLowerCase().includes(lower) ||
        s.student_login_id.toLowerCase().includes(lower)
      )
    )
  }

  return { students, loading, error, createStudent, deleteStudent, toggleActive, searchStudents, refreshStudents: fetchStudents }
}
