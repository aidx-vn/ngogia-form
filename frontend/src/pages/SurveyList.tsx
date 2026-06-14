import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import type { SurveyListItem } from '../types'

export default function SurveyList() {
  const [surveys, setSurveys] = useState<SurveyListItem[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api<SurveyListItem[]>('/surveys')
      .then(setSurveys)
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <p className="text-red-600">{error}</p>
  if (!surveys) return <p className="text-gray-400">Đang tải…</p>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Khảo sát đang mở</h1>
      {surveys.length === 0 && <p className="text-gray-500">Hiện chưa có khảo sát nào.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {surveys.map((s) => (
          <Link
            key={s.id}
            to={`/surveys/${s.id}`}
            className="block rounded-xl bg-white p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-[var(--primary)]/40 transition"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold">{s.title}</h2>
              {s.answered && (
                <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                  Đã trả lời
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{s.description}</p>
            <p className="text-xs text-gray-400 mt-3">{s.question_count} câu hỏi</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
