import { useMemo } from 'react'
import { useTickets } from '../hooks/useData'
import type { Ticket, TicketStage } from '../lib/supabase'
import { STAGES, PRIORITIES } from '../lib/supabase'
import { User, Building2 } from 'lucide-react'
import type { TicketFilters } from '../pages/DashboardPage'

const KANBAN_STAGES: TicketStage[] = [
  'new',
  'assigned',
  'in_progress',
  'pending_dev',
  'testing',
  'pending_validation',
  'done'
]

function TicketCard({ ticket, onClick }: { ticket: Ticket; onClick: () => void }) {
  const priority = PRIORITIES[ticket.priority]
  
  return (
    <div
      onClick={onClick}
      className="bg-white border border-[#E0E0E1] rounded-xl p-3 cursor-pointer hover:border-[#6353FF] hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-mono text-[#8A8F8F]">#{ticket.ticket_ref}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${priority.color} text-white`}>
          {priority.label}
        </span>
      </div>
      
      <h3 className="text-sm font-semibold text-[#3F4444] group-hover:text-[#6353FF] transition-colors line-clamp-2 mb-3">
        {ticket.title}
      </h3>
      
      <div className="flex flex-wrap gap-2 text-xs text-[#8A8F8F]">
        {ticket.entity && (
          <span className="flex items-center gap-1">
            <Building2 className="w-3 h-3" />
            <span className="truncate max-w-[120px]">{ticket.entity.name}</span>
          </span>
        )}
        {ticket.assigned_to_profile && (
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {ticket.assigned_to_profile.full_name?.split(' ')[0]}
          </span>
        )}
      </div>
    </div>
  )
}

function KanbanColumn({ 
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
      </div>
    </div>
  )
}

type KanbanBoardProps = {
  onTicketClick: (ticketId: string) => void
  filters: TicketFilters
}

export function KanbanBoard({ onTicketClick, filters }: KanbanBoardProps) {
  const { data: tickets, isLoading } = useTickets()
  
  // Apply all filters
  const filteredTickets = useMemo(() => {
    if (!tickets) return []
    
    return tickets.filter(ticket => {
      // Search filter (title, ref, entity name)
      if (filters.search) {
        const q = filters.search.toLowerCase()
        const matchesTitle = ticket.title.toLowerCase().includes(q)
        const matchesRef = ticket.ticket_ref.toString().includes(q)
        const matchesEntity = ticket.entity?.name.toLowerCase().includes(q)
        if (!matchesTitle && !matchesRef && !matchesEntity) return false
      }
      
      // Priority filter
      if (filters.priority && ticket.priority !== filters.priority) {
        return false
      }
      
      // Stage filter
      if (filters.stage && ticket.stage !== filters.stage) {
        return false
      }
      
      // Entity filter
      if (filters.entity && ticket.entity_id !== filters.entity) {
        return false
      }
      
      // Application filter
      if (filters.application && ticket.application !== filters.application) {
        return false
      }
      
      // Classification filter
      if (filters.classification && ticket.classification !== filters.classification) {
        return false
      }
      
      // Assigned to filter
      if (filters.assignedTo) {
        if (filters.assignedTo === 'unassigned') {
          if (ticket.assigned_to) return false
        } else {
          if (ticket.assigned_to !== filters.assignedTo) return false
        }
      }
      
      return true
    })
  }, [tickets, filters])
  
  const ticketsByStage = useMemo(() => {
    const grouped: Record<TicketStage, Ticket[]> = {} as any
    KANBAN_STAGES.forEach(stage => {
      grouped[stage] = []
    })
    
    filteredTickets.forEach(ticket => {
      if (KANBAN_STAGES.includes(ticket.stage)) {
        grouped[ticket.stage].push(ticket)
      }
    })
    
    return grouped
  }, [filteredTickets])
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#8A8F8F]">Cargando tickets...</div>
      </div>
    )
  }

  const totalFiltered = filteredTickets.length
  const totalAll = tickets?.length || 0
  
  return (
    <div>
      {/* Results count */}
      {(filters.search || filters.priority || filters.stage || filters.entity || filters.application || filters.classification || filters.assignedTo) && (
        <div className="mb-4 text-sm text-[#8A8F8F]">
          Mostrando <span className="font-semibold text-[#3F4444]">{totalFiltered}</span> de {totalAll} tickets
        </div>
      )}
      
      <div className="flex gap-4 overflow-x-auto pb-4">
        {KANBAN_STAGES.map(stage => (
          <KanbanColumn 
            key={stage} 
            stage={stage} 
            tickets={ticketsByStage[stage]}
            onTicketClick={onTicketClick}
          />
        ))}
      </div>
    </div>
  )
}
