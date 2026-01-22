import { useMemo, useState, useEffect, forwardRef, type CSSProperties } from 'react'
import { useTickets, useUpdateTicket } from '../hooks/useData'
import type { Ticket, TicketStage } from '../lib/supabase'
import { STAGES, PRIORITIES } from '../lib/supabase'
import { User, Building2 } from 'lucide-react'
import type { TicketFilters } from '../pages/DashboardPage'
import { ConfirmModal } from './ConfirmModal'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const KANBAN_STAGES: TicketStage[] = [
  'new',
  'assigned',
  'in_progress',
  'pending_dev',
  'testing',
  'pending_validation',
  'done'
]

type TicketCardProps = {
  ticket: Ticket
  onClick?: () => void
  isDragging?: boolean
  isOverlay?: boolean
  style?: CSSProperties
  dragAttributes?: React.HTMLAttributes<HTMLDivElement>
  dragListeners?: React.HTMLAttributes<HTMLDivElement>
}

const TicketCard = forwardRef<HTMLDivElement, TicketCardProps>(function TicketCard(
  { ticket, onClick, isDragging, isOverlay, style, dragAttributes, dragListeners },
  ref
) {
  const priority = PRIORITIES[ticket.priority]
  const handleClick = () => {
    if (isDragging) return
    onClick?.()
  }

  return (
    <div
      ref={ref}
      onClick={handleClick}
      style={style}
      className={`bg-white border border-[#E0E0E1] rounded-xl p-3 cursor-pointer transition-all group ${
        isOverlay ? 'shadow-lg border-[#6353FF]' : 'hover:border-[#6353FF] hover:shadow-md'
      }`}
      {...dragAttributes}
      {...dragListeners}
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
        <span className="flex items-center gap-1">
          <Building2 className="w-3 h-3" />
          <span className="truncate max-w-[120px]">{ticket.entity?.name || '---'}</span>
        </span>
        <span className="flex items-center gap-1">
          <User className="w-3 h-3" />
          {ticket.assigned_to_profile?.full_name?.split(' ')[0] || '---'}
        </span>
      </div>
    </div>
  )
})

