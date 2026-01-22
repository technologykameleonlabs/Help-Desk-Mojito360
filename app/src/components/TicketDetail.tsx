import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { 
  useTicket, 
  useUpdateTicket, 
  useComments, 
  useCreateComment,
  useProfiles,
  useEntities
} from '../hooks/useData'
import { useCreateMentionNotifications } from '../hooks/useNotifications'
import { useRealtimeComments } from '../hooks/useRealtime'
import { MentionTextarea, extractMentions } from './MentionTextarea'

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
  History
} from 'lucide-react'
import { STAGES, PRIORITIES, type TicketStage, type TicketPriority, type Ticket } from '../lib/supabase'
import { useState, useCallback, useMemo, useEffect } from 'react'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const TICKET_TYPES = [
  '🔔 Alertas', '🔼 Carga', '💽 Dato', '📝 Documentos', 
  '📡 Integración', '📈 Reportes', '👤 Usuarios', '✏️ Modificación', 
  '⏱️ Rendimiento', '💕 Mapeos', '💎 Gestión del soporte', '🔎 Control'
]

const APPLICATION_OPTIONS = ['Mojito360', 'Wintruck', 'Odoo', 'Otros']

type EditableField = 'stage' | 'priority' | 'entity_id' | 'assigned_to' | 'ticket_type' | 'application'

