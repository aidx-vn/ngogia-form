import type { AnswerValue, Question } from '../types'

interface Props {
  question: Question
  value: AnswerValue | undefined
  onChange: (value: AnswerValue) => void
  error?: string
}

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent'

export default function QuestionField({ question, value, onChange, error }: Props) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
      <label className="block font-medium mb-1">
        {question.label}
        {question.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {question.help && <p className="text-sm text-gray-500 mb-3">{question.help}</p>}
      <Control question={question} value={value} onChange={onChange} />
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  )
}

function Control({ question, value, onChange }: Omit<Props, 'error'>) {
  switch (question.type) {
    case 'single_choice':
      return (
        <div className="space-y-2">
          {question.options?.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition ${
                value === opt.value
                  ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name={question.id}
                checked={value === opt.value}
                onChange={() => onChange(opt.value)}
                className="accent-[var(--primary)]"
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      )

    case 'multiple_choice': {
      const selected = Array.isArray(value) ? value : []
      const toggle = (v: string) =>
        onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v])
      return (
        <div className="space-y-2">
          {question.options?.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition ${
                selected.includes(opt.value)
                  ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="accent-[var(--primary)]"
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      )
    }

    case 'text':
      return (
        <input
          type="text"
          className={inputClass}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )

    case 'textarea':
      return (
        <textarea
          rows={4}
          className={inputClass}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )

    case 'rating': {
      const max = question.max ?? 5
      const current = typeof value === 'number' ? value : 0
      return (
        <div className="flex gap-1">
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-label={`${n} sao`}
              className={`text-3xl transition hover:scale-110 ${
                n <= current ? 'text-amber-400' : 'text-gray-300'
              }`}
            >
              ★
            </button>
          ))}
        </div>
      )
    }

    case 'scale': {
      const min = question.min ?? 0
      const max = question.max ?? 10
      return (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`h-10 w-10 rounded-lg border text-sm font-medium transition ${
                value === n
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                  : 'border-gray-300 hover:border-[var(--primary)]'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      )
    }

    case 'number':
      return (
        <input
          type="number"
          className={inputClass}
          min={question.min}
          max={question.max}
          value={value === undefined ? '' : (value as number)}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
      )

    case 'date':
      return (
        <input
          type="date"
          className={inputClass}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )

    default:
      return null
  }
}
