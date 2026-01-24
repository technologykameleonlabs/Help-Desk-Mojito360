import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Ticket, Entity, Profile, Comment, TicketStage, TicketPriority, Label, SavedView, SavedViewScope, SlaPolicy, SlaThreshold, TicketStageHistory, TicketSlaStatus, AppSettings } from '../lib/supabase'

const chunkArray = <T,>(items: T[], size: number) => {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

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
          entity:entities(*),
          labels:ticket_labels(label:labels(*))
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
          entity:entities(*),
          labels:ticket_labels(label:labels(*))
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
  category?: string
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
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('tickets')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
          updated_by: updates.updated_by ?? user?.id ?? null,
        })
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

// App settings
export function useAppSettings() {
  return useQuery({
    queryKey: ['app_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', 1)
        .single()

      if (error) throw error
      return data as AppSettings
    }
  })
}

export function useUpdateAppSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updates: Partial<AppSettings>) => {
      const { data, error } = await supabase
        .from('app_settings')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', 1)
        .select()
        .single()

      if (error) throw error
      return data as AppSettings
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app_settings'] })
    }
  })
}

// Labels
export function useLabels() {
  return useQuery({
    queryKey: ['labels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('labels')
        .select('*')
        .order('name')

      if (error) throw error
      return data as Label[]
    }
  })
}

export function useCreateLabel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { name: string; color: string }) => {
      const { data, error } = await supabase
        .from('labels')
        .insert(input)
        .select()
        .single()

      if (error) throw error
      return data as Label
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] })
    }
  })
}

export function useUpdateLabel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name: string; color: string }) => {
      const { data, error } = await supabase
        .from('labels')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Label
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] })
    }
  })
}

export function useDeleteLabel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('labels')
        .delete()
        .eq('id', id)

      if (error) throw error
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] })
    }
  })
}

export function useUpdateTicketLabels() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ ticketId, labelIds }: { ticketId: string; labelIds: string[] }) => {
      const { error: deleteError } = await supabase
        .from('ticket_labels')
        .delete()
        .eq('ticket_id', ticketId)

      if (deleteError) throw deleteError

      if (labelIds.length === 0) {
        return { ticketId, labelIds }
      }

      const inserts = labelIds.map(labelId => ({
        ticket_id: ticketId,
        label_id: labelId,
      }))

      const { error: insertError } = await supabase
        .from('ticket_labels')
        .insert(inserts)

      if (insertError) throw insertError
      return { ticketId, labelIds }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['ticket', variables.ticketId] })
    }
  })
}

// SLA Policies
export function useSlaPolicies() {
  return useQuery({
    queryKey: ['sla_policies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sla_policies')
        .select('*')
        .order('name')

      if (error) throw error
      return data as SlaPolicy[]
    }
  })
}

export function useCreateSlaPolicy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { name: string; description?: string | null; is_active?: boolean }) => {
      const { data, error } = await supabase
        .from('sla_policies')
        .insert(input)
        .select()
        .single()

      if (error) throw error
      return data as SlaPolicy
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla_policies'] })
    }
  })
}

export function useUpdateSlaPolicy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; description?: string | null; is_active?: boolean }) => {
      const { data, error } = await supabase
        .from('sla_policies')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as SlaPolicy
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla_policies'] })
      queryClient.invalidateQueries({ queryKey: ['sla_thresholds'] })
    }
  })
}

export function useDeleteSlaPolicy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sla_policies')
        .delete()
        .eq('id', id)

      if (error) throw error
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla_policies'] })
      queryClient.invalidateQueries({ queryKey: ['sla_thresholds'] })
    }
  })
}

// SLA Thresholds
export function useSlaThresholds(policyId?: string) {
  return useQuery({
    queryKey: ['sla_thresholds', { policyId }],
    queryFn: async () => {
      let query = supabase
        .from('sla_thresholds')
        .select('*, policy:sla_policies(*), entity:entities(*)')
        .order('created_at', { ascending: false })

      if (policyId) {
        query = query.eq('policy_id', policyId)
      }

      const { data, error } = await query
      if (error) throw error
      return data as SlaThreshold[]
    }
  })
}

export function useCreateSlaThreshold() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      policy_id: string
      priority?: TicketPriority | null
      application?: string | null
      entity_id?: string | null
      warning_minutes: number
      breach_minutes: number
    }) => {
      const { data, error } = await supabase
        .from('sla_thresholds')
        .insert(input)
        .select('*, policy:sla_policies(*), entity:entities(*)')
        .single()

      if (error) throw error
      return data as SlaThreshold
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sla_thresholds'] })
      queryClient.invalidateQueries({ queryKey: ['sla_thresholds', { policyId: variables.policy_id }] })
    }
  })
}

export function useUpdateSlaThreshold() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string
      priority?: TicketPriority | null
      application?: string | null
      entity_id?: string | null
      warning_minutes?: number
      breach_minutes?: number
      policy_id?: string
    }) => {
      const { data, error } = await supabase
        .from('sla_thresholds')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*, policy:sla_policies(*), entity:entities(*)')
        .single()

      if (error) throw error
      return data as SlaThreshold
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla_thresholds'] })
    }
  })
}

export function useDeleteSlaThreshold() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sla_thresholds')
        .delete()
        .eq('id', id)

      if (error) throw error
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla_thresholds'] })
    }
  })
}

