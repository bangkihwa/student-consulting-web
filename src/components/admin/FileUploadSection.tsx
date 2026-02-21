import { useState, useRef } from 'react'

interface Props {
  onUpload: (file: File) => Promise<void>
  uploading: boolean
}

export default function FileUploadSection({ onUpload, uploading }: Props) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): boolean => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !['pdf', 'docx', 'jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
      alert(`${file.name}: PDF, DOCX, 이미지(JPG/PNG) 파일만 업로드 가능합니다.`)
      return false
    }
    if (file.size > 10 * 1024 * 1024) {
      alert(`${file.name}: 파일 크기는 10MB 이하여야 합니다.`)
      return false
    }
    return true
  }

  const addFiles = (newFiles: FileList | File[]) => {
    const valid = Array.from(newFiles).filter(validateFile)
    if (valid.length === 0) return
    setSelectedFiles(prev => {
      const existing = new Set(prev.map(f => `${f.name}_${f.size}`))
      const unique = valid.filter(f => !existing.has(`${f.name}_${f.size}`))
      return [...prev, ...unique]
    })
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files)
  }

  const handleSubmit = async () => {
    if (selectedFiles.length === 0) return
    try {
      for (const file of selectedFiles) {
        await onUpload(file)
      }
      setSelectedFiles([])
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch {
      // 에러는 상위에서 처리
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-2">활동 보고서 업로드</h3>
      <p className="text-sm text-gray-500 mb-4">
        창체활동, 교과세특 구분 없이 파일만 올리면 AI가 자동으로 학기, 분류, 교과명을 판별합니다.
      </p>

      <div className="space-y-4">
        {/* 파일 선택 영역 */}
        <div>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition ${
              dragOver
                ? 'border-blue-500 bg-blue-50'
                : selectedFiles.length > 0
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            }`}
          >
            {selectedFiles.length > 0 ? (
              <div>
                <p className="text-sm font-medium text-green-700">{selectedFiles.length}개 파일 선택됨</p>
                <p className="text-xs text-gray-500 mt-2">클릭하여 파일 추가</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-500">파일을 드래그하거나 클릭하여 선택 (복수 선택 가능)</p>
                <p className="text-xs text-gray-400 mt-1">PDF, DOCX, 이미지(JPG/PNG) (최대 10MB)</p>
                <p className="text-xs text-gray-400">캡쳐 이미지도 AI가 텍스트를 읽어 분석합니다</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.jpg,.jpeg,.png,.webp,.gif"
            multiple
            className="hidden"
            onChange={e => {
              if (e.target.files && e.target.files.length > 0) addFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        {/* 선택된 파일 목록 */}
        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            {selectedFiles.map((file, idx) => (
              <div key={`${file.name}_${idx}`} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 uppercase flex-shrink-0">
                    {file.name.split('.').pop()}
                  </span>
                  <span className="text-sm text-gray-700 truncate">{file.name}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{formatFileSize(file.size)}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeFile(idx) }}
                  className="text-gray-400 hover:text-red-500 transition ml-2 flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 업로드 버튼 */}
        <button
          type="button"
          disabled={selectedFiles.length === 0 || uploading}
          onClick={handleSubmit}
          className={`w-full py-3 rounded-lg text-sm font-medium transition ${
            selectedFiles.length === 0 || uploading
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {uploading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              AI 분석 중...
            </span>
          ) : (
            `업로드 및 AI 자동 분류 (${selectedFiles.length}개)`
          )}
        </button>
      </div>
    </div>
  )
}
