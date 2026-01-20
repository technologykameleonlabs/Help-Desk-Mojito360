import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { KanbanBoard } from '../components/KanbanBoard'
import { TicketDetail } from '../components/TicketDetail'
import { LayoutGrid, List, Search, X } from 'lucide-react'
import { useRealtimeTickets } from '../hooks/useRealtime'

export function DashboardPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<string>('')
  
  // Subscribe to realtime ticket updates
  useRealtimeTickets()
  
  const handleTicketClick = (ticketId: string) => {
    navigate(`/ticket/${ticketId}`)
  }

  const clearFilters = () => {
    setSearchQuery('')
    setPriorityFilter('')
  }

  const hasActiveFilters = searchQuery || priorityFilter
  
  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-hidden flex flex-col">
          {/* Header */}
          <header className="h-16 border-b border-[#E0E0E1] flex items-center justify-between px-6 shrink-0 bg-white gap-4">
            <h1 className="text-lg font-semibold text-[#3F4444]">Dashboard</h1>
            
            {/* Search */}
            <div className="flex-1 max-w-md relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B0B5B5]" />
              <input
                type="text"
                placeholder="Buscar tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#F7F7F8] border border-[#E0E0E1] rounded-xl text-sm text-[#3F4444] placeholder:text-[#B0B5B5] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all"
              />
            </div>

            <div className="flex items-center gap-3">
              {/* Priority Filter */}
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-3 py-2 bg-[#F7F7F8] border border-[#E0E0E1] rounded-xl text-sm text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 transition-all min-w-[140px]"
              >
                <option value="">Todas Prioridades</option>
                <option value="critical">Crítica</option>
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>

              {/* Clear Filters */}
              {hasActiveFilters && (
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
          </header>
          
          {/* Content */}
          <div className="p-6 flex-1 overflow-auto bg-[#F7F7F8]">
            {view === 'kanban' ? (
              <KanbanBoard 
                onTicketClick={handleTicketClick} 
                searchQuery={searchQuery}
                priorityFilter={priorityFilter}
              />
            ) : (
              <div className="text-[#8A8F8F]">Vista de lista - próximamente</div>
            )}
          </div>
        </main>

        {id && <TicketDetail />}
      </div>
    </div>
  )
}


