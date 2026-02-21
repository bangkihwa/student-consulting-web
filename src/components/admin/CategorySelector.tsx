import {
  CategoryMain,
  ChangcheType,
  GyogwaType,
  CHANGCHE_TYPES,
  CHANGCHE_SUBS,
  GYOGWA_TYPES,
  GYOGWA_SUBS,
  SEMESTERS,
} from '../../types/database'

export interface CategoryMetadata {
  semester: string
  category_main: CategoryMain
  changche_type: ChangcheType | null
  changche_sub: string
  gyogwa_type: GyogwaType | null
  gyogwa_sub: string
  gyogwa_subject_name: string
  bongsa_hours: number | null
}

interface Props {
  value: CategoryMetadata
  onChange: (v: CategoryMetadata) => void
}

export default function CategorySelector({ value, onChange }: Props) {
  const update = (patch: Partial<CategoryMetadata>) => onChange({ ...value, ...patch })

  return (
    <div className="space-y-4">
      {/* 학기 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">학기</label>
        <select
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={value.semester}
          onChange={e => update({ semester: e.target.value })}
        >
          <option value="">선택</option>
          {SEMESTERS.map(s => (
            <option key={s} value={s}>{s.replace('-', '학년 ')}학기</option>
          ))}
        </select>
      </div>

      {/* 대분류 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">대분류</label>
        <div className="flex gap-2">
          {(['창체활동', '교과세특'] as CategoryMain[]).map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => update({
                category_main: cat,
                changche_type: null,
                changche_sub: '',
                gyogwa_type: null,
                gyogwa_sub: '',
                gyogwa_subject_name: '',
                bongsa_hours: null,
              })}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                value.category_main === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 창체활동 하위분류 */}
      {value.category_main === '창체활동' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">활동 유형</label>
            <div className="grid grid-cols-2 gap-2">
              {CHANGCHE_TYPES.map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => update({
                    changche_type: type,
                    changche_sub: '',
                    bongsa_hours: type === '봉사활동' ? null : value.bongsa_hours,
                  })}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition ${
                    value.changche_type === type
                      ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {value.changche_type && value.changche_type !== '봉사활동' && CHANGCHE_SUBS[value.changche_type].length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">세부 유형</label>
              <div className="flex flex-wrap gap-2">
                {CHANGCHE_SUBS[value.changche_type].map(sub => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => update({ changche_sub: sub })}
                    className={`py-1.5 px-3 rounded-full text-xs font-medium transition ${
                      value.changche_sub === sub
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>
          )}

          {value.changche_type === '봉사활동' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">봉사 시간</label>
              <input
                type="number"
                min="0"
                step="0.5"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="시간 입력"
                value={value.bongsa_hours ?? ''}
                onChange={e => update({ bongsa_hours: e.target.value ? parseFloat(e.target.value) : null })}
              />
            </div>
          )}
        </>
      )}

      {/* 교과세특 하위분류 */}
      {value.category_main === '교과세특' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">교과명</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="예: 수학, 영어, 물리학 등"
              value={value.gyogwa_subject_name}
              onChange={e => update({ gyogwa_subject_name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">활동 유형</label>
            <div className="flex gap-2">
              {GYOGWA_TYPES.map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => update({ gyogwa_type: type, gyogwa_sub: '' })}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${
                    value.gyogwa_type === type
                      ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {value.gyogwa_type && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">세부 유형</label>
              <div className="flex flex-wrap gap-2">
                {GYOGWA_SUBS[value.gyogwa_type].map(sub => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => update({ gyogwa_sub: sub })}
                    className={`py-1.5 px-3 rounded-full text-xs font-medium transition ${
                      value.gyogwa_sub === sub
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
