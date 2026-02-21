import { SmUploadedFile } from '../../types/database'

interface Props {
  files: SmUploadedFile[]
  selectedFileId: string | null
  onSelect: (fileId: string) => void
  onDelete: (fileId: string) => void
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  '대기중': { bg: 'bg-gray-100', text: 'text-gray-600', label: '대기중' },
  '분석중': { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '분석중' },
  '완료': { bg: 'bg-green-100', text: 'text-green-700', label: '완료' },
  '실패': { bg: 'bg-red-100', text: 'text-red-700', label: '실패' },
}

export default function FileList({ files, selectedFileId, onSelect, onDelete }: Props) {
  if (files.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">업로드된 파일</h3>
        <p className="text-gray-400 text-sm">아직 업로드된 파일이 없습니다.</p>
      </div>
    )
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  }

  const getCategoryLabel = (file: SmUploadedFile) => {
    if (file.category_main === '창체활동') {
      const parts = [file.changche_type, file.changche_sub].filter(Boolean)
      return parts.length > 0 ? `창체 > ${parts.join(' > ')}` : '창체활동'
    }
    const parts = [file.gyogwa_subject_name, file.gyogwa_type, file.gyogwa_sub].filter(Boolean)
    return parts.length > 0 ? `교과 > ${parts.join(' > ')}` : '교과세특'
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          업로드된 파일 <span className="text-sm font-normal text-gray-500">({files.length}개)</span>
        </h3>
      </div>

      <div className="space-y-2">
        {files.map(file => {
          const status = STATUS_STYLES[file.analysis_status] || STATUS_STYLES['대기중']
          const isSelected = file.id === selectedFileId

          return (
            <div
              key={file.id}
              className={`border rounded-lg p-3 cursor-pointer transition ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
              onClick={() => onSelect(file.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-500 uppercase">
                      {file.file_type}
                    </span>
                    <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium ${status.bg} ${status.text}`}>
                      {status.label}
                    </span>
                    {file.semester && (
                      <span className="px-1.5 py-0.5 text-xs rounded-full bg-purple-50 text-purple-600">
                        {file.semester}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-800 truncate">{file.file_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {getCategoryLabel(file)} &middot; {formatDate(file.created_at)}
                  </p>
                  {file.analysis_status === '실패' && file.analysis_error && (
                    <p className="text-xs text-red-500 mt-1">{file.analysis_error}</p>
                  )}
                </div>
                <button
                  onClick={e => {
                    e.stopPropagation()
                    if (confirm(`"${file.file_name}" 파일을 삭제하시겠습니까?`)) {
                      onDelete(file.id)
                    }
                  }}
                  className="ml-2 p-1 text-gray-400 hover:text-red-500 transition"
                  title="삭제"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
