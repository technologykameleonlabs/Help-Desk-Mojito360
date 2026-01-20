import type { Ticket } from '../lib/supabase'
import { STAGES, PRIORITIES } from '../lib/supabase'
import { Building2 } from 'lucide-react'


type TicketListProps = {
  tickets: Ticket[]
  onTicketClick: (ticketId: string) => void
}

export function TicketList({ tickets, onTicketClick }: TicketListProps) {
  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[#8A8F8F]">
        <p>No se encontraron tickets.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-[#E0E0E1] overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-[#FAFAFA] border-b border-[#E0E0E1] text-[10px] uppercase font-bold text-[#8A8F8F] tracking-wider">
        <div className="col-span-1">Ref</div>
        <div className="col-span-4">Título</div>
        <div className="col-span-2">Estado</div>
        <div className="col-span-1">Prioridad</div>
        <div className="col-span-2">Entidad</div>
        <div className="col-span-2">Asignado</div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-[#E0E0E1]">
        {tickets.map(ticket => {
          const stage = STAGES[ticket.stage]
          const priority = PRIORITIES[ticket.priority]

          return (
            <div
              key={ticket.id}
              onClick={() => onTicketClick(ticket.id)}
              className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-[#F7F7F8] cursor-pointer transition-colors items-center"
            >
              {/* Ref */}
              <div className="col-span-1">
                <span className="text-xs font-mono text-[#8A8F8F]">#{ticket.ticket_ref}</span>
              </div>

              {/* Title */}
              <div className="col-span-4">
                <p className="text-sm font-medium text-[#3F4444] line-clamp-1 hover:text-[#6353FF] transition-colors">
                  {ticket.title}
                </p>
                {ticket.description && (
                  <p className="text-xs text-[#8A8F8F] line-clamp-1 mt-0.5">
                    {ticket.description.replace(/<[^>]*>/g, '').slice(0, 80)}
                  </p>
                )}
              </div>

              {/* Stage */}
              <div className="col-span-2">
                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium ${stage.color} bg-opacity-10`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${stage.color}`} />
                  <span className="text-[#3F4444]">{stage.label}</span>
                </span>
              </div>

              {/* Priority */}
              <div className="col-span-1">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${priority.color} text-white`}>
                  {priority.label}
                </span>
              </div>

              {/* Entity */}
              <div className="col-span-2">
                {ticket.entity ? (
                  <span className="flex items-center gap-1.5 text-xs text-[#5A5F5F]">
                    <Building2 className="w-3 h-3 text-[#8A8F8F]" />
                    <span className="truncate max-w-[140px]">{ticket.entity.name}</span>
                  </span>
                ) : (
                  <span className="text-xs text-[#B0B5B5]">—</span>
                )}
              </div>

              {/* Assigned To */}
              <div className="col-span-2">
                {ticket.assigned_to_profile ? (
                  <span className="flex items-center gap-1.5 text-xs text-[#5A5F5F]">
                    <div className="w-5 h-5 rounded-full bg-[#6353FF] flex items-center justify-center text-white text-[10px] font-medium">
                      {ticket.assigned_to_profile.full_name?.[0] || '?'}
                    </div>
                    <span className="truncate">{ticket.assigned_to_profile.full_name?.split(' ')[0]}</span>
                  </span>
                ) : (
                  <span className="text-xs text-[#B0B5B5]">Sin asignar</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
