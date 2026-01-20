import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { KanbanBoard } from '../components/KanbanBoard'
import { TicketDetail } from '../components/TicketDetail'
import { TicketList } from '../components/TicketList'
import { LayoutGrid, List, Search, X, Filter, ChevronDown, Loader2 } from 'lucide-react'
import { useRealtimeTickets } from '../hooks/useRealtime'
import { useFilteredTickets } from '../hooks/useFilteredTickets'
import { useEntities, useProfiles } from '../hooks/useData'
import { STAGES } from '../lib/supabase'

export type TicketFilters = {
  search: string
  priority: string
  stage: string
  entity: string
  application: string
  classification: string
  assignedTo: string
}

const APPLICATIONS = ['Mojito360', 'Wintruck', 'Odoo', 'Otros']
const CLASSIFICATIONS = ['Soporte', 'Desarrollo']

export function DashboardPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [showFilters, setShowFilters] = useState(false)
  
  const [filters, setFilters] = useState<TicketFilters>({
    search: '',
    priority: '',
    stage: '',
    entity: '',
    application: '',
    classification: '',
    assignedTo: ''
  })
  
  const { data: entities } = useEntities()
  const { data: profiles } = useProfiles()
  
  // Subscribe to realtime ticket updates
  useRealtimeTickets()
  
  const handleTicketClick = (ticketId: string) => {
    navigate(`/ticket/${ticketId}`)
  }

  const updateFilter = (key: keyof TicketFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setFilters({
      search: '',
      priority: '',
      stage: '',
      entity: '',
      application: '',
      classification: '',
      assignedTo: ''
    })
  }

  const activeFilterCount = Object.values(filters).filter(v => v).length

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

    const hasFilters = Object.values(filters).some(v => v)

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

            {/* Collapsible Filter Panel */}
            {showFilters && (
              <div className="px-6 py-4 bg-[#FAFAFA] border-t border-[#E0E0E1] animate-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {/* Priority */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-[#8A8F8F] tracking-wider mb-1.5">Prioridad</label>
                    <select
                      value={filters.priority}
                      onChange={(e) => updateFilter('priority', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-lg text-sm text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 transition-all"
                    >
                      <option value="">Todas</option>
                      <option value="critical">Crítica</option>
                      <option value="high">Alta</option>
                      <option value="medium">Media</option>
                      <option value="low">Baja</option>
                    </select>
                  </div>

                  {/* Stage */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-[#8A8F8F] tracking-wider mb-1.5">Estado</label>
                    <select
                      value={filters.stage}
                      onChange={(e) => updateFilter('stage', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-lg text-sm text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 transition-all"
                    >
                      <option value="">Todos</option>
                      {Object.entries(STAGES).map(([key, value]) => (
                        <option key={key} value={key}>{value.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Entity */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-[#8A8F8F] tracking-wider mb-1.5">Entidad</label>
                    <select
                      value={filters.entity}
                      onChange={(e) => updateFilter('entity', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-lg text-sm text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 transition-all"
                    >
                      <option value="">Todas</option>
                      {entities?.map(entity => (
                        <option key={entity.id} value={entity.id}>{entity.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Application */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-[#8A8F8F] tracking-wider mb-1.5">Aplicación</label>
                    <select
                      value={filters.application}
                      onChange={(e) => updateFilter('application', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-lg text-sm text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 transition-all"
                    >
                      <option value="">Todas</option>
                      {APPLICATIONS.map(app => (
                        <option key={app} value={app}>{app}</option>
                      ))}
                    </select>
                  </div>

                  {/* Classification */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-[#8A8F8F] tracking-wider mb-1.5">Clasificación</label>
                    <select
                      value={filters.classification}
                      onChange={(e) => updateFilter('classification', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-lg text-sm text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 transition-all"
                    >
                      <option value="">Todas</option>
                      {CLASSIFICATIONS.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Assigned To */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-[#8A8F8F] tracking-wider mb-1.5">Asignado a</label>
                    <select
                      value={filters.assignedTo}
                      onChange={(e) => updateFilter('assignedTo', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-lg text-sm text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 transition-all"
                    >
                      <option value="">Todos</option>
                      <option value="unassigned">Sin asignar</option>
                      {profiles?.map(profile => (
                        <option key={profile.id} value={profile.id}>{profile.full_name || profile.email}</option>
                      ))}
                    </select>
                  </div>
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
