import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { supabase } from '../lib/supabase'
import { useCurrentUser, useProfiles } from '../hooks/useData'
import type { Profile } from '../lib/supabase'
import { UserPlus, Shield, Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

type UserFormState = {
  email: string
  password: string
  full_name: string
  role: Profile['role']
}

export function UsersPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: currentUser, isLoading: loadingUser } = useCurrentUser()
  const { data: profiles, isLoading: loadingProfiles } = useProfiles()

  const [formState, setFormState] = useState<UserFormState>({
    email: '',
    password: '',
    full_name: '',
    role: 'agent',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<{
    full_name: string
    role: Profile['role']
    is_active: boolean
  }>({
    full_name: '',
    role: 'agent',
    is_active: true,
  })
  const [message, setMessage] = useState<string | null>(null)

  const isAdmin = currentUser?.role === 'admin'

  const sortedProfiles = useMemo(() => {
    if (!profiles) return []
    return [...profiles].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
  }, [profiles])

  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F8]">
        <Loader2 className="w-8 h-8 animate-spin text-[#6353FF]" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F8]">
        <div className="bg-white border border-[#E0E0E1] rounded-2xl p-8 text-center space-y-4">
          <Shield className="w-10 h-10 text-[#8A8F8F] mx-auto" />
          <h2 className="text-lg font-semibold text-[#3F4444]">Sin permisos</h2>
          <p className="text-sm text-[#8A8F8F]">
            Solo los usuarios admin pueden gestionar usuarios.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 text-sm font-semibold bg-[#6353FF] hover:bg-[#5244e6] text-white rounded-xl transition-colors"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    )
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formState.email || !formState.password || !formState.full_name) {
      alert('Completa email, password y nombre.')
      return
    }

    setCreating(true)
    setMessage(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      let accessToken = sessionData.session?.access_token
      if (!accessToken) {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError) throw refreshError
        accessToken = refreshData.session?.access_token
      }
      if (!accessToken) {
        alert('No hay sesión activa. Inicia sesión de nuevo.')
        return
      }

      // El cliente de Supabase añade el JWT de la sesión al invoke(); no hace falta headers manuales.
      const { data: fnData, error } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'create',
          email: formState.email,
          password: formState.password,
          full_name: formState.full_name,
          role: formState.role,
        },
      })

      if (error) throw error
      const res = fnData as { error?: string }
      if (res?.error) throw new Error(res.error)

      setFormState({ email: '', password: '', full_name: '', role: 'agent' })
      await queryClient.invalidateQueries({ queryKey: ['profiles'] })
      setMessage('Usuario creado correctamente.')
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'No se pudo crear el usuario.')
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (profile: Profile) => {
    setEditingId(profile.id)
    setEditState({
      full_name: profile.full_name || '',
      role: profile.role,
      is_active: profile.is_active ?? true,
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const saveEdit = async (profile: Profile) => {
    if (!editState.full_name) {
      alert('El nombre es requerido.')
      return
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      let accessToken = sessionData.session?.access_token
      if (!accessToken) {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError) throw refreshError
        accessToken = refreshData.session?.access_token
      }
      if (!accessToken) {
        alert('No hay sesión activa. Inicia sesión de nuevo.')
        return
      }

      const { data: fnData, error } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'update',
          id: profile.id,
          full_name: editState.full_name,
          role: editState.role,
          is_active: editState.is_active,
        },
      })

      if (error) throw error
      const res = fnData as { error?: string }
      if (res?.error) throw new Error(res.error)

      await queryClient.invalidateQueries({ queryKey: ['profiles'] })
      setEditingId(null)
      setMessage('Usuario actualizado correctamente.')
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'No se pudo actualizar el usuario.')
    }
  }

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar />

      <div className="flex-1 overflow-auto bg-[#F7F7F8]">
        <div className="max-w-5xl mx-auto p-8 space-y-8">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-[#3F4444]">Usuarios</h1>
              <p className="text-sm text-[#8A8F8F]">Gestiona accesos y roles del sistema.</p>
            </div>
          </header>

          <section className="bg-white border border-[#E0E0E1] rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-[#3F4444] font-semibold">
              <UserPlus className="w-5 h-5" />
              Crear usuario
            </div>
            <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#8A8F8F] uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={formState.email}
                  onChange={(e) => setFormState(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-sm text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#8A8F8F] uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formState.password}
                    onChange={(e) => setFormState(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-sm text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all pr-20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#6353FF] hover:text-[#5244e6] transition-colors"
                  >
                    {showPassword ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#8A8F8F] uppercase tracking-wider mb-1.5">
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={formState.full_name}
                  onChange={(e) => setFormState(prev => ({ ...prev, full_name: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-sm text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#8A8F8F] uppercase tracking-wider mb-1.5">
                  Rol
                </label>
                <select
                  value={formState.role}
                  onChange={(e) => setFormState(prev => ({ ...prev, role: e.target.value as Profile['role'] }))}
                  className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-sm text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all appearance-none"
                >
                  <option value="admin">Admin</option>
                  <option value="agent">Agent</option>
                  <option value="client">Client</option>
                  <option value="dev">Dev</option>
                </select>
              </div>
              <div className="md:col-span-2 flex items-center justify-between">
                <div className="text-sm text-[#2E7D32]">{message}</div>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 text-sm font-semibold bg-[#6353FF] hover:bg-[#5244e6] text-white rounded-xl transition-colors disabled:opacity-50"
                >
                  {creating ? 'Creando...' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </section>

          <section className="bg-white border border-[#E0E0E1] rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-[#3F4444]">Usuarios registrados</h2>
            {loadingProfiles ? (
              <div className="flex items-center gap-2 text-sm text-[#8A8F8F]">
                <Loader2 className="w-4 h-4 animate-spin" />
                Cargando usuarios...
              </div>
            ) : (
              <div className="space-y-3">
                {sortedProfiles.map(profile => (
                  <div
                    key={profile.id}
                    className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border border-[#E0E0E1] rounded-xl p-4"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#3F4444]">
                        {profile.full_name || 'Sin nombre'}
                      </p>
                      <p className="text-xs text-[#8A8F8F]">{profile.email || 'Sin email'}</p>
                    </div>
                    <div className="flex-1 flex items-center gap-3">
                      {editingId === profile.id ? (
                        <>
                          <input
                            type="text"
                            value={editState.full_name}
                            onChange={(e) => setEditState(prev => ({ ...prev, full_name: e.target.value }))}
                            className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-sm text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all"
                          />
                          <select
                            value={editState.role}
                            onChange={(e) => setEditState(prev => ({ ...prev, role: e.target.value as Profile['role'] }))}
                            className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-sm text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all appearance-none"
                          >
                            <option value="admin">Admin</option>
                            <option value="agent">Agent</option>
                            <option value="client">Client</option>
                            <option value="dev">Dev</option>
                          </select>
                          <select
                            value={editState.is_active ? 'active' : 'inactive'}
                            onChange={(e) => setEditState(prev => ({ ...prev, is_active: e.target.value === 'active' }))}
                            className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-sm text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all appearance-none"
                          >
                            <option value="active">Activo</option>
                            <option value="inactive">Inactivo</option>
                          </select>
                        </>
                      ) : (
                        <div className="flex-1 text-sm text-[#5A5F5F]">
                          <span className="inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-semibold bg-[#F7F7F8] border border-[#E0E0E1]">
                            {profile.role}
                          </span>
                          <span
                            className={`ml-2 inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-semibold border ${
                              profile.is_active
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-red-50 text-red-600 border-red-200'
                            }`}
                          >
                            {profile.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {editingId === profile.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => saveEdit(profile)}
                            className="px-3 py-2 text-xs font-semibold bg-[#6353FF] hover:bg-[#5244e6] text-white rounded-xl transition-colors"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="px-3 py-2 text-xs font-medium text-[#8A8F8F] hover:text-[#3F4444] hover:bg-[#F7F7F8] rounded-xl transition-colors"
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(profile)}
                          className="px-3 py-2 text-xs font-medium text-[#6353FF] hover:bg-[rgba(99,83,255,0.1)] rounded-xl transition-colors"
                        >
                          Editar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {sortedProfiles.length === 0 && (
                  <div className="text-sm text-[#8A8F8F]">No hay usuarios aún.</div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