// Ticket stage history
export function useTicketStageHistory(ticketId: string) {
  return useQuery({
    queryKey: ['ticket_stage_history', ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_stage_history')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('started_at', { ascending: true })

      if (error) throw error
      return data as TicketStageHistory[]
    },
    enabled: !!ticketId
  })
}

// Ticket SLA status view
export function useTicketSlaStatus(ticketId: string) {
  return useQuery({
    queryKey: ['ticket_sla_status', ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_sla_status')
        .select('*')
        .eq('ticket_id', ticketId)
        .maybeSingle()

      if (error) throw error
      return data as TicketSlaStatus | null
    },
    enabled: !!ticketId
  })
}

export function useTicketSlaStatuses(ticketIds: string[]) {
  const sortedIds = [...ticketIds].sort()
  return useQuery({
    queryKey: ['ticket_sla_statuses', sortedIds],
    queryFn: async () => {
      if (sortedIds.length === 0) return []
      const batches = chunkArray(sortedIds, 200)
      const allRows: TicketSlaStatus[] = []
      for (const batch of batches) {
        const { data, error } = await supabase
          .from('ticket_sla_status')
          .select('*')
          .in('ticket_id', batch)

        if (error) {
          throw error
        }
        if (data?.length) {
          allRows.push(...data)
        }
      }
      return allRows
    },
    enabled: sortedIds.length > 0
  })
}

export function useTicketStageHistoryByTicketIds(ticketIds: string[]) {
  const sortedIds = [...ticketIds].sort()
  return useQuery({
    queryKey: ['ticket_stage_history_bulk', sortedIds],
    queryFn: async () => {
      if (sortedIds.length === 0) return []
      const batches = chunkArray(sortedIds, 200)
      const allRows: TicketStageHistory[] = []
      for (const batch of batches) {
        const { data, error } = await supabase
          .from('ticket_stage_history')
          .select('*')
          .in('ticket_id', batch)

        if (error) {
          throw error
        }
        if (data?.length) {
          allRows.push(...data)
        }
      }
      return allRows
    },
    enabled: sortedIds.length > 0
  })
}

export function useTicketCommentsSummary(ticketIds: string[]) {
  const sortedIds = [...ticketIds].sort()
  return useQuery({
    queryKey: ['ticket_comments_summary', sortedIds],
    queryFn: async () => {
      if (sortedIds.length === 0) return []
      const batches = chunkArray(sortedIds, 200)
      const allRows: Array<{ ticket_id: string; user_id: string; created_at: string; is_internal: boolean }> = []
      for (const batch of batches) {
        const { data, error } = await supabase
          .from('comments')
          .select('ticket_id, user_id, created_at, is_internal')
          .in('ticket_id', batch)
          .order('created_at', { ascending: true })

        if (error) {
          throw error
        }
        if (data?.length) {
          allRows.push(...data)
        }
      }
      return allRows
    },
    enabled: sortedIds.length > 0
  })
}

// Comments
export function useComments(ticketId: string) {
  return useQuery({
    queryKey: ['comments', ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comments')
        .select('*, user:profiles!comments_user_id_fkey(*)')
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
        .select('*, user:profiles!comments_user_id_fkey(*)')
        .single()
      
      if (error) throw error
      return data
    },
    onSuccess: (_, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: ['comments', ticketId] })
    }
  })
}

export function useUpdateComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string; content: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('comments')
        .update({
          content,
          edited_at: new Date().toISOString(),
          edited_by: user?.id || null,
        })
        .eq('id', commentId)
        .select('*, user:profiles!comments_user_id_fkey(*)')
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      if (data?.ticket_id) {
        queryClient.invalidateQueries({ queryKey: ['comments', data.ticket_id] })
      }
    }
  })
}

export function useDeleteComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ commentId }: { commentId: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('comments')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id || null,
        })
        .eq('id', commentId)
        .select('*, user:profiles!comments_user_id_fkey(*)')
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      if (data?.ticket_id) {
        queryClient.invalidateQueries({ queryKey: ['comments', data.ticket_id] })
      }
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
        .select(`
          *,
          assigned_to_profile:profiles!entities_assigned_to_fkey(*)
        `)
        .eq('status', 'active')
        .order('name')
      
      if (error) throw error
      return data as Entity[]
    }
  })
}

export function useUpdateEntity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Entity> & { id: string }) => {
      const { data, error } = await supabase
        .from('entities')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities'] })
    }
  })
}

export function useUpdateEntities() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: Partial<Entity> }) => {
      const { data, error } = await supabase
        .from('entities')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .in('id', ids)
        .select()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities'] })
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

// Saved views
export function useSavedViews(scope: SavedViewScope) {
  return useQuery({
    queryKey: ['saved_views', scope],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_views')
        .select('*')
        .eq('scope', scope)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as SavedView[]
    }
  })
}

export function useCreateSavedView() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: Omit<SavedView, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('saved_views')
        .insert(input)
        .select()
        .single()

      if (error) throw error
      return data as SavedView
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['saved_views', variables.scope] })
    }
  })
}

export function useUpdateSavedView() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SavedView> & { id: string }) => {
      const { data, error } = await supabase
        .from('saved_views')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as SavedView
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['saved_views', data.scope] })
    }
  })
}

export function useDeleteSavedView() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, scope }: { id: string; scope: SavedViewScope }) => {
      const { error } = await supabase
        .from('saved_views')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { id, scope }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['saved_views', data.scope] })
    }
  })
}
