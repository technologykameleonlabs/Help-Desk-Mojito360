import { useMemo } from 'react'
import { useTickets } from './useData'

import type { TicketFilters } from '../pages/DashboardPage'

/**
 * Hook that returns filtered tickets based on the provided filters.
 * Supports multi-select (array) filters.
 */
export function useFilteredTickets(filters: TicketFilters, includeArchived: boolean = false) {
  const { data: tickets, isLoading, error } = useTickets(includeArchived)
  
  const filteredTickets = useMemo(() => {
    if (!tickets) return []
    
    return tickets.filter(ticket => {
      if (filters.dateFrom || filters.dateTo) {
        const ticketDate = new Date(ticket.created_at).getTime()
        if (filters.dateFrom) {
          const start = new Date(`${filters.dateFrom}T00:00:00`).getTime()
          if (ticketDate < start) return false
        }
        if (filters.dateTo) {
          const end = new Date(`${filters.dateTo}T23:59:59`).getTime()
          if (ticketDate > end) return false
        }
      }

      // Reference filter (ticket_ref)
      if (filters.reference) {
        const ref = filters.reference.trim()
        if (ref && !ticket.ticket_ref.toString().includes(ref)) {
          return false
        }
      }

      // External reference filter (external_ref)
      if (filters.externalReference) {
        const ref = filters.externalReference.trim()
        const externalValue = ticket.external_ref || ''
        if (ref && !externalValue.includes(ref)) {
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

      // Category filter (multi-select)
      if (filters.category.length > 0) {
        if (!ticket.category || !filters.category.includes(ticket.category)) {
          return false
        }
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
  
  return {
    tickets: filteredTickets,
    allTickets: tickets || [],
    isLoading,
    error
  }
}
