import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types based on database schema
export type Profile = {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: 'admin' | 'agent' | 'dev'
  email: string | null
  created_at: string
  updated_at: string
}

export type Entity = {
  id: string
  external_id: string | null
  name: string
  status: 'active' | 'inactive'
  usage: string | null
  created_at: string
  updated_at: string
}

export type TicketStage = 
  | 'new' 
  | 'assigned' 
  | 'in_progress' 
  | 'pending_dev' 
  | 'pending_sales'
  | 'pending_client' 
  | 'testing' 
  | 'pending_validation' 
  | 'done' 
  | 'paused' 
  | 'cancelled'

export type TicketPriority = 'low' | 'medium' | 'high' | 'critical'

export type Ticket = {
  id: string
  ticket_ref: number
  title: string
  description: string | null
  stage: TicketStage
  priority: TicketPriority
  assigned_to: string | null
  created_by: string | null
  entity_id: string | null
  application: string | null
  classification: string | null
  channel: string | null
  origin: string | null
  ticket_type: string | null
  commitment_date: string | null
  estimated_time: number | null
  responsibility: string | null
  sharepoint_url: string | null
  solution: string | null
  created_at: string
  updated_at: string
  // Relations (populated by joins)
  assigned_to_profile?: Profile
  created_by_profile?: Profile
  entity?: Entity
}

export type Comment = {
  id: string
  ticket_id: string
  user_id: string
  content: string
  is_internal: boolean
  created_at: string
  // Relations
  user?: Profile
}

// Stage display configuration
export const STAGES: Record<TicketStage, { label: string; color: string }> = {

  new: { label: '📧 Nuevo', color: 'bg-blue-500' },
  assigned: { label: '🧍 Asignado', color: 'bg-yellow-500' },
  in_progress: { label: '✍️ En Ejecución', color: 'bg-orange-500' },
  pending_dev: { label: '💾 Pdte. Desarrollo', color: 'bg-purple-500' },
  pending_sales: { label: '💲 Pdte. Comercial', color: 'bg-pink-500' },
  pending_client: { label: '🧑 Pdte. Cliente', color: 'bg-cyan-500' },
  testing: { label: '🧪 Pruebas', color: 'bg-indigo-500' },
  pending_validation: { label: '⌛ Pdte. Validación', color: 'bg-amber-500' },
  done: { label: '✔️ Completado', color: 'bg-green-500' },
  paused: { label: '⏸️ Pausado', color: 'bg-zinc-500' },
  cancelled: { label: '❌ Cancelado', color: 'bg-red-500' },
}

export const PRIORITIES: Record<TicketPriority, { label: string; color: string }> = {

  low: { label: 'Baja', color: 'bg-zinc-500' },
  medium: { label: 'Media', color: 'bg-blue-500' },
  high: { label: 'Alta', color: 'bg-orange-500' },
  critical: { label: 'Crítica', color: 'bg-red-500' },
}
