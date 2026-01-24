import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export const adminSupabase = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    })
  : null

// Types based on database schema
export type Profile = {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: 'admin' | 'agent' | 'dev' | 'client'
  email: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Entity = {
  id: string
  external_id: string | null
  name: string
  status: 'active' | 'inactive'
  usage: string | null
  assigned_to: string | null
  created_at: string
  updated_at: string
  // Relations
  assigned_to_profile?: Profile
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
  external_ref: string | null
  external_source: string | null
  external_url: string | null
  title: string
  description: string | null
  stage: TicketStage
  priority: TicketPriority
  assigned_to: string | null
  created_by: string | null
  created_by_email?: string | null
  updated_by?: string | null
  entity_id: string | null
  category: string | null
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
  pending_validation_since?: string | null
  last_client_activity_at?: string | null
  created_at: string
  updated_at: string
  // Relations (populated by joins)
  assigned_to_profile?: Profile
  created_by_profile?: Profile
  entity?: Entity
  labels?: { label: Label }[]
}

export type Label = {
  id: string
  name: string
  color: string
  created_at?: string
}

export type SlaPolicy = {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type SlaThreshold = {
  id: string
  policy_id: string
  priority: TicketPriority | null
  application: string | null
  entity_id: string | null
  warning_minutes: number
  breach_minutes: number
  created_at: string
  updated_at: string
  policy?: SlaPolicy
  entity?: Entity
}

export type TicketStageHistory = {
  id: string
  ticket_id: string
  stage: TicketStage
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  is_paused: boolean
  created_at: string
  changed_by?: string | null
}

export type AppSettings = {
  id: number
  auto_close_pending_validation_hours: number
  system_user_id: string | null
  updated_at: string
}

export type TicketSlaStatus = {
  ticket_id: string
  created_at: string
  priority: TicketPriority
  application: string | null
  entity_id: string | null
  threshold_id: string | null
  policy_id: string | null
  warning_minutes: number | null
  breach_minutes: number | null
  elapsed_minutes: number
  sla_status: 'A tiempo' | 'En riesgo' | 'Atrasado' | null
}

export type Comment = {
  id: string
  ticket_id: string
  user_id: string
  content: string
  is_internal: boolean
  created_at: string
  edited_at?: string | null
  edited_by?: string | null
  is_deleted?: boolean | null
  deleted_at?: string | null
  deleted_by?: string | null
  // Relations
  user?: Profile
}

export type SavedViewVisibility = 'private' | 'public'
export type SavedViewScope = 'dashboard'

export type SavedView = {
  id: string
  name: string
  owner_id: string
  scope: SavedViewScope
  visibility: SavedViewVisibility
  config: Record<string, unknown>
  created_at: string
  updated_at: string
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
