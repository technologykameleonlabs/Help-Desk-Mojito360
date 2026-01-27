import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const MIN_PASSWORD_LENGTH = 8

export function ResetPasswordPage() {
  const [isRecovery, setIsRecovery] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setIsRecovery(true)
        }
        setLoading(false)
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`)
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setSubmitting(false)
      return
    }

    await supabase.auth.signOut()
    setSubmitting(false)
    navigate('/login?reset=success', { replace: true })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F8]">
        <div className="text-[#8A8F8F]">Cargando...</div>
      </div>
    )
  }

  if (!isRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F8]">
        <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg border border-[#E0E0E1]">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-[#3F4444]">
              Mojito<span className="text-[#6353FF]">360</span>
            </h1>
            <p className="text-[#8A8F8F] mt-2">Restablecer contraseña</p>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-[#8A8F8F]">
              El enlace no es válido o ha expirado. Solicita uno nuevo desde la página de recuperación.
            </p>
            <Link
              to="/forgot-password"
              className="block w-full py-3 px-6 bg-[#6353FF] hover:bg-[#5244e6] text-white font-semibold rounded-full transition-colors text-center lowercase"
            >
              solicitar nuevo enlace
            </Link>
            <Link
              to="/login"
              className="block text-center text-sm text-[#6353FF] hover:underline"
            >
              volver al inicio de sesión
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F7F8]">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg border border-[#E0E0E1]">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#3F4444]">
            Mojito<span className="text-[#6353FF]">360</span>
          </h1>
          <p className="text-[#8A8F8F] mt-2">Nueva contraseña</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[#3F4444] mb-2">
              Nueva contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#3F4444] mb-2">
              Confirmar contraseña
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
            disabled={submitting}
            className="w-full py-3 px-6 bg-[#6353FF] hover:bg-[#5244e6] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-full transition-colors lowercase"
          >
            {submitting ? 'guardando...' : 'guardar nueva contraseña'}
          </button>

          <Link
            to="/login"
            className="block text-center text-sm text-[#6353FF] hover:underline"
          >
            cancelar e ir al inicio de sesión
          </Link>
        </form>
      </div>
    </div>
  )
}
