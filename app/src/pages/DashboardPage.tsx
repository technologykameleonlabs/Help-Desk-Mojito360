import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { KanbanBoard } from '../components/KanbanBoard'
import { TicketDetail } from '../components/TicketDetail'
import { TicketList } from '../components/TicketList'
import { MultiSelect } from '../components/MultiSelect'
import { LayoutGrid, List, Search, X, Filter, ChevronDown, Loader2 } from 'lucide-react'
import { useRealtimeTickets } from '../hooks/useRealtime'
import { useFilteredTickets } from '../hooks/useFilteredTickets'
import { useCreateSavedView, useCurrentUser, useDeleteSavedView, useEntities, useProfiles, useSavedViews, useUpdateSavedView } from '../hooks/useData'
import { STAGES, PRIORITIES } from '../lib/supabase'
import { CATEGORY_OPTIONS } from '../lib/ticketOptions'

// Updated filters to support multi-select (arrays)
export type TicketFilters = {
  reference: string
  externalReference: string
  search: string
  priority: string[]  // Changed to array
  stage: string[]     // Changed to array
  entity: string[]    // Changed to array
  application: string[]
  category: string[]
  assignedTo: string[]
  responsible: string[]
}

type SavedViewConfig = {
  filters: TicketFilters
  view: 'kanban' | 'list'
}

type ConfirmAction =
  | { type: 'apply'; name: string; config: Record<string, unknown> }
  | { type: 'delete'; id: string; name: string }
  | { type: 'update'; name: string }

const DEFAULT_FILTERS: TicketFilters = {
  reference: '',
  externalReference: '',
  search: '',
  priority: [],
  stage: [],
  entity: [],
  application: [],
  category: [],
  assignedTo: [],
  responsible: []
}

const normalizeFilters = (input?: Partial<TicketFilters> | null): TicketFilters => ({
  reference: typeof input?.reference === 'string' ? input.reference : '',
  externalReference: typeof input?.externalReference === 'string' ? input.externalReference : '',
  search: typeof input?.search === 'string' ? input.search : '',
  priority: Array.isArray(input?.priority) ? input?.priority : [],
  stage: Array.isArray(input?.stage) ? input?.stage : [],
  entity: Array.isArray(input?.entity) ? input?.entity : [],
  application: Array.isArray(input?.application) ? input?.application : [],
  category: Array.isArray(input?.category) ? input?.category : [],
  assignedTo: Array.isArray(input?.assignedTo) ? input?.assignedTo : [],
  responsible: Array.isArray(input?.responsible) ? input?.responsible : []
})

const APPLICATIONS = ['Mojito360', 'Wintruck', 'Odoo', 'Otros']

// Convert STAGES to options format
const STAGE_OPTIONS = Object.entries(STAGES).map(([key, value]) => ({
  value: key,
  label: value.label,
  color: value.color
}))

// Convert PRIORITIES to options format
const PRIORITY_OPTIONS = Object.entries(PRIORITIES).map(([key, value]) => ({
  value: key,
  label: value.label,
  color: value.color
}))

const APPLICATION_OPTIONS = APPLICATIONS.map(app => ({ value: app, label: app }))
const CATEGORY_FILTER_OPTIONS = CATEGORY_OPTIONS.map(option => ({
  value: option.value,
  label: `${option.icon} ${option.label}`,
}))

