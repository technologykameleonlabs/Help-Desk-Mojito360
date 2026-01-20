import { useMemo } from 'react'
import { useTickets } from '../hooks/useData'
import type { Ticket, TicketStage } from '../lib/supabase'
import { STAGE_CONFIG, PRIORITY_CONFIG } from '../lib/supabase'
import { Clock, User, Building2 } from 'lucide-react'


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
  const priority = PRIORITY_CONFIG[ticket.priority]
  
  return (
    <div
      onClick={onClick}
      className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 cursor-pointer hover:border-zinc-700 transition-colors group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-mono text-zinc-500">#{ticket.ticket_ref}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${priority.color} text-white`}>
          {priority.label}
        </span>
      </div>
      
      <h3 className="text-sm font-medium text-white group-hover:text-primary-400 transition-colors line-clamp-2 mb-3">
        {ticket.title}
      </h3>
      
      <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
        {ticket.entity && (
          <span className="flex items-center gap-1">
            <Building2 className="w-3 h-3" />
            {ticket.entity.name}
          </span>
        )}
        {ticket.assigned_to_profile && (
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {ticket.assigned_to_profile.full_name?.split(' ')[0]}
          </span>
        )}
        {ticket.estimated_time && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {ticket.estimated_time}m
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
  onTicketClick: (ticket: Ticket) => void
}) {
  const config = STAGE_CONFIG[stage]
  
  return (
    <div className="flex-shrink-0 w-72">
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={`w-2 h-2 rounded-full ${config.color}`} />
        <h2 className="text-sm font-medium text-zinc-300">{config.label}</h2>
        <span className="text-xs text-zinc-500 ml-auto">{tickets.length}</span>
      </div>
      
      <div className="space-y-2 min-h-[200px]">
        {tickets.map(ticket => (
          <TicketCard 
            key={ticket.id} 
            ticket={ticket} 
            onClick={() => onTicketClick(ticket)}
          />
        ))}
      </div>
    </div>
  )
}

export function KanbanBoard({ onTicketClick }: { onTicketClick: (ticket: Ticket) => void }) {
  const { data: tickets, isLoading } = useTickets()
  
  const ticketsByStage = useMemo(() => {
    const grouped: Record<TicketStage, Ticket[]> = {} as any
    KANBAN_STAGES.forEach(stage => {
      grouped[stage] = []
    })
    
    tickets?.forEach(ticket => {
      if (KANBAN_STAGES.includes(ticket.stage)) {
        grouped[ticket.stage].push(ticket)
      }
    })
    
    return grouped
  }, [tickets])
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-500">Cargando tickets...</div>
      </div>
    )
  }
  
  return (
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
  )
}
