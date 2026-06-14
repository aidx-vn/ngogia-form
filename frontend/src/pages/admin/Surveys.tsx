import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import type { AdminSurveyItem, Survey } from '../../types'

const SCHEMA_TEMPLATE = `{
  "questions": [
    {
      "id": "q1",
      "type": "single_choice",
      "label": "Câu hỏi một lựa chọn?",
      "required": true,
      "options": [
        { "value": "a", "label": "Lựa chọn A" },
        { "value": "b", "label": "Lựa chọn B" }
      ]
    },
    {
      "id": "q2",
      "type": "multiple_choice",
      "label": "Câu hỏi nhiều lựa chọn?",
      "required": false,
      "options": [
        { "value": "x", "label": "Mục X" },
        { "value": "y", "label": "Mục Y" }
      ]
    },
    { "id": "q3", "type": "rating", "label": "Đánh giá sao (1-5)", "required": true, "min": 1, "max": 5 },
    { "id": "q4", "type": "scale", "label": "Thang điểm 0-10", "required": false, "min": 0, "max": 10 },
    { "id": "q5", "type": "text", "label": "Câu trả lời ngắn", "required": false },
    { "id": "q6", "type": "textarea", "label": "Câu trả lời dài", "required": false },
    { "id": "q7", "type": "number", "label": "Nhập một con số", "required": false, "min": 0 },
    { "id": "q8", "type": "date", "label": "Chọn ngày", "required": false }
  ]
}`

const statusLabels: Record<string, string> = {
  draft: 'Nháp',
  active: 'Đang mở',
  closed: 'Đã đóng',
}
const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-green-100 text-green-700',
  closed: 'bg-red-100 text-red-600',
}

interface EditorState {
  id?: number
  title: string
  description: string
  status: string
  schemaText: string
}

function Editor({
  initial,
  onClose,
  onSaved,
}: {
  initial: EditorState
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState(initial)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    let schema: unknown
    try {
      schema = JSON.parse(form.schemaText)
    } catch {
      setError('Schema không phải JSON hợp lệ')
      return
    }
    setSaving(true)
    setError('')
    try {
      const body = JSON.stringify({
        title: form.title,
        description: form.description,
        status: form.status,
        schema,
      })
      if (form.id) {
        await api(`/admin/surveys/${form.id}`, { method: 'PUT', body })
      } else {
        await api('/admin/surveys', { method: 'POST', body })
      }
      onSaved()
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]'

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100 space-y-4">
      <h2 className="font-semibold text-lg">{form.id ? `Sửa khảo sát #${form.id}` : 'Tạo khảo sát mới'}</h2>
      <div>
        <label className="block text-sm font-medium mb-1">Tiêu đề</label>
        <input
          className={inputClass}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Mô tả</label>
        <textarea
          rows={2}
          className={inputClass}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Trạng thái</label>
        <select
          className={inputClass}
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
        >
          <option value="draft">Nháp</option>
          <option value="active">Đang mở</option>
          <option value="closed">Đã đóng</option>
        </select>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium">Schema câu hỏi (JSON)</label>
          <button
            type="button"
            className="text-xs text-[var(--primary)]"
            onClick={() => setForm({ ...form, schemaText: SCHEMA_TEMPLATE })}
          >
            Chèn mẫu đầy đủ
          </button>
        </div>
        <textarea
          rows={14}
          spellCheck={false}
          className={`${inputClass} font-mono text-xs`}
          value={form.schemaText}
          onChange={(e) => setForm({ ...form, schemaText: e.target.value })}
        />
        <p className="text-xs text-gray-400 mt-1">
          Loại câu hỏi: single_choice, multiple_choice, text, textarea, rating, scale, number, date
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg bg-[var(--primary)] text-white font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Đang lưu…' : 'Lưu'}
        </button>
        <button onClick={onClose} className="px-6 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50">
          Hủy
        </button>
      </div>
    </div>
  )
}

export default function Surveys() {
  const [surveys, setSurveys] = useState<AdminSurveyItem[] | null>(null)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [error, setError] = useState('')

  const load = () => {
    api<AdminSurveyItem[]>('/admin/surveys')
      .then(setSurveys)
      .catch((e) => setError(e.message))
  }
  useEffect(load, [])

  const edit = async (id: number) => {
    const s = await api<Survey>(`/admin/surveys/${id}`)
    setEditor({
      id: s.id,
      title: s.title,
      description: s.description,
      status: s.status,
      schemaText: JSON.stringify(s.schema, null, 2),
    })
  }

  const remove = async (s: AdminSurveyItem) => {
    if (!confirm(`Xóa khảo sát "${s.title}" cùng ${s.response_count} lượt trả lời?`)) return
    await api(`/admin/surveys/${s.id}`, { method: 'DELETE' })
    load()
  }

  if (error) return <p className="text-red-600">{error}</p>
  if (!surveys) return <p className="text-gray-400">Đang tải…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quản lý khảo sát</h1>
        <button
          onClick={() =>
            setEditor({ title: '', description: '', status: 'draft', schemaText: SCHEMA_TEMPLATE })
          }
          className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white font-medium hover:opacity-90"
        >
          + Tạo mới
        </button>
      </div>

      {editor && (
        <Editor
          initial={editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null)
            load()
          }}
        />
      )}

      <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="px-4 py-3">Tiêu đề</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Trả lời</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {surveys.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-medium">
                  <Link to={`/admin/surveys/${s.id}`} className="hover:text-[var(--primary)]">
                    {s.title}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[s.status]}`}>
                    {statusLabels[s.status]}
                  </span>
                </td>
                <td className="px-4 py-3">{s.response_count}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <Link to={`/admin/surveys/${s.id}`} className="text-[var(--primary)] mr-3">
                    Chi tiết
                  </Link>
                  <button onClick={() => edit(s.id)} className="text-gray-600 hover:text-gray-900 mr-3">
                    Sửa
                  </button>
                  <button onClick={() => remove(s)} className="text-red-500 hover:text-red-700">
                    Xóa
                  </button>
                </td>
              </tr>
            ))}
            {surveys.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  Chưa có khảo sát nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