export function TicketDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { data: ticket, isLoading, error, isFetching } = useTicket(id!)
  const { data: comments } = useComments(id!)
  const { data: profiles } = useProfiles()
  const { data: entities } = useEntities()
  const updateTicket = useUpdateTicket()

  // Subscribe to realtime comment updates
  useRealtimeComments(id!)

  const createComment = useCreateComment()
  const createMentionNotifications = useCreateMentionNotifications()
  
  const [commentText, setCommentText] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([])
  const [editingFields, setEditingFields] = useState<Set<EditableField>>(new Set())
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [awaitingRefresh, setAwaitingRefresh] = useState(false)
  const [pendingSaveMessage, setPendingSaveMessage] = useState<string | null>(null)

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
  }, [ticket])

  useEffect(() => {
    if (!saveMessage) return
    const timeout = setTimeout(() => setSaveMessage(null), 3000)
    return () => clearTimeout(timeout)
  }, [saveMessage])

  useEffect(() => {
    if (!awaitingRefresh) return
    if (!updateTicket.isPending && !isFetching) {
      setAwaitingRefresh(false)
      if (pendingSaveMessage) {
        setSaveMessage(pendingSaveMessage)
        setPendingSaveMessage(null)
      }
    }
  }, [awaitingRefresh, updateTicket.isPending, isFetching, pendingSaveMessage])

  // Track mentions as user types
  const handleMention = useCallback((userId: string) => {
    setMentionedUserIds(prev => 
      prev.includes(userId) ? prev : [...prev, userId]
    )
  }, [])

  const hasChanges = useMemo(() => {
    if (!ticket) return false
    return (
      draft.stage !== ticket.stage ||
      draft.priority !== ticket.priority ||
      (draft.entity_id || null) !== ticket.entity_id ||
      (draft.assigned_to || null) !== ticket.assigned_to ||
      (draft.ticket_type || '') !== (ticket.ticket_type || '') ||
      (draft.application || '') !== (ticket.application || '')
    )
  }, [draft, ticket])

  const selectedEntity = useMemo(() => {
    if (draft.entity_id) {
      return entities?.find(entity => entity.id === draft.entity_id) || null
    }
    return ticket?.entity || null
  }, [draft.entity_id, entities, ticket?.entity])

  const entityResponsible = selectedEntity?.assigned_to_profile?.full_name ||
    selectedEntity?.assigned_to_profile?.email ||
    ''

  const closePath = useMemo(() => {
    const path = location.pathname
    if (path.startsWith('/my-tickets')) return '/my-tickets'
    if (path.startsWith('/inbox')) return '/inbox'
    if (path.startsWith('/archive')) return '/archive'
    return '/'
  }, [location.pathname])

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
        isInternal
      })

      // Extract all mentioned users from the text
      const allMentions = profiles 
        ? extractMentions(commentText, profiles) 
        : mentionedUserIds
      
      // Create notifications for mentioned users
      if (allMentions.length > 0 && result?.id) {
        await createMentionNotifications.mutateAsync({
          commentId: result.id,
          ticketId: ticket.id,
          mentionedUserIds: allMentions
        })
      }

      setCommentText('')
      setMentionedUserIds([])
    } catch (e) {
      console.error(e)
    }
  }

  const handleApplyChanges = async () => {
    if (!hasChanges) return
    try {
      setSaveMessage(null)
      setPendingSaveMessage('Cambios guardados correctamente.')
      setAwaitingRefresh(true)
      const updates: Partial<Ticket> & { id: string } = { id: ticket.id }
      if (draft.stage !== ticket.stage) updates.stage = draft.stage
      if (draft.priority !== ticket.priority) updates.priority = draft.priority
      if ((draft.entity_id || null) !== ticket.entity_id) updates.entity_id = draft.entity_id || null
      if ((draft.assigned_to || null) !== ticket.assigned_to) updates.assigned_to = draft.assigned_to || null
      if ((draft.ticket_type || '') !== (ticket.ticket_type || '')) updates.ticket_type = draft.ticket_type || null
      if ((draft.application || '') !== (ticket.application || '')) updates.application = draft.application || null

      await updateTicket.mutateAsync(updates)
      setEditingFields(new Set())
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

  const isSaving = updateTicket.isPending || awaitingRefresh || isFetching

  return (
    <div className="flex flex-col h-full bg-white border-l border-[#E0E0E1] w-[600px] animate-in slide-in-from-right duration-300 shadow-xl relative z-20">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#E0E0E1]">
        <div className="flex items-center gap-3">
          <span className="text-[#8A8F8F] font-mono text-sm">#{ticket.ticket_ref}</span>
          <h2 className="text-[#3F4444] font-semibold flex-1 line-clamp-1">{ticket.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {ticket.mojito_ref ? (
            <a
              href={`https://app.mojito360.com/resources/support/detail-case/${ticket.mojito_ref}`}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 hover:bg-[#F7F7F8] rounded-lg text-[#8A8F8F] transition-colors"
              title="Abrir en Mojito360"
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
                    <span className="text-[#8A8F8F] block">Referencia Mojito</span>
                    <span className="text-[#3F4444] font-medium">{ticket.mojito_ref ?? ''}</span>
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

          {/* Timings */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[#8A8F8F] uppercase tracking-widest">Timings</h3>
            <div className="text-sm text-[#8A8F8F]">Por desarrollar</div>
          </div>

          {/* Solution (if any) */}
          {ticket.solution && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-[#6353FF] uppercase tracking-widest">Solución</h3>
              <div className="text-[#5A5F5F] text-sm leading-relaxed bg-[rgba(99,83,255,0.05)] p-4 rounded-xl border border-[rgba(99,83,255,0.2)] whitespace-pre-wrap">
                {ticket.solution}
              </div>
            </div>
          )}

          {/* Comments Section */}
          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#8A8F8F]" />
              <h3 className="text-xs font-bold text-[#8A8F8F] uppercase tracking-widest">Comentarios ({comments?.length || 0})</h3>
            </div>
            
            <div className="space-y-4">
              {comments?.map((comment) => (
                <div 
                  key={comment.id} 
                  className={clsx(
                    "p-3 rounded-xl text-sm",
                    comment.is_internal ? "bg-amber-50 border border-amber-200" : "bg-[#F7F7F8] border border-[#E0E0E1]"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[#5A5F5F] font-medium text-xs">
                      {comment.user?.full_name || 'Usuario'}
                    </span>
                    <span className="text-[#B0B5B5] text-[10px]">
                      {format(new Date(comment.created_at), 'HH:mm')}
                    </span>
                  </div>
                  <p className="text-[#3F4444]">{comment.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Comment Input with Mentions */}
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
              disabled={createComment.isPending || !commentText.trim()}
              className="absolute bottom-3 right-3 p-2 bg-[#6353FF] hover:bg-[#5244e6] text-white rounded-full transition-all disabled:opacity-50"
            >
              {createComment.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
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
        </form>
      </footer>
    </div>
  )
}
