import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export type Notification = {
  id: string
  user_id: string
  ticket_id: string | null
  entity_id?: string | null
  type: 'mention' | 'assignment' | 'status_change' | 'new_comment' | 'entity_assignment'
  triggered_by: string | null
  message: string | null
  is_read: boolean
  is_email_sent: boolean
  created_at: string
}

type NewNotification = {
  user_id: string
  ticket_id?: string | null
  entity_id?: string | null
  type: 'mention' | 'assignment' | 'status_change' | 'new_comment' | 'entity_assignment'
  triggered_by?: string | null
  message?: string | null
  is_read?: boolean
  is_email_sent?: boolean
}

export async function sendNotificationEmails(notificationIds: string[]) {
  if (notificationIds.length === 0) return
  const { error } = await supabase.functions.invoke('send-notification-email', {
    body: { notificationIds },
  })
  if (error) throw error
}

// Fetch user's notifications
export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      return data as Notification[]
    }
  })
}

// Fetch unread notification count
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ['notifications', 'unread_count'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return 0

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

      if (error) throw error
      return count || 0
    }
  })
}

// Mark notification as read
export function useMarkNotificationRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
  })
}

// Mark all notifications as read
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
  })
}

// Create generic notifications
export function useCreateNotifications() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (notifications: NewNotification[]) => {
      if (notifications.length === 0) return []
      const { data, error } = await supabase
        .from('notifications')
        .insert(
          notifications.map(notification => ({
            ...notification,
            is_read: notification.is_read ?? false,
            is_email_sent: notification.is_email_sent ?? false,
          }))
        )
        .select('id')

      if (error) throw error
      return (data || []).map(item => item.id as string)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread_count'] })
    }
  })
}

// Create mention notifications and comment_mentions entries
export function useCreateMentionNotifications() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ 
      commentId, 
      ticketId, 
      mentionedUserIds 
    }: { 
      commentId: string
      ticketId: string 
      mentionedUserIds: string[] 
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Get ticket details for the notification message
      const { data: ticket } = await supabase
        .from('tickets')
        .select('ticket_ref, title')
        .eq('id', ticketId)
        .single()

      // Create comment_mentions entries
      const mentionEntries = mentionedUserIds.map(userId => ({
        comment_id: commentId,
        user_id: userId
      }))

      const { error: mentionError } = await supabase
        .from('comment_mentions')
        .upsert(mentionEntries, { onConflict: 'comment_id,user_id' })

      if (mentionError) console.error('Error creating mentions:', mentionError)

      // Create notifications for each mentioned user
      const notifications = mentionedUserIds
        .filter(userId => userId !== user.id) // Don't notify self
        .map(userId => ({
          user_id: userId,
          ticket_id: ticketId,
          type: 'mention' as const,
          triggered_by: user.id,
          message: `Te mencionaron en el ticket #${ticket?.ticket_ref || ''}: ${ticket?.title || ''}`,
          is_read: false,
          is_email_sent: false
        }))

      if (notifications.length > 0) {
        const { data: notificationRows, error: notifError } = await supabase
          .from('notifications')
          .insert(notifications)
          .select('id')

        if (notifError) throw notifError
        return { success: true, notificationIds: (notificationRows || []).map(item => item.id as string) }
      }

      return { success: true, notificationIds: [] as string[] }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread_count'] })
    }
  })
}
