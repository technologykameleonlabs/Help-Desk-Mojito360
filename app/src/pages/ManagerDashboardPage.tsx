import { useMemo, useState } from 'react'
import { Sidebar } from '../components/Sidebar'
import { MultiSelect } from '../components/MultiSelect'
import { BarChart3, Download, Loader2, PieChart, LineChart, Filter } from 'lucide-react'
import { useEntities, useTicketCommentsSummary, useTicketSlaStatuses, useTicketStageHistoryByTicketIds } from '../hooks/useData'
import { useFilteredTickets } from '../hooks/useFilteredTickets'
import { STAGES, PRIORITIES } from '../lib/supabase'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import type { TicketFilters } from './DashboardPage'
import type { TicketStageHistory } from '../lib/supabase'

const APPLICATIONS = ['Mojito360', 'Wintruck', 'Odoo', 'Otros']
const APPLICATION_OPTIONS = APPLICATIONS.map(app => ({ value: app, label: app }))

const DEFAULT_FILTERS: TicketFilters = {
  dateFrom: '',
  dateTo: '',
  reference: '',
  externalReference: '',
  search: '',
  priority: [],
  stage: [],
  entity: [],
  application: [],
  category: [],
  assignedTo: [],
  responsible: []
}

export function ManagerDashboardPage() {
  const [filters, setFilters] = useState<TicketFilters>(DEFAULT_FILTERS)
  const { data: entities } = useEntities()

  const { tickets: filteredTicketsForMetrics, isLoading: metricsLoading } = useFilteredTickets(filters, true)
  const ticketIds = useMemo(() => filteredTicketsForMetrics.map(ticket => ticket.id), [filteredTicketsForMetrics])
  const { data: stageHistory, isFetching: stageHistoryFetching } = useTicketStageHistoryByTicketIds(ticketIds)
  const { data: commentsSummary, isFetching: commentsFetching } = useTicketCommentsSummary(ticketIds)
  const { data: slaStatuses, isFetching: slaFetching } = useTicketSlaStatuses(ticketIds)

  const entityOptions = entities?.map(entity => ({ value: entity.id, label: entity.name })) || []
  const isMetricsLoading = metricsLoading || stageHistoryFetching || commentsFetching || slaFetching

  const formatMinutes = (minutes: number) => {
    if (!Number.isFinite(minutes)) return '0m'
    const totalMinutes = Math.max(0, Math.round(minutes))
    const hours = Math.floor(totalMinutes / 60)
    const rest = totalMinutes % 60
    if (hours > 0) return `${hours}h ${rest}m`
    return `${rest}m`
  }

  const stripIcons = (label: string) => label
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  const dateRange = useMemo(() => {
    const start = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null
    const end = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`) : null
    return { start, end }
  }, [filters.dateFrom, filters.dateTo])

  const isWithinRange = (dateString?: string | null) => {
    if (!dateString) return false
    const value = new Date(dateString).getTime()
    if (Number.isNaN(value)) return false
    if (dateRange.start && value < dateRange.start.getTime()) return false
    if (dateRange.end && value > dateRange.end.getTime()) return false
    return true
  }

  const metricsData = useMemo(() => {
    const tickets = filteredTicketsForMetrics
    const totalTickets = tickets.length
    const resolvedTickets = tickets.filter(ticket => ticket.stage === 'done')
    const resolvedCount = resolvedTickets.length

    const byAssignee = new Map<string, { name: string; count: number }>()
    resolvedTickets.forEach(ticket => {
      const name = ticket.assigned_to_profile?.full_name || ticket.assigned_to_profile?.email || 'Sin asignar'
      const key = ticket.assigned_to || 'unassigned'
      const current = byAssignee.get(key) || { name, count: 0 }
      byAssignee.set(key, { name, count: current.count + 1 })
    })
    const productivity = Array.from(byAssignee.values())
      .sort((a, b) => b.count - a.count)

    const commentByTicket = new Map<string, Array<{ user_id: string; created_at: string; is_internal: boolean }>>()
    commentsSummary?.forEach(comment => {
      if (!commentByTicket.has(comment.ticket_id)) {
        commentByTicket.set(comment.ticket_id, [])
      }
      commentByTicket.get(comment.ticket_id)!.push(comment)
    })

    let firstResponseTotal = 0
    let firstResponseCount = 0
    tickets.forEach(ticket => {
      const ticketComments = commentByTicket.get(ticket.id) || []
      const firstResponse = ticketComments.find(comment => comment.user_id !== ticket.created_by)
      if (firstResponse) {
        const diffMinutes = (new Date(firstResponse.created_at).getTime() - new Date(ticket.created_at).getTime()) / 60000
        if (Number.isFinite(diffMinutes) && diffMinutes >= 0) {
          firstResponseTotal += diffMinutes
          firstResponseCount += 1
        }
      }
    })
    const avgFirstResponse = firstResponseCount > 0 ? firstResponseTotal / firstResponseCount : 0

    const doneStartedByTicket = new Map<string, string>()
    stageHistory?.forEach(entry => {
      if (entry.stage !== 'done') return
      const existing = doneStartedByTicket.get(entry.ticket_id)
      if (!existing || new Date(entry.started_at).getTime() < new Date(existing).getTime()) {
        doneStartedByTicket.set(entry.ticket_id, entry.started_at)
      }
    })
    let resolutionTotal = 0
    let resolutionCount = 0
    tickets.forEach(ticket => {
      const doneAt = doneStartedByTicket.get(ticket.id)
      if (!doneAt) return
      const diffMinutes = (new Date(doneAt).getTime() - new Date(ticket.created_at).getTime()) / 60000
      if (Number.isFinite(diffMinutes) && diffMinutes >= 0) {
        resolutionTotal += diffMinutes
        resolutionCount += 1
      }
    })
    const avgResolution = resolutionCount > 0 ? resolutionTotal / resolutionCount : 0

    const stageTotals = new Map<string, number>()
    let pausedSeconds = 0
    stageHistory?.forEach(entry => {
      const seconds = entry.duration_seconds ?? 0
      if (entry.is_paused) {
        pausedSeconds += seconds
        return
      }
      stageTotals.set(entry.stage, (stageTotals.get(entry.stage) || 0) + seconds)
    })
    const bottlenecks = Array.from(stageTotals.entries())
      .map(([stage, seconds]) => ({ stage, seconds }))
      .sort((a, b) => b.seconds - a.seconds)

    const slaCounts = { onTime: 0, risk: 0, overdue: 0, none: 0 }
    slaStatuses?.forEach(status => {
      if (status.sla_status === 'A tiempo') slaCounts.onTime += 1
      else if (status.sla_status === 'En riesgo') slaCounts.risk += 1
      else if (status.sla_status === 'Atrasado') slaCounts.overdue += 1
      else slaCounts.none += 1
    })

    const ticketsByApp = new Map<string, number>()
    const ticketsByEntity = new Map<string, number>()
    tickets.forEach(ticket => {
      const app = ticket.application || 'Sin aplicación'
      ticketsByApp.set(app, (ticketsByApp.get(app) || 0) + 1)
      const entity = ticket.entity?.name || 'Sin entidad'
      ticketsByEntity.set(entity, (ticketsByEntity.get(entity) || 0) + 1)
    })
    const topApps = Array.from(ticketsByApp.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
    const topEntities = Array.from(ticketsByEntity.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return {
      totalTickets,
      resolvedCount,
      productivity,
      avgFirstResponse,
      avgResolution,
      bottlenecks,
      pausedSeconds,
      slaCounts,
      topApps,
      topEntities,
    }
  }, [filteredTicketsForMetrics, stageHistory, commentsSummary, slaStatuses])

  const advancedMetrics = useMemo(() => {
    const tickets = filteredTicketsForMetrics
    const historyByTicket = new Map<string, TicketStageHistory[]>()
    stageHistory?.forEach(entry => {
      if (!historyByTicket.has(entry.ticket_id)) {
        historyByTicket.set(entry.ticket_id, [])
      }
      historyByTicket.get(entry.ticket_id)!.push(entry)
    })
    historyByTicket.forEach(entries => {
      entries.sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
    })

    const reopenedTickets = new Set<string>()
    historyByTicket.forEach(entries => {
      for (let i = 1; i < entries.length; i += 1) {
        const prev = entries[i - 1]
        const current = entries[i]
        if (prev.stage === 'done' && current.stage !== 'done' && current.stage !== 'cancelled') {
          if (isWithinRange(current.started_at)) {
            reopenedTickets.add(current.ticket_id)
          }
        }
      }
    })

    const closedTicketsInRange = tickets.filter(ticket => isWithinRange(ticket.closed_at ?? null))
    const closedCount = closedTicketsInRange.length
    const reopenedCount = reopenedTickets.size
    const reopenRatePct = closedCount > 0 ? Math.round((reopenedCount / closedCount) * 100) : 0

    const commentByTicket = new Map<string, Array<{ user_id: string; created_at: string; is_internal: boolean }>>()
    commentsSummary?.forEach(comment => {
      if (!commentByTicket.has(comment.ticket_id)) {
        commentByTicket.set(comment.ticket_id, [])
      }
      commentByTicket.get(comment.ticket_id)!.push(comment)
    })

    let fcrCount = 0
    let resolvedCount = 0
    tickets.forEach(ticket => {
      if (!isWithinRange(ticket.closed_at ?? null)) return
      resolvedCount += 1
      const ticketComments = (commentByTicket.get(ticket.id) || [])
        .filter(comment => !comment.is_internal && comment.user_id !== ticket.created_by)
      if (ticketComments.length === 1) {
        fcrCount += 1
      }
    })

    const fcrRatePct = resolvedCount > 0 ? Math.round((fcrCount / resolvedCount) * 100) : 0

    return {
      reopenRatePct,
      reopenedCount,
      closedCount,
      fcrRatePct,
      fcrCount,
      resolvedCount,
    }
  }, [filteredTicketsForMetrics, stageHistory, commentsSummary, isWithinRange])

  const slaTotal = metricsData.slaCounts.onTime + metricsData.slaCounts.risk + metricsData.slaCounts.overdue
  const slaOnTimePercent = slaTotal > 0 ? Math.round((metricsData.slaCounts.onTime / slaTotal) * 100) : 0
  const slaOverduePercent = slaTotal > 0 ? Math.round((metricsData.slaCounts.overdue / slaTotal) * 100) : 0

  const trendData = useMemo(() => {
    const tickets = filteredTicketsForMetrics
    const defaultDays = 14
    const end = dateRange.end ?? new Date()
    const start = dateRange.start ?? new Date(end.getTime() - (defaultDays - 1) * 86400000)

    const days: Array<{ label: string; dateKey: string; created: number; resolved: number }> = []
    for (let i = 0; i <= Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000)); i += 1) {
      const day = new Date(start.getTime() + i * 86400000)
      const key = day.toISOString().slice(0, 10)
      days.push({
        label: day.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
        dateKey: key,
        created: 0,
        resolved: 0,
      })
    }

    const byDate = new Map(days.map(item => [item.dateKey, item]))
    tickets.forEach(ticket => {
      const createdKey = new Date(ticket.created_at).toISOString().slice(0, 10)
      const createdBucket = byDate.get(createdKey)
      if (createdBucket) createdBucket.created += 1
      if (ticket.closed_at) {
        const resolvedKey = new Date(ticket.closed_at).toISOString().slice(0, 10)
        const resolvedBucket = byDate.get(resolvedKey)
        if (resolvedBucket) resolvedBucket.resolved += 1
      }
    })

    return days
  }, [filteredTicketsForMetrics, dateRange.end, dateRange.start])

  const resolutionHistogram = useMemo(() => {
    const buckets = [
      { label: '< 1 día', count: 0 },
      { label: '1-2 días', count: 0 },
      { label: '3-5 días', count: 0 },
      { label: '5-7 días', count: 0 },
      { label: '> 1 semana', count: 0 },
    ]

    filteredTicketsForMetrics.forEach(ticket => {
      if (!ticket.closed_at) return
      const diffDays = (new Date(ticket.closed_at).getTime() - new Date(ticket.created_at).getTime()) / 86400000
      if (!Number.isFinite(diffDays) || diffDays < 0) return
      if (diffDays < 1) buckets[0].count += 1
      else if (diffDays < 2) buckets[1].count += 1
      else if (diffDays < 5) buckets[2].count += 1
      else if (diffDays < 7) buckets[3].count += 1
      else buckets[4].count += 1
    })

    return buckets
  }, [filteredTicketsForMetrics])

  const agingBuckets = useMemo(() => {
    const buckets = [
      { label: '0-24h', count: 0 },
      { label: '1-2 días', count: 0 },
      { label: '2-5 días', count: 0 },
      { label: '5-10 días', count: 0 },
      { label: 'Más de 10 días', count: 0 },
    ]

    filteredTicketsForMetrics.forEach(ticket => {
      if (ticket.stage === 'done' || ticket.stage === 'cancelled') return
      const diffDays = (Date.now() - new Date(ticket.created_at).getTime()) / 86400000
      if (!Number.isFinite(diffDays) || diffDays < 0) return
      if (diffDays < 1) buckets[0].count += 1
      else if (diffDays < 2) buckets[1].count += 1
      else if (diffDays < 5) buckets[2].count += 1
      else if (diffDays < 10) buckets[3].count += 1
      else buckets[4].count += 1
    })

    return buckets
  }, [filteredTicketsForMetrics])

  const backlogByPriority = useMemo(() => {
    const counts = new Map<string, number>()
    filteredTicketsForMetrics.forEach(ticket => {
      if (ticket.stage === 'done' || ticket.stage === 'cancelled') return
      const key = ticket.priority || 'medium'
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    return Array.from(counts.entries()).map(([priority, count]) => ({ priority, count }))
  }, [filteredTicketsForMetrics])

  const backlogPie = useMemo(() => {
    const priorityOrder = ['critical', 'high', 'medium', 'low']
    const colors: Record<string, string> = {
      critical: '#EF4444',
      high: '#F59E0B',
      medium: '#3B82F6',
      low: '#6B7280',
    }
    const sorted = [...backlogByPriority].sort((a, b) =>
      priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority)
    )
    const total = sorted.reduce((sum, item) => sum + item.count, 0)
    if (total === 0) {
      return { total, gradient: 'conic-gradient(#E5E7EB 0 100%)', slices: [] }
    }
    let current = 0
    const slices = sorted.map(item => {
      const percent = (item.count / total) * 100
      const start = current
      const end = current + percent
      current = end
      return {
        ...item,
        percent,
        color: colors[item.priority] || '#9CA3AF',
        range: `${start}% ${end}%`,
      }
    })
    const gradient = `conic-gradient(${slices.map(slice => `${slice.color} ${slice.range}`).join(', ')})`
    return { total, gradient, slices }
  }, [backlogByPriority])

  const heatmapData = useMemo(() => {
    const matrix = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))
    filteredTicketsForMetrics.forEach(ticket => {
      const date = new Date(ticket.created_at)
      if (Number.isNaN(date.getTime())) return
      const day = date.getDay()
      const hour = date.getHours()
      matrix[day][hour] += 1
    })
    return matrix
  }, [filteredTicketsForMetrics])

  const dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  const handleExportExcel = () => {
    const summaryRows = [
      ['Total tickets', metricsData.totalTickets],
      ['Resueltos', metricsData.resolvedCount],
      ['Prom. primera respuesta', formatMinutes(metricsData.avgFirstResponse)],
      ['Prom. resolución', formatMinutes(metricsData.avgResolution)],
      ['Tasa reapertura', `${advancedMetrics.reopenRatePct}%`],
      ['Reaperturas', advancedMetrics.reopenedCount],
      ['FCR', `${advancedMetrics.fcrRatePct}%`],
      ['SLA en tiempo', metricsData.slaCounts.onTime],
      ['SLA en riesgo', metricsData.slaCounts.risk],
      ['SLA vencidos', metricsData.slaCounts.overdue],
      ['SLA sin regla', metricsData.slaCounts.none],
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Indicador', 'Valor'], ...summaryRows]), 'Resumen')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(metricsData.productivity), 'Productividad')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(metricsData.bottlenecks.map(item => ({
      estado: STAGES[item.stage as keyof typeof STAGES]?.label || item.stage,
      minutos: Math.round(item.seconds / 60),
    }))), 'Cuellos de botella')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(metricsData.topApps), 'Top Apps')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(metricsData.topEntities), 'Top Entidades')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trendData.map(item => ({
      fecha: item.dateKey,
      creados: item.created,
      resueltos: item.resolved,
    }))), 'Tendencia')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resolutionHistogram), 'Histograma Resolución')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(agingBuckets), 'Aging Backlog')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(backlogByPriority), 'Backlog Prioridad')
    const heatmapRows = heatmapData.flatMap((hours, dayIndex) =>
      hours.map((count, hour) => ({ dia: dayIndex, hora: hour, tickets: count }))
    )
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(heatmapRows), 'Heatmap')
    XLSX.writeFile(wb, 'dashboard_reportes.xlsx')
  }

  const handleExportPdf = () => {
    const doc = new jsPDF()
    const rows = [
      ['Total tickets', String(metricsData.totalTickets)],
      ['Resueltos', String(metricsData.resolvedCount)],
      ['Prom. primera respuesta', formatMinutes(metricsData.avgFirstResponse)],
      ['Prom. resolución', formatMinutes(metricsData.avgResolution)],
      ['Tasa reapertura', `${advancedMetrics.reopenRatePct}%`],
      ['FCR', `${advancedMetrics.fcrRatePct}%`],
      ['SLA en tiempo', String(metricsData.slaCounts.onTime)],
      ['SLA en riesgo', String(metricsData.slaCounts.risk)],
      ['SLA vencidos', String(metricsData.slaCounts.overdue)],
      ['SLA sin regla', String(metricsData.slaCounts.none)],
    ]
    doc.text('Panel de Control Gerencial', 14, 14)
    let y = 24
    rows.forEach(([label, value]) => {
      doc.text(`${label}: ${value}`, 14, y)
      y += 8
    })
    y += 6
    doc.text('Productividad (tickets resueltos):', 14, y)
    y += 8
    metricsData.productivity.slice(0, 10).forEach(item => {
      doc.text(`- ${item.name}: ${item.count}`, 14, y)
      y += 6
      if (y > 280) {
        doc.addPage()
        y = 20
      }
    })

    y += 6
    doc.text('Cuellos de botella (tiempo por estado):', 14, y)
    y += 8
    metricsData.bottlenecks.slice(0, 10).forEach(item => {
      const rawLabel = STAGES[item.stage as keyof typeof STAGES]?.label || item.stage
      const label = stripIcons(rawLabel)
      doc.text(`- ${label}: ${formatMinutes(item.seconds / 60)}`, 14, y)
      y += 6
      if (y > 280) {
        doc.addPage()
        y = 20
      }
    })
    y += 6
    doc.text('Top aplicaciones:', 14, y)
    y += 8
    metricsData.topApps.forEach(item => {
      doc.text(`- ${item.name}: ${item.count}`, 14, y)
      y += 6
      if (y > 280) {
        doc.addPage()
        y = 20
      }
    })

    y += 6
    doc.text('Top entidades:', 14, y)
    y += 8
    metricsData.topEntities.forEach(item => {
      doc.text(`- ${item.name}: ${item.count}`, 14, y)
      y += 6
      if (y > 280) {
        doc.addPage()
        y = 20
      }
    })
    doc.save('dashboard_reportes.pdf')
  }

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar />
      <div className="flex-1 overflow-auto bg-[#F7F7F8]">
        <div className="max-w-6xl mx-auto p-8 space-y-6">
          <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-lg font-semibold text-[#3F4444]">Panel de Control Gerencial</h1>
              <p className="text-sm text-[#8A8F8F]">Indicadores de productividad, tiempos y SLA.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-white border border-[#E0E0E1] rounded-xl text-[#3F4444] hover:bg-[#ECECED] transition-colors"
              >
                <Download className="w-4 h-4" />
                Exportar Excel
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-white border border-[#E0E0E1] rounded-xl text-[#3F4444] hover:bg-[#ECECED] transition-colors"
              >
                <Download className="w-4 h-4" />
                Exportar PDF
              </button>
            </div>
          </header>

          <section className="bg-white border border-[#E0E0E1] rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-[#3F4444] font-semibold">
              <Filter className="w-5 h-5" />
              Filtros
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="block mb-1.5 text-[10px] uppercase font-bold text-[#8A8F8F] tracking-wider">
                  Fecha desde
                </label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-sm text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="block mb-1.5 text-[10px] uppercase font-bold text-[#8A8F8F] tracking-wider">
                  Fecha hasta
                </label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-[#E0E0E1] rounded-xl text-sm text-[#3F4444] outline-none focus:ring-2 focus:ring-[#6353FF] focus:ring-opacity-30 focus:border-[#6353FF] transition-all"
                />
              </div>
              <MultiSelect
                label="Entidad"
                options={entityOptions}
                value={filters.entity}
                onChange={(value) => setFilters(prev => ({ ...prev, entity: value }))}
                placeholder="Todas"
              />
              <MultiSelect
                label="Aplicación"
                options={APPLICATION_OPTIONS}
                value={filters.application}
                onChange={(value) => setFilters(prev => ({ ...prev, application: value }))}
                placeholder="Todas"
              />
            </div>
          </section>

          <section className="bg-white border border-[#E0E0E1] rounded-2xl p-6 space-y-6 relative">
            {isMetricsLoading && (
              <div className="absolute inset-0 z-10 rounded-2xl bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
                <div className="flex items-center gap-2 text-sm text-[#8A8F8F]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cargando métricas...
                </div>
              </div>
            )}
            {metricsLoading ? (
              <div className="flex items-center gap-2 text-sm text-[#8A8F8F]">
                <Loader2 className="w-4 h-4 animate-spin" />
                Calculando métricas...
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="border border-[#E0E0E1] rounded-xl p-4">
                    <div className="text-[11px] text-[#8A8F8F] uppercase tracking-wider">Tickets totales</div>
                    <div className="text-2xl font-semibold text-[#3F4444]">{metricsData.totalTickets}</div>
                  </div>
                  <div className="border border-[#E0E0E1] rounded-xl p-4">
                    <div className="text-[11px] text-[#8A8F8F] uppercase tracking-wider">Resueltos</div>
                    <div className="text-2xl font-semibold text-[#3F4444]">{metricsData.resolvedCount}</div>
                  </div>
                  <div className="border border-[#E0E0E1] rounded-xl p-4">
                    <div className="text-[11px] text-[#8A8F8F] uppercase tracking-wider">Prom. primera respuesta</div>
                    <div className="text-2xl font-semibold text-[#3F4444]">{formatMinutes(metricsData.avgFirstResponse)}</div>
                  </div>
                  <div className="border border-[#E0E0E1] rounded-xl p-4">
                    <div className="text-[11px] text-[#8A8F8F] uppercase tracking-wider">Prom. resolución</div>
                    <div className="text-2xl font-semibold text-[#3F4444]">{formatMinutes(metricsData.avgResolution)}</div>
                  </div>
                  <div className="border border-[#E0E0E1] rounded-xl p-4">
                    <div className="text-[11px] text-[#8A8F8F] uppercase tracking-wider">Tasa reapertura</div>
                    <div className="text-2xl font-semibold text-[#3F4444]">{advancedMetrics.reopenRatePct}%</div>
                    <div className="text-xs text-[#8A8F8F]">{advancedMetrics.reopenedCount} de {advancedMetrics.closedCount}</div>
                  </div>
                  <div className="border border-[#E0E0E1] rounded-xl p-4">
                    <div className="text-[11px] text-[#8A8F8F] uppercase tracking-wider">FCR</div>
                    <div className="text-2xl font-semibold text-[#3F4444]">{advancedMetrics.fcrRatePct}%</div>
                    <div className="text-xs text-[#8A8F8F]">{advancedMetrics.fcrCount} de {advancedMetrics.resolvedCount}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="border border-[#E0E0E1] rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#3F4444]">
                      <PieChart className="w-4 h-4" />
                      SLA (en tiempo vs vencido)
                    </div>
                    <div className="flex items-center gap-4">
                      <div
                        className="w-24 h-24 rounded-full"
                        style={{
                          background: `conic-gradient(#10B981 0 ${slaOnTimePercent}%, #EF4444 ${slaOnTimePercent}% ${slaOnTimePercent + slaOverduePercent}%, #F59E0B ${slaOnTimePercent + slaOverduePercent}% 100%)`,
                        }}
                      />
                      <div className="text-sm text-[#5A5F5F] space-y-1">
                        <div>En tiempo: <span className="font-semibold text-[#3F4444]">{metricsData.slaCounts.onTime}</span></div>
                        <div>En riesgo: <span className="font-semibold text-[#3F4444]">{metricsData.slaCounts.risk}</span></div>
                        <div>Vencidos: <span className="font-semibold text-[#3F4444]">{metricsData.slaCounts.overdue}</span></div>
                        <div>Sin SLA: <span className="font-semibold text-[#3F4444]">{metricsData.slaCounts.none}</span></div>
                      </div>
                    </div>
                  </div>

                  <div className="border border-[#E0E0E1] rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#3F4444]">
                      <BarChart3 className="w-4 h-4" />
                      Top 5 aplicaciones con más fallos
                    </div>
                    <div className="space-y-2">
                      {metricsData.topApps.length === 0 && (
                        <div className="text-sm text-[#8A8F8F]">Sin datos.</div>
                      )}
                      {metricsData.topApps.map(item => {
                        const max = Math.max(...metricsData.topApps.map(value => value.count), 1)
                        const width = Math.round((item.count / max) * 100)
                        return (
                          <div key={item.name} className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-[#5A5F5F]">
                              <span>{item.name}</span>
                              <span className="font-semibold text-[#3F4444]">{item.count}</span>
                            </div>
                            <div className="h-2 bg-[#F7F7F8] rounded-full overflow-hidden">
                              <div className="h-full bg-[#6353FF]" style={{ width: `${width}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="border border-[#E0E0E1] rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#3F4444]">
                      <BarChart3 className="w-4 h-4" />
                      Top 5 entidades con más solicitudes
                    </div>
                    <div className="space-y-2">
                      {metricsData.topEntities.length === 0 && (
                        <div className="text-sm text-[#8A8F8F]">Sin datos.</div>
                      )}
                      {metricsData.topEntities.map(item => {
                        const max = Math.max(...metricsData.topEntities.map(value => value.count), 1)
                        const width = Math.round((item.count / max) * 100)
                        return (
                          <div key={item.name} className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-[#5A5F5F]">
                              <span>{item.name}</span>
                              <span className="font-semibold text-[#3F4444]">{item.count}</span>
                            </div>
                            <div className="h-2 bg-[#F7F7F8] rounded-full overflow-hidden">
                              <div className="h-full bg-[#10B981]" style={{ width: `${width}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="border border-[#E0E0E1] rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#3F4444]">
                    <BarChart3 className="w-4 h-4" />
                    Productividad (resueltos por especialista)
                  </div>
                  <div className="space-y-2">
                    {metricsData.productivity.length === 0 && (
                      <div className="text-sm text-[#8A8F8F]">Sin datos.</div>
                    )}
                    {metricsData.productivity.slice(0, 8).map(item => {
                      const max = Math.max(...metricsData.productivity.map(value => value.count), 1)
                      const width = Math.round((item.count / max) * 100)
                      return (
                        <div key={item.name} className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-[#5A5F5F]">
                            <span>{item.name}</span>
                            <span className="font-semibold text-[#3F4444]">{item.count}</span>
                          </div>
                          <div className="h-2 bg-[#F7F7F8] rounded-full overflow-hidden">
                            <div className="h-full bg-[#3B82F6]" style={{ width: `${width}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="border border-[#E0E0E1] rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#3F4444]">
                      <BarChart3 className="w-4 h-4" />
                      Cuellos de botella por estado
                    </div>
                    <div className="space-y-2">
                      {metricsData.bottlenecks.length === 0 && (
                        <div className="text-sm text-[#8A8F8F]">Sin datos.</div>
                      )}
                      {metricsData.bottlenecks.map(item => {
                        const max = Math.max(...metricsData.bottlenecks.map(value => value.seconds), 1)
                        const width = Math.round((item.seconds / max) * 100)
                        return (
                          <div key={item.stage} className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-[#5A5F5F]">
                              <span>{STAGES[item.stage as keyof typeof STAGES]?.label || item.stage}</span>
                              <span className="font-semibold text-[#3F4444]">{formatMinutes(item.seconds / 60)}</span>
                            </div>
                            <div className="h-2 bg-[#F7F7F8] rounded-full overflow-hidden">
                              <div className="h-full bg-[#F59E0B]" style={{ width: `${width}%` }} />
                            </div>
                          </div>
                        )
                      })}
                      {metricsData.pausedSeconds > 0 && (
                        <div className="text-xs text-[#8A8F8F]">
                          Tiempo en pausa (no SLA): {formatMinutes(metricsData.pausedSeconds / 60)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border border-[#E0E0E1] rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#3F4444]">
                      <LineChart className="w-4 h-4" />
                      Tendencia de backlog (creados vs resueltos)
                    </div>
                    <div className="h-32">
                      <svg viewBox="0 0 300 120" className="w-full h-full">
                        {(() => {
                          const max = Math.max(
                            ...trendData.map(item => Math.max(item.created, item.resolved)),
                            1
                          )
                          const createdPoints = trendData.map((item, index) => {
                            const x = (index / Math.max(trendData.length - 1, 1)) * 280 + 10
                            const y = 100 - (item.created / max) * 80 + 10
                            return `${x},${y}`
                          }).join(' ')
                          const resolvedPoints = trendData.map((item, index) => {
                            const x = (index / Math.max(trendData.length - 1, 1)) * 280 + 10
                            const y = 100 - (item.resolved / max) * 80 + 10
                            return `${x},${y}`
                          }).join(' ')
                          return (
                            <>
                              <polyline
                                points={createdPoints}
                                fill="none"
                                stroke="#6353FF"
                                strokeWidth="2"
                              />
                              <polyline
                                points={resolvedPoints}
                                fill="none"
                                stroke="#10B981"
                                strokeWidth="2"
                              />
                              {trendData.map((item, index) => {
                                const x = (index / Math.max(trendData.length - 1, 1)) * 280 + 10
                                const y = 100 - (item.created / max) * 80 + 10
                                return <circle key={item.dateKey} cx={x} cy={y} r="3" fill="#6353FF" />
                              })}
                              {trendData.map((item, index) => {
                                const x = (index / Math.max(trendData.length - 1, 1)) * 280 + 10
                                const y = 100 - (item.resolved / max) * 80 + 10
                                return <circle key={`${item.dateKey}-resolved`} cx={x} cy={y} r="3" fill="#10B981" />
                              })}
                            </>
                          )
                        })()}
                      </svg>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[#5A5F5F]">
                      <div className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-[#6353FF]" />
                        Creados
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-[#10B981]" />
                        Resueltos
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[#8A8F8F]">
                      <span>{trendData[0]?.label || ''}</span>
                      <span>{trendData[trendData.length - 1]?.label || ''}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="border border-[#E0E0E1] rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#3F4444]">
                      <BarChart3 className="w-4 h-4" />
                      Mapa de calor (día vs hora)
                    </div>
                    <div className="overflow-auto">
                      <div className="grid grid-cols-[40px_repeat(24,minmax(12px,1fr))] gap-1 text-[10px]">
                        <div />
                        {Array.from({ length: 24 }, (_, hour) => (
                          <div key={`hour-${hour}`} className="text-center text-[#8A8F8F]">{hour}</div>
                        ))}
                        {heatmapData.map((hours, dayIndex) => {
                          const max = Math.max(...heatmapData.flat(), 1)
                          return (
                            <div key={`day-${dayIndex}`} className="contents">
                              <div className="text-[#8A8F8F]">{dayLabels[dayIndex]}</div>
                              {hours.map((count, hour) => {
                                const intensity = count / max
                                const background = `rgba(99, 83, 255, ${Math.max(0.05, intensity)})`
                                return (
                                  <div
                                    key={`cell-${dayIndex}-${hour}`}
                                    title={`${dayLabels[dayIndex]} ${hour}:00 - ${count} tickets`}
                                    className="h-5 rounded"
                                    style={{ background }}
                                  />
                                )
                              })}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="border border-[#E0E0E1] rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#3F4444]">
                      <BarChart3 className="w-4 h-4" />
                      Histograma de tiempos de solución
                    </div>
                    <div className="space-y-2">
                      {resolutionHistogram.map(bucket => {
                        const max = Math.max(...resolutionHistogram.map(item => item.count), 1)
                        const width = Math.round((bucket.count / max) * 100)
                        return (
                          <div key={bucket.label} className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-[#5A5F5F]">
                              <span>{bucket.label}</span>
                              <span className="font-semibold text-[#3F4444]">{bucket.count}</span>
                            </div>
                            <div className="h-2 bg-[#F7F7F8] rounded-full overflow-hidden">
                              <div className="h-full bg-[#7C3AED]" style={{ width: `${width}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="border border-[#E0E0E1] rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#3F4444]">
                      <BarChart3 className="w-4 h-4" />
                      Edad del backlog (tickets abiertos)
                    </div>
                    <div className="space-y-2">
                      {agingBuckets.map(bucket => {
                        const max = Math.max(...agingBuckets.map(item => item.count), 1)
                        const width = Math.round((bucket.count / max) * 100)
                        return (
                          <div key={bucket.label} className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-[#5A5F5F]">
                              <span>{bucket.label}</span>
                              <span className="font-semibold text-[#3F4444]">{bucket.count}</span>
                            </div>
                            <div className="h-2 bg-[#F7F7F8] rounded-full overflow-hidden">
                              <div className="h-full bg-[#F97316]" style={{ width: `${width}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="border border-[#E0E0E1] rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#3F4444]">
                      <PieChart className="w-4 h-4" />
                      Composición del backlog (prioridad)
                    </div>
                    <div className="flex items-center gap-4">
                      <div
                        className="w-24 h-24 rounded-full"
                        style={{ background: backlogPie.gradient }}
                      />
                      <div className="text-sm text-[#5A5F5F] space-y-1">
                        {backlogPie.slices.length === 0 && (
                          <div className="text-sm text-[#8A8F8F]">Sin datos.</div>
                        )}
                        {backlogPie.slices.map(slice => {
                          const label = PRIORITIES[slice.priority as keyof typeof PRIORITIES]?.label || slice.priority
                          return (
                            <div key={slice.priority} className="flex items-center gap-2">
                              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: slice.color }} />
                              <span>{label}: <strong className="text-[#3F4444]">{slice.count}</strong></span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
