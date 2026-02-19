import { useState } from 'react'
import PersonalInfoForm from '../../components/student/PersonalInfoForm'
import CareerGoalsForm from '../../components/student/CareerGoalsForm'
import CareerHistoryForm from '../../components/student/CareerHistoryForm'

const TABS = [
  { id: 'personal', label: '기본 정보' },
  { id: 'career', label: '진로 및 목표' },
  { id: 'history', label: '진로 변경 이력' },
] as const

type TabId = typeof TABS[number]['id']

export default function StudentFormPage() {
  const [activeTab, setActiveTab] = useState<TabId>('personal')

  return (
    <div>
      <div className="flex gap-1 bg-white rounded-xl shadow-sm p-1 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition ${
              activeTab === tab.id
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'personal' && <PersonalInfoForm />}
      {activeTab === 'career' && <CareerGoalsForm />}
      {activeTab === 'history' && <CareerHistoryForm />}
    </div>
  )
}