function SortableTicketCard({ ticket, onClick }: { ticket: Ticket; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ticket.id,
    data: { stage: ticket.stage },
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  return (
    <TicketCard
      ref={setNodeRef}
      ticket={ticket}
      onClick={onClick}
      isDragging={isDragging}
      style={style}
      dragAttributes={attributes}
      dragListeners={listeners}
    />
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
  const { setNodeRef } = useDroppable({
    id: stage,
    data: { stage },
  })
  
  return (
    <div className="flex-shrink-0 w-80">
      <div className="flex items-center gap-2 mb-4 px-1">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        <h2 className="text-sm font-bold text-[#5A5F5F] uppercase tracking-widest">{config.label}</h2>
        <span className="text-xs text-[#8A8F8F] ml-auto font-mono bg-[#F7F7F8] px-2 py-0.5 rounded border border-[#E0E0E1]">{tickets.length}</span>
      </div>
      
      <div
        ref={setNodeRef}
        className="space-y-3 min-h-[500px] p-2 rounded-xl bg-[#F7F7F8] border border-[#ECECED]"
      >
        <SortableContext items={tickets.map(ticket => ticket.id)} strategy={verticalListSortingStrategy}>
          {tickets.map(ticket => (
            <SortableTicketCard
              key={ticket.id}
              ticket={ticket}
              onClick={() => onTicketClick(ticket.id)}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}

type KanbanBoardProps = {
  onTicketClick: (ticketId: string) => void
  filters: TicketFilters
}

export function KanbanBoard({ onTicketClick, filters }: KanbanBoardProps) {
  const { data: tickets, isLoading, isFetching } = useTickets()
  const updateTicket = useUpdateTicket()
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null)
  const [pendingMove, setPendingMove] = useState<{
    ticketId: string
    fromStage: TicketStage
    toStage: TicketStage
  } | null>(null)
  const [awaitingRefresh, setAwaitingRefresh] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  
  // Apply all filters (supports multi-select arrays)
  const filteredTickets = useMemo(() => {
    if (!tickets) return []
    
    return tickets.filter(ticket => {
      // Reference filter (ticket_ref)
      if (filters.reference) {
        const ref = filters.reference.trim()
        if (ref && !ticket.ticket_ref.toString().includes(ref)) {
          return false
        }
      }

      // Mojito reference filter (mojito_ref)
      if (filters.mojitoReference) {
        const ref = filters.mojitoReference.trim()
        const mojitoValue = ticket.mojito_ref?.toString() || ''
        if (ref && !mojitoValue.includes(ref)) {
          return false
        }
      }

      // Search filter (title, ref, entity name)
      if (filters.search) {
        const q = filters.search.toLowerCase()
        const matchesTitle = ticket.title.toLowerCase().includes(q)
        const matchesRef = ticket.ticket_ref.toString().includes(q)
        const matchesEntity = ticket.entity?.name.toLowerCase().includes(q)
        if (!matchesTitle && !matchesRef && !matchesEntity) return false
      }
      
      // Priority filter (multi-select)
      if (filters.priority.length > 0 && !filters.priority.includes(ticket.priority)) {
        return false
      }
      
      // Stage filter (multi-select)
      if (filters.stage.length > 0 && !filters.stage.includes(ticket.stage)) {
        return false
      }
      
      // Entity filter (multi-select)
      if (filters.entity.length > 0) {
        if (!ticket.entity_id || !filters.entity.includes(ticket.entity_id)) {
          return false
        }
      }
      
      // Application filter (multi-select)
      if (filters.application.length > 0) {
        if (!ticket.application || !filters.application.includes(ticket.application)) {
          return false
        }
      }
      
      // Assigned to filter (multi-select)
      if (filters.assignedTo.length > 0) {
        const hasUnassigned = filters.assignedTo.includes('unassigned')
        const selectedUsers = filters.assignedTo.filter(id => id !== 'unassigned')
        
        if (!ticket.assigned_to && hasUnassigned) {
          // Match unassigned
        } else if (ticket.assigned_to && selectedUsers.includes(ticket.assigned_to)) {
          // Match specific user
        } else {
          return false
        }
      }

      // Responsible filter (entity assigned_to)
      if (filters.responsible.length > 0) {
        const hasUnassigned = filters.responsible.includes('unassigned')
        const selectedUsers = filters.responsible.filter(id => id !== 'unassigned')
        const responsibleId = ticket.entity?.assigned_to || null

        if (hasUnassigned && !responsibleId) {
          // Match: unassigned responsible
        } else if (selectedUsers.length > 0 && responsibleId && selectedUsers.includes(responsibleId)) {
          // Match: specific responsible
        } else if (hasUnassigned && selectedUsers.length === 0 && !responsibleId) {
          // Match: only unassigned
        } else if (!hasUnassigned && selectedUsers.length > 0 && responsibleId && selectedUsers.includes(responsibleId)) {
          // Match: only specific responsibles
        } else {
          return false
        }
      }
      
      return true
    })
  }, [tickets, filters])
  
  const ticketsByStage = useMemo(() => {
    const grouped: Record<TicketStage, Ticket[]> = {} as Record<TicketStage, Ticket[]>
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

  const ticketsById = useMemo(() => {
    const map = new Map<string, Ticket>()
    filteredTickets.forEach(ticket => {
      map.set(ticket.id, ticket)
    })
    return map
  }, [filteredTickets])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTicketId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTicketId(null)
    if (!over) return

    const activeTicket = ticketsById.get(active.id as string)
    if (!activeTicket) return

    const overStage = (over.data.current?.stage as TicketStage | undefined) ||
      (ticketsById.get(over.id as string)?.stage)

    if (!overStage || overStage === activeTicket.stage) return

    setPendingMove({
      ticketId: activeTicket.id,
      fromStage: activeTicket.stage,
      toStage: overStage,
    })
  }

  const activeTicket = activeTicketId ? ticketsById.get(activeTicketId) : null
  const isUpdating = updateTicket.isPending || awaitingRefresh || isFetching

  useEffect(() => {
    if (awaitingRefresh && !updateTicket.isPending && !isFetching) {
      setAwaitingRefresh(false)
      setPendingMove(null)
    }
  }, [awaitingRefresh, updateTicket.isPending, isFetching])
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#8A8F8F]">Cargando tickets...</div>
      </div>
    )
  }

  const totalFiltered = filteredTickets.length
  const totalAll = tickets?.length || 0
  
  // Check if any filters are active (array-based)
  const hasActiveFilters = filters.reference ||
    filters.mojitoReference ||
    filters.search || 
    filters.priority.length > 0 || 
    filters.stage.length > 0 || 
    filters.entity.length > 0 || 
    filters.application.length > 0 || 
    filters.assignedTo.length > 0 ||
    filters.responsible.length > 0
  
  return (
    <div>
      {/* Results count */}
      {hasActiveFilters && (
        <div className="mb-4 text-sm text-[#8A8F8F]">
          Mostrando <span className="font-semibold text-[#3F4444]">{totalFiltered}</span> de {totalAll} tickets
        </div>
      )}
      
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveTicketId(null)}
      >
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
        <DragOverlay>
          {activeTicket ? <TicketCard ticket={activeTicket} isOverlay /> : null}
        </DragOverlay>
      </DndContext>

      <ConfirmModal
        open={!!pendingMove}
        title={
          pendingMove
            ? `Está seguro que desea editar el estado del ticket #${ticketsById.get(pendingMove.ticketId)?.ticket_ref}?`
            : ''
        }
        description={
          pendingMove ? (
            <div className="flex items-center gap-2 text-sm text-[#5A5F5F]">
              <span className="font-semibold">{STAGES[pendingMove.fromStage].label}</span>
              <span className="text-[#8A8F8F]">→</span>
              <span className="font-semibold">{STAGES[pendingMove.toStage].label}</span>
            </div>
          ) : null
        }
        confirmText="Aceptar"
        cancelText="Cancelar"
        isConfirming={isUpdating}
        disableClose={isUpdating}
        onCancel={() => {
          if (!isUpdating) {
            setPendingMove(null)
          }
        }}
        onConfirm={async () => {
          if (!pendingMove) return
          setAwaitingRefresh(true)
          try {
            await updateTicket.mutateAsync({ id: pendingMove.ticketId, stage: pendingMove.toStage })
          } catch (error) {
            console.error(error)
            alert('No se pudo actualizar el estado del ticket.')
            setAwaitingRefresh(false)
          } finally {
          }
        }}
      />
    </div>
  )
}