export function DashboardPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [showFilters, setShowFilters] = useState(false)

  const [filters, setFilters] = useState<TicketFilters>(DEFAULT_FILTERS)
  const [showSavedViews, setShowSavedViews] = useState(false)
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveVisibility, setSaveVisibility] = useState<'private' | 'public'>('private')
  const [editingViewId, setEditingViewId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showVisibilityOptions, setShowVisibilityOptions] = useState(false)
  const visibilityRef = useRef<HTMLDivElement>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  
  const { data: entities } = useEntities()
  const { data: profiles } = useProfiles()
  const { data: currentUser } = useCurrentUser()
  const { data: savedViews, isLoading: isLoadingViews } = useSavedViews('dashboard')
  const createSavedView = useCreateSavedView()
  const updateSavedView = useUpdateSavedView()
  const deleteSavedView = useDeleteSavedView()
  
  // Subscribe to realtime ticket updates
  useRealtimeTickets()
  
  const handleTicketClick = (ticketId: string) => {
    navigate(`/ticket/${ticketId}`)
  }

  const updateFilter = <K extends keyof TicketFilters>(key: K, value: TicketFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS)
  }

  const canManagePublic = currentUser?.role === 'admin'

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (visibilityRef.current && !visibilityRef.current.contains(event.target as Node)) {
        setShowVisibilityOptions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const savedViewsByVisibility = useMemo(() => {
    const views = savedViews || []
    return {
      private: views.filter(view => view.visibility === 'private'),
      public: views.filter(view => view.visibility === 'public')
    }
  }, [savedViews])

  const startCreateView = () => {
    setEditingViewId(null)
    setSaveName('')
    setSaveVisibility('private')
    setSaveError(null)
    setShowSaveForm(true)
    setShowSavedViews(false)
  }

  const startEditView = (viewId: string, name: string, visibility: 'private' | 'public') => {
    setEditingViewId(viewId)
    setSaveName(name)
    setSaveVisibility(visibility)
    setSaveError(null)
    setShowSaveForm(true)
    setShowSavedViews(false)
  }

  const applySavedView = (config: Record<string, unknown>) => {
    const viewConfig = config as Partial<SavedViewConfig>
    const nextFilters = normalizeFilters(viewConfig.filters)
    setFilters(nextFilters)
    if (viewConfig.view === 'kanban' || viewConfig.view === 'list') {
      setView(viewConfig.view)
    }
    setShowSavedViews(false)
  }

  const performSaveView = async () => {
    if (!currentUser?.id) {
      setSaveError('No se pudo identificar al usuario actual.')
      return
    }

    const trimmedName = saveName.trim()
    if (!trimmedName) {
      setSaveError('El nombre de la vista es obligatorio.')
      return
    }

    if (saveVisibility === 'public' && !canManagePublic) {
      setSaveError('Solo los administradores pueden guardar vistas públicas.')
      return
    }

    setSaveError(null)
    const config: SavedViewConfig = { filters, view }

    try {
      if (editingViewId) {
        await updateSavedView.mutateAsync({
          id: editingViewId,
          name: trimmedName,
          visibility: saveVisibility,
          config
        })
      } else {
        await createSavedView.mutateAsync({
          name: trimmedName,
          owner_id: currentUser.id,
          scope: 'dashboard',
          visibility: saveVisibility,
          config
        })
      }

      setShowSaveForm(false)
      setSaveName('')
      setSaveVisibility('private')
      setEditingViewId(null)
    } catch (error) {
      setSaveError('No se pudo guardar la vista. Revisa el nombre o permisos.')
    }
  }

  const handleSaveView = async () => {
    if (!currentUser?.id) {
      setSaveError('No se pudo identificar al usuario actual.')
      return
    }

    const trimmedName = saveName.trim()
    if (!trimmedName) {
      setSaveError('El nombre de la vista es obligatorio.')
      return
    }

    if (saveVisibility === 'public' && !canManagePublic) {
      setSaveError('Solo los administradores pueden guardar vistas públicas.')
      return
    }

    if (editingViewId) {
      setConfirmAction({ type: 'update', name: trimmedName })
      return
    }

    await performSaveView()
  }

  const handleDeleteView = async (viewId: string) => {
    try {
      await deleteSavedView.mutateAsync({ id: viewId, scope: 'dashboard' })
    } catch (error) {
      setSaveError('No se pudo eliminar la vista.')
    }
  }

  const handleConfirmAction = async () => {
    if (!confirmAction) return

    if (confirmAction.type === 'apply') {
      applySavedView(confirmAction.config)
    }

    if (confirmAction.type === 'delete') {
      await handleDeleteView(confirmAction.id)
    }

    if (confirmAction.type === 'update') {
      await performSaveView()
    }

    setConfirmAction(null)
  }

  const confirmContent = useMemo(() => {
    if (!confirmAction) return null

    if (confirmAction.type === 'apply') {
      return {
        title: 'Aplicar vista',
        message: `Se reemplazarán los filtros actuales por la vista "${confirmAction.name}". ¿Deseas continuar?`,
        confirmLabel: 'Aplicar'
      }
    }

    if (confirmAction.type === 'delete') {
      return {
        title: 'Eliminar vista',
        message: `¿Seguro que deseas eliminar la vista "${confirmAction.name}"? Esta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar'
      }
    }

    return {
      title: 'Actualizar vista',
      message: `¿Confirmas actualizar la vista "${confirmAction.name}" con los filtros actuales?`,
      confirmLabel: 'Actualizar'
    }
  }, [confirmAction])

  // Count active filters (arrays with length > 0)
  const activeFilterCount = 
    (filters.reference ? 1 : 0) +
    (filters.externalReference ? 1 : 0) +
    (filters.search ? 1 : 0) +
    filters.priority.length +
    filters.stage.length +
    filters.entity.length +
    filters.application.length +
    filters.category.length +
    filters.assignedTo.length +
    filters.responsible.length

  // Convert entities and profiles to options
  const entityOptions = entities?.map(e => ({ value: e.id, label: e.name })) || []
  const profileOptions = [
    { value: 'unassigned', label: 'Sin asignar' },
    ...(profiles?.map(p => ({ value: p.id, label: p.full_name || p.email || 'Usuario' })) || [])
  ]
  const responsibleOptions = [
    { value: 'unassigned', label: 'Sin responsable' },
    ...(profiles?.map(p => ({ value: p.id, label: p.full_name || p.email || 'Usuario' })) || [])
  ]

  // List View Content Component (uses useFilteredTickets)
  function ListViewContent({ 
    filters, 
    onTicketClick 
  }: { 
    filters: TicketFilters
    onTicketClick: (ticketId: string) => void 
  }) {
    const { tickets, allTickets, isLoading } = useFilteredTickets(filters)
    
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-[#6353FF]" />
        </div>
      )
    }

    const hasFilters = activeFilterCount > 0

    return (
      <div>
        {hasFilters && (
          <div className="mb-4 text-sm text-[#8A8F8F]">
            Mostrando <span className="font-semibold text-[#3F4444]">{tickets.length}</span> de {allTickets.length} tickets
          </div>
        )}
        <TicketList tickets={tickets} onTicketClick={onTicketClick} />
      </div>
    )
  }
  
  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-hidden flex flex-col">
          {/* Header */}
          <header className="border-b border-[#E0E0E1] shrink-0 bg-white">
            <div className="h-16 flex items-center justify-between px-6 gap-4">
              <h1 className="text-lg font-semibold text-[#3F4444]">Dashboard</h1>
              
              {/* Search */}
              <div className="flex-1 max-w-md relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B0B5B5]" />
                <input
                  type="text"
                  placeholder="Buscar tickets..."
                  value={filters.search}
                  onChange={(e) => updateFilter('search', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[#F7F7F8] border border-[#E0E0E1] rounded-xl text-sm text-[#3F4444] placeholder:text-[#B0B5B5] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all"
                />
              </div>

              <div className="flex items-center gap-3">
                {/* Saved Views */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowSavedViews(prev => !prev)
                      setShowSaveForm(false)
                      setSaveError(null)
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-[#F7F7F8] text-[#5A5F5F] border border-[#E0E0E1] hover:bg-[#ECECED] transition-all"
                  >
                    Mis vistas
                    <ChevronDown className={`w-4 h-4 transition-transform ${showSavedViews ? 'rotate-180' : ''}`} />
                  </button>

                  {showSavedViews && (
                    <div className="absolute right-0 mt-2 w-72 bg-white border border-[#E0E0E1] rounded-xl shadow-lg z-20">
                      <div className="p-3 border-b border-[#E0E0E1]">
                        <button
                          onClick={startCreateView}
                          className="w-full px-3 py-2 text-sm font-medium text-white bg-[#6353FF] rounded-lg hover:bg-[#5647f5] transition-colors"
                        >
                          Guardar vista actual
                        </button>
                      </div>
                      <div className="max-h-72 overflow-auto p-3 space-y-3 text-sm">
                        {isLoadingViews && (
                          <div className="text-[#8A8F8F]">Cargando vistas...</div>
                        )}
                        {!isLoadingViews && savedViews?.length === 0 && (
                          <div className="text-[#8A8F8F]">No hay vistas guardadas.</div>
                        )}

                        {savedViewsByVisibility.private.length > 0 && (
                          <div>
                            <div className="text-[10px] uppercase font-bold text-[#8A8F8F] tracking-wider mb-2">
                              Privadas
                            </div>
                            {savedViewsByVisibility.private.map(viewItem => (
                              <div key={viewItem.id} className="flex items-center justify-between gap-2 py-1">
                                <button
                                  onClick={() => setConfirmAction({ type: 'apply', name: viewItem.name, config: viewItem.config })}
                                  className="text-left text-[#3F4444] hover:text-[#6353FF] transition-colors"
                                >
                                  {viewItem.name}
                                </button>
                                {viewItem.owner_id === currentUser?.id && (
                                  <div className="flex items-center gap-2 text-xs">
                                    <button
                                      onClick={() => startEditView(viewItem.id, viewItem.name, viewItem.visibility)}
                                      className="text-[#8A8F8F] hover:text-[#3F4444]"
                                    >
                                      Editar
                                    </button>
                                    <button
                                      onClick={() => setConfirmAction({ type: 'delete', id: viewItem.id, name: viewItem.name })}
                                      className="text-red-500 hover:text-red-600"
                                    >
                                      Eliminar
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {savedViewsByVisibility.public.length > 0 && (
                          <div>
                            <div className="text-[10px] uppercase font-bold text-[#8A8F8F] tracking-wider mb-2">
                              Públicas
                            </div>
                            {savedViewsByVisibility.public.map(viewItem => (
                              <div key={viewItem.id} className="flex items-center justify-between gap-2 py-1">
                                <button
                                  onClick={() => setConfirmAction({ type: 'apply', name: viewItem.name, config: viewItem.config })}
                                  className="text-left text-[#3F4444] hover:text-[#6353FF] transition-colors"
                                >
                                  {viewItem.name}
                                </button>
                                {canManagePublic && (
                                  <div className="flex items-center gap-2 text-xs">
                                    <button
                                      onClick={() => startEditView(viewItem.id, viewItem.name, viewItem.visibility)}
                                      className="text-[#8A8F8F] hover:text-[#3F4444]"
                                    >
                                      Editar
                                    </button>
                                    <button
                                      onClick={() => setConfirmAction({ type: 'delete', id: viewItem.id, name: viewItem.name })}
                                      className="text-red-500 hover:text-red-600"
                                    >
                                      Eliminar
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Save View Form */}
                {showSaveForm && (
                  <div className="relative">
                    <div className="absolute right-0 mt-2 w-80 bg-white border border-[#E0E0E1] rounded-xl shadow-lg z-20 p-4">
                      <div className="text-sm font-semibold text-[#3F4444] mb-3">
                        {editingViewId ? 'Editar vista' : 'Guardar vista actual'}
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block mb-1 text-[10px] uppercase font-bold text-[#8A8F8F] tracking-wider">
                            Nombre
                          </label>
                          <input
                            type="text"
                            value={saveName}
                            onChange={(e) => setSaveName(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-sm text-[#3F4444] placeholder:text-[#B0B5B5] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all"
                            placeholder="Ej: Pendientes críticos"
                          />
                        </div>
                        <div>
                          <label className="block mb-1 text-[10px] uppercase font-bold text-[#8A8F8F] tracking-wider">
                            Visibilidad
                          </label>
                          <div ref={visibilityRef} className="relative">
                            <button
                              type="button"
                              onClick={() => setShowVisibilityOptions(prev => !prev)}
                              className={`w-full flex items-center justify-between gap-2 px-3 py-2 bg-white border rounded-lg text-sm text-left transition-all ${
                                showVisibilityOptions
                                  ? 'border-[#6353FF] ring-2 ring-[#6353FF] ring-opacity-30'
                                  : 'border-[#E0E0E1] hover:border-[#B0B5B5]'
                              }`}
                            >
                              <span className="text-[#3F4444]">
                                {saveVisibility === 'public' ? 'Pública' : 'Privada'}
                              </span>
                              <ChevronDown
                                className={`w-4 h-4 text-[#8A8F8F] transition-transform ${
                                  showVisibilityOptions ? 'rotate-180' : ''
                                }`}
                              />
                            </button>
                            {showVisibilityOptions && (
                              <div className="absolute z-50 mt-1 w-full bg-white border border-[#E0E0E1] rounded-lg shadow-lg overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSaveVisibility('private')
                                    setShowVisibilityOptions(false)
                                  }}
                                  className={`w-full px-3 py-2 text-sm text-left transition-colors ${
                                    saveVisibility === 'private'
                                      ? 'bg-[rgba(99,83,255,0.08)] text-[#6353FF]'
                                      : 'hover:bg-[#F7F7F8] text-[#3F4444]'
                                  }`}
                                >
                                  Privada
                                </button>
                                {canManagePublic && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSaveVisibility('public')
                                      setShowVisibilityOptions(false)
                                    }}
                                    className={`w-full px-3 py-2 text-sm text-left transition-colors ${
                                      saveVisibility === 'public'
                                        ? 'bg-[rgba(99,83,255,0.08)] text-[#6353FF]'
                                        : 'hover:bg-[#F7F7F8] text-[#3F4444]'
                                    }`}
                                  >
                                    Pública
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        {saveError && <div className="text-xs text-red-500">{saveError}</div>}
                        <div className="flex items-center justify-end gap-2 pt-2">
                          <button
                            onClick={() => {
                              setShowSaveForm(false)
                              setEditingViewId(null)
                            }}
                            className="px-3 py-2 text-sm text-[#8A8F8F] hover:text-[#3F4444]"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={handleSaveView}
                            disabled={createSavedView.isPending || updateSavedView.isPending}
                            className="px-3 py-2 text-sm font-medium text-white bg-[#6353FF] rounded-lg hover:bg-[#5647f5] transition-colors disabled:opacity-60"
                          >
                            {editingViewId ? 'Actualizar' : 'Guardar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Filter Toggle */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    showFilters || activeFilterCount > 0
                      ? 'bg-[#6353FF] text-white'
                      : 'bg-[#F7F7F8] text-[#5A5F5F] border border-[#E0E0E1] hover:bg-[#ECECED]'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  Filtros
                  {activeFilterCount > 0 && (
                    <span className="bg-white text-[#6353FF] text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px]">
                      {activeFilterCount}
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                </button>

                {/* Clear Filters */}
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 px-3 py-2 text-sm text-[#8A8F8F] hover:text-[#3F4444] hover:bg-[#F7F7F8] rounded-xl transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Limpiar
                  </button>
                )}
              
                {/* View Toggle */}
                <div className="flex items-center gap-1 border-l border-[#E0E0E1] pl-3">
                  <button
                    onClick={() => setView('kanban')}
                    className={`p-2 rounded-lg transition-colors ${
                      view === 'kanban' 
                        ? 'bg-[rgba(99,83,255,0.1)] text-[#6353FF]' 
                        : 'text-[#8A8F8F] hover:text-[#3F4444] hover:bg-[#F7F7F8]'
                    }`}
                    title="Vista Kanban"
                  >
                    <LayoutGrid className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setView('list')}
                    className={`p-2 rounded-lg transition-colors ${
                      view === 'list' 
                        ? 'bg-[rgba(99,83,255,0.1)] text-[#6353FF]' 
                        : 'text-[#8A8F8F] hover:text-[#3F4444] hover:bg-[#F7F7F8]'
                    }`}
                    title="Vista Lista"
                  >
                    <List className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Collapsible Filter Panel with Multi-Select */}
            {showFilters && (
              <div className="px-6 py-4 bg-[#FAFAFA] border-t border-[#E0E0E1] animate-in slide-in-from-top-2 duration-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Reference - Number input */}
                  <div className="space-y-1">
                    <label className="block mb-1.5 text-[10px] uppercase font-bold text-[#8A8F8F] tracking-wider">
                      Referencia
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="Ej: 123"
                      value={filters.reference}
                      onChange={(e) => updateFilter('reference', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-sm text-[#3F4444] placeholder:text-[#B0B5B5] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all"
                    />
                  </div>

                  {/* External Reference - Number input */}
                  <div className="space-y-1">
                    <label className="block mb-1.5 text-[10px] uppercase font-bold text-[#8A8F8F] tracking-wider">
                      Referencia externa
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="Ej: 123"
                      value={filters.externalReference}
                      onChange={(e) => updateFilter('externalReference', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-sm text-[#3F4444] placeholder:text-[#B0B5B5] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all"
                    />
                  </div>

                  {/* Priority - Multi-select */}
                  <MultiSelect
                    label="Prioridad"
                    options={PRIORITY_OPTIONS}
                    value={filters.priority}
                    onChange={(v) => updateFilter('priority', v)}
                    placeholder="Todas"
                  />

                  {/* Stage - Multi-select */}
                  <MultiSelect
                    label="Estado"
                    options={STAGE_OPTIONS}
                    value={filters.stage}
                    onChange={(v) => updateFilter('stage', v)}
                    placeholder="Todos"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Entity - Multi-select */}
                  <MultiSelect
                    label="Entidad"
                    options={entityOptions}
                    value={filters.entity}
                    onChange={(v) => updateFilter('entity', v)}
                    placeholder="Todas"
                  />

                  {/* Application - Multi-select */}
                  <MultiSelect
                    label="Aplicación"
                    options={APPLICATION_OPTIONS}
                    value={filters.application}
                    onChange={(v) => updateFilter('application', v)}
                    placeholder="Todas"
                  />

                  {/* Category - Multi-select */}
                  <MultiSelect
                    label="Categoría"
                    options={CATEGORY_FILTER_OPTIONS}
                    value={filters.category}
                    onChange={(v) => updateFilter('category', v)}
                    placeholder="Todas"
                  />

                  {/* Assigned To - Multi-select */}
                  <MultiSelect
                    label="Asignado a"
                    options={profileOptions}
                    value={filters.assignedTo}
                    onChange={(v) => updateFilter('assignedTo', v)}
                    placeholder="Todos"
                  />

                  {/* Responsible - Multi-select */}
                  <MultiSelect
                    label="Responsable"
                    options={responsibleOptions}
                    value={filters.responsible}
                    onChange={(v) => updateFilter('responsible', v)}
                    placeholder="Todos"
                  />
                </div>
              </div>
            )}
          </header>
          
          {/* Content */}
          <div className="p-6 flex-1 overflow-auto bg-[#F7F7F8]">
            {view === 'kanban' ? (
              <KanbanBoard 
                onTicketClick={handleTicketClick} 
                filters={filters}
              />
            ) : (
              <ListViewContent 
                filters={filters}
                onTicketClick={handleTicketClick}
              />
            )}
          </div>

        </main>

        {id && <TicketDetail />}
      </div>

      {confirmContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <div className="text-base font-semibold text-[#3F4444]">{confirmContent.title}</div>
            <div className="mt-2 text-sm text-[#5A5F5F]">{confirmContent.message}</div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-3 py-2 text-sm text-[#8A8F8F] hover:text-[#3F4444]"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmAction}
                className="px-3 py-2 text-sm font-medium text-white bg-[#6353FF] rounded-lg hover:bg-[#5647f5] transition-colors"
              >
                {confirmContent.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
