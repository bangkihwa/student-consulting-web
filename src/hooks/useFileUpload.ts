import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { SmUploadedFile, SmFileAnalysis } from '../types/database'

export function useFileUpload(studentId: string | undefined) {
  const [files, setFiles] = useState<SmUploadedFile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchFiles = useCallback(async () => {
    if (!studentId) return
    setLoading(true)
    const { data, error: err } = await supabase
      .from('sm_uploaded_files')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })

    if (err) {
      setError(err.message)
    } else {
      setFiles(data || [])
      setError(null)
    }
    setLoading(false)
  }, [studentId])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  const uploadFile = async (file: File) => {
    if (!studentId) throw new Error('학생 ID가 필요합니다.')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('로그인이 필요합니다.')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('student_id', studentId)

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const response = await fetch(`${supabaseUrl}/functions/v1/analyze-file`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: formData,
    })

    const result = await response.json()
    if (!response.ok || !result.success) {
      throw new Error(result.error || '업로드 실패')
    }

    await fetchFiles()
    return result as { file: SmUploadedFile; analysis: SmFileAnalysis }
  }

  const deleteFile = async (fileId: string) => {
    // 스토리지에서 파일 삭제
    const fileToDelete = files.find(f => f.id === fileId)
    if (fileToDelete) {
      await supabase.storage.from('sm-activity-files').remove([fileToDelete.storage_path])
    }

    // DB에서 삭제 (CASCADE로 분석 결과도 삭제)
    const { error: err } = await supabase
      .from('sm_uploaded_files')
      .delete()
      .eq('id', fileId)

    if (err) throw new Error(err.message)
    await fetchFiles()
  }

  const getAnalysis = async (fileId: string): Promise<SmFileAnalysis | null> => {
    const { data, error: err } = await supabase
      .from('sm_file_analysis')
      .select('*')
      .eq('file_id', fileId)
      .maybeSingle()

    if (err) throw new Error(err.message)
    return data
  }

  const updateAnalysis = async (analysisId: string, updates: Partial<SmFileAnalysis>) => {
    const { error: err } = await supabase
      .from('sm_file_analysis')
      .update({ ...updates, is_edited: true })
      .eq('id', analysisId)

    if (err) throw new Error(err.message)
  }

  const getAllAnalyses = useCallback(async (): Promise<SmFileAnalysis[]> => {
    if (!studentId) return []
    const { data, error: err } = await supabase
      .from('sm_file_analysis')
      .select('*')
      .eq('student_id', studentId)

    if (err) throw new Error(err.message)
    return data || []
  }, [studentId])

  const updateFileMetadata = async (fileId: string, updates: Partial<SmUploadedFile>) => {
    const { error: err } = await supabase
      .from('sm_uploaded_files')
      .update(updates)
      .eq('id', fileId)

    if (err) throw new Error(err.message)
    await fetchFiles()
  }

  const reanalyzeFile = async (fileId: string) => {
    if (!studentId) throw new Error('학생 ID가 필요합니다.')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('로그인이 필요합니다.')

    // 상태를 분석중으로 변경
    await supabase
      .from('sm_uploaded_files')
      .update({ analysis_status: '분석중', analysis_error: null })
      .eq('id', fileId)

    await fetchFiles()

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const response = await fetch(`${supabaseUrl}/functions/v1/analyze-file`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file_id: fileId, reanalyze: true }),
    })

    const result = await response.json()
    if (!response.ok || !result.success) {
      throw new Error(result.error || '재분석 실패')
    }

    await fetchFiles()
    return result
  }

  return {
    files,
    loading,
    error,
    uploadFile,
    deleteFile,
    getAnalysis,
    getAllAnalyses,
    updateAnalysis,
    updateFileMetadata,
    reanalyzeFile,
    refreshFiles: fetchFiles,
  }
}
