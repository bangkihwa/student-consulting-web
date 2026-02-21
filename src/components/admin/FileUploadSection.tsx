import { useState, useRef } from 'react'
import CategorySelector, { CategoryMetadata } from './CategorySelector'

interface Props {
  onUpload: (file: File, metadata: CategoryMetadata) => Promise<void>
  uploading: boolean
}

const DEFAULT_METADATA: CategoryMetadata = {
  semester: '',
  category_main: '창체활동',
  changche_type: null,
  changche_sub: '',
  gyogwa_type: null,
  gyogwa_sub: '',
  gyogwa_subject_name: '',
  bongsa_hours: null,
}

export default function FileUploadSection({ onUpload, uploading }: Props) {
  const [metadata, setMetadata] = useState<CategoryMetadata>(DEFAULT_METADATA)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !['pdf', 'docx'].includes(ext)) {
      alert('PDF 또는 DOCX 파일만 업로드 가능합니다.\n한글(HWP) 파일은 PDF로 변환 후 업로드해주세요.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('파일 크기는 10MB 이하여야 합니다.')
      return
    }
    setSelectedFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const handleSubmit = async () => {
    if (!selectedFile) return
    try {
      await onUpload(selectedFile, metadata)
      setSelectedFile(null)
      setMetadata(DEFAULT_METADATA)
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
      <h3 className="text-lg font-semibold text-gray-800 mb-4">활동 보고서 업로드</h3>

      <div className="space-y-4">
        {/* 카테고리 선택 */}
        <CategorySelector value={metadata} onChange={setMetadata} />

        {/* 파일 선택 영역 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">파일 선택</label>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition ${
              dragOver
                ? 'border-blue-500 bg-blue-50'
                : selectedFile
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            }`}
          >
            {selectedFile ? (
              <div>
                <p className="text-sm font-medium text-green-700">{selectedFile.name}</p>
                <p className="text-xs text-green-600 mt-1">{formatFileSize(selectedFile.size)}</p>
                <p className="text-xs text-gray-500 mt-2">클릭하여 다른 파일 선택</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-500">파일을 드래그하거나 클릭하여 선택</p>
                <p className="text-xs text-gray-400 mt-1">PDF, DOCX (최대 10MB)</p>
                <p className="text-xs text-gray-400">HWP 파일은 PDF로 변환 후 업로드해주세요</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handleFileSelect(file)
            }}
          />
        </div>

        {/* 업로드 버튼 */}
        <button
          type="button"
          disabled={!selectedFile || uploading}
          onClick={handleSubmit}
          className={`w-full py-3 rounded-lg text-sm font-medium transition ${
            !selectedFile || uploading
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
            '업로드 및 AI 분석'
          )}
        </button>
      </div>
    </div>
  )
}
