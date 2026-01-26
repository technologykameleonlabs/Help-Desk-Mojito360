import { STAGES, type Ticket } from './supabase'

export type GroupByKey =
  | 'none'
  | 'entity'
  | 'assigned_to'
  | 'stage'
  | 'type'
  | 'label'
  | 'created_month'

export const GROUP_BY_OPTIONS: Array<{ value: GroupByKey; label: string }> = [
  { value: 'none', label: 'Sin agrupar' },
  { value: 'entity', label: 'Entidad' },
  { value: 'assigned_to', label: 'Asignado a' },
  { value: 'stage', label: 'Estado' },
  { value: 'type', label: 'Tipo' },
  { value: 'label', label: 'Etiqueta' },
  { value: 'created_month', label: 'Fecha de creación (mes)' },
]

type TicketGroup = {
  id: string
  label: string
  tickets: Ticket[]
  sortValue?: number
}

const STAGE_ORDER: Array<keyof typeof STAGES> = [
  'new',
  'assigned',
  'in_progress',
  'pending_dev',
  'pending_sales',
  'pending_client',
  'testing',
  'pending_validation',
  'done',
  'paused',
  'cancelled',
]

const MONTH_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  month: 'long',
  year: 'numeric',
})

const capitalize = (value: string) => value ? value[0].toUpperCase() + value.slice(1) : value

export const isGroupByKey = (value: unknown): value is GroupByKey =>
  GROUP_BY_OPTIONS.some(option => option.value === value)

export const buildTicketGroups = (tickets: Ticket[], groupBy: GroupByKey): TicketGroup[] => {
  if (groupBy === 'none') return [{ id: 'all', label: 'Todos', tickets }]

  const groups = new Map<string, TicketGroup>()

  const addToGroup = (id: string, label: string, ticket: Ticket, sortValue?: number) => {
    const existing = groups.get(id)
    if (existing) {
      existing.tickets.push(ticket)
      if (sortValue !== undefined) {
        existing.sortValue = sortValue
      }
      return
    }
    groups.set(id, { id, label, tickets: [ticket], sortValue })
  }

  tickets.forEach(ticket => {
    switch (groupBy) {
      case 'entity': {
        const label = ticket.entity?.name || 'Sin entidad'
        const id = ticket.entity?.id ? `entity:${ticket.entity.id}` : 'missing:entity'
        addToGroup(id, label, ticket)
        break
      }
      case 'assigned_to': {
        if (!ticket.assigned_to) {
          addToGroup('missing:assigned_to', 'Sin asignar', ticket)
          break
        }
        const label = ticket.assigned_to_profile?.full_name || ticket.assigned_to_profile?.email || 'Usuario'
        addToGroup(`assigned:${ticket.assigned_to}`, label, ticket)
        break
      }
      case 'stage': {
        const label = STAGES[ticket.stage]?.label || ticket.stage
        addToGroup(`stage:${ticket.stage}`, label, ticket)
        break
      }
      case 'type': {
        const label = ticket.ticket_type || 'Sin tipo'
        const id = ticket.ticket_type ? `type:${ticket.ticket_type}` : 'missing:type'
        addToGroup(id, label, ticket)
        break
      }
      case 'label': {
        const labels = ticket.labels?.map(entry => entry.label).filter(Boolean) || []
        if (labels.length === 0) {
          addToGroup('missing:label', 'Sin etiqueta', ticket)
          break
        }
        labels.forEach(label => {
          addToGroup(`label:${label.id}`, label.name, ticket)
        })
        break
      }
      case 'created_month': {
        const createdAt = new Date(ticket.created_at)
        const monthIndex = createdAt.getMonth()
        const year = createdAt.getFullYear()
        const label = capitalize(MONTH_FORMATTER.format(createdAt))
        const sortValue = year * 12 + monthIndex
        addToGroup(`created_month:${year}-${monthIndex}`, label, ticket, sortValue)
        break
      }
      default:
        addToGroup('all', 'Todos', ticket)
    }
  })

  const grouped = Array.from(groups.values())

  if (groupBy === 'created_month') {
    return grouped.sort((a, b) => (b.sortValue ?? 0) - (a.sortValue ?? 0))
  }

  if (groupBy === 'stage') {
    const orderMap = new Map(STAGE_ORDER.map((stage, index) => [stage, index]))
    return grouped.sort((a, b) => {
      const aStage = a.id.replace('stage:', '') as keyof typeof STAGES
      const bStage = b.id.replace('stage:', '') as keyof typeof STAGES
      return (orderMap.get(aStage) ?? 999) - (orderMap.get(bStage) ?? 999)
    })
  }

  return grouped.sort((a, b) => {
    const aMissing = a.id.startsWith('missing:')
    const bMissing = b.id.startsWith('missing:')
    if (aMissing !== bMissing) return aMissing ? 1 : -1
    return a.label.localeCompare(b.label, 'es', { sensitivity: 'base' })
  })
}
