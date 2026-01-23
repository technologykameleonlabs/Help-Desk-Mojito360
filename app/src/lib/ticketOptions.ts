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

export const getCategoryOption = (value?: string | null) => {
  if (!value) return null
  return CATEGORY_OPTIONS.find(option => option.value === value) || null
}
