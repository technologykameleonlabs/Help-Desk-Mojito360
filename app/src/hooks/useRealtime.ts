import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Ticket } from '../lib/supabase'


/**
 * Hook to subscribe to realtime changes on tickets table.
 * Automatically invalidates React Query cache when changes occur.
 */
export function useRealtimeTickets() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase.channel('tickets-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets'
        },
        (payload) => {
          console.log('[Realtime] Ticket change:', payload.eventType)
          
          // Invalidate tickets list
          queryClient.invalidateQueries({ queryKey: ['tickets'] })
          
          // If updating a specific ticket, invalidate that too
          if (payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
            const ticketId = (payload.old as Ticket)?.id || (payload.new as Ticket)?.id
            if (ticketId) {
              queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}

/**
 * Hook to subscribe to realtime changes on comments for a specific ticket.
 */
export function useRealtimeComments(ticketId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!ticketId) return

    const channel = supabase.channel(`comments-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `ticket_id=eq.${ticketId}`
        },
        (payload) => {
          console.log('[Realtime] Comment change:', payload.eventType)
          queryClient.invalidateQueries({ queryKey: ['comments', ticketId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [ticketId, queryClient])
}

/**
 * Hook to subscribe to realtime changes on notifications for the current user.
 */
export function useRealtimeNotifications() {
  const queryClient = useQueryClient()

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    let isActive = true

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!isActive || !user) return

      channel = supabase
        .channel(`notifications-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('[Realtime] Notification change:', payload.eventType)
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
            queryClient.invalidateQueries({ queryKey: ['notifications', 'unread_count'] })
          }
        )
        .subscribe()
    })

    return () => {
      isActive = false
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [queryClient])
}
