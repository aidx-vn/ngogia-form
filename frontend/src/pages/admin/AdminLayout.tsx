import { Navigate, NavLink, Outlet } from 'react-router-dom'
import { useApp } from '../../context'

export default function AdminLayout() {
  const { user, loading } = useApp()

  if (loading) return null
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />

  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
      isActive ? 'bg-[var(--primary)] text-white' : 'text-gray-600 hover:bg-gray-100'
    }`

  return (
    <div>
      <nav className="flex gap-2 mb-6 overflow-x-auto">
        <NavLink to="/admin" end className={tabClass}>
          Dashboard
        </NavLink>
        <NavLink to="/admin/surveys" className={tabClass}>
          Khảo sát
        </NavLink>
        <NavLink to="/admin/settings" className={tabClass}>
          Giao diện
        </NavLink>
      </nav>
      <Outlet />
    </div>
  )
}
