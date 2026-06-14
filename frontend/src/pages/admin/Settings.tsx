import { useState, useEffect } from 'react'
import { api } from '../../api'
import { useApp } from '../../context'
import type { Settings } from '../../types'

export default function SettingsPage() {
  const { settings, refreshSettings } = useApp()
  const [form, setForm] = useState<Settings>(settings)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    setForm(settings)
  }, [settings])

  const handleChange = (field: keyof Settings, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await api('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(form),
      })
      await refreshSettings()
      setMessage({ type: 'success', text: 'Đã lưu ✓' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Lỗi không xác định'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">Tùy chỉnh giao diện</h1>
        <p className="text-sm text-gray-500 mb-6">Thay đổi áp dụng ngay sau khi lưu.</p>

        <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100 max-w-xl space-y-5">
          {/* App Name */}
          <div>
            <label className="block text-sm font-medium mb-1">Tên ứng dụng</label>
            <input
              type="text"
              value={form.app_name}
              onChange={e => handleChange('app_name', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>

          {/* Primary Color */}
          <div>
            <label className="block text-sm font-medium mb-1">Màu chủ đạo</label>
            <div className="flex gap-3 items-center">
              <input
                type="color"
                value={form.primary_color}
                onChange={e => handleChange('primary_color', e.target.value)}
                className="h-10 w-14 cursor-pointer rounded border border-gray-300"
              />
              <input
                type="text"
                value={form.primary_color}
                onChange={e => handleChange('primary_color', e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                placeholder="#000000"
              />
            </div>
          </div>

          {/* Font Family */}
          <div>
            <label className="block text-sm font-medium mb-1">Font chữ</label>
            <select
              value={form.font_family}
              onChange={e => handleChange('font_family', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            >
              <option value="Inter">Inter</option>
              <option value="Be Vietnam Pro">Be Vietnam Pro</option>
              <option value="Roboto">Roboto</option>
              <option value="Open Sans">Open Sans</option>
              <option value="Montserrat">Montserrat</option>
              <option value="Nunito">Nunito</option>
              <option value="Lora">Lora</option>
            </select>
          </div>

          {/* Logo URL */}
          <div>
            <label className="block text-sm font-medium mb-1">Logo URL</label>
            <input
              type="text"
              value={form.logo_url}
              onChange={e => handleChange('logo_url', e.target.value)}
              placeholder="https://… (để trống dùng chữ cái đầu)"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            {form.logo_url && (
              <img
                src={form.logo_url}
                alt="Logo preview"
                className="mt-2 h-12 rounded object-contain"
              />
            )}
          </div>
        </div>

        {/* Save Button & Messages */}
        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 rounded-lg bg-[var(--primary)] text-white font-semibold hover:opacity-90 disabled:opacity-50"
          >
            Lưu thay đổi
          </button>
          {message && (
            <span
              className={
                message.type === 'success'
                  ? 'text-green-600 font-medium'
                  : 'text-red-600 font-medium'
              }
            >
              {message.text}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
