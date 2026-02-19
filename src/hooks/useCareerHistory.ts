import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useStudentSession } from '../contexts/StudentSessionContext'
import { SmCareerChangeHistory } from '../types/database'

export function useCareerHistory() {
  const { sessionToken } = useStudentSession()
  const [history, setHistory] = useState<SmCareerChangeHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHistory = useCallback(async () => {
    if (!sessionToken) return
    setLoading(true)
    const { data, error: err } = await supabase.rpc('sm_get_my_career_history', {
      p_session_token: sessionToken,
    })
    if (err) {
      setError(err.message)
    } else {
      setHistory(data || [])
      setError(null)
    }
    setLoading(false)
  }, [sessionToken])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const addHistory = async (entry: {
    change_date: string
    previous_career: string
    new_career: string
    reason?: string
  }) => {
    if (!sessionToken) throw new Error('세션이 만료되었습니다.')
    const { error: err } = await supabase.rpc('sm_add_my_career_history', {
      p_session_token: sessionToken,
      p_change_date: entry.change_date,
      p_previous_career: entry.previous_career,
      p_new_career: entry.new_career,
      p_reason: entry.reason || '',
    })
    if (err) throw new Error(err.message)
    await fetchHistory()
  }

  const deleteHistory = async (historyId: string) => {
    if (!sessionToken) throw new Error('세션이 만료되었습니다.')
    const { error: err } = await supabase.rpc('sm_delete_my_career_history', {
      p_session_token: sessionToken,
      p_history_id: historyId,
    })
    if (err) throw new Error(err.message)
    await fetchHistory()
  }

  return { history, loading, error, addHistory, deleteHistory, refreshHistory: fetchHistory }
}
