import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useStudentSession } from '../contexts/StudentSessionContext'
import { SmCareerGoals } from '../types/database'

export function useCareerGoals() {
  const { sessionToken } = useStudentSession()
  const [careerGoals, setCareerGoals] = useState<SmCareerGoals | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchGoals = useCallback(async () => {
    if (!sessionToken) return
    setLoading(true)
    const { data, error: err } = await supabase.rpc('sm_get_my_career_goals', {
      p_session_token: sessionToken,
    })
    if (err) {
      setError(err.message)
    } else if (data && data.length > 0) {
      setCareerGoals(data[0])
      setError(null)
    } else {
      setCareerGoals(null)
      setError(null)
    }
    setLoading(false)
  }, [sessionToken])

  useEffect(() => {
    fetchGoals()
  }, [fetchGoals])

  const saveCareerGoals = async (goals: Partial<SmCareerGoals>) => {
    if (!sessionToken) throw new Error('세션이 만료되었습니다.')
    const { error: err } = await supabase.rpc('sm_upsert_my_career_goals', {
      p_session_token: sessionToken,
      p_career_field_1st: goals.career_field_1st ?? null,
      p_career_detail_1st: goals.career_detail_1st ?? null,
      p_career_field_2nd: goals.career_field_2nd ?? null,
      p_career_detail_2nd: goals.career_detail_2nd ?? null,
      p_target_univ_1_name: goals.target_univ_1_name ?? null,
      p_target_univ_1_dept: goals.target_univ_1_dept ?? null,
      p_target_univ_2_name: goals.target_univ_2_name ?? null,
      p_target_univ_2_dept: goals.target_univ_2_dept ?? null,
      p_target_univ_3_name: goals.target_univ_3_name ?? null,
      p_target_univ_3_dept: goals.target_univ_3_dept ?? null,
      p_target_tier: goals.target_tier ?? null,
      p_admission_hakjong_ratio: goals.admission_hakjong_ratio ?? null,
      p_admission_gyogwa_ratio: goals.admission_gyogwa_ratio ?? null,
      p_admission_nonsul_ratio: goals.admission_nonsul_ratio ?? null,
      p_admission_jeongsi_ratio: goals.admission_jeongsi_ratio ?? null,
      p_field_keywords: goals.field_keywords ?? null,
      p_special_notes: goals.special_notes ?? null,
    })
    if (err) throw new Error(err.message)
    await fetchGoals()
  }

  return { careerGoals, loading, error, saveCareerGoals, refreshGoals: fetchGoals }
}
