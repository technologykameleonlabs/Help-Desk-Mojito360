import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { ConfirmModal } from '../components/ConfirmModal'
import { useCurrentUser, useEntities, useProfiles, useUpdateEntities, useUpdateEntity } from '../hooks/useData'
import type { Entity } from '../lib/supabase'
import { Building2, Shield, Loader2, Users } from 'lucide-react'

export function EntitiesPage() {
  const navigate = useNavigate()
  const { data: currentUser, isLoading: loadingUser } = useCurrentUser()
  const { data: entities, isLoading: loadingEntities, isFetching } = useEntities()
  const { data: profiles, isLoading: loadingProfiles } = useProfiles()
  const updateEntity = useUpdateEntity()
  const updateEntities = useUpdateEntities()

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkAssignee, setBulkAssignee] = useState<string>('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftAssignee, setDraftAssignee] = useState<string>('')
  const [awaitingRefresh, setAwaitingRefresh] = useState(false)
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [pendingSingleId, setPendingSingleId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const isAdmin = currentUser?.role === 'admin'

  const isUpdating =
    updateEntity.isPending ||
    updateEntities.isPending ||
    awaitingRefresh ||
    isFetching

  useEffect(() => {
    if (!awaitingRefresh || updateEntity.isPending || updateEntities.isPending || isFetching) return

    setAwaitingRefresh(false)

    if (bulkUpdating) {
      setBulkUpdating(false)
      setBulkOpen(false)
      setSelectedIds([])
    }

    if (pendingSingleId) {
      setPendingSingleId(null)
      setEditingId(null)
    }
  }, [awaitingRefresh, updateEntity.isPending, updateEntities.isPending, isFetching, bulkUpdating, pendingSingleId])

  const entityList = useMemo(() => entities ?? [], [entities])
  const filteredEntities = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return entityList
    return entityList.filter(entity => entity.name.toLowerCase().includes(query))
  }, [entityList, searchTerm])

  const allSelected =
    filteredEntities.length > 0 &&
    filteredEntities.every(entity => selectedIds.includes(entity.id))
  const hasSelection = selectedIds.length > 0

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
            Solo los usuarios admin pueden gestionar entidades.
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

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        filteredEntities.forEach(entity => next.add(entity.id))
        return Array.from(next)
      })
    } else {
      setSelectedIds(prev => prev.filter(id => !filteredEntities.some(entity => entity.id === id)))
    }
  }

  const handleToggleOne = (entityId: string, checked: boolean) => {
    setSelectedIds(prev => {
      if (checked) {
        return prev.includes(entityId) ? prev : [...prev, entityId]
      }
      return prev.filter(id => id !== entityId)
    })
  }

  const handleStartEdit = (entity: Entity) => {
    if (isUpdating) return
    if (editingId === entity.id) return
    setEditingId(entity.id)
    setDraftAssignee(entity.assigned_to ?? '')
  }

  const handleSaveSingle = async () => {
    if (!editingId) return
    setAwaitingRefresh(true)
    setPendingSingleId(editingId)
    try {
      await updateEntity.mutateAsync({
        id: editingId,
        assigned_to: draftAssignee || null,
      })
    } catch (error) {
      console.error(error)
      alert('No se pudo actualizar el responsable.')
      setAwaitingRefresh(false)
      setPendingSingleId(null)
    }
  }

  const handleBulkConfirm = async () => {
    if (!hasSelection) return
    setBulkUpdating(true)
    setAwaitingRefresh(true)
    try {
      await updateEntities.mutateAsync({
        ids: selectedIds,
        updates: { assigned_to: bulkAssignee || null },
      })
    } catch (error) {
      console.error(error)
      alert('No se pudieron actualizar las entidades.')
      setAwaitingRefresh(false)
      setBulkUpdating(false)
    }
  }

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar />

      <div className="flex-1 overflow-auto bg-[#F7F7F8]">
        <div className="max-w-6xl mx-auto p-8 space-y-6">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-[#3F4444]">Entidades</h1>
              <p className="text-sm text-[#8A8F8F]">Asigna responsables a las entidades activas.</p>
            </div>
            {hasSelection && (
              <button
                type="button"
                onClick={() => setBulkOpen(true)}
                disabled={isUpdating}
                className="px-4 py-2 text-sm font-semibold bg-[#6353FF] hover:bg-[#5244e6] text-white rounded-xl transition-colors disabled:opacity-50"
              >
                Cambiar Responsable
              </button>
            )}
          </header>

          <section className="bg-white border border-[#E0E0E1] rounded-2xl p-6">
            <div className="flex items-center justify-between text-[#3F4444] font-semibold mb-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Entidades registradas
              </div>
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar entidad..."
                className="w-64 px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-sm text-[#3F4444] font-normal outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all"
              />
            </div>

            {(loadingEntities || loadingProfiles) && (
              <div className="flex items-center gap-2 text-sm text-[#8A8F8F] mb-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Cargando entidades...
              </div>
            )}

            <div className="relative">
              {isUpdating && (
                <div className="absolute inset-0 bg-white/70 z-10 flex items-center justify-center rounded-xl">
                  <div className="flex items-center gap-2 text-sm text-[#3F4444]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Actualizando responsables...
                  </div>
                </div>
              )}

              <div className="border border-[#E0E0E1] rounded-xl overflow-hidden">
                <table className="min-w-full text-sm">
                  <thead className="bg-[#F7F7F8] text-[#8A8F8F] uppercase text-xs tracking-wider">
                    <tr>
                      <th className="px-4 py-3 text-left w-12">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={(e) => handleToggleAll(e.target.checked)}
                          disabled={isUpdating || entityList.length === 0}
                          className="h-4 w-4"
                        />
                      </th>
                      <th className="px-4 py-3 text-left">Entidad</th>
                      <th className="px-4 py-3 text-left">Responsable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E0E1]">
                    {filteredEntities.map(entity => (
                      <tr key={entity.id} className="text-[#3F4444]">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(entity.id)}
                            onChange={(e) => handleToggleOne(entity.id, e.target.checked)}
                            disabled={isUpdating}
                            className="h-4 w-4"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium">{entity.name}</td>
                        <td
                          className="px-4 py-3 cursor-pointer"
                          onClick={() => handleStartEdit(entity)}
                        >
                          {editingId === entity.id ? (
                            <div className="flex items-center gap-2">
                              <select
                                value={draftAssignee}
                                onChange={(e) => setDraftAssignee(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-sm text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all appearance-none"
                                disabled={isUpdating}
                              >
                                <option value="">Sin responsable</option>
                                {(profiles || []).map(profile => (
                                  <option key={profile.id} value={profile.id}>
                                    {profile.email || profile.full_name || profile.id}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={handleSaveSingle}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="px-3 py-2 text-xs font-semibold bg-[#6353FF] hover:bg-[#5244e6] text-white rounded-xl transition-colors"
                                disabled={isUpdating}
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingId(null)
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="px-3 py-2 text-xs font-medium text-[#8A8F8F] hover:text-[#3F4444] hover:bg-[#F7F7F8] rounded-xl transition-colors"
                                disabled={isUpdating}
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <span className="text-sm text-[#5A5F5F] hover:text-[#3F4444] transition-colors">
                              {entity.assigned_to_profile?.email || '---'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredEntities.length === 0 && !loadingEntities && (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-sm text-[#8A8F8F]">
                          No hay entidades para mostrar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>

      <ConfirmModal
        open={bulkOpen}
        title="Cambiar responsable"
        description={
          <div className="space-y-3 text-sm text-[#5A5F5F]">
            <p>
              Vas a cambiar el responsable de <span className="font-semibold">{selectedIds.length}</span> entidades.
            </p>
            <div className="flex items-center gap-2 text-[#3F4444] font-medium">
              <Users className="w-4 h-4" />
              Selecciona un usuario
            </div>
            <select
              value={bulkAssignee}
              onChange={(e) => setBulkAssignee(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-sm text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all appearance-none"
              disabled={isUpdating}
            >
              <option value="">Sin responsable</option>
              {(profiles || []).map(profile => (
                <option key={profile.id} value={profile.id}>
                  {profile.email || profile.full_name || profile.id}
                </option>
              ))}
            </select>
          </div>
        }
        confirmText="Aceptar"
        cancelText="Cancelar"
        isConfirming={isUpdating}
        disableClose={isUpdating}
        onCancel={() => {
          if (!isUpdating) {
            setBulkOpen(false)
          }
        }}
        onConfirm={handleBulkConfirm}
      />
    </div>
  )
}
