import { useState, useRef } from 'react'
import { Paperclip, FileText, Image, Loader2, Download, Trash2 } from 'lucide-react'

import { supabase } from '../lib/supabase'
import { clsx } from 'clsx'
import { ConfirmModal } from './ConfirmModal'

export type Attachment = {
  id: string
  ticket_id: string
  comment_id: string | null
  uploaded_by: string
  file_name: string
  file_size: number
  file_type: string
  storage_path: string
  created_at: string
}

type FileUploadProps = {
  ticketId: string
  commentId?: string
  onUploadComplete?: (attachment: Attachment) => void
  compact?: boolean
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// Get file icon based on MIME type
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image
  return FileText
}

export function FileUpload({ ticketId, commentId, onUploadComplete, compact = false }: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    
    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError('El archivo es demasiado grande. Máximo 10MB.')
      return
    }

    setUploading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      // Generate unique path: user_id/ticket_id/timestamp_filename
      const timestamp = Date.now()
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const storagePath = `${user.id}/${ticketId}/${timestamp}_${safeName}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('ticket-attachments')
        .upload(storagePath, file)


      if (uploadError) throw uploadError

      // Save metadata to attachments table
      const { data: attachment, error: dbError } = await supabase
        .from('attachments')
        .insert({
          ticket_id: ticketId,
          comment_id: commentId || null,
          uploaded_by: user.id,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          storage_path: storagePath
        })
        .select()
        .single()

      if (dbError) throw dbError

      onUploadComplete?.(attachment as Attachment)
    } catch (err: any) {
      console.error('Upload error:', err)
      setError(err.message || 'Error al subir el archivo')
    } finally {
      setUploading(false)
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
      />
      
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className={clsx(
          "flex items-center gap-2 transition-all",
          compact 
            ? "p-2 rounded-lg text-[#8A8F8F] hover:text-[#6353FF] hover:bg-[rgba(99,83,255,0.08)]"
            : "px-3 py-2 text-sm bg-[#F7F7F8] border border-[#E0E0E1] rounded-xl text-[#5A5F5F] hover:bg-white hover:border-[#6353FF] hover:text-[#6353FF]"
        )}
      >
        {uploading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Paperclip className="w-4 h-4" />
        )}
        {!compact && <span>{uploading ? 'Subiendo...' : 'Adjuntar archivo'}</span>}
      </button>

      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
    </div>
  )
}

// Component to display a list of attachments
type AttachmentListProps = {
  attachments: Attachment[]
  onDelete?: (id: string) => void
  canDelete?: boolean | ((attachment: Attachment) => boolean)
}

export function AttachmentList({ attachments, onDelete, canDelete = false }: AttachmentListProps) {
  const [downloading, setDownloading] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{
    type: 'download' | 'delete'
    attachment: Attachment
  } | null>(null)

  const handleDownload = async (attachment: Attachment) => {
    setDownloading(attachment.id)
    try {
      const { data, error } = await supabase.storage
        .from('ticket-attachments')
        .download(attachment.storage_path)


      if (error) throw error

      // Create download link
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = attachment.file_name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download error:', err)
    } finally {
      setDownloading(null)
    }
  }

  const handleConfirm = async () => {
    if (!confirmAction) return
    const { type, attachment } = confirmAction
    setConfirmAction(null)
    if (type === 'download') {
      await handleDownload(attachment)
      return
    }
    if (type === 'delete' && onDelete) {
      onDelete(attachment.id)
    }
  }

  if (attachments.length === 0) return null

  return (
    <div className="space-y-2">
      {attachments.map(attachment => {
        const FileIcon = getFileIcon(attachment.file_type)
        const isImage = attachment.file_type.startsWith('image/')
        const allowDelete = typeof canDelete === 'function' ? canDelete(attachment) : canDelete

        return (
          <div 
            key={attachment.id}
            className="flex items-center gap-3 p-2 bg-[#F7F7F8] border border-[#E0E0E1] rounded-lg group"
          >
            <div className={clsx(
              "w-8 h-8 rounded flex items-center justify-center",
              isImage ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
            )}>
              <FileIcon className="w-4 h-4" />
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#3F4444] truncate">{attachment.file_name}</p>
              <p className="text-[10px] text-[#8A8F8F]">{formatFileSize(attachment.file_size)}</p>
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setConfirmAction({ type: 'download', attachment })}
                disabled={downloading === attachment.id}
                className="p-1.5 hover:bg-white rounded transition-colors text-[#8A8F8F] hover:text-[#6353FF]"
                title="Descargar"
              >
                {downloading === attachment.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </button>
              
              {allowDelete && onDelete && (
                <button
                  onClick={() => setConfirmAction({ type: 'delete', attachment })}
                  className="p-1.5 hover:bg-red-50 rounded transition-colors text-[#8A8F8F] hover:text-red-500"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )
      })}

      <ConfirmModal
        open={!!confirmAction}
        title={
          confirmAction?.type === 'delete'
            ? 'Eliminar adjunto'
            : 'Descargar adjunto'
        }
        description={
          confirmAction
            ? `¿Deseas ${confirmAction.type === 'delete' ? 'eliminar' : 'descargar'} "${confirmAction.attachment.file_name}"?`
            : undefined
        }
        confirmText={confirmAction?.type === 'delete' ? 'Eliminar' : 'Descargar'}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
        isConfirming={confirmAction?.type === 'download' && !!downloading}
      />
    </div>
  )
}
