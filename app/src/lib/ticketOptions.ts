export const CATEGORY_OPTIONS = [
  { value: 'Alertas', label: 'Alertas', icon: '🔔' },
  { value: 'Front - Web', label: 'Front - Web', icon: '🌐' },
  { value: 'Carga', label: 'Carga', icon: '🔼' },
  { value: 'Dato', label: 'Dato', icon: '💽' },
  { value: 'Documentos', label: 'Documentos', icon: '📝' },
  { value: 'Integración', label: 'Integración', icon: '📡' },
  { value: 'Reportes', label: 'Reportes', icon: '📈' },
  { value: 'Usuarios', label: 'Usuarios', icon: '👤' },
  { value: 'Modificación', label: 'Modificación', icon: '✏️' },
  { value: 'Rendimiento', label: 'Rendimiento', icon: '⏱️' },
  { value: 'Mapeos', label: 'Mapeos', icon: '💕' },
  { value: 'Gestión del soporte', label: 'Gestión del soporte', icon: '💎' },
  { value: 'Otros', label: 'Otros', icon: '❓' },
  { value: 'Control', label: 'Control', icon: '🔎' },
  { value: 'No definido', label: 'No definido', icon: '➖' },
]

/** Opciones de "Tipo" de ticket (como en la UI de referencia: Desconocido, Consulta, Correctivo, Evolutivo, Tarea) */
export const TICKET_TYPE_OPTIONS = [
  { value: 'Desconocido', label: 'Desconocido', icon: '🛸' },
  { value: 'Consulta', label: 'Consulta', icon: '❓' },
  { value: 'Correctivo', label: 'Correctivo', icon: '🔥' },
  { value: 'Evolutivo', label: 'Evolutivo', icon: '🤖' },
  { value: 'Tarea', label: 'Tarea', icon: '📄' },
] as const

/** Opciones de tipo válido (excluye Desconocido) para Pdte. Validación y Completado */
export const VALID_TICKET_TYPE_OPTIONS = TICKET_TYPE_OPTIONS.filter(
  (o) => o.value !== 'Desconocido'
)

const VALID_TIPO_VALUES: Set<string> = new Set(
  VALID_TICKET_TYPE_OPTIONS.map((o) => o.value as string)
)

/** Solo Consulta, Correctivo, Evolutivo y Tarea son válidos. Null, vacío y Desconocido no. */
export function isValidTicketType(value?: string | null): boolean {
  const s = typeof value === 'string' ? value.trim() : ''
  if (!s) return false
  return VALID_TIPO_VALUES.has(s)
}

export const getCategoryOption = (value?: string | null) => {
  if (!value) return null
  return CATEGORY_OPTIONS.find(option => option.value === value) || null
}

export const getTicketTypeOption = (value?: string | null) => {
  if (!value) return null
  return TICKET_TYPE_OPTIONS.find(option => option.value === value) ?? null
}
