import { Link } from 'react-router-dom'

export default function ThankYou() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-20"
      style={{ '--primary': 'var(--primary)' } as React.CSSProperties}
    >
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-6">🎉</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Cảm ơn bạn đã tham gia!
        </h1>
        <p className="text-gray-600 mb-8">
          Câu trả lời của bạn đã được ghi nhận.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center bg-[var(--primary)] text-white rounded-lg px-6 py-2.5 font-medium hover:opacity-90 transition"
        >
          Xem khảo sát khác
        </Link>
      </div>
    </div>
  )
}
