import { useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { TicketList } from '../components/TicketList'
import { TicketDetail } from '../components/TicketDetail'
import { TicketCard } from '../components/KanbanBoard'
import { LayoutGrid, List, Loader2, User } from 'lucide-react'
import { useRealtimeTickets } from '../hooks/useRealtime'
import { useTickets, useCurrentUser } from '../hooks/useData'
import type { TicketStage, Ticket } from '../lib/supabase'
import { STAGES } from '../lib/supabase'

// Mini Kanban Column using Dashboard cards
function MiniKanbanColumn({ 
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
      <div className="flex items-center gap-2 mb-4 px-1">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        <h2 className="text-sm font-bold text-[#5A5F5F] uppercase tracking-widest">{config.label}</h2>
        <span className="text-xs text-[#8A8F8F] ml-auto font-mono bg-[#F7F7F8] px-2 py-0.5 rounded border border-[#E0E0E1]">{tickets.length}</span>
      </div>
      
      <div className="space-y-3 min-h-[500px] p-2 rounded-xl bg-[#F7F7F8] border border-[#ECECED]">
        {tickets.map(ticket => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            onClick={() => onTicketClick(ticket.id)}
          />
        ))}
        {tickets.length === 0 && (
          <div className="text-center py-8 text-[#B0B5B5] text-xs">Sin tickets</div>
        )}
      </div>
    </div>
  )
}

// My Tickets: Tickets assigned to current user
export function MyTicketsPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  
  const { data: allTickets, isLoading: loadingTickets } = useTickets()
  const { data: currentUser, isLoading: loadingUser } = useCurrentUser()
  
  useRealtimeTickets()
  
  // Filter: tickets assigned to current user or entity responsible (excluding archived)
  const tickets = useMemo(() => {
    if (!allTickets || !currentUser) return []
    return allTickets.filter(t => 
      (t.assigned_to === currentUser.id || t.entity?.assigned_to === currentUser.id) &&
      !['done', 'cancelled', 'paused'].includes(t.stage)
    )
  }, [allTickets, currentUser])
  
  const handleTicketClick = (ticketId: string) => {
    navigate(`/my-tickets/${ticketId}`)
  }
  
  // Group by stage
  const ticketsByStage = useMemo(() => {
    const stages: TicketStage[] = ['assigned', 'in_progress', 'pending_dev', 'testing', 'pending_validation']
    const grouped: Record<TicketStage, Ticket[]> = {} as any
    stages.forEach(s => grouped[s] = [])
    tickets.forEach(t => {
      if (stages.includes(t.stage)) grouped[t.stage].push(t)
    })
    return { stages, grouped }
  }, [tickets])
  
  const isLoading = loadingTickets || loadingUser
  
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
              <User className="w-5 h-5 text-[#6353FF]" />
              <h1 className="text-lg font-semibold text-[#3F4444]">Mis Tickets</h1>
              <span className="text-sm text-[#8A8F8F]">({tickets.length} tickets)</span>
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
                {ticketsByStage.stages.map(stage => (
                  <MiniKanbanColumn 
                    key={stage}
                    stage={stage}
                    tickets={ticketsByStage.grouped[stage]}
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
