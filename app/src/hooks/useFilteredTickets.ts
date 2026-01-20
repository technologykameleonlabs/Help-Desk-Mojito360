import { useMemo } from 'react'
import { useTickets } from './useData'

import type { TicketFilters } from '../pages/DashboardPage'

/**
 * Hook that returns filtered tickets based on the provided filters.
 * Shared between KanbanBoard and TicketList views.
 */
export function useFilteredTickets(filters: TicketFilters) {
  const { data: tickets, isLoading, error } = useTickets()
  
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
  
  return {
    tickets: filteredTickets,
    allTickets: tickets || [],
    isLoading,
    error
  }
}
