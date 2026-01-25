import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { 
  useTicket, 
  useUpdateTicket, 
  useComments, 
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
  useProfiles,
  useEntities,
  useLabels,
  useUpdateTicketLabels,
  useCurrentUser,
  useTicketStageHistory,
  useTicketSlaStatus
} from '../hooks/useData'
import { sendNotificationEmails, useCreateMentionNotifications, useCreateNotifications } from '../hooks/useNotifications'
import { useRealtimeComments } from '../hooks/useRealtime'
import { MentionTextarea, extractMentions } from './MentionTextarea'
import { useAttachments, useDeleteAttachment } from '../hooks/useAttachments'
import { AttachmentList } from './FileUpload'
import { ConfirmModal } from './ConfirmModal'
import { supabase } from '../lib/supabase'

import { 
  X, 
  Clock, 
  User, 
  Building2, 
  Users,
  Tag, 
  MessageSquare, 
  Send,
  Loader2,
  AlertCircle,
  ExternalLink,
  History,
  ChevronUp,
  ChevronDown,
  Paperclip,
  Plus
} from 'lucide-react'
import { STAGES, PRIORITIES, type TicketStage, type TicketPriority, type Ticket } from '../lib/supabase'
import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { MultiSelect } from './MultiSelect'
import { getCategoryOption } from '../lib/ticketOptions'
import { useQueryClient } from '@tanstack/react-query'

const TICKET_TYPES = [
  '🔔 Alertas', '🔼 Carga', '💽 Dato', '📝 Documentos', 
  '📡 Integración', '📈 Reportes', '👤 Usuarios', '✏️ Modificación', 
  '⏱️ Rendimiento', '💕 Mapeos', '💎 Gestión del soporte', '🔎 Control'
]

const APPLICATION_OPTIONS = ['Mojito360', 'Wintruck', 'Odoo', 'Otros']
const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
])

type EditableField = 'stage' | 'priority' | 'entity_id' | 'assigned_to' | 'ticket_type' | 'application' | 'labels'

