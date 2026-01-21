import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Attachment } from '../components/FileUpload'

// Fetch attachments for a ticket
export function useAttachments(ticketId: string) {
  return useQuery({
    queryKey: ['attachments', ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Attachment[]
    },
    enabled: !!ticketId
  })
}

// Delete attachment
export function useDeleteAttachment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, storagePath }: { id: string; storagePath: string }) => {
      // Delete from storage first
      const { error: storageError } = await supabase.storage
        .from('files')
        .remove([storagePath])


      if (storageError) console.warn('Storage delete error:', storageError)

      // Delete metadata from database
      const { error: dbError } = await supabase
        .from('attachments')
        .delete()
        .eq('id', id)

      if (dbError) throw dbError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments'] })
    }
  })
}
