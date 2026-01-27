import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { ConfirmModal } from '../components/ConfirmModal'
import { useCurrentUser, useEntities, useProfiles, useUpdateEntities, useUpdateEntity, useCreateEntity } from '../hooks/useData'
import { sendNotificationEmails, useCreateNotifications } from '../hooks/useNotifications'
import type { Entity } from '../lib/supabase'
import { Building2, Shield, Loader2, Users, Plus, Pencil, Trash2 } from 'lucide-react'

type EntityForm = {
  name: string
  external_id: string
  status: 'active' | 'inactive'
  usage: string
  assigned_to: string
}

export function EntitiesPage() {
  const navigate = useNavigate()
  const { data: currentUser, isLoading: loadingUser } = useCurrentUser()
  const { data: entities, isLoading: loadingEntities, isFetching } = useEntities()
  const { data: profiles, isLoading: loadingProfiles } = useProfiles()
  const updateEntity = useUpdateEntity()
  const updateEntities = useUpdateEntities()
  const createEntity = useCreateEntity()
  const createNotifications = useCreateNotifications()

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkAssignee, setBulkAssignee] = useState<string>('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftAssignee, setDraftAssignee] = useState<string>('')
  const [awaitingRefresh, setAwaitingRefresh] = useState(false)
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [pendingSingleId, setPendingSingleId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [entityToEdit, setEntityToEdit] = useState<Entity | null>(null)
  const [entityToDelete, setEntityToDelete] = useState<Entity | null>(null)
  const [createForm, setCreateForm] = useState<EntityForm>({
    name: '',
    external_id: '',
    status: 'active',
    usage: '',
    assigned_to: '',
  })
  const [editForm, setEditForm] = useState<EntityForm>({
    name: '',
    external_id: '',
    status: 'active',
    usage: '',
    assigned_to: '',
  })

  const isAdmin = currentUser?.role === 'admin'

  const isUpdating =
    updateEntity.isPending ||
    updateEntities.isPending ||
    createEntity.isPending ||
    awaitingRefresh ||
    isFetching
  const isSavingEdit = Boolean(entityToEdit && updateEntity.isPending)
  const isSavingCreate = Boolean(createOpen && createEntity.isPending)
  const isDeleting = Boolean(entityToDelete && updateEntity.isPending)

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
    return entityList.filter(entity => {
      const nameMatches = entity.name.toLowerCase().includes(query)
      const assigneeEmail = entity.assigned_to_profile?.email?.toLowerCase() ?? ''
      const assigneeName = entity.assigned_to_profile?.full_name?.toLowerCase() ?? ''
      const assigneeMatches =
        assigneeEmail.includes(query) || assigneeName.includes(query)
      return nameMatches || assigneeMatches
    })
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
    const currentEntity = entityList.find(entity => entity.id === editingId)
    const previousAssignee = currentEntity?.assigned_to ?? null
    const nextAssignee = draftAssignee || null
    setAwaitingRefresh(true)
    setPendingSingleId(editingId)
    try {
      await updateEntity.mutateAsync({
        id: editingId,
        assigned_to: nextAssignee,
      })

      if (
        nextAssignee &&
        nextAssignee !== previousAssignee &&
        nextAssignee !== currentUser?.id
      ) {
        const notificationIds = await createNotifications.mutateAsync([
          {
            user_id: nextAssignee,
            entity_id: editingId,
            type: 'entity_assignment',
            triggered_by: currentUser?.id ?? null,
            message: `Te asignaron como responsable de la entidad: ${currentEntity?.name || 'Entidad'}`,
          }
        ])
        await sendNotificationEmails(notificationIds)
      }
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

      const nextAssignee = bulkAssignee || null
      if (nextAssignee && nextAssignee !== currentUser?.id) {
        const selectedEntities = entityList.filter(entity => selectedIds.includes(entity.id))
        const entityNames = selectedEntities.map(entity => entity.name)
        const visibleNames = entityNames.slice(0, 5)
        const remaining = entityNames.length - visibleNames.length
        const summary = remaining > 0
          ? `${visibleNames.join(', ')} y ${remaining} más`
          : visibleNames.join(', ')

        const notificationIds = await createNotifications.mutateAsync([
          {
            user_id: nextAssignee,
            type: 'entity_assignment',
            triggered_by: currentUser?.id ?? null,
            message: `Te asignaron como responsable de ${entityNames.length} entidades: ${summary}`,
          }
        ])
        await sendNotificationEmails(notificationIds)
      }
    } catch (error) {
      console.error(error)
      alert('No se pudieron actualizar las entidades.')
      setAwaitingRefresh(false)
      setBulkUpdating(false)
    }
  }

  const handleCreateOpen = () => {
    setCreateForm({ name: '', external_id: '', status: 'active', usage: '', assigned_to: '' })
    setCreateOpen(true)
  }

  const handleCreateConfirm = async () => {
    if (!createForm.name.trim()) {
      alert('El nombre es obligatorio.')
      return
    }
    try {
      await createEntity.mutateAsync({
        name: createForm.name.trim(),
        external_id: createForm.external_id.trim() || null,
        status: createForm.status,
        usage: createForm.usage.trim() || null,
        assigned_to: createForm.assigned_to || null,
      })
      setCreateOpen(false)
    } catch (err) {
      console.error(err)
      alert('No se pudo crear la entidad.')
    }
  }

  const handleEditOpen = (entity: Entity) => {
    setEntityToEdit(entity)
    setEditForm({
      name: entity.name ?? '',
      external_id: entity.external_id ?? '',
      status: (entity.status as 'active' | 'inactive') ?? 'active',
      usage: entity.usage ?? '',
      assigned_to: entity.assigned_to ?? '',
    })
  }

  const handleEditConfirm = async () => {
    if (!entityToEdit) return
    if (!editForm.name.trim()) {
      alert('El nombre es obligatorio.')
      return
    }
    try {
      await updateEntity.mutateAsync({
        id: entityToEdit.id,
        name: editForm.name.trim(),
        external_id: editForm.external_id.trim() || null,
        status: editForm.status,
        usage: editForm.usage.trim() || null,
        assigned_to: editForm.assigned_to || null,
      })
      setEntityToEdit(null)
    } catch (err) {
      console.error(err)
      alert('No se pudo actualizar la entidad.')
    }
  }

  const handleDeleteOpen = (entity: Entity) => {
    setEntityToDelete(entity)
  }

  const handleDeleteConfirm = async () => {
    if (!entityToDelete) return
    try {
      await updateEntity.mutateAsync({
        id: entityToDelete.id,
        status: 'inactive',
      })
      setEntityToDelete(null)
    } catch (err) {
      console.error(err)
      alert('No se pudo eliminar la entidad.')
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
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCreateOpen}
                disabled={isUpdating}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-[#6353FF] hover:bg-[#5244e6] text-white rounded-xl transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Crear entidad
              </button>
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
            </div>
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
                placeholder="Buscar entidad o responsable..."
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
                      <th className="px-4 py-3 text-left w-28">Acciones</th>
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
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditOpen(entity)}
                              disabled={isUpdating}
                              className="p-1.5 rounded-lg text-[#8A8F8F] hover:text-[#6353FF] hover:bg-[rgba(99,83,255,0.1)] transition-colors disabled:opacity-50"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteOpen(entity)}
                              disabled={isUpdating}
                              className="p-1.5 rounded-lg text-[#8A8F8F] hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredEntities.length === 0 && !loadingEntities && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-sm text-[#8A8F8F]">
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

      <ConfirmModal
        open={entityToDelete != null}
        title="Eliminar entidad"
        description={
          entityToDelete ? (
            <div className="space-y-3 text-sm text-[#5A5F5F]">
              <p>
                ¿Eliminar la entidad <span className="font-semibold text-[#3F4444]">{entityToDelete.name}</span>?
                Dejará de estar activa y no aparecerá en la lista.
              </p>
              <p className="font-medium text-[#3F4444]">
                Esta acción no se puede deshacer.
              </p>
              <p>
                Si más adelante necesitas volver a dar de alta esta entidad, créala de nuevo con el <strong>ID externo</strong> igual al ID de Mojito y el <strong>nombre</strong> exactamente como lo tienen en Mojito, para que la integración la reconozca.
              </p>
            </div>
          ) : null
        }
        confirmText="Eliminar"
        confirmingText="Eliminando..."
        isConfirming={isDeleting}
        disableClose={isDeleting}
        onCancel={() => { if (!isDeleting) setEntityToDelete(null) }}
        onConfirm={handleDeleteConfirm}
      />

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => { if (!isSavingCreate) setCreateOpen(false) }}
            role="button"
            tabIndex={isSavingCreate ? -1 : 0}
            aria-label="Cerrar"
          />
          <div className="relative bg-white rounded-2xl shadow-xl border border-[#E0E0E1] w-full max-w-md mx-4 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-[#3F4444]">Crear entidad</h3>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-[#8A8F8F] uppercase tracking-wider mb-1">Nombre</label>
                <input
                  value={createForm.name}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30"
                  placeholder="Nombre de la entidad"
                  disabled={isSavingCreate}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#8A8F8F] uppercase tracking-wider mb-1">External ID</label>
                <input
                  value={createForm.external_id}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, external_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30"
                  placeholder="ID externo (opcional)"
                  disabled={isSavingCreate}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#8A8F8F] uppercase tracking-wider mb-1">Estado</label>
                <select
                  value={createForm.status}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
                  className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 appearance-none"
                  disabled={isSavingCreate}
                >
                  <option value="active">Activa</option>
                  <option value="inactive">Inactiva</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#8A8F8F] uppercase tracking-wider mb-1">Uso</label>
                <input
                  value={createForm.usage}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, usage: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30"
                  placeholder="Ej. Producción, Interna, Test"
                  disabled={isSavingCreate}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#8A8F8F] uppercase tracking-wider mb-1">Responsable</label>
                <select
                  value={createForm.assigned_to}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, assigned_to: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 appearance-none"
                  disabled={isSavingCreate}
                >
                  <option value="">Sin responsable</option>
                  {(profiles || []).map(p => (
                    <option key={p.id} value={p.id}>{p.email || p.full_name || p.id}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { if (!isSavingCreate) setCreateOpen(false) }}
                disabled={isSavingCreate}
                className="px-4 py-2 text-sm font-medium text-[#8A8F8F] hover:bg-[#F7F7F8] rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateConfirm}
                disabled={isSavingCreate || !createForm.name.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-[#6353FF] hover:bg-[#5244e6] text-white rounded-xl disabled:opacity-50"
              >
                {isSavingCreate && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSavingCreate ? 'Creando...' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {entityToEdit != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => { if (!isSavingEdit) setEntityToEdit(null) }}
            role="button"
            tabIndex={isSavingEdit ? -1 : 0}
            aria-label="Cerrar"
          />
          <div className="relative bg-white rounded-2xl shadow-xl border border-[#E0E0E1] w-full max-w-md mx-4 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-[#3F4444]">Editar entidad</h3>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-[#8A8F8F] uppercase tracking-wider mb-1">Nombre</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30"
                  placeholder="Nombre de la entidad"
                  disabled={isSavingEdit}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#8A8F8F] uppercase tracking-wider mb-1">External ID</label>
                <input
                  value={editForm.external_id}
                  onChange={(e) => setEditForm(prev => ({ ...prev, external_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30"
                  placeholder="ID externo (opcional)"
                  disabled={isSavingEdit}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#8A8F8F] uppercase tracking-wider mb-1">Estado</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
                  className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 appearance-none"
                  disabled={isSavingEdit}
                >
                  <option value="active">Activa</option>
                  <option value="inactive">Inactiva</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#8A8F8F] uppercase tracking-wider mb-1">Uso</label>
                <input
                  value={editForm.usage}
                  onChange={(e) => setEditForm(prev => ({ ...prev, usage: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30"
                  placeholder="Ej. Producción, Interna, Test"
                  disabled={isSavingEdit}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#8A8F8F] uppercase tracking-wider mb-1">Responsable</label>
                <select
                  value={editForm.assigned_to}
                  onChange={(e) => setEditForm(prev => ({ ...prev, assigned_to: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 appearance-none"
                  disabled={isSavingEdit}
                >
                  <option value="">Sin responsable</option>
                  {(profiles || []).map(p => (
                    <option key={p.id} value={p.id}>{p.email || p.full_name || p.id}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { if (!isSavingEdit) setEntityToEdit(null) }}
                disabled={isSavingEdit}
                className="px-4 py-2 text-sm font-medium text-[#8A8F8F] hover:bg-[#F7F7F8] rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEditConfirm}
                disabled={isSavingEdit || !editForm.name.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-[#6353FF] hover:bg-[#5244e6] text-white rounded-xl disabled:opacity-50"
              >
                {isSavingEdit && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSavingEdit ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
