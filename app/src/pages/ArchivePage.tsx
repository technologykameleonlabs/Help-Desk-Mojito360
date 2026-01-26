import { useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { TicketList } from '../components/TicketList'
import { TicketDetail } from '../components/TicketDetail'
import { LayoutGrid, List, Loader2, Archive as ArchiveIcon } from 'lucide-react'
import { useRealtimeTickets } from '../hooks/useRealtime'
import { useTickets } from '../hooks/useData'
import type { TicketStage, Ticket } from '../lib/supabase'
import { STAGES, PRIORITIES } from '../lib/supabase'

// Archive Kanban Column
function ArchiveColumn({ 
  stage, 
  tickets, 
  onTicketClick 
}: { 
  stage: TicketStage
  tickets: Ticket[]
  onTicketClick: (ticketId: string) => void
}) {
  const config = STAGES[stage]
  
  return (
    <div className="flex-shrink-0 w-80">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        <h2 className="text-xs font-bold text-[#5A5F5F] uppercase tracking-widest">{config.label}</h2>
        <span className="text-xs text-[#8A8F8F] ml-auto font-mono bg-white px-2 py-0.5 rounded border border-[#E0E0E1]">{tickets.length}</span>
      </div>
      
      <div className="space-y-2 min-h-[400px] p-2 rounded-xl bg-white border border-[#E0E0E1]">
        {tickets.map(ticket => {
          const priority = PRIORITIES[ticket.priority]
          return (
            <div
              key={ticket.id}
              onClick={() => onTicketClick(ticket.id)}
              className="p-3 bg-[#FAFAFA] border border-[#E0E0E1] rounded-lg cursor-pointer hover:border-[#6353FF] hover:shadow-sm transition-all opacity-75 hover:opacity-100"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono text-[#8A8F8F]">#{ticket.ticket_ref}</span>
                <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase ${priority.color} text-white`}>
                  {priority.label}
                </span>
              </div>
              <p className="text-sm font-medium text-[#5A5F5F] line-clamp-2">{ticket.title}</p>
            </div>
          )
        })}
        {tickets.length === 0 && (
          <div className="text-center py-8 text-[#B0B5B5] text-xs">Sin tickets</div>
        )}
      </div>
    </div>
  )
}

// Archive: Completed, Cancelled, Paused tickets
export function ArchivePage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [view, setView] = useState<'kanban' | 'list'>('list') // Default to list for archive
  
  const { data: allTickets, isLoading } = useTickets(true)
  
  useRealtimeTickets()
  
  // Filter: archived tickets only
  const archivedStages: TicketStage[] = ['done', 'cancelled', 'paused']
  
  const tickets = useMemo(() => {
    if (!allTickets) return []
    return allTickets.filter(t => archivedStages.includes(t.stage))
  }, [allTickets])
  
  const handleTicketClick = (ticketId: string) => {
    navigate(`/archive/${ticketId}`)
  }
  
  // Group by stage
  const ticketsByStage = useMemo(() => {
    const grouped: Record<TicketStage, Ticket[]> = {} as any
    archivedStages.forEach(s => grouped[s] = [])
    tickets.forEach(t => {
      if (archivedStages.includes(t.stage)) grouped[t.stage].push(t)
    })
    return grouped
  }, [tickets])
  
  if (isLoading) {
    return (
      <div className="flex h-screen bg-white">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#6353FF]" />
        </div>
      </div>
    )
  }
  
  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-hidden flex flex-col">
          <header className="h-16 border-b border-[#E0E0E1] flex items-center justify-between px-6 shrink-0 bg-white">
            <div className="flex items-center gap-3">
              <ArchiveIcon className="w-5 h-5 text-[#8A8F8F]" />
              <h1 className="text-lg font-semibold text-[#3F4444]">Archivo</h1>
              <span className="text-sm text-[#8A8F8F]">({tickets.length} archivados)</span>
            </div>
            
            <div className="flex items-center gap-1">
              <button
                onClick={() => setView('kanban')}
                className={`p-2 rounded-lg transition-colors ${
                  view === 'kanban' 
                    ? 'bg-[rgba(99,83,255,0.1)] text-[#6353FF]' 
                    : 'text-[#8A8F8F] hover:text-[#3F4444] hover:bg-[#F7F7F8]'
                }`}
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
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </header>
          
          <div className="p-6 flex-1 overflow-auto bg-[#F7F7F8]">
            {view === 'kanban' ? (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {archivedStages.map(stage => (
                  <ArchiveColumn 
                    key={stage}
                    stage={stage}
                    tickets={ticketsByStage[stage]}
                    onTicketClick={handleTicketClick}
                  />
                ))}
              </div>
            ) : (
              <TicketList tickets={tickets} onTicketClick={handleTicketClick} />
            )}
          </div>
        </main>
        
        {id && <TicketDetail />}
      </div>
    </div>
  )
}
