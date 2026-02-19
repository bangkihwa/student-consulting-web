import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { supabase } from '../lib/supabase'

interface StudentSessionContextType {
  studentId: string | null
  sessionToken: string | null
  loading: boolean
  login: (loginId: string, name: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const StudentSessionContext = createContext<StudentSessionContextType | undefined>(undefined)

export function StudentSessionProvider({ children }: { children: ReactNode }) {
  const [studentId, setStudentId] = useState<string | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const validateSession = useCallback(async (token: string) => {
    const { data, error } = await supabase.rpc('sm_get_student_by_session', {
      p_session_token: token,
    })
    if (error || !data) {
      sessionStorage.removeItem('sm_session_token')
      sessionStorage.removeItem('sm_student_id')
      setSessionToken(null)
      setStudentId(null)
      return false
    }
    setStudentId(data)
    return true
  }, [])

  useEffect(() => {
    const storedToken = sessionStorage.getItem('sm_session_token')
    const storedId = sessionStorage.getItem('sm_student_id')
    if (storedToken && storedId) {
      setSessionToken(storedToken)
      setStudentId(storedId)
      validateSession(storedToken).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [validateSession])

  const login = async (loginId: string, name: string) => {
    const { data, error } = await supabase.rpc('sm_verify_student_login', {
      p_login_id: loginId,
      p_student_name: name,
    })
    if (error) throw new Error('아이디 또는 이름이 올바르지 않습니다.')
    if (!data || data.length === 0) throw new Error('로그인에 실패했습니다.')

    const { student_id, session_token } = data[0]
    setStudentId(student_id)
    setSessionToken(session_token)
    sessionStorage.setItem('sm_session_token', session_token)
    sessionStorage.setItem('sm_student_id', student_id)
  }

  const logout = () => {
    setStudentId(null)
    setSessionToken(null)
    sessionStorage.removeItem('sm_session_token')
    sessionStorage.removeItem('sm_student_id')
  }

  return (
    <StudentSessionContext.Provider
      value={{
        studentId,
        sessionToken,
        loading,
        login,
        logout,
        isAuthenticated: !!sessionToken && !!studentId,
      }}
    >
      {children}
    </StudentSessionContext.Provider>
  )
}

export function useStudentSession() {
  const context = useContext(StudentSessionContext)
  if (!context) throw new Error('useStudentSession must be used within StudentSessionProvider')
  return context
}
