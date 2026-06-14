import { useEffect, useState } from 'react'
import { api } from '../../api'
import type { DashboardStats } from '../../types'

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api<DashboardStats>('/admin/stats').then(setStats).catch((e) => setError(e.message))
  }, [])

  if (error) return <p className="text-red-600">{error}</p>
  if (!stats) return <p className="text-gray-400">Đang tải…</p>

  const maxCount = Math.max(1, ...stats.responses_by_day.map((d) => d.count))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Tổng khảo sát" value={stats.total_surveys} />
        <StatCard label="Đang mở" value={stats.active_surveys} />
        <StatCard label="Lượt trả lời" value={stats.total_responses} />
        <StatCard label="Người dùng" value={stats.total_users} />
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
        <h2 className="font-semibold mb-4">Lượt trả lời 14 ngày gần nhất</h2>
        <div className="flex items-end gap-1 h-36">
          {stats.responses_by_day.map((d) => (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group">
              <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100">{d.count}</span>
              <div
                className="w-full rounded-t bg-[var(--primary)] transition-all"
                style={{ height: `${(d.count / maxCount) * 100}%`, minHeight: d.count > 0 ? 4 : 1 }}
              />
              <span className="text-[10px] text-gray-400 rotate-0 hidden sm:block">{d.day.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
        <h2 className="font-semibold mb-3">Trả lời gần đây</h2>
        {stats.recent_responses.length === 0 && (
          <p className="text-sm text-gray-400">Chưa có lượt trả lời nào.</p>
        )}
        <ul className="divide-y divide-gray-100">
          {stats.recent_responses.map((r) => (
            <li key={r.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium truncate">{r.user?.name ?? `User #${r.user_id}`}</span>
              <span className="text-gray-400 shrink-0">
                Khảo sát #{r.survey_id} · {new Date(r.created_at).toLocaleString('vi-VN')}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
