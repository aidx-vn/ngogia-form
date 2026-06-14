import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { api } from '../api'
import { useApp } from '../context'
import QuestionField from '../components/QuestionField'
import type { AnswerValue, Question, Survey, SurveyResponse } from '../types'

function validate(q: Question, value: AnswerValue | undefined): string {
  const empty =
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  if (empty) return q.required ? 'Câu hỏi này là bắt buộc' : ''
  if ((q.type === 'number' || q.type === 'rating' || q.type === 'scale') && typeof value === 'number') {
    if (q.min !== undefined && value < q.min) return `Giá trị tối thiểu là ${q.min}`
    if (q.max !== undefined && value > q.max) return `Giá trị tối đa là ${q.max}`
  }
  return ''
}

export default function SurveyPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useApp()
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [existing, setExisting] = useState<SurveyResponse | null>(null)
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loadError, setLoadError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    Promise.all([
      api<Survey>(`/surveys/${id}`),
      api<SurveyResponse | null>(`/surveys/${id}/my-response`),
    ])
      .then(([s, r]) => {
        setSurvey(s)
        setExisting(r)
        if (!r && user?.profile) {
          setAnswers(user.profile as Record<string, AnswerValue>)
        }
      })
      .catch((e) => setLoadError(e.message))
  }, [id, user])

  if (loadError) return <p className="text-red-600">{loadError}</p>
  if (!survey) return <p className="text-gray-400">Đang tải…</p>

  if (existing) {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-xl font-bold mb-2">Bạn đã trả lời khảo sát này</h1>
        <p className="text-gray-500 mb-6">
          Cảm ơn bạn! Mỗi người chỉ trả lời một lần cho mỗi khảo sát.
        </p>
        <Link to="/" className="text-[var(--primary)] font-medium">
          ← Quay lại danh sách
        </Link>
      </div>
    )
  }

  const questions = survey.schema?.questions ?? []

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    for (const q of questions) {
      const msg = validate(q, answers[q.id])
      if (msg) errs[q.id] = msg
    }
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      document.getElementById(Object.keys(errs)[0])?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setSubmitting(true)
    setSubmitError('')
    try {
      // Drop empty optional answers before sending.
      const payload: Record<string, AnswerValue> = {}
      for (const q of questions) {
        const v = answers[q.id]
        if (v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)) payload[q.id] = v
      }
      await api(`/surveys/${id}/responses`, {
        method: 'POST',
        body: JSON.stringify({ answers: payload }),
      })
      navigate('/thanks')
    } catch (err) {
      setSubmitError((err as Error).message)
      setSubmitting(false)
    }
  }

  const answeredCount = questions.filter((q) => {
    const v = answers[q.id]
    return v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)
  }).length

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{survey.title}</h1>
        <p className="text-gray-500 mt-1">{survey.description}</p>
        <div className="mt-4 h-1.5 rounded-full bg-gray-200 overflow-hidden">
          <div
            className="h-full bg-[var(--primary)] transition-all"
            style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {answeredCount}/{questions.length} câu đã trả lời
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {questions.map((q) => (
          <div key={q.id} id={q.id}>
            <QuestionField
              question={q}
              value={answers[q.id]}
              onChange={(v) => {
                setAnswers((a) => ({ ...a, [q.id]: v }))
                setErrors((e) => ({ ...e, [q.id]: '' }))
              }}
              error={errors[q.id]}
            />
          </div>
        ))}

        {submitError && <p className="text-red-600">{submitError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full sm:w-auto px-8 py-3 rounded-xl bg-[var(--primary)] text-white font-semibold hover:opacity-90 disabled:opacity-50 transition"
        >
          {submitting ? 'Đang gửi…' : 'Gửi câu trả lời'}
        </button>
      </form>
    </div>
  )
}
