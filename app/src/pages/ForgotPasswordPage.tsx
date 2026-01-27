import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSent(false)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F7F8]">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg border border-[#E0E0E1]">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#3F4444]">
            Mojito<span className="text-[#6353FF]">360</span>
          </h1>
          <p className="text-[#8A8F8F] mt-2">Restablecer contraseña</p>
        </div>

        {sent ? (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm">
              Si el correo está registrado, recibirás un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada y la carpeta de spam.
            </div>
            <Link
              to="/login"
              className="block w-full py-3 px-6 bg-[#6353FF] hover:bg-[#5244e6] text-white font-semibold rounded-full transition-colors text-center lowercase"
            >
              volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <p className="text-sm text-[#8A8F8F]">
              Indica el email de tu cuenta y te enviaremos un enlace para crear una nueva contraseña.
            </p>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#3F4444] mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-[#E0E0E1] rounded-xl text-[#3F4444] placeholder-[#B0B5B5] focus:outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all"
                placeholder="tu@email.com"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-6 bg-[#6353FF] hover:bg-[#5244e6] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-full transition-colors lowercase"
            >
              {loading ? 'enviando...' : 'enviar enlace'}
            </button>

            <Link
              to="/login"
              className="block text-center text-sm text-[#6353FF] hover:underline"
            >
              volver al inicio de sesión
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