export function TicketDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { data: ticket, isLoading, error, isFetching } = useTicket(id!)
  const { data: comments } = useComments(id!)
  const { data: currentUser } = useCurrentUser()
  const { data: profiles } = useProfiles()
  const { data: entities } = useEntities()
  const { data: labels } = useLabels()
  const { data: attachments } = useAttachments(id!)
  const { data: ticketStageHistory } = useTicketStageHistory(id!)
  const { data: ticketSlaStatus } = useTicketSlaStatus(id!)
  const updateTicket = useUpdateTicket()
  const updateTicketLabels = useUpdateTicketLabels()
  const updateComment = useUpdateComment()
  const deleteComment = useDeleteComment()
  const deleteAttachment = useDeleteAttachment()

  // Subscribe to realtime comment updates
  useRealtimeComments(id!)

  const createComment = useCreateComment()
  const createMentionNotifications = useCreateMentionNotifications()
  const createNotifications = useCreateNotifications()
  
  const [commentText, setCommentText] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([])
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([])
  const [pendingCommentFiles, setPendingCommentFiles] = useState<File[]>([])
  const [commentUploadError, setCommentUploadError] = useState<string | null>(null)
  const [commentUploading, setCommentUploading] = useState(false)
  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingCommentText, setEditingCommentText] = useState('')
  const commentFileInputRef = useRef<HTMLInputElement>(null)
  const [editingFields, setEditingFields] = useState<Set<EditableField>>(new Set())
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [awaitingRefresh, setAwaitingRefresh] = useState(false)
  const [pendingSaveMessage, setPendingSaveMessage] = useState<string | null>(null)
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now())
  const [solutionModalOpen, setSolutionModalOpen] = useState(false)
  const [solutionModalText, setSolutionModalText] = useState('')
  const [solutionModalError, setSolutionModalError] = useState<string | null>(null)
  const [pendingUpdates, setPendingUpdates] = useState<(Partial<Ticket> & { id: string }) | null>(null)

  const [draft, setDraft] = useState({
    stage: '' as TicketStage,
    priority: '' as TicketPriority,
    entity_id: '' as string,
    assigned_to: '' as string,
    ticket_type: '' as string,
    application: '' as string,
  })

  useEffect(() => {
    if (!ticket) return
    setDraft({
      stage: ticket.stage,
      priority: ticket.priority,
      entity_id: ticket.entity_id || '',
      assigned_to: ticket.assigned_to || '',
      ticket_type: ticket.ticket_type || '',
      application: ticket.application || '',
    })
    setEditingFields(new Set())
    setSelectedLabelIds(ticket.labels?.map(item => item.label.id) || [])
  }, [ticket])

  useEffect(() => {
    if (!saveMessage) return
    const timeout = setTimeout(() => setSaveMessage(null), 3000)
    return () => clearTimeout(timeout)
  }, [saveMessage])

  useEffect(() => {
    if (!awaitingRefresh) return
    if (!updateTicket.isPending && !updateTicketLabels.isPending && !isFetching) {
      setAwaitingRefresh(false)
      if (pendingSaveMessage) {
        setSaveMessage(pendingSaveMessage)
        setPendingSaveMessage(null)
      }
    }
  }, [awaitingRefresh, updateTicket.isPending, updateTicketLabels.isPending, isFetching, pendingSaveMessage])

  useEffect(() => {
    const interval = setInterval(() => {
      setNowTimestamp(Date.now())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  // Track mentions as user types
  const handleMention = useCallback((userId: string) => {
    setMentionedUserIds(prev => 
      prev.includes(userId) ? prev : [...prev, userId]
    )
  }, [])

  const handleCommentFilesChange = (files: FileList | null) => {
    if (!files) return
    const nextFiles: File[] = []
    let errorMessage: string | null = null

    Array.from(files).forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        errorMessage = 'El archivo supera 10MB.'
        return
      }
      if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
        errorMessage = 'Tipo de archivo no permitido.'
        return
      }
      nextFiles.push(file)
    })

    if (errorMessage) {
      setCommentUploadError(errorMessage)
      return
    }

    setCommentUploadError(null)
    setPendingCommentFiles(prev => [...prev, ...nextFiles])
  }

  const removePendingCommentFile = (index: number) => {
    setPendingCommentFiles(prev => prev.filter((_, i) => i !== index))
  }

  const uploadCommentAttachments = async (commentId: string) => {
    if (pendingCommentFiles.length === 0) return

    setCommentUploading(true)
    setCommentUploadError(null)

    try {
      const ticketId = ticket?.id
      if (!ticketId) {
        throw new Error('Ticket no disponible')
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      for (const file of pendingCommentFiles) {
        const timestamp = Date.now()
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
        const storagePath = `${user.id}/${ticketId}/${timestamp}_${safeName}`

        const { error: uploadError } = await supabase.storage
          .from('ticket-attachments')
          .upload(storagePath, file)

        if (uploadError) throw uploadError

        const { error: dbError } = await supabase
          .from('attachments')
          .insert({
            ticket_id: ticketId,
            comment_id: commentId,
            uploaded_by: user.id,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
            storage_path: storagePath
          })

        if (dbError) throw dbError
      }

      setPendingCommentFiles([])
      await queryClient.invalidateQueries({ queryKey: ['attachments', ticketId] })
      await queryClient.refetchQueries({ queryKey: ['attachments', ticketId] })
    } catch (err: any) {
      console.error('Upload error:', err)
      setCommentUploadError(err.message || 'Error al subir archivos')
    } finally {
      setCommentUploading(false)
    }
  }

  const labelsChanged = useMemo(() => {
    const current = ticket?.labels?.map(item => item.label.id) || []
    if (current.length !== selectedLabelIds.length) return true
    const sortedCurrent = [...current].sort()
    const sortedSelected = [...selectedLabelIds].sort()
    return sortedCurrent.some((value, index) => value !== sortedSelected[index])
  }, [ticket?.labels, selectedLabelIds])

  const hasChanges = useMemo(() => {
    if (!ticket) return false
    return (
      draft.stage !== ticket.stage ||
      draft.priority !== ticket.priority ||
      (draft.entity_id || null) !== ticket.entity_id ||
      (draft.assigned_to || null) !== ticket.assigned_to ||
      (draft.ticket_type || '') !== (ticket.ticket_type || '') ||
      (draft.application || '') !== (ticket.application || '') ||
      labelsChanged
    )
  }, [draft, ticket, labelsChanged])

  const selectedEntity = useMemo(() => {
    if (draft.entity_id) {
      return entities?.find(entity => entity.id === draft.entity_id) || null
    }
    return ticket?.entity || null
  }, [draft.entity_id, entities, ticket?.entity])

  const entityResponsible = selectedEntity?.assigned_to_profile?.full_name ||
    selectedEntity?.assigned_to_profile?.email ||
    ''
  const categoryOption = getCategoryOption(ticket?.category)

  const closePath = useMemo(() => {
    const path = location.pathname
    if (path.startsWith('/my-tickets')) return '/my-tickets'
    if (path.startsWith('/inbox')) return '/inbox'
    if (path.startsWith('/archive')) return '/archive'
    return '/'
  }, [location.pathname])

  const labelOptions = labels?.map(label => ({
    value: label.id,
    label: label.name,
    color: label.color,
  })) || []

  const selectedLabels = useMemo(() => {
    if (!labels) return []
    const selectedSet = new Set(selectedLabelIds)
    return labels.filter(label => selectedSet.has(label.id))
  }, [labels, selectedLabelIds])

  const slaBadge = useMemo(() => {
    const status = ticketSlaStatus?.sla_status
    if (status === 'A tiempo') {
      return { label: status, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    }
    if (status === 'En riesgo') {
      return { label: status, className: 'bg-amber-50 text-amber-700 border-amber-200' }
    }
    if (status === 'Atrasado') {
      return { label: status, className: 'bg-red-50 text-red-600 border-red-200' }
    }
    return { label: 'Sin SLA', className: 'bg-[#F7F7F8] text-[#5A5F5F] border-[#E0E0E1]' }
  }, [ticketSlaStatus?.sla_status])

  const pendingValidationSinceLabel = useMemo(() => {
    if (!ticket?.pending_validation_since) return null
    const date = new Date(ticket.pending_validation_since)
    if (Number.isNaN(date.getTime())) return null
    return format(date, 'dd/MM/yyyy HH:mm', { locale: es })
  }, [ticket?.pending_validation_since])

  const formatDuration = useCallback((totalSeconds: number) => {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds))
    const totalMinutes = Math.floor(safeSeconds / 60)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }, [])

  const stageStats = useMemo(() => {
    if (!ticketStageHistory || ticketStageHistory.length === 0) {
      return {
        items: [] as Array<{ stage: TicketStage; seconds: number }>,
        totalActiveSeconds: 0,
        totalPausedSeconds: 0,
      }
    }

    const totals = new Map<TicketStage, number>()
    let totalActiveSeconds = 0
    let totalPausedSeconds = 0
    const now = new Date(nowTimestamp)

    ticketStageHistory.forEach(entry => {
      const startedAt = new Date(entry.started_at)
      const endedAt = entry.ended_at ? new Date(entry.ended_at) : now
      const durationSeconds = entry.duration_seconds ?? Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000))
      totals.set(entry.stage, (totals.get(entry.stage) || 0) + durationSeconds)
      if (entry.is_paused) {
        totalPausedSeconds += durationSeconds
      } else {
        totalActiveSeconds += durationSeconds
      }
    })

    const items = Array.from(totals.entries())
      .map(([stage, seconds]) => ({ stage, seconds }))
      .sort((a, b) => b.seconds - a.seconds)

    return { items, totalActiveSeconds, totalPausedSeconds }
  }, [ticketStageHistory, nowTimestamp])

  const isClient = currentUser?.role === 'client'
  const isSupportUser = !isClient
  const ticketAttachments = useMemo(() => {
    return attachments?.filter(item => !item.comment_id) || []
  }, [attachments])
  const visibleComments = useMemo(() => {
    if (!comments) return []
    return isClient ? comments.filter(comment => !comment.is_internal) : comments
  }, [comments, isClient])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full w-[600px] bg-white border-l border-[#E0E0E1]">
        <Loader2 className="w-8 h-8 animate-spin text-[#6353FF]" />
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-[600px] bg-white border-l border-[#E0E0E1] text-[#8A8F8F] gap-4">
        <AlertCircle className="w-12 h-12 text-[#E0E0E1]" />
        <p>No se encontró el ticket o hubo un error.</p>
        <button onClick={() => navigate(closePath)} className="text-[#6353FF] hover:underline">
          Volver al Dashboard
        </button>
      </div>
    )
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim()) return

    try {
      // Create the comment
      const result = await createComment.mutateAsync({
        ticketId: ticket.id,
        content: commentText,
        isInternal: currentUser?.role === 'client' ? false : isInternal
      })

      // Extract all mentioned users from the text
      const allMentions = profiles 
        ? extractMentions(commentText, profiles) 
        : mentionedUserIds
      
      // Create notifications for mentioned users
      if (allMentions.length > 0 && result?.id) {
        const { notificationIds } = await createMentionNotifications.mutateAsync({
          commentId: result.id,
          ticketId: ticket.id,
          mentionedUserIds: allMentions
        })
        if (notificationIds.length > 0) {
          await sendNotificationEmails(notificationIds)
        }
      }

      if (result?.id) {
        await uploadCommentAttachments(result.id)
      }

      setCommentText('')
      setMentionedUserIds([])
      setIsInternal(false)
      setIsAttachmentModalOpen(false)
    } catch (e) {
      console.error(e)
    }
  }

  const startEditComment = (commentId: string, content: string) => {
    setEditingCommentId(commentId)
    setEditingCommentText(content)
  }

  const cancelEditComment = () => {
    setEditingCommentId(null)
    setEditingCommentText('')
  }

  const saveEditComment = async (commentId: string) => {
    if (!editingCommentText.trim()) return
    try {
      await updateComment.mutateAsync({ commentId, content: editingCommentText.trim() })
      cancelEditComment()
    } catch (e) {
      console.error(e)
      alert('No se pudo editar el mensaje.')
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    const confirmDelete = window.confirm('¿Eliminar este mensaje?')
    if (!confirmDelete) return
    try {
      await deleteComment.mutateAsync({ commentId })
    } catch (e) {
      console.error(e)
      alert('No se pudo eliminar el mensaje.')
    }
  }

  const handleDeleteAttachment = (attachmentId: string) => {
    const attachment = attachments?.find(item => item.id === attachmentId)
    if (!attachment) return
    deleteAttachment.mutate({ id: attachment.id, storagePath: attachment.storage_path })
  }

  const applyUpdates = async (updates: Partial<Ticket> & { id: string }) => {
    setSaveMessage(null)
    setPendingSaveMessage('Cambios guardados correctamente.')
    setAwaitingRefresh(true)

    if (Object.keys(updates).length > 1) {
      await updateTicket.mutateAsync(updates)
    }

    const assignedChanged =
      (draft.assigned_to || null) !== (ticket?.assigned_to || null)
    const nextAssignee = draft.assigned_to || null

    if (
      assignedChanged &&
      nextAssignee &&
      nextAssignee !== currentUser?.id &&
      ticket
    ) {
      const notificationIds = await createNotifications.mutateAsync([
        {
          user_id: nextAssignee,
          ticket_id: ticket.id,
          type: 'assignment',
          triggered_by: currentUser?.id ?? null,
          message: `Te asignaron el ticket #${ticket.ticket_ref}: ${ticket.title}`,
        }
      ])

      await sendNotificationEmails(notificationIds)
    }

    if (labelsChanged && ticket) {
      await updateTicketLabels.mutateAsync({
        ticketId: ticket.id,
        labelIds: selectedLabelIds,
      })
    }
    setEditingFields(new Set())
  }

  const handleApplyChanges = async () => {
    if (!hasChanges) return
    try {
      const updates: Partial<Ticket> & { id: string } = { id: ticket.id }
      if (draft.stage !== ticket.stage) updates.stage = draft.stage
      if (draft.priority !== ticket.priority) updates.priority = draft.priority
      if ((draft.entity_id || null) !== ticket.entity_id) updates.entity_id = draft.entity_id || null
      if ((draft.assigned_to || null) !== ticket.assigned_to) updates.assigned_to = draft.assigned_to || null
      if ((draft.ticket_type || '') !== (ticket.ticket_type || '')) updates.ticket_type = draft.ticket_type || null
      if ((draft.application || '') !== (ticket.application || '')) updates.application = draft.application || null

      if (draft.stage === 'pending_validation' && draft.stage !== ticket.stage) {
        setPendingUpdates(updates)
        setSolutionModalText(ticket.solution || '')
        setSolutionModalError(null)
        setSolutionModalOpen(true)
        return
      }

      await applyUpdates(updates)
    } catch (e) {
      console.error(e)
      alert('No se pudo actualizar el ticket.')
      setAwaitingRefresh(false)
      setPendingSaveMessage(null)
    }
  }

  const handleCancelChanges = () => {
    setDraft({
      stage: ticket.stage,
      priority: ticket.priority,
      entity_id: ticket.entity_id || '',
      assigned_to: ticket.assigned_to || '',
      ticket_type: ticket.ticket_type || '',
      application: ticket.application || '',
    })
    setSelectedLabelIds(ticket.labels?.map(item => item.label.id) || [])
    setEditingFields(new Set())
  }

  const enableEdit = (field: EditableField) => {
    setEditingFields(prev => {
      const next = new Set(prev)
      next.add(field)
      return next
    })
  }

  const entityOptions = entities?.map(entity => ({
    value: entity.id,
    label: entity.name,
  })) || []

  const profileOptions = [
    { value: '', label: 'Sin asignar' },
    ...(profiles?.map(profile => ({
      value: profile.id,
      label: profile.full_name || profile.email || 'Usuario',
    })) || [])
  ]

  const isSaving = updateTicket.isPending || updateTicketLabels.isPending || awaitingRefresh || isFetching

  return (
    <div className="flex flex-col h-full bg-white border-l border-[#E0E0E1] w-[600px] animate-in slide-in-from-right duration-300 shadow-xl relative z-20">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#E0E0E1]">
        <div className="flex items-center gap-3">
          <span className="text-[#8A8F8F] font-mono text-sm">#{ticket.ticket_ref}</span>
          <h2 className="text-[#3F4444] font-semibold flex-1 line-clamp-1">{ticket.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {ticket.external_url ? (
            <a
              href={ticket.external_url}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 hover:bg-[#F7F7F8] rounded-lg text-[#8A8F8F] transition-colors"
              title="Abrir en origen"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
          ) : null}
          <button 
            onClick={() => navigate(closePath)}
            className="p-1.5 hover:bg-[#F7F7F8] rounded-lg text-[#8A8F8F] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {!isChatOpen ? (
        <>
          {/* Content */}
          <div className="flex-1 overflow-auto">
            {/* Quick Actions */}
            <div className="p-6 space-y-6">
          {/* Properties */}
          <div className="relative space-y-4 py-4 border-b border-[#E0E0E1]">
            {isSaving && (
              <div className="absolute inset-0 z-10 rounded-xl bg-white/60 backdrop-blur-[1px] flex items-center justify-center">
                <div className="flex items-center gap-2 text-sm text-[#6353FF]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start text-sm gap-3">
                  <Tag className="w-4 h-4 text-[#8A8F8F] mt-0.5" />
                  <div className="flex-1">
                    <span className="text-[#8A8F8F] block">Estado</span>
                    {editingFields.has('stage') ? (
                      <select
                        value={draft.stage}
                        onChange={(e) => setDraft(prev => ({ ...prev, stage: e.target.value as TicketStage }))}
                        className="mt-1 w-full bg-white border border-[#E0E0E1] rounded-xl px-3 py-2 text-sm text-[#3F4444] outline-none focus:ring-1 focus:ring-[#6353FF] transition-all appearance-none"
                      >
                        {Object.entries(STAGES).map(([key, value]) => (
                          <option key={key} value={key}>{(value as any).label}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        type="button"
                        onClick={() => enableEdit('stage')}
                        className="text-left text-[#3F4444] font-medium hover:text-[#6353FF] transition-colors"
                      >
                        {STAGES[ticket.stage].label}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-start text-sm gap-3">
                  <AlertCircle className="w-4 h-4 text-[#8A8F8F] mt-0.5" />
                  <div className="flex-1">
                    <span className="text-[#8A8F8F] block">Prioridad</span>
                    {editingFields.has('priority') ? (
                      <select
                        value={draft.priority}
                        onChange={(e) => setDraft(prev => ({ ...prev, priority: e.target.value as TicketPriority }))}
                        className="mt-1 w-full bg-white border border-[#E0E0E1] rounded-xl px-3 py-2 text-sm text-[#3F4444] outline-none focus:ring-1 focus:ring-[#6353FF] transition-all appearance-none"
                      >
                        {Object.entries(PRIORITIES).map(([key, value]) => (
                          <option key={key} value={key}>{(value as any).label}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        type="button"
                        onClick={() => enableEdit('priority')}
                        className="text-left text-[#3F4444] font-medium hover:text-[#6353FF] transition-colors"
                      >
                        {PRIORITIES[ticket.priority].label}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-start text-sm gap-3">
                  <Clock className="w-4 h-4 text-[#8A8F8F] mt-0.5" />
                  <div className="flex-1">
                    <span className="text-[#8A8F8F] block">Estado SLA</span>
                    <span className={`inline-flex items-center px-2 py-1 mt-1 rounded-lg text-[11px] font-semibold border ${slaBadge.className}`}>
                      {slaBadge.label}
                    </span>
                    {ticketSlaStatus?.elapsed_minutes !== undefined ? (
                      <div className="text-[11px] text-[#8A8F8F] mt-1">
                        {ticketSlaStatus.elapsed_minutes} min transcurridos
                      </div>
                    ) : (
                      <div className="text-[11px] text-[#8A8F8F] mt-1">Sin reglas aplicables</div>
                    )}
                  </div>
                </div>

                <div className="flex items-start text-sm gap-3">
                  <Building2 className="w-4 h-4 text-[#8A8F8F] mt-0.5" />
                  <div className="flex-1">
                    <span className="text-[#8A8F8F] block">Entidad</span>
                    {editingFields.has('entity_id') ? (
                      <select
                        value={draft.entity_id}
                        onChange={(e) => setDraft(prev => ({ ...prev, entity_id: e.target.value }))}
                        className="mt-1 w-full bg-white border border-[#E0E0E1] rounded-xl px-3 py-2 text-sm text-[#3F4444] outline-none focus:ring-1 focus:ring-[#6353FF] transition-all appearance-none"
                      >
                        <option value="">Sin entidad</option>
                        {entityOptions.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        type="button"
                        onClick={() => enableEdit('entity_id')}
                        className="text-left text-[#3F4444] font-medium hover:text-[#6353FF] transition-colors"
                      >
                        {ticket.entity?.name || '---'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-start text-sm gap-3">
                  <Users className="w-4 h-4 text-[#8A8F8F] mt-0.5" />
                  <div className="flex-1">
                    <span className="text-[#8A8F8F] block">Responsable</span>
                    <span className="text-[#3F4444] font-medium">{entityResponsible}</span>
                  </div>
                </div>

                <div className="flex items-start text-sm gap-3">
                  <Tag className="w-4 h-4 text-[#8A8F8F] mt-0.5" />
                  <div className="flex-1">
                    <span className="text-[#8A8F8F] block">Categoría</span>
                    <span className="text-[#3F4444] font-medium">
                      {categoryOption ? `${categoryOption.icon} ${categoryOption.label}` : '---'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start text-sm gap-3">
                  <Tag className="w-4 h-4 text-[#8A8F8F] mt-0.5" />
                  <div className="flex-1">
                    <span className="text-[#8A8F8F] block">Aplicación</span>
                    {editingFields.has('application') ? (
                      <select
                        value={draft.application}
                        onChange={(e) => setDraft(prev => ({ ...prev, application: e.target.value }))}
                        className="mt-1 w-full bg-white border border-[#E0E0E1] rounded-xl px-3 py-2 text-sm text-[#3F4444] outline-none focus:ring-1 focus:ring-[#6353FF] transition-all appearance-none"
                      >
                        <option value="">Sin aplicación</option>
                        {APPLICATION_OPTIONS.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        type="button"
                        onClick={() => enableEdit('application')}
                        className="text-left text-[#3F4444] font-medium hover:text-[#6353FF] transition-colors"
                      >
                        {ticket.application || '---'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start text-sm gap-3">
                  <Tag className="w-4 h-4 text-[#8A8F8F] mt-0.5" />
                  <div className="flex-1">
                    <span className="text-[#8A8F8F] block">Tipo</span>
                    {editingFields.has('ticket_type') ? (
                      <select
                        value={draft.ticket_type}
                        onChange={(e) => setDraft(prev => ({ ...prev, ticket_type: e.target.value }))}
                        className="mt-1 w-full bg-white border border-[#E0E0E1] rounded-xl px-3 py-2 text-sm text-[#3F4444] outline-none focus:ring-1 focus:ring-[#6353FF] transition-all appearance-none"
                      >
                        <option value="">Sin tipo</option>
                        {TICKET_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        type="button"
                        onClick={() => enableEdit('ticket_type')}
                        className="text-left text-[#3F4444] font-medium hover:text-[#6353FF] transition-colors"
                      >
                        {ticket.ticket_type || 'No definido'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-start text-sm gap-3">
                  <ExternalLink className="w-4 h-4 text-[#8A8F8F] mt-0.5" />
                  <div className="flex-1">
                    <span className="text-[#8A8F8F] block">Referencia externa</span>
                    <span className="text-[#3F4444] font-medium">{ticket.external_ref ?? ''}</span>
                  </div>
                </div>

                <div className="flex items-start text-sm gap-3">
                  <Tag className="w-4 h-4 text-[#8A8F8F] mt-0.5" />
                  <div className="flex-1">
                    <span className="text-[#8A8F8F] block">Fuente externa</span>
                    <span className="text-[#3F4444] font-medium">{ticket.external_source ?? '---'}</span>
                  </div>
                </div>

                <div className="flex items-start text-sm gap-3">
                  <User className="w-4 h-4 text-[#8A8F8F] mt-0.5" />
                  <div className="flex-1">
                    <span className="text-[#8A8F8F] block">Asignado a</span>
                    {editingFields.has('assigned_to') ? (
                      <select
                        value={draft.assigned_to}
                        onChange={(e) => setDraft(prev => ({ ...prev, assigned_to: e.target.value }))}
                        className="mt-1 w-full bg-white border border-[#E0E0E1] rounded-xl px-3 py-2 text-sm text-[#3F4444] outline-none focus:ring-1 focus:ring-[#6353FF] transition-all appearance-none"
                      >
                        {profileOptions.map(option => (
                          <option key={option.value || 'unassigned'} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        type="button"
                        onClick={() => enableEdit('assigned_to')}
                        className="text-left text-[#3F4444] font-medium hover:text-[#6353FF] transition-colors"
                      >
                        {ticket.assigned_to_profile?.full_name || 'Sin asignar'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-start text-sm gap-3">
                  <Tag className="w-4 h-4 text-[#8A8F8F] mt-0.5" />
                  <div className="flex-1">
                    <span className="text-[#8A8F8F] block">Etiqueta</span>
                    {editingFields.has('labels') ? (
                      <div className="mt-1">
                        <MultiSelect
                          options={labelOptions}
                          value={selectedLabelIds}
                          onChange={setSelectedLabelIds}
                          placeholder="Sin etiquetas"
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => enableEdit('labels')}
                        className="text-left text-[#3F4444] font-medium hover:text-[#6353FF] transition-colors"
                      >
                        {selectedLabels.length ? (
                          <div className="flex flex-wrap items-center gap-1">
                            {selectedLabels.map(label => (
                              <span
                                key={label.id}
                                className={clsx(
                                  "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                                  label.color ? "text-white" : "bg-[#F7F7F8] text-[#5A5F5F]",
                                  label.color && !label.color.startsWith('#') ? label.color : ""
                                )}
                                style={label.color?.startsWith('#') ? { backgroundColor: label.color } : undefined}
                              >
                                {label.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          '---'
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-start text-sm gap-3">
                  <Clock className="w-4 h-4 text-[#8A8F8F] mt-0.5" />
                  <div className="flex-1">
                    <span className="text-[#8A8F8F] block">Creado</span>
                    <span className="text-[#3F4444] font-medium">
                      {format(new Date(ticket.created_at), "d 'de' MMMM", { locale: es })}
                    </span>
                  </div>
                </div>

                <div className="flex items-start text-sm gap-3">
                  <History className="w-4 h-4 text-[#8A8F8F] mt-0.5" />
                  <div className="flex-1">
                    <span className="text-[#8A8F8F] block">Ult. Modificación</span>
                    <span className="text-[#3F4444] font-medium">
                      {format(new Date(ticket.updated_at), "d 'de' MMMM", { locale: es })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {(hasChanges || saveMessage) && (
              <div className="pt-4 border-t border-[#ECECED] flex items-center justify-between gap-3">
                <div className="text-sm text-[#2E7D32]">{saveMessage}</div>
                {hasChanges && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCancelChanges}
                      className="px-4 py-2 text-sm font-medium text-[#8A8F8F] hover:text-[#3F4444] hover:bg-[#F7F7F8] rounded-xl transition-colors"
                      disabled={isSaving}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyChanges}
                      className="px-4 py-2 text-sm font-semibold bg-[#6353FF] hover:bg-[#5244e6] text-white rounded-xl transition-colors disabled:opacity-50"
                      disabled={isSaving}
                    >
                      {isSaving ? 'Guardando...' : 'Aceptar'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[#8A8F8F] uppercase tracking-widest">Descripción</h3>
            <div className="text-[#5A5F5F] text-sm leading-relaxed whitespace-pre-wrap">
              {ticket.description || 'Sin descripción.'}
            </div>
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[#8A8F8F] uppercase tracking-widest">Adjuntos</h3>
            {ticketAttachments.length > 0 ? (
              <AttachmentList
                attachments={ticketAttachments}
                onDelete={handleDeleteAttachment}
                canDelete={(attachment) => attachment.uploaded_by === currentUser?.id}
              />
            ) : (
              <div className="text-sm text-[#8A8F8F]">Sin adjuntos.</div>
            )}
          </div>

          {/* Timings */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[#8A8F8F] uppercase tracking-widest">Estadísticas</h3>
            {stageStats.items.length === 0 ? (
              <div className="text-sm text-[#8A8F8F]">Sin datos de tiempo todavía.</div>
            ) : (
              <div className="space-y-3 text-sm text-[#3F4444]">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#F7F7F8] border border-[#E0E0E1] rounded-xl px-3 py-2">
                    <div className="text-[11px] text-[#8A8F8F] uppercase tracking-wider">Tiempo activo</div>
                    <div className="font-semibold">{formatDuration(stageStats.totalActiveSeconds)}</div>
                  </div>
                  <div className="bg-[#F7F7F8] border border-[#E0E0E1] rounded-xl px-3 py-2">
                    <div className="text-[11px] text-[#8A8F8F] uppercase tracking-wider">Tiempo pausado</div>
                    <div className="font-semibold">{formatDuration(stageStats.totalPausedSeconds)}</div>
                  </div>
                </div>
                <div className="border border-[#E0E0E1] rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-[#FAFAFA] text-[11px] text-[#8A8F8F] uppercase tracking-wider font-semibold">
                    Desglose por estado
                  </div>
                  <div className="divide-y divide-[#E0E0E1]">
                    {stageStats.items.map(item => (
                      <div key={item.stage} className="flex items-center justify-between px-3 py-2">
                        <span className="text-[#5A5F5F]">{STAGES[item.stage].label}</span>
                        <span
                          className="font-semibold"
                          title={
                            item.stage === 'pending_validation' && pendingValidationSinceLabel
                              ? `Tiempo total en este estado (historial). pending_validation_since: ${pendingValidationSinceLabel}`
                              : undefined
                          }
                        >
                          {formatDuration(item.seconds)}
                          {item.stage === 'pending_validation' && pendingValidationSinceLabel
                            ? ` (desde ${pendingValidationSinceLabel})`
                            : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Solución (solo lectura) */}
          {ticket.solution && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-[#6353FF] uppercase tracking-widest">Solución</h3>
              <div className="text-[#5A5F5F] text-sm leading-relaxed bg-[rgba(99,83,255,0.05)] p-4 rounded-xl border border-[rgba(99,83,255,0.2)] whitespace-pre-wrap">
                {ticket.solution}
              </div>
            </div>
          )}

            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsChatOpen(true)}
            className="p-4 border-t border-[#E0E0E1] bg-white flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#8A8F8F]" />
              <span className="text-xs font-bold text-[#8A8F8F] uppercase tracking-widest">
                Mensajes ({visibleComments.length})
              </span>
            </div>
            <ChevronUp className="w-4 h-4 text-[#8A8F8F]" />
          </button>
        </>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-6 py-4 border-b border-[#E0E0E1] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#8A8F8F]" />
              <h3 className="text-xs font-bold text-[#8A8F8F] uppercase tracking-widest">
                Mensajes ({visibleComments.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsChatOpen(false)}
              className="p-1.5 hover:bg-[#F7F7F8] rounded-lg text-[#8A8F8F] transition-colors"
              title="Colapsar"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-6 space-y-4 min-h-0">
            {visibleComments.length ? (
              visibleComments.map((comment) => (
                <div 
                  key={comment.id} 
                  className={clsx(
                    "p-3 rounded-xl text-sm",
                    comment.is_internal ? "bg-amber-50 border border-amber-200" : "bg-[#F7F7F8] border border-[#E0E0E1]"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[#5A5F5F] font-medium text-xs">
                        {comment.user?.full_name || 'Usuario'}
                      </span>
                      {comment.edited_at && !comment.is_deleted && (
                        <span className="text-[10px] text-[#8A8F8F]">
                          (Editado {format(new Date(comment.edited_at), 'dd/MM HH:mm')})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[#B0B5B5] text-[10px]">
                        {format(new Date(comment.created_at), 'HH:mm')}
                      </span>
                      {isSupportUser && currentUser?.id === comment.user_id && !comment.is_deleted && (
                        <>
                          <button
                            type="button"
                            onClick={() => startEditComment(comment.id, comment.content)}
                            className="text-[10px] text-[#8A8F8F] hover:text-[#3F4444]"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(comment.id)}
                            className="text-[10px] text-[#8A8F8F] hover:text-red-500"
                          >
                            Eliminar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {comment.is_deleted ? (
                    <p className="text-[#8A8F8F] italic">Mensaje eliminado</p>
                  ) : editingCommentId === comment.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingCommentText}
                        onChange={(e) => setEditingCommentText(e.target.value)}
                        className="w-full bg-white border border-[#E0E0E1] rounded-xl px-3 py-2 text-sm text-[#3F4444] outline-none focus:border-[#6353FF] transition-all resize-none min-h-[80px]"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={cancelEditComment}
                          className="px-3 py-1.5 text-xs font-medium text-[#8A8F8F] hover:text-[#3F4444] hover:bg-[#ECECED] rounded-lg transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => saveEditComment(comment.id)}
                          className="px-3 py-1.5 text-xs font-semibold bg-[#6353FF] hover:bg-[#5244e6] text-white rounded-lg transition-colors"
                        >
                          Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[#3F4444]">{comment.content}</p>
                  )}

                  {!comment.is_deleted && attachments && attachments.some(item => item.comment_id === comment.id) && (
                    <div className="mt-2">
                      <AttachmentList
                        attachments={attachments.filter(item => item.comment_id === comment.id)}
                        onDelete={handleDeleteAttachment}
                        canDelete={(attachment) => attachment.uploaded_by === currentUser?.id}
                      />
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-sm text-[#8A8F8F]">Sin mensajes todavía.</div>
            )}
          </div>

          <footer className="p-4 border-t border-[#E0E0E1] bg-white">
            <form onSubmit={handleAddComment} className="space-y-3">
              <div className="relative">
                <MentionTextarea
                  value={commentText}
                  onChange={setCommentText}
                  onMention={handleMention}
                  placeholder="Escribe un comentario... (usa @ para mencionar)"
                  className="w-full bg-[#F7F7F8] border border-[#E0E0E1] rounded-xl px-4 py-3 pr-12 text-sm text-[#3F4444] placeholder:text-[#B0B5B5] outline-none focus:border-[#6353FF] transition-all resize-none min-h-[100px]"
                />
                <button
                  type="submit"
                  disabled={createComment.isPending || commentUploading || !commentText.trim()}
                  className="absolute bottom-3 right-3 p-2 bg-[#6353FF] hover:bg-[#5244e6] text-white rounded-full transition-all disabled:opacity-50"
                >
                  {createComment.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsAttachmentModalOpen(true)}
                  className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#8A8F8F] hover:text-[#3F4444] hover:bg-[#F7F7F8] rounded-xl transition-colors"
                >
                  <Paperclip className="w-4 h-4" />
                  Adjuntar{pendingCommentFiles.length > 0 ? ` (${pendingCommentFiles.length})` : ''}
                </button>
                {commentUploading && (
                  <div className="flex items-center gap-2 text-xs text-[#8A8F8F]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Subiendo adjuntos...
                  </div>
                )}
                {!isClient && (
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="internal" 
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      className="rounded border-[#E0E0E1] bg-white text-[#6353FF] focus:ring-0"
                    />
                    <label htmlFor="internal" className="text-xs text-[#8A8F8F] cursor-pointer select-none">
                      Comentario interno (Símbolo 🔒)
                    </label>
                  </div>
                )}
              </div>
            </form>
          </footer>
          {isAttachmentModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => setIsAttachmentModalOpen(false)}
                role="button"
                tabIndex={-1}
                aria-label="Cerrar modal"
              />
              <div className="relative bg-white rounded-2xl shadow-xl border border-[#E0E0E1] w-full max-w-lg mx-4 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#3F4444]">
                    Adjuntos ({pendingCommentFiles.length})
                  </h3>
                </div>
                {commentUploading && (
                  <div className="flex items-center gap-2 text-xs text-[#8A8F8F]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Subiendo adjuntos...
                  </div>
                )}
                <input
                  ref={commentFileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                  className="hidden"
                  onChange={(e) => {
                    handleCommentFilesChange(e.target.files)
                    if (commentFileInputRef.current) {
                      commentFileInputRef.current.value = ''
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => commentFileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#8A8F8F] hover:text-[#3F4444] hover:bg-[#F7F7F8] rounded-xl transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Agregar archivos
                </button>
                {commentUploadError && (
                  <p className="text-xs text-red-500">{commentUploadError}</p>
                )}
                {pendingCommentFiles.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-auto">
                    {pendingCommentFiles.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="flex items-center justify-between text-xs text-[#5A5F5F] bg-[#F7F7F8] border border-[#E0E0E1] rounded-lg px-3 py-2"
                      >
                        <span className="truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removePendingCommentFile(index)}
                          className="text-[#8A8F8F] hover:text-red-500"
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-[#8A8F8F]">No hay archivos seleccionados.</div>
                )}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#ECECED]">
                  <button
                    type="button"
                    onClick={() => {
                      setPendingCommentFiles([])
                      setIsAttachmentModalOpen(false)
                    }}
                    className="px-4 py-2 text-xs font-medium text-[#8A8F8F] hover:text-[#3F4444] hover:bg-[#F7F7F8] rounded-xl transition-colors"
                    disabled={commentUploading}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAttachmentModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold bg-[#6353FF] hover:bg-[#5244e6] text-white rounded-xl transition-colors disabled:opacity-50"
                    disabled={commentUploading}
                  >
                    Aceptar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        open={solutionModalOpen}
        title={`Confirmar cambio a ${STAGES.pending_validation.label}`}
        description={
          <div className="space-y-3">
            <p className="text-sm text-[#5A5F5F]">
              Debes ingresar el mensaje de solución para continuar.
            </p>
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#3F4444]">
                Mensaje de solución
              </label>
              <textarea
                value={solutionModalText}
                onChange={(event) => {
                  setSolutionModalText(event.target.value)
                  if (solutionModalError) setSolutionModalError(null)
                }}
                rows={4}
                placeholder="Describe la solución aplicada..."
                className="w-full px-3 py-2 text-sm text-[#3F4444] bg-white border border-[#E0E0E1] rounded-xl outline-none focus:ring-1 focus:ring-[#6353FF] transition-all resize-none"
              />
              {solutionModalError && (
                <div className="text-[11px] text-red-500">{solutionModalError}</div>
              )}
            </div>
          </div>
        }
        confirmText="Aceptar"
        cancelText="Cancelar"
        isConfirming={isSaving}
        disableClose={isSaving}
        onCancel={() => {
          if (!isSaving) {
            setSolutionModalOpen(false)
            setPendingUpdates(null)
          }
        }}
        onConfirm={async () => {
          if (!pendingUpdates) return
          if (!solutionModalText.trim()) {
            setSolutionModalError('Debes ingresar un mensaje de solución.')
            return
          }
          setSolutionModalOpen(false)
          try {
            await applyUpdates({
              ...pendingUpdates,
              solution: solutionModalText.trim(),
            })
          } catch (error) {
            console.error(error)
            alert('No se pudo actualizar el ticket.')
            setAwaitingRefresh(false)
            setPendingSaveMessage(null)
          } finally {
            setPendingUpdates(null)
          }
        }}
      />
    </div>
  )
}
