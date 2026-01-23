import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { ConfirmModal } from '../components/ConfirmModal'
import { useCurrentUser, useEntities, useSlaPolicies, useCreateSlaPolicy, useUpdateSlaPolicy, useDeleteSlaPolicy, useSlaThresholds, useCreateSlaThreshold, useUpdateSlaThreshold, useDeleteSlaThreshold } from '../hooks/useData'
import type { SlaPolicy, SlaThreshold, TicketPriority } from '../lib/supabase'
import { Loader2, Shield, Sliders, Plus, Pencil, Trash2, Filter } from 'lucide-react'

const APPLICATION_OPTIONS = ['Mojito360', 'Wintruck', 'Odoo', 'Otros']

type PolicyFormState = {
  name: string
  description: string
  is_active: boolean
}

type ThresholdFormState = {
  policy_id: string
  priority: TicketPriority | ''
  application: string
  entity_id: string
  warning_minutes: string
  breach_minutes: string
}

export function SlaSettingsPage() {
  const navigate = useNavigate()
  const { data: currentUser, isLoading: loadingUser } = useCurrentUser()
  const { data: policies, isLoading: loadingPolicies } = useSlaPolicies()
  const { data: entities } = useEntities()
  const [policyFilter, setPolicyFilter] = useState<string>('')
  const { data: thresholds, isLoading: loadingThresholds } = useSlaThresholds(policyFilter || undefined)

  const createPolicy = useCreateSlaPolicy()
  const updatePolicy = useUpdateSlaPolicy()
  const deletePolicy = useDeleteSlaPolicy()
  const createThreshold = useCreateSlaThreshold()
  const updateThreshold = useUpdateSlaThreshold()
  const deleteThreshold = useDeleteSlaThreshold()

  const [policyModalOpen, setPolicyModalOpen] = useState(false)
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null)
  const [policyForm, setPolicyForm] = useState<PolicyFormState>({
    name: '',
    description: '',
    is_active: true,
  })
  const [deletePolicyId, setDeletePolicyId] = useState<string | null>(null)

  const [thresholdModalOpen, setThresholdModalOpen] = useState(false)
  const [editingThresholdId, setEditingThresholdId] = useState<string | null>(null)
  const [thresholdForm, setThresholdForm] = useState<ThresholdFormState>({
    policy_id: '',
    priority: '',
    application: '',
    entity_id: '',
    warning_minutes: '',
    breach_minutes: '',
  })
  const [deleteThresholdId, setDeleteThresholdId] = useState<string | null>(null)

  const isAdmin = currentUser?.role === 'admin'
  const isSavingPolicy = createPolicy.isPending || updatePolicy.isPending
  const isSavingThreshold = createThreshold.isPending || updateThreshold.isPending

  const sortedPolicies = useMemo(() => {
    return (policies || []).slice().sort((a, b) => a.name.localeCompare(b.name))
  }, [policies])

  const policyOptions = sortedPolicies.map(policy => ({
    value: policy.id,
    label: policy.name,
  }))

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
            Solo los usuarios admin pueden gestionar SLA.
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

  const openCreatePolicy = () => {
    setEditingPolicyId(null)
    setPolicyForm({ name: '', description: '', is_active: true })
    setPolicyModalOpen(true)
  }

  const openEditPolicy = (policy: SlaPolicy) => {
    setEditingPolicyId(policy.id)
    setPolicyForm({
      name: policy.name,
      description: policy.description || '',
      is_active: policy.is_active,
    })
    setPolicyModalOpen(true)
  }

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!policyForm.name.trim()) return
    try {
      if (editingPolicyId) {
        await updatePolicy.mutateAsync({
          id: editingPolicyId,
          name: policyForm.name.trim(),
          description: policyForm.description.trim() || null,
          is_active: policyForm.is_active,
        })
      } else {
        await createPolicy.mutateAsync({
          name: policyForm.name.trim(),
          description: policyForm.description.trim() || null,
          is_active: policyForm.is_active,
        })
      }
      setPolicyModalOpen(false)
    } catch (error) {
      console.error(error)
      alert('No se pudo guardar la política.')
    }
  }

  const handleDeletePolicy = async () => {
    if (!deletePolicyId) return
    try {
      await deletePolicy.mutateAsync(deletePolicyId)
      setDeletePolicyId(null)
    } catch (error) {
      console.error(error)
      alert('No se pudo eliminar la política.')
    }
  }

  const openCreateThreshold = () => {
    setEditingThresholdId(null)
    setThresholdForm({
      policy_id: policyFilter || '',
      priority: '',
      application: '',
      entity_id: '',
      warning_minutes: '',
      breach_minutes: '',
    })
    setThresholdModalOpen(true)
  }

  const openEditThreshold = (threshold: SlaThreshold) => {
    setEditingThresholdId(threshold.id)
    setThresholdForm({
      policy_id: threshold.policy_id,
      priority: threshold.priority || '',
      application: threshold.application || '',
      entity_id: threshold.entity_id || '',
      warning_minutes: String(threshold.warning_minutes ?? ''),
      breach_minutes: String(threshold.breach_minutes ?? ''),
    })
    setThresholdModalOpen(true)
  }

  const handleSaveThreshold = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!thresholdForm.policy_id) {
      alert('Selecciona una política.')
      return
    }
    const warningValue = Number(thresholdForm.warning_minutes)
    const breachValue = Number(thresholdForm.breach_minutes)
    if (!Number.isFinite(warningValue) || !Number.isFinite(breachValue)) {
      alert('Completa los minutos de alerta y vencimiento.')
      return
    }
    try {
      if (editingThresholdId) {
        await updateThreshold.mutateAsync({
          id: editingThresholdId,
          policy_id: thresholdForm.policy_id,
          priority: thresholdForm.priority || null,
          application: thresholdForm.application || null,
          entity_id: thresholdForm.entity_id || null,
          warning_minutes: warningValue,
          breach_minutes: breachValue,
        })
      } else {
        await createThreshold.mutateAsync({
          policy_id: thresholdForm.policy_id,
          priority: thresholdForm.priority || null,
          application: thresholdForm.application || null,
          entity_id: thresholdForm.entity_id || null,
          warning_minutes: warningValue,
          breach_minutes: breachValue,
        })
      }
      setThresholdModalOpen(false)
    } catch (error) {
      console.error(error)
      alert('No se pudo guardar el umbral.')
    }
  }

  const handleDeleteThreshold = async () => {
    if (!deleteThresholdId) return
    try {
      await deleteThreshold.mutateAsync(deleteThresholdId)
      setDeleteThresholdId(null)
    } catch (error) {
      console.error(error)
      alert('No se pudo eliminar el umbral.')
    }
  }

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar />
      <div className="flex-1 overflow-auto bg-[#F7F7F8]">
        <div className="max-w-6xl mx-auto p-8 space-y-6">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-[#3F4444]">Configuración de SLA</h1>
              <p className="text-sm text-[#8A8F8F]">
                Administra políticas y umbrales por prioridad, aplicación y entidad.
              </p>
            </div>
          </header>

          <section className="bg-white border border-[#E0E0E1] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E0E0E1] flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#3F4444] font-semibold">
                <Sliders className="w-5 h-5" />
                Políticas SLA
              </div>
              <button
                type="button"
                onClick={openCreatePolicy}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-[#6353FF] hover:bg-[#5244e6] text-white rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
                Crear política
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[#FAFAFA] text-[#8A8F8F] uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                    <th className="px-4 py-3 text-left font-semibold">Descripción</th>
                    <th className="px-4 py-3 text-left font-semibold">Estado</th>
                    <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0E0E1]">
                  {loadingPolicies ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-[#8A8F8F]">
                        Cargando...
                      </td>
                    </tr>
                  ) : sortedPolicies.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-[#8A8F8F]">
                        No hay políticas creadas.
                      </td>
                    </tr>
                  ) : (
                    sortedPolicies.map(policy => (
                      <tr key={policy.id} className="text-[#3F4444]">
                        <td className="px-4 py-3 font-medium">{policy.name}</td>
                        <td className="px-4 py-3 text-[#5A5F5F]">{policy.description || '---'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-semibold border ${policy.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                            {policy.is_active ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditPolicy(policy)}
                              className="p-2 text-[#8A8F8F] hover:text-[#3F4444] hover:bg-[#F7F7F8] rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletePolicyId(policy.id)}
                              className="p-2 text-[#8A8F8F] hover:text-[#D32F2F] hover:bg-[#FCEAEA] rounded-lg transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white border border-[#E0E0E1] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E0E0E1] flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 text-[#3F4444] font-semibold">
                <Filter className="w-5 h-5" />
                Umbrales SLA
              </div>
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <select
                  value={policyFilter}
                  onChange={(e) => setPolicyFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-sm text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all appearance-none min-w-[220px]"
                >
                  <option value="">Todas las políticas</option>
                  {policyOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={openCreateThreshold}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-[#6353FF] hover:bg-[#5244e6] text-white rounded-xl transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Crear umbral
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[#FAFAFA] text-[#8A8F8F] uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Política</th>
                    <th className="px-4 py-3 text-left font-semibold">Prioridad</th>
                    <th className="px-4 py-3 text-left font-semibold">Aplicación</th>
                    <th className="px-4 py-3 text-left font-semibold">Entidad</th>
                    <th className="px-4 py-3 text-left font-semibold">Alerta (min)</th>
                    <th className="px-4 py-3 text-left font-semibold">Vence (min)</th>
                    <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0E0E1]">
                  {loadingThresholds ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-[#8A8F8F]">
                        Cargando...
                      </td>
                    </tr>
                  ) : (thresholds || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-[#8A8F8F]">
                        No hay umbrales configurados.
                      </td>
                    </tr>
                  ) : (
                    (thresholds || []).map(threshold => (
                      <tr key={threshold.id} className="text-[#3F4444]">
                        <td className="px-4 py-3 font-medium">{threshold.policy?.name || '---'}</td>
                        <td className="px-4 py-3">{threshold.priority || 'Todas'}</td>
                        <td className="px-4 py-3">{threshold.application || 'Todas'}</td>
                        <td className="px-4 py-3">{threshold.entity?.name || 'Todas'}</td>
                        <td className="px-4 py-3">{threshold.warning_minutes}</td>
                        <td className="px-4 py-3">{threshold.breach_minutes}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditThreshold(threshold)}
                              className="p-2 text-[#8A8F8F] hover:text-[#3F4444] hover:bg-[#F7F7F8] rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteThresholdId(threshold.id)}
                              className="p-2 text-[#8A8F8F] hover:text-[#D32F2F] hover:bg-[#FCEAEA] rounded-lg transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      {policyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !isSavingPolicy && setPolicyModalOpen(false)}
            role="button"
            tabIndex={-1}
            aria-label="Cerrar modal"
          />
          <form
            onSubmit={handleSavePolicy}
            className="relative bg-white rounded-2xl shadow-xl border border-[#E0E0E1] w-full max-w-md mx-4 p-6 space-y-4"
          >
            <h3 className="text-lg font-semibold text-[#3F4444]">
              {editingPolicyId ? 'Editar política' : 'Crear política'}
            </h3>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#3F4444]">Nombre</label>
              <input
                value={policyForm.name}
                onChange={(e) => setPolicyForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-sm text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all"
                placeholder="Ej: SLA Soporte Estándar"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#3F4444]">Descripción</label>
              <textarea
                value={policyForm.description}
                onChange={(e) => setPolicyForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full min-h-[80px] px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-sm text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-[#5A5F5F]">
              <input
                type="checkbox"
                checked={policyForm.is_active}
                onChange={(e) => setPolicyForm(prev => ({ ...prev, is_active: e.target.checked }))}
              />
              Política activa
            </label>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPolicyModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-[#8A8F8F] hover:text-[#3F4444] hover:bg-[#F7F7F8] rounded-xl transition-colors"
                disabled={isSavingPolicy}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSavingPolicy}
                className="px-4 py-2 text-sm font-semibold bg-[#6353FF] hover:bg-[#5244e6] text-white rounded-xl transition-colors disabled:opacity-50"
              >
                {isSavingPolicy ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {thresholdModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !isSavingThreshold && setThresholdModalOpen(false)}
            role="button"
            tabIndex={-1}
            aria-label="Cerrar modal"
          />
          <form
            onSubmit={handleSaveThreshold}
            className="relative bg-white rounded-2xl shadow-xl border border-[#E0E0E1] w-full max-w-lg mx-4 p-6 space-y-4"
          >
            <h3 className="text-lg font-semibold text-[#3F4444]">
              {editingThresholdId ? 'Editar umbral' : 'Crear umbral'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <label className="block text-sm font-medium text-[#3F4444]">Política</label>
                <select
                  value={thresholdForm.policy_id}
                  onChange={(e) => setThresholdForm(prev => ({ ...prev, policy_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-sm text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all appearance-none"
                >
                  <option value="">Selecciona una política</option>
                  {policyOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[#3F4444]">Prioridad</label>
                <select
                  value={thresholdForm.priority}
                  onChange={(e) => setThresholdForm(prev => ({ ...prev, priority: e.target.value as TicketPriority | '' }))}
                  className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-sm text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all appearance-none"
                >
                  <option value="">Todas</option>
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="critical">Crítica</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[#3F4444]">Aplicación</label>
                <select
                  value={thresholdForm.application}
                  onChange={(e) => setThresholdForm(prev => ({ ...prev, application: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-sm text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all appearance-none"
                >
                  <option value="">Todas</option>
                  {APPLICATION_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="block text-sm font-medium text-[#3F4444]">Entidad</label>
                <select
                  value={thresholdForm.entity_id}
                  onChange={(e) => setThresholdForm(prev => ({ ...prev, entity_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-sm text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all appearance-none"
                >
                  <option value="">Todas</option>
                  {(entities || []).map(entity => (
                    <option key={entity.id} value={entity.id}>{entity.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[#3F4444]">Alerta (min)</label>
                <input
                  type="number"
                  min="0"
                  value={thresholdForm.warning_minutes}
                  onChange={(e) => setThresholdForm(prev => ({ ...prev, warning_minutes: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-sm text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[#3F4444]">Vence (min)</label>
                <input
                  type="number"
                  min="0"
                  value={thresholdForm.breach_minutes}
                  onChange={(e) => setThresholdForm(prev => ({ ...prev, breach_minutes: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-sm text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setThresholdModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-[#8A8F8F] hover:text-[#3F4444] hover:bg-[#F7F7F8] rounded-xl transition-colors"
                disabled={isSavingThreshold}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSavingThreshold}
                className="px-4 py-2 text-sm font-semibold bg-[#6353FF] hover:bg-[#5244e6] text-white rounded-xl transition-colors disabled:opacity-50"
              >
                {isSavingThreshold ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal
        open={!!deletePolicyId}
        title="Eliminar política"
        description="Se eliminarán también los umbrales asociados."
        confirmText="Eliminar"
        onConfirm={handleDeletePolicy}
        onCancel={() => setDeletePolicyId(null)}
        isConfirming={deletePolicy.isPending}
      />

      <ConfirmModal
        open={!!deleteThresholdId}
        title="Eliminar umbral"
        description="Esta acción no se puede deshacer."
        confirmText="Eliminar"
        onConfirm={handleDeleteThreshold}
        onCancel={() => setDeleteThresholdId(null)}
        isConfirming={deleteThreshold.isPending}
      />
    </div>
  )
}
