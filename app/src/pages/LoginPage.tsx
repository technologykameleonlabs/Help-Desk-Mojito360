import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const userId = data.user?.id
    if (!userId) {
      setError('No se pudo validar el usuario.')
      setLoading(false)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_active')
      .eq('id', userId)
      .single()

    if (profileError) {
      setError('No se pudo validar el estado del usuario.')
      setLoading(false)
      return
    }

    if (!profile?.is_active) {
      await supabase.auth.signOut()
      setError('Tu usuario está inactivo. Contacta al administrador.')
      setLoading(false)
      return
    }

    navigate('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F7F8]">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg border border-[#E0E0E1]">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#3F4444]">
            Mojito<span className="text-[#6353FF]">360</span>
          </h1>
          <p className="text-[#8A8F8F] mt-2">Help Desk</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

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

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[#3F4444] mb-2">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-[#E0E0E1] rounded-xl text-[#3F4444] placeholder-[#B0B5B5] focus:outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-6 bg-[#6353FF] hover:bg-[#5244e6] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-full transition-colors lowercase"
          >
            {loading ? 'iniciando sesión...' : 'iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  )
}
