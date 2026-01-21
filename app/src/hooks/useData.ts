import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Ticket, Entity, Profile, Comment, TicketStage, TicketPriority } from '../lib/supabase'

// Closed/archived stages to filter out by default
const CLOSED_STAGES: TicketStage[] = ['done', 'cancelled', 'paused']

// Tickets (default: only open tickets)
export function useTickets(includeArchived: boolean = false) {
  return useQuery({
    queryKey: ['tickets', { includeArchived }],
    queryFn: async () => {
      let query = supabase
        .from('tickets')
        .select(`
          *,
          assigned_to_profile:profiles!tickets_assigned_to_fkey(*),
          created_by_profile:profiles!tickets_created_by_fkey(*),
          entity:entities(*)
        `)
        .order('created_at', { ascending: false })
      
      // Filter out closed tickets by default
      if (!includeArchived) {
        query = query.not('stage', 'in', `(${CLOSED_STAGES.join(',')})`)
      }
      
      const { data, error } = await query
      
      if (error) throw error
      return data as Ticket[]
    }
  })
}

// Paginated tickets (for large datasets)
const PAGE_SIZE = 20

export function useTicketsPaginated(includeArchived: boolean = false) {
  return useInfiniteQuery({
    queryKey: ['tickets', 'paginated', { includeArchived }],
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from('tickets')
        .select(`
          *,
          assigned_to_profile:profiles!tickets_assigned_to_fkey(*),
          created_by_profile:profiles!tickets_created_by_fkey(*),
          entity:entities(*)
        `)
        .order('created_at', { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1)
      
      // Filter out closed tickets by default
      if (!includeArchived) {
        query = query.not('stage', 'in', `(${CLOSED_STAGES.join(',')})`)
      }
      
      const { data, error } = await query
      
      if (error) throw error
      return {
        tickets: data as Ticket[],
        nextPage: data.length === PAGE_SIZE ? pageParam + 1 : undefined
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0
  })
}


export function useTicket(id: string) {
  return useQuery({
    queryKey: ['ticket', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          assigned_to_profile:profiles!tickets_assigned_to_fkey(*),
          created_by_profile:profiles!tickets_created_by_fkey(*),
          entity:entities(*)
        `)
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data as Ticket
    },
    enabled: !!id
  })
}

type CreateTicketInput = {
  title: string
  description?: string
  stage?: TicketStage
  priority?: TicketPriority
  assigned_to?: string
  entity_id?: string
  application?: string
  classification?: string
  channel?: string
  ticket_type?: string
}

export function useCreateTicket() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (input: CreateTicketInput) => {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data, error } = await supabase
        .from('tickets')
        .insert({
          ...input,
          created_by: user?.id
        })
        .select()
        .single()
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    }
  })
}

export function useUpdateTicket() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Ticket> & { id: string }) => {
      const { data, error } = await supabase
        .from('tickets')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['ticket', variables.id] })
    }
  })
}

// Comments
export function useComments(ticketId: string) {
  return useQuery({
    queryKey: ['comments', ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comments')
        .select('*, user:profiles(*)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })
      
      if (error) throw error
      return data as Comment[]
    },
    enabled: !!ticketId
  })
}

export function useCreateComment() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ ticketId, content, isInternal }: { ticketId: string; content: string; isInternal?: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data, error } = await supabase
        .from('comments')
        .insert({
          ticket_id: ticketId,
          user_id: user?.id,
          content,
          is_internal: isInternal ?? false
        })
        .select('*, user:profiles(*)')
        .single()
      
      if (error) throw error
      return data
    },
    onSuccess: (_, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: ['comments', ticketId] })
    }
  })
}


// Entities
export function useEntities() {
  return useQuery({
    queryKey: ['entities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .eq('status', 'active')
        .order('name')
      
      if (error) throw error
      return data as Entity[]
    }
  })
}

// Profiles (users)
export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name')
      
      if (error) throw error
      return data as Profile[]
    }
  })
}

// Current user
export function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      return data as Profile | null
    }
  })
}
