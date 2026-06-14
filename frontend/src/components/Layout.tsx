import { useState, useRef, useEffect } from 'react'
import { Link, NavLink, Outlet, Navigate, useLocation } from 'react-router-dom'
import { useApp } from '../context'
import { api } from '../api'

export default function Layout() {
  const { user, settings, loading, logout } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleDeleteAccount() {
    setDeleting(true)
    try {
      await api('/auth/me', { method: 'DELETE' })
      window.location.href = '/login'
    } catch {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Đang tải…
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition ${
      isActive ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'text-gray-600 hover:bg-gray-100'
    }`

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="logo" className="h-8 w-8 rounded object-contain" />
            ) : (
              <span className="h-8 w-8 rounded-lg bg-[var(--primary)] inline-flex items-center justify-center text-white font-bold">
                {settings.app_name.charAt(0)}
              </span>
            )}
            <span className="font-semibold truncate">{settings.app_name}</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            <NavLink to="/" end className={navClass}>
              Khảo sát
            </NavLink>
            {user.role === 'admin' && (
              <NavLink to="/admin" className={navClass}>
                Quản trị
              </NavLink>
            )}
          </nav>

          <div className="flex items-center gap-2">
            {/* Profile dropdown */}
            <div className="relative hidden sm:block" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-gray-100 transition"
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="h-8 w-8 rounded-full" />
                ) : (
                  <span className="h-8 w-8 rounded-full bg-gray-200 inline-flex items-center justify-center text-sm font-medium">
                    {user.name.charAt(0)}
                  </span>
                )}
                <span className="hidden md:inline text-sm text-gray-600 max-w-32 truncate">{user.name}</span>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                    {user.email && <p className="text-xs text-gray-500 truncate">{user.email}</p>}
                  </div>
                  <button
                    onClick={() => { setProfileOpen(false); logout() }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Đăng xuất
                  </button>
                  <button
                    onClick={() => { setProfileOpen(false); setShowDeleteConfirm(true) }}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    Xóa tài khoản…
                  </button>
                </div>
              )}
            </div>

            <button
              className="sm:hidden p-2 text-gray-600"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu"
            >
              ☰
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="sm:hidden border-t border-gray-100 px-4 py-2 flex flex-col gap-1 bg-white">
            <div className="px-3 py-2 border-b border-gray-100 mb-1">
              <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
              {user.email && <p className="text-xs text-gray-500 truncate">{user.email}</p>}
            </div>
            <NavLink to="/" end className={navClass} onClick={() => setMenuOpen(false)}>
              Khảo sát
            </NavLink>
            {user.role === 'admin' && (
              <NavLink to="/admin" className={navClass} onClick={() => setMenuOpen(false)}>
                Quản trị
              </NavLink>
            )}
            <button onClick={() => { setMenuOpen(false); logout() }} className="text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
              Đăng xuất
            </button>
            <button
              onClick={() => { setMenuOpen(false); setShowDeleteConfirm(true) }}
              className="text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
            >
              Xóa tài khoản…
            </button>
          </nav>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Xóa tài khoản?</h2>
            <p className="text-sm text-gray-600 mb-4">
              Toàn bộ dữ liệu cá nhân và câu trả lời khảo sát của bạn sẽ bị xóa vĩnh viễn.
              Hành động này <strong>không thể hoàn tác</strong>.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Đang xóa…' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
