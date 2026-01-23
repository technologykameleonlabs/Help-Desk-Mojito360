import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { ConfirmModal } from '../components/ConfirmModal'
import { useCurrentUser, useLabels, useCreateLabel, useUpdateLabel, useDeleteLabel } from '../hooks/useData'
import { Loader2, Tag, Pencil, Trash2, Plus } from 'lucide-react'

type LabelFormState = {
  name: string
  color: string
}

export function LabelsPage() {
  const navigate = useNavigate()
  const { data: currentUser, isLoading: loadingUser } = useCurrentUser()
  const { data: labels, isLoading: loadingLabels } = useLabels()
  const createLabel = useCreateLabel()
  const updateLabel = useUpdateLabel()
  const deleteLabel = useDeleteLabel()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formState, setFormState] = useState<LabelFormState>({ name: '', color: '#6353FF' })
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const isAdmin = currentUser?.role === 'admin'
  const isSaving = createLabel.isPending || updateLabel.isPending

  const sortedLabels = useMemo(() => {
    if (!labels) return []
    return [...labels].sort((a, b) => a.name.localeCompare(b.name))
  }, [labels])

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
          <Tag className="w-10 h-10 text-[#8A8F8F] mx-auto" />
          <h2 className="text-lg font-semibold text-[#3F4444]">Sin permisos</h2>
          <p className="text-sm text-[#8A8F8F]">Solo los usuarios admin pueden gestionar labels.</p>
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

  const openCreate = () => {
    setEditingId(null)
    setFormState({ name: '', color: '#6353FF' })
    setModalOpen(true)
  }

  const openEdit = (label: { id: string; name: string; color: string }) => {
    setEditingId(label.id)
    setFormState({ name: label.name, color: label.color })
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formState.name.trim()) return
    try {
      if (editingId) {
        await updateLabel.mutateAsync({ id: editingId, ...formState })
      } else {
        await createLabel.mutateAsync(formState)
      }
      setModalOpen(false)
    } catch (error) {
      console.error(error)
      alert('No se pudo guardar el label.')
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteLabel.mutateAsync(deleteId)
      setDeleteId(null)
    } catch (error) {
      console.error(error)
      alert('No se pudo eliminar el label.')
    }
  }

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar />
      <div className="flex-1 overflow-auto bg-[#F7F7F8]">
        <div className="max-w-5xl mx-auto p-8 space-y-6">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-[#3F4444]">Labels</h1>
              <p className="text-sm text-[#8A8F8F]">Administra los labels disponibles.</p>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-[#6353FF] hover:bg-[#5244e6] text-white rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Crear label
            </button>
          </header>

          <section className="bg-white border border-[#E0E0E1] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E0E0E1] flex items-center gap-2 text-[#3F4444] font-semibold">
              <Tag className="w-5 h-5" />
              Labels registrados
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[#FAFAFA] text-[#8A8F8F] uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                    <th className="px-4 py-3 text-left font-semibold">Color</th>
                    <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0E0E1]">
                  {loadingLabels ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-[#8A8F8F]">
                        Cargando...
                      </td>
                    </tr>
                  ) : sortedLabels.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-[#8A8F8F]">
                        No hay labels creados.
                      </td>
                    </tr>
                  ) : (
                    sortedLabels.map(label => (
                      <tr key={label.id} className="text-[#3F4444]">
                        <td className="px-4 py-3">{label.name}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: label.color }}
                            />
                            <span className="text-xs text-[#8A8F8F]">{label.color}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(label)}
                              className="p-2 text-[#8A8F8F] hover:text-[#3F4444] hover:bg-[#F7F7F8] rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteId(label.id)}
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !isSaving && setModalOpen(false)}
            role="button"
            tabIndex={-1}
            aria-label="Cerrar modal"
          />
          <form
            onSubmit={handleSave}
            className="relative bg-white rounded-2xl shadow-xl border border-[#E0E0E1] w-full max-w-md mx-4 p-6 space-y-4"
          >
            <h3 className="text-lg font-semibold text-[#3F4444]">
              {editingId ? 'Editar label' : 'Crear label'}
            </h3>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#3F4444]">Nombre</label>
              <input
                value={formState.name}
                onChange={(e) => setFormState(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-sm text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all"
                placeholder="Ej: Urgente"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#3F4444]">Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={formState.color}
                  onChange={(e) => setFormState(prev => ({ ...prev, color: e.target.value }))}
                  className="w-10 h-10 border border-[#E0E0E1] rounded-lg bg-white"
                />
                <input
                  value={formState.color}
                  onChange={(e) => setFormState(prev => ({ ...prev, color: e.target.value }))}
                  className="flex-1 px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-sm text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-[#8A8F8F] hover:text-[#3F4444] hover:bg-[#F7F7F8] rounded-xl transition-colors"
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 text-sm font-semibold bg-[#6353FF] hover:bg-[#5244e6] text-white rounded-xl transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal
        open={!!deleteId}
        title="Eliminar label"
        description="Esta acción no se puede deshacer."
        confirmText="Eliminar"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        isConfirming={deleteLabel.isPending}
      />
    </div>
  )
}
