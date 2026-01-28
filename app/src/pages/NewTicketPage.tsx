import { useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { 
  useEntities, 
  useCreateTicket, 
  useProfiles,
  useLabels,
  useUpdateTicketLabels
} from '../hooks/useData'
import { Sidebar } from '../components/Sidebar'
import { ChevronLeft, Loader2 } from 'lucide-react'
import type { TicketStage } from '../lib/supabase'
import { MultiSelect } from '../components/MultiSelect'
import { SingleSelect } from '../components/SingleSelect'
import { CATEGORY_OPTIONS, TICKET_TYPE_OPTIONS } from '../lib/ticketOptions'
import { supabase } from '../lib/supabase'
import { sendNotificationEmails, useCreateNotifications } from '../hooks/useNotifications'


const ticketSchema = z.object({
  title: z.string().min(5, 'El título debe tener al menos 5 caracteres'),
  description: z.string().optional(),
  entity_id: z.string().min(1, 'Selecciona una entidad'),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  application: z.string().min(1, 'Selecciona una aplicación'),
  category: z.string().min(1, 'Selecciona una categoría'),
  classification: z.string().min(1, 'Selecciona una clasificación'),
  channel: z.string().min(1, 'Selecciona un canal'),
  ticket_type: z.string().min(1, 'Selecciona un tipo'),
  assigned_to: z.string().optional(),
})

type TicketFormValues = z.infer<typeof ticketSchema>

const APPLICATIONS = ['Mojito360', 'Wimtruck', 'Odoo', 'Otros']
const CLASSIFICATIONS = ['Soporte', 'Desarrollo']
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

export function NewTicketPage() {
  const navigate = useNavigate()
  const { data: entities, isLoading: loadingEntities } = useEntities()
  const { data: profiles } = useProfiles()
  const { data: labels } = useLabels()
  const createTicket = useCreateTicket()
  const createNotifications = useCreateNotifications()
  const updateTicketLabels = useUpdateTicketLabels()
  const [selectedLabels, setSelectedLabels] = useState<string[]>([])
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      priority: 'medium',
      application: 'Mojito360',
      category: 'Alertas',
      classification: 'Soporte',
      channel: 'APP Tickets',
    }
  })

  const selectedEntityId = watch('entity_id')
  const assignedToValue = watch('assigned_to')

  useEffect(() => {
    if (!selectedEntityId || assignedToValue) return
    const selectedEntity = entities?.find(entity => entity.id === selectedEntityId)
    if (selectedEntity?.assigned_to) {
      setValue('assigned_to', selectedEntity.assigned_to, { shouldDirty: true })
    }
  }, [assignedToValue, entities, selectedEntityId, setValue])

  const handleFileChange = (files: FileList | null) => {
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
      setUploadError(errorMessage)
      return
    }

    setUploadError(null)
    setPendingFiles(prev => [...prev, ...nextFiles])
  }

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }

  const uploadTicketAttachments = async (ticketId: string) => {
    if (pendingFiles.length === 0) return

    setUploading(true)
    setUploadError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      for (const file of pendingFiles) {
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
            comment_id: null,
            uploaded_by: user.id,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
            storage_path: storagePath
          })

        if (dbError) throw dbError
      }

      setPendingFiles([])
    } finally {
      setUploading(false)
    }
  }

  const onSubmit = async (values: TicketFormValues) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const created = await createTicket.mutateAsync({
        ...values,
        stage: 'new' as TicketStage,
      })

      let mojitoSyncFailed = false
      try {
        const { data: fnData, error } = await supabase.functions.invoke('mojito-send', {
          body: { action: 'create', ticket_id: created.id },
        })
        if (error || !(fnData && (fnData as { ok?: boolean }).ok)) {
          mojitoSyncFailed = true
        }
      } catch {
        mojitoSyncFailed = true
      }

      const selectedEntity = entities?.find(entity => entity.id === values.entity_id)
      const assigneeId = created.assigned_to || null
      const responsibleId = selectedEntity?.assigned_to || null
      const currentUserId = user?.id ?? null

      const notificationsMap = new Map<string, string>()
      if (assigneeId && assigneeId !== currentUserId) {
        notificationsMap.set(
          assigneeId,
          `Te asignaron el ticket #${created.ticket_ref}: ${created.title}`
        )
      }
      if (responsibleId && responsibleId !== currentUserId) {
        if (!notificationsMap.has(responsibleId)) {
          notificationsMap.set(
            responsibleId,
            `Eres responsable del ticket #${created.ticket_ref}: ${created.title}`
          )
        }
      }

      if (notificationsMap.size > 0) {
        const notificationIds = await createNotifications.mutateAsync(
          Array.from(notificationsMap.entries()).map(([userId, message]) => ({
            user_id: userId,
            ticket_id: created.id,
            type: 'assignment',
            triggered_by: currentUserId,
            message,
          }))
        )
        await sendNotificationEmails(notificationIds)
      }

      await uploadTicketAttachments(created.id)
      if (selectedLabels.length > 0) {
        await updateTicketLabels.mutateAsync({
          ticketId: created.id,
          labelIds: selectedLabels
        })
      }
      if (mojitoSyncFailed) {
        navigate(`/ticket/${created.id}`, { state: { mojitoSyncFailed: true } })
      } else {
        navigate('/')
      }
    } catch (error) {
      console.error('Error creating ticket:', error)
      if (error instanceof Error) {
        setUploadError(error.message)
      }
      alert('Error al crear el ticket. Revisa la consola.')
    }
  }

  const labelOptions = labels?.map(label => ({
    value: label.id,
    label: label.name,
    color: label.color,
  })) || []

  return (
    <div className="flex h-screen bg-white">
      <Sidebar />
      
      <main className="flex-1 overflow-auto">
        <header className="h-16 border-b border-[#E0E0E1] flex items-center px-6 gap-4 bg-white">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-[#F7F7F8] rounded-lg text-[#8A8F8F] hover:text-[#3F4444] transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-[#3F4444]">Crear Nuevo Ticket</h1>
        </header>

        <div className="max-w-3xl p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Main Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#3F4444] mb-2">
                  Título del Ticket
                </label>
                <input
                  {...register('title')}
                  placeholder="Ej: Error en carga de facturas"
                  className="w-full px-4 py-3 bg-white border border-[#E0E0E1] rounded-xl text-[#3F4444] focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] outline-none transition-all placeholder:text-[#B0B5B5]"
                />
                {errors.title && (
                  <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3F4444] mb-2">
                  Descripción
                </label>
                <textarea
                  {...register('description')}
                  rows={4}
                  placeholder="Describe el problema o requerimiento detalladamente..."
                  className="w-full px-4 py-3 bg-white border border-[#E0E0E1] rounded-xl text-[#3F4444] focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] outline-none transition-all placeholder:text-[#B0B5B5] resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-[#3F4444] mb-2">
                  Adjuntos (opcional)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                  className="hidden"
                  onChange={(e) => {
                    handleFileChange(e.target.files)
                    if (fileInputRef.current) {
                      fileInputRef.current.value = ''
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-[#F7F7F8] border border-[#E0E0E1] rounded-xl text-[#5A5F5F] hover:bg-white hover:border-[#6353FF] hover:text-[#6353FF] transition-all"
                >
                  Agregar archivos
                </button>
                {pendingFiles.length > 0 && (
                  <div className="space-y-2">
                    {pendingFiles.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="flex items-center justify-between text-xs text-[#5A5F5F] bg-[#F7F7F8] border border-[#E0E0E1] rounded-lg px-3 py-2"
                      >
                        <span className="truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removePendingFile(index)}
                          className="text-[#8A8F8F] hover:text-red-500"
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {uploadError && (
                  <p className="text-xs text-red-500">{uploadError}</p>
                )}
              </div>
            </div>

            {/* Properties Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-[#3F4444] mb-2">
                  Entidad (Cliente)
                </label>
                <select
                  {...register('entity_id')}
                  disabled={loadingEntities}
                  className="w-full px-4 py-3 bg-white border border-[#E0E0E1] rounded-xl text-[#3F4444] focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] outline-none transition-all appearance-none"
                >
                  <option value="">Selecciona una entidad...</option>
                  {entities?.map(entity => (
                    <option key={entity.id} value={entity.id}>
                      {entity.name}
                    </option>
                  ))}
                </select>
                {errors.entity_id && (
                  <p className="mt-1 text-xs text-red-500">{errors.entity_id.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3F4444] mb-2">
                  Asignado a
                </label>
                <select
                  {...register('assigned_to')}
                  className="w-full px-4 py-3 bg-white border border-[#E0E0E1] rounded-xl text-[#3F4444] focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] outline-none transition-all appearance-none"
                >
                  <option value="">Sin asignar</option>
                  {profiles?.map(profile => (
                    <option key={profile.id} value={profile.id}>
                      {profile.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3F4444] mb-2">
                  Prioridad
                </label>
                <select
                  {...register('priority')}
                  className="w-full px-4 py-3 bg-white border border-[#E0E0E1] rounded-xl text-[#3F4444] focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] outline-none transition-all appearance-none"
                >
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="critical">Crítica</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3F4444] mb-2">
                  Aplicación
                </label>
                <select
                  {...register('application')}
                  className="w-full px-4 py-3 bg-white border border-[#E0E0E1] rounded-xl text-[#3F4444] focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] outline-none transition-all appearance-none"
                >
                  {APPLICATIONS.map(app => (
                    <option key={app} value={app}>{app}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3F4444] mb-2">
                  Categoría
                </label>
                <select
                  {...register('category')}
                  className="w-full px-4 py-3 bg-white border border-[#E0E0E1] rounded-xl text-[#3F4444] focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] outline-none transition-all appearance-none"
                >
                  {CATEGORY_OPTIONS.map(category => (
                    <option key={category.value} value={category.value}>
                      {category.icon} {category.label}
                    </option>
                  ))}
                </select>
                {errors.category && (
                  <p className="mt-1 text-xs text-red-500">{errors.category.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3F4444] mb-2">
                  Clasificación
                </label>
                <select
                  {...register('classification')}
                  className="w-full px-4 py-3 bg-white border border-[#E0E0E1] rounded-xl text-[#3F4444] focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] outline-none transition-all appearance-none"
                >
                  {CLASSIFICATIONS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3F4444] mb-2">
                  Tipo de Ticket
                </label>
                <SingleSelect
                  options={[...TICKET_TYPE_OPTIONS]}
                  value={watch('ticket_type') ?? ''}
                  onChange={(v) => setValue('ticket_type', v, { shouldValidate: true })}
                  placeholder="Selecciona tipo..."
                />
                {errors.ticket_type && (
                  <p className="mt-1 text-sm text-red-500">{errors.ticket_type.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <MultiSelect
                label="Labels"
                options={labelOptions}
                value={selectedLabels}
                onChange={setSelectedLabels}
                placeholder="Selecciona labels"
              />
            </div>

            <div className="flex items-center justify-end gap-4 pt-6 border-t border-[#E0E0E1]">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-6 py-2.5 text-sm font-medium text-[#8A8F8F] hover:text-[#3F4444] transition-colors"
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || uploading}
                className="flex items-center gap-2 px-8 py-2.5 bg-[#6353FF] hover:bg-[#5244e6] text-white font-semibold rounded-full transition-all disabled:opacity-50"
              >
                {(isSubmitting || uploading) && <Loader2 className="w-4 h-4 animate-spin" />}
                {uploading ? 'Subiendo...' : 'Crear ticket'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
