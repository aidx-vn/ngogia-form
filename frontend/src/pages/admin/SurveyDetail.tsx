import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api'
import type { QuestionStats, SurveyResponse, SurveyStats } from '../../types'

function ChoiceBars({ q }: { q: QuestionStats }) {
  const counts = q.counts ?? {}
  const total = Math.max(1, ...Object.values(counts))
  const labelFor = (value: string) => q.options?.find((o) => o.value === value)?.label ?? value
  const rows = (q.options ?? []).map((o) => ({ value: o.value, count: counts[o.value] ?? 0 }))
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.value}>
          <div className="flex justify-between text-sm mb-0.5">
            <span>{labelFor(row.value)}</span>
            <span className="text-gray-500">{row.count}</span>
          </div>
          <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--primary)]"
              style={{ width: `${(row.count / total) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function NumericStats({ q }: { q: QuestionStats }) {
  const dist = q.distribution ?? {}
  const keys = Object.keys(dist).sort((a, b) => Number(a) - Number(b))
  const max = Math.max(1, ...Object.values(dist))
  return (
    <div>
      {q.average !== undefined && (
        <p className="text-sm mb-3">
          Trung bình: <span className="font-semibold">{q.average.toFixed(2)}</span>
        </p>
      )}
      <div className="flex items-end gap-1 h-20">
        {keys.map((k) => (
          <div key={k} className="flex flex-col items-center gap-1 min-w-8">
            <span className="text-xs text-gray-500">{dist[k]}</span>
            <div
              className="w-6 rounded-t bg-[var(--primary)]"
              style={{ height: `${(dist[k] / max) * 100}%`, minHeight: 3 }}
            />
            <span className="text-xs text-gray-400">{k}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SurveyDetail() {
  const { id } = useParams()
  const [stats, setStats] = useState<SurveyStats | null>(null)
  const [responses, setResponses] = useState<SurveyResponse[]>([])
  const [tab, setTab] = useState<'stats' | 'responses'>('stats')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      api<SurveyStats>(`/admin/surveys/${id}/stats`),
      api<SurveyResponse[]>(`/admin/surveys/${id}/responses`),
    ])
      .then(([s, r]) => {
        setStats(s)
        setResponses(r)
      })
      .catch((e) => setError(e.message))
  }, [id])

  if (error) return <p className="text-red-600">{error}</p>
  if (!stats) return <p className="text-gray-400">Đang tải…</p>

  const questionLabel = (qid: string) =>
    stats.survey.schema.questions.find((q) => q.id === qid)?.label ?? qid

  const formatAnswer = (qid: string, v: unknown): string => {
    const q = stats.survey.schema.questions.find((x) => x.id === qid)
    if (Array.isArray(v)) {
      return v.map((item) => q?.options?.find((o) => o.value === item)?.label ?? String(item)).join(', ')
    }
    if (typeof v === 'string' && q?.options) {
      return q.options.find((o) => o.value === v)?.label ?? v
    }
    return String(v)
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to="/admin/surveys" className="text-sm text-gray-400 hover:text-gray-600">
          ← Danh sách khảo sát
        </Link>
        <h1 className="text-2xl font-bold mt-1">{stats.survey.title}</h1>
        <p className="text-gray-500">{stats.response_count} lượt trả lời</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab('stats')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === 'stats' ? 'bg-[var(--primary)] text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Thống kê
        </button>
        <button
          onClick={() => setTab('responses')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === 'responses' ? 'bg-[var(--primary)] text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Danh sách trả lời
        </button>
      </div>

      {tab === 'stats' && (
        <div className="grid gap-4 lg:grid-cols-2">
          {stats.questions.map((q) => (
            <div key={q.id} className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
              <h3 className="font-medium mb-1">{q.label}</h3>
              <p className="text-xs text-gray-400 mb-3">
                {q.type} · {q.total} lượt trả lời
              </p>
              {(q.type === 'single_choice' || q.type === 'multiple_choice') && <ChoiceBars q={q} />}
              {(q.type === 'rating' || q.type === 'scale' || q.type === 'number') && <NumericStats q={q} />}
              {(q.type === 'text' || q.type === 'textarea' || q.type === 'date') && (
                <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                  {(q.texts ?? []).map((t, i) => (
                    <li key={i} className="text-sm bg-gray-50 rounded-lg px-3 py-1.5">
                      {t}
                    </li>
                  ))}
                  {(q.texts ?? []).length === 0 && (
                    <li className="text-sm text-gray-400">Chưa có câu trả lời.</li>
                  )}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'responses' && (
        <div className="rounded-xl bg-white shadow-sm border border-gray-100 divide-y divide-gray-50">
          {responses.length === 0 && (
            <p className="px-4 py-8 text-center text-gray-400">Chưa có lượt trả lời nào.</p>
          )}
          {responses.map((r) => (
            <div key={r.id}>
              <button
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                className="w-full px-4 py-3 flex items-center justify-between gap-3 text-sm hover:bg-gray-50"
              >
                <span className="flex items-center gap-2 min-w-0">
                  {r.user?.avatar_url && (
                    <img src={r.user.avatar_url} alt="" className="h-7 w-7 rounded-full" />
                  )}
                  <span className="font-medium truncate">{r.user?.name ?? `User #${r.user_id}`}</span>
                  <span className="text-gray-400 hidden sm:inline truncate">{r.user?.email}</span>
                </span>
                <span className="text-gray-400 shrink-0">
                  {new Date(r.created_at).toLocaleString('vi-VN')} {expanded === r.id ? '▲' : '▼'}
                </span>
              </button>
              {expanded === r.id && (
                <dl className="px-4 pb-4 space-y-2">
                  {Object.entries(r.answers).map(([qid, v]) => (
                    <div key={qid} className="text-sm">
                      <dt className="text-gray-500">{questionLabel(qid)}</dt>
                      <dd className="font-medium">{formatAnswer(qid, v)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
