import { useMemo } from 'react'
import { useTickets } from './useData'

import type { TicketFilters } from '../pages/DashboardPage'

/**
 * Hook that returns filtered tickets based on the provided filters.
 * Supports multi-select (array) filters.
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
      
      // Priority filter (multi-select)
      if (filters.priority.length > 0 && !filters.priority.includes(ticket.priority)) {
        return false
      }
      
      // Stage filter (multi-select)
      if (filters.stage.length > 0 && !filters.stage.includes(ticket.stage)) {
        return false
      }
      
      // Entity filter (multi-select)
      if (filters.entity.length > 0 && ticket.entity_id && !filters.entity.includes(ticket.entity_id)) {
        return false
      }
      
      // Application filter (multi-select)
      if (filters.application.length > 0 && ticket.application && !filters.application.includes(ticket.application)) {
        return false
      }
      
      // Classification filter (multi-select)
      if (filters.classification.length > 0 && ticket.classification && !filters.classification.includes(ticket.classification)) {
        return false
      }
      
      // Assigned to filter (multi-select)
      if (filters.assignedTo.length > 0) {
        const hasUnassigned = filters.assignedTo.includes('unassigned')
        const selectedUsers = filters.assignedTo.filter(id => id !== 'unassigned')
        
        if (hasUnassigned && !ticket.assigned_to) {
          // Match: unassigned filter and no assignment
        } else if (selectedUsers.length > 0 && ticket.assigned_to && selectedUsers.includes(ticket.assigned_to)) {
          // Match: specific user filter
        } else if (hasUnassigned && selectedUsers.length === 0 && !ticket.assigned_to) {
          // Match: only unassigned
        } else if (!hasUnassigned && selectedUsers.length > 0 && ticket.assigned_to && selectedUsers.includes(ticket.assigned_to)) {
          // Match: only specific users
        } else {
          return false
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
