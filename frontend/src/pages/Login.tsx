import { useApp } from '../context'
import { Navigate } from 'react-router-dom'

export default function Login() {
  const { user, providers, settings, loading } = useApp()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-center text-gray-600">Đang tải…</p>
      </div>
    )
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  const logoChar = settings.app_name.charAt(0).toUpperCase()

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full">
        {/* Logo */}
        {settings.logo_url ? (
          <div className="flex justify-center mb-6">
            <img src={settings.logo_url} alt="Logo" className="h-12" />
          </div>
        ) : (
          <div
            className="flex justify-center mb-6"
            style={{ '--primary': settings.primary_color } as React.CSSProperties}
          >
            <div
              className="h-12 w-12 rounded-full bg-[var(--primary)] flex items-center justify-center text-white font-bold text-lg"
            >
              {logoChar}
            </div>
          </div>
        )}

        {/* Title and Subtitle */}
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
          {settings.app_name}
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Đăng nhập để tham gia khảo sát
        </p>

        {/* Login Buttons */}
        <div className="space-y-4">
          {providers.includes('google') && (
            <a
              href="/api/auth/google/login"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg font-medium border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 transition"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Tiếp tục với Google
            </a>
          )}

          {providers.includes('facebook') && (
            <a
              href="/api/auth/facebook/login"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg font-medium bg-[#1877F2] text-white hover:bg-[#165FD8] transition"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Tiếp tục với Facebook
            </a>
          )}

          {providers.includes('dev') && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-gray-300"></div>
                <span className="text-sm text-gray-500">— hoặc (chế độ dev) —</span>
                <div className="flex-1 border-t border-gray-300"></div>
              </div>
              <div className="space-y-2">
                <a
                  href="/api/auth/dev/login?role=user"
                  className="flex items-center justify-center w-full py-2.5 rounded-lg font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition text-sm"
                >
                  Đăng nhập Dev (Người dùng)
                </a>
                <a
                  href="/api/auth/dev/login?role=admin"
                  className="flex items-center justify-center w-full py-2.5 rounded-lg font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition text-sm"
                >
                  Đăng nhập Dev (Quản trị)
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
