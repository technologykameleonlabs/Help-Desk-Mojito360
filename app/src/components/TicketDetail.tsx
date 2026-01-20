import { useNavigate, useParams } from 'react-router-dom'
import { 
  useTicket, 
  useUpdateTicket, 
  useComments, 
  useCreateComment
} from '../hooks/useData'
import { useRealtimeComments } from '../hooks/useRealtime'

import { 
  X, 
  Clock, 
  User, 
  Building2, 
  Tag, 
  MessageSquare, 
  Send,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { STAGES, PRIORITIES, type TicketStage, type TicketPriority } from '../lib/supabase'
import { useState } from 'react'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export function TicketDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: ticket, isLoading, error } = useTicket(id!)
  const { data: comments } = useComments(id!)
  const updateTicket = useUpdateTicket()

  // Subscribe to realtime comment updates
  useRealtimeComments(id!)


  const createComment = useCreateComment()
  
  const [commentText, setCommentText] = useState('')
  const [isInternal, setIsInternal] = useState(false)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full w-[500px] bg-white border-l border-[#E0E0E1]">
        <Loader2 className="w-8 h-8 animate-spin text-[#6353FF]" />
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-[500px] bg-white border-l border-[#E0E0E1] text-[#8A8F8F] gap-4">
        <AlertCircle className="w-12 h-12 text-[#E0E0E1]" />
        <p>No se encontró el ticket o hubo un error.</p>
        <button onClick={() => navigate('/')} className="text-[#6353FF] hover:underline">
          Volver al Dashboard
        </button>
      </div>
    )
  }

  const handleUpdateStage = async (newStage: TicketStage) => {
    try {
      await updateTicket.mutateAsync({ id: ticket.id, stage: newStage })
    } catch (e) {
      console.error(e)
    }
  }

  const handleUpdatePriority = async (newPriority: TicketPriority) => {
    try {
      await updateTicket.mutateAsync({ id: ticket.id, priority: newPriority })
    } catch (e) {
      console.error(e)
    }
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim()) return

    try {
      await createComment.mutateAsync({
        ticketId: ticket.id,
        content: commentText,
        isInternal
      })
      setCommentText('')
    } catch (e) {

      console.error(e)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white border-l border-[#E0E0E1] w-[500px] animate-in slide-in-from-right duration-300 shadow-xl relative z-20">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#E0E0E1]">
        <div className="flex items-center gap-3">
          <span className="text-[#8A8F8F] font-mono text-sm">#{ticket.ticket_ref}</span>
          <h2 className="text-[#3F4444] font-semibold flex-1 line-clamp-1">{ticket.title}</h2>
        </div>
        <button 
          onClick={() => navigate('/')}
          className="p-1.5 hover:bg-[#F7F7F8] rounded-lg text-[#8A8F8F] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* Quick Actions */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-[#8A8F8F] tracking-wider">Estado</label>
              <select
                value={ticket.stage}
                onChange={(e) => handleUpdateStage(e.target.value as TicketStage)}
                className="w-full bg-white border border-[#E0E0E1] rounded-xl px-3 py-2 text-sm text-[#3F4444] outline-none focus:ring-1 focus:ring-[#6353FF] transition-all"
              >
                {Object.entries(STAGES).map(([key, value]) => (
                  <option key={key} value={key}>{(value as any).label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-[#8A8F8F] tracking-wider">Prioridad</label>
              <select
                value={ticket.priority}
                onChange={(e) => handleUpdatePriority(e.target.value as TicketPriority)}
                className="w-full bg-white border border-[#E0E0E1] rounded-xl px-3 py-2 text-sm text-[#3F4444] outline-none focus:ring-1 focus:ring-[#6353FF] transition-all"
              >
                {Object.entries(PRIORITIES).map(([key, value]) => (
                  <option key={key} value={key}>{(value as any).label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Properties */}
          <div className="space-y-4 py-4 border-y border-[#E0E0E1]">
            <div className="flex items-center text-sm gap-3">
              <Building2 className="w-4 h-4 text-[#8A8F8F]" />
              <span className="text-[#8A8F8F] w-24">Entidad</span>
              <span className="text-[#3F4444] font-medium">{ticket.entity?.name || '---'}</span>
            </div>
            <div className="flex items-center text-sm gap-3">
              <User className="w-4 h-4 text-[#8A8F8F]" />
              <span className="text-[#8A8F8F] w-24">Responsable</span>
              <span className="text-[#3F4444] font-medium">{ticket.assigned_to_profile?.full_name || 'Sin asignar'}</span>
            </div>
            <div className="flex items-center text-sm gap-3">
              <Tag className="w-4 h-4 text-[#8A8F8F]" />
              <span className="text-[#8A8F8F] w-24">Tipo</span>
              <span className="text-[#3F4444] font-medium">{ticket.ticket_type || 'No definido'}</span>
            </div>
            <div className="flex items-center text-sm gap-3">
              <Clock className="w-4 h-4 text-[#8A8F8F]" />
              <span className="text-[#8A8F8F] w-24">Creado</span>
              <span className="text-[#3F4444] font-medium">
                {format(new Date(ticket.created_at), "d 'de' MMMM", { locale: es })}
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[#8A8F8F] uppercase tracking-widest">Descripción</h3>
            <div className="text-[#5A5F5F] text-sm leading-relaxed bg-[#F7F7F8] p-4 rounded-xl border border-[#E0E0E1] whitespace-pre-wrap">
              {ticket.description || 'Sin descripción.'}
            </div>
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

      {/* Comment Input */}
      <footer className="p-4 border-t border-[#E0E0E1] bg-white">
        <form onSubmit={handleAddComment} className="space-y-3">
          <div className="relative">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Escribe un comentario..."
              className="w-full bg-[#F7F7F8] border border-[#E0E0E1] rounded-xl px-4 py-3 text-sm text-[#3F4444] placeholder:text-[#B0B5B5] outline-none focus:border-[#6353FF] transition-all resize-none min-h-[100px]"
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
