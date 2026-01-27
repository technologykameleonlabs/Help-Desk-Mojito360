import { useState } from 'react'
import { Sidebar } from '../components/Sidebar'
import { supabase } from '../lib/supabase'
import { useCurrentUser } from '../hooks/useData'
import { KeyRound, Loader2 } from 'lucide-react'

const MIN_PASSWORD_LENGTH = 8

export function AccountPage() {
  const { data: user, isLoading: loadingUser } = useCurrentUser()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!user?.email) {
      setError('No se pudo obtener tu email.')
      return
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`)
      return
    }
    if (newPassword !== confirmPassword) {
      setError('La nueva contraseña y la confirmación no coinciden.')
      return
    }

    setLoading(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })

    if (signInError) {
      setError('La contraseña actual no es correcta.')
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setLoading(false)
  }

  if (loadingUser) {
    return (
      <div className="flex h-screen bg-white overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center bg-[#F7F7F8]">
          <Loader2 className="w-8 h-8 animate-spin text-[#6353FF]" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar />
      <div className="flex-1 overflow-auto bg-[#F7F7F8]">
        <div className="max-w-xl mx-auto p-8 space-y-8">
          <header>
            <h1 className="text-lg font-semibold text-[#3F4444]">Mi cuenta</h1>
            <p className="text-sm text-[#8A8F8F] mt-1">
              {user?.full_name || 'Usuario'} · {user?.email}
            </p>
          </header>

          <section className="bg-white border border-[#E0E0E1] rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-[#3F4444] font-semibold">
              <KeyRound className="w-5 h-5" />
              Cambiar contraseña
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {success && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm">
                  Contraseña actualizada correctamente.
                </div>
              )}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-[#3F4444] mb-1.5">
                  Contraseña actual
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-[#E0E0E1] rounded-xl text-[#3F4444] placeholder-[#B0B5B5] focus:outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-[#3F4444] mb-1.5">
                  Nueva contraseña
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-[#E0E0E1] rounded-xl text-[#3F4444] placeholder-[#B0B5B5] focus:outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all"
                  placeholder="••••••••"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                />
                <p className="text-xs text-[#8A8F8F] mt-1">
                  Mínimo {MIN_PASSWORD_LENGTH} caracteres.
                </p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#3F4444] mb-1.5">
                  Confirmar nueva contraseña
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-[#E0E0E1] rounded-xl text-[#3F4444] placeholder-[#B0B5B5] focus:outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all"
                  placeholder="••••••••"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-6 bg-[#6353FF] hover:bg-[#5244e6] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-full transition-colors lowercase"
              >
                {loading ? 'guardando...' : 'guardar nueva contraseña'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}
