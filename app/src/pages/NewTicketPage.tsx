import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { 
  useEntities, 
  useCreateTicket, 
  useProfiles 
} from '../hooks/useData'
import { Sidebar } from '../components/Sidebar'
import { ChevronLeft, Loader2 } from 'lucide-react'
import type { TicketStage } from '../lib/supabase'


const ticketSchema = z.object({
  title: z.string().min(5, 'El título debe tener al menos 5 caracteres'),
  description: z.string().optional(),
  entity_id: z.string().min(1, 'Selecciona una entidad'),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  application: z.string().min(1, 'Selecciona una aplicación'),
  classification: z.string().min(1, 'Selecciona una clasificación'),
  channel: z.string().min(1, 'Selecciona un canal'),
  ticket_type: z.string().min(1, 'Selecciona un tipo'),
  assigned_to: z.string().optional(),
})

type TicketFormValues = z.infer<typeof ticketSchema>

const APPLICATIONS = ['Mojito360', 'Wintruck', 'Odoo', 'Otros']
const CLASSIFICATIONS = ['Soporte', 'Desarrollo']
const TICKET_TYPES = [

  '🔔 Alertas', '🔼 Carga', '💽 Dato', '📝 Documentos', 
  '📡 Integración', '📈 Reportes', '👤 Usuarios', '✏️ Modificación', 
  '⏱️ Rendimiento', '💕 Mapeos', '💎 Gestión del soporte', '🔎 Control'
]

export function NewTicketPage() {
  const navigate = useNavigate()
  const { data: entities, isLoading: loadingEntities } = useEntities()
  const { data: profiles } = useProfiles()
  const createTicket = useCreateTicket()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      priority: 'medium',
      application: 'Mojito360',
      classification: 'Soporte',
      channel: 'APP Tickets',
    }
  })

  const onSubmit = async (values: TicketFormValues) => {
    try {
      await createTicket.mutateAsync({
        ...values,
        stage: 'new' as TicketStage,
      })
      navigate('/')
    } catch (error) {
      console.error('Error creating ticket:', error)
      alert('Error al crear el ticket. Revisa la consola.')
    }
  }

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
                <select
                  {...register('ticket_type')}
                  className="w-full px-4 py-3 bg-white border border-[#E0E0E1] rounded-xl text-[#3F4444] focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] outline-none transition-all appearance-none"
                >
                  <option value="">Selecciona tipo...</option>
                  {TICKET_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
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
                disabled={isSubmitting}
                className="flex items-center gap-2 px-8 py-2.5 bg-[#6353FF] hover:bg-[#5244e6] text-white font-semibold rounded-full transition-all disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Crear ticket
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
