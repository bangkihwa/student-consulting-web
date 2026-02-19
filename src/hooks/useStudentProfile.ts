import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useStudentSession } from '../contexts/StudentSessionContext'
import { SmStudent } from '../types/database'

export function useStudentProfile() {
  const { sessionToken } = useStudentSession()
  const [profile, setProfile] = useState<SmStudent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = useCallback(async () => {
    if (!sessionToken) return
    setLoading(true)
    const { data, error: err } = await supabase.rpc('sm_get_my_profile', {
      p_session_token: sessionToken,
    })
    if (err) {
      setError(err.message)
    } else if (data && data.length > 0) {
      setProfile(data[0])
      setError(null)
    }
    setLoading(false)
  }, [sessionToken])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const updateProfile = async (updates: {
    name?: string
    student_phone?: string
    parent_phone?: string
    high_school_name?: string
    enrollment_year?: number
    graduation_year?: number
  }) => {
    if (!sessionToken) throw new Error('세션이 만료되었습니다.')
    const { error: err } = await supabase.rpc('sm_update_my_profile', {
      p_session_token: sessionToken,
      p_name: updates.name ?? null,
      p_student_phone: updates.student_phone ?? null,
      p_parent_phone: updates.parent_phone ?? null,
      p_high_school_name: updates.high_school_name ?? null,
      p_enrollment_year: updates.enrollment_year ?? null,
      p_graduation_year: updates.graduation_year ?? null,
    })
    if (err) throw new Error(err.message)
    await fetchProfile()
  }

  return { profile, loading, error, updateProfile, refreshProfile: fetchProfile }
}
