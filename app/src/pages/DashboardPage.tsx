import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { KanbanBoard } from '../components/KanbanBoard'
import { TicketDetail } from '../components/TicketDetail'
import { TicketList } from '../components/TicketList'
import { MultiSelect } from '../components/MultiSelect'
import { LayoutGrid, List, Search, X, Filter, ChevronDown, Loader2 } from 'lucide-react'
import { useRealtimeTickets } from '../hooks/useRealtime'
import { useFilteredTickets } from '../hooks/useFilteredTickets'
import { useEntities, useProfiles } from '../hooks/useData'
import { STAGES, PRIORITIES } from '../lib/supabase'

// Updated filters to support multi-select (arrays)
export type TicketFilters = {
  reference: string
  search: string
  priority: string[]  // Changed to array
  stage: string[]     // Changed to array
  entity: string[]    // Changed to array
  application: string[]
  assignedTo: string[]
}

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

export function DashboardPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [showFilters, setShowFilters] = useState(false)
  
  const [filters, setFilters] = useState<TicketFilters>({
    reference: '',
    search: '',
    priority: [],
    stage: [],
    entity: [],
    application: [],
    assignedTo: []
  })
  
  const { data: entities } = useEntities()
  const { data: profiles } = useProfiles()
  
  // Subscribe to realtime ticket updates
  useRealtimeTickets()
  
  const handleTicketClick = (ticketId: string) => {
    navigate(`/ticket/${ticketId}`)
  }

  const updateFilter = <K extends keyof TicketFilters>(key: K, value: TicketFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setFilters({
      reference: '',
      search: '',
      priority: [],
      stage: [],
      entity: [],
      application: [],
      assignedTo: []
    })
  }

  // Count active filters (arrays with length > 0)
  const activeFilterCount = 
    (filters.reference ? 1 : 0) +
    (filters.search ? 1 : 0) +
    filters.priority.length +
    filters.stage.length +
    filters.entity.length +
    filters.application.length +
    filters.assignedTo.length

  // Convert entities and profiles to options
  const entityOptions = entities?.map(e => ({ value: e.id, label: e.name })) || []
  const profileOptions = [
    { value: 'unassigned', label: 'Sin asignar' },
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
              <div className="px-6 py-4 bg-[#FAFAFA] border-t border-[#E0E0E1] animate-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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

                  {/* Assigned To - Multi-select */}
                  <MultiSelect
                    label="Asignado a"
                    options={profileOptions}
                    value={filters.assignedTo}
                    onChange={(v) => updateFilter('assignedTo', v)}
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
    </div>
  )
}
