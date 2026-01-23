import { useNavigate } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '../hooks/useNotifications'
import { Bell, Loader2 } from 'lucide-react'
import { format } from 'date-fns'

export function NotificationsPage() {
  const navigate = useNavigate()
  const { data: notifications, isLoading } = useNotifications()
  const markNotificationRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  const unreadCount = notifications?.filter(notification => !notification.is_read).length || 0

  const handleOpen = async (notification: { id: string; is_read: boolean; ticket_id: string | null }) => {
    if (!notification.is_read) {
      await markNotificationRead.mutateAsync(notification.id)
    }
    if (notification.ticket_id) {
      navigate(`/ticket/${notification.ticket_id}`)
    }
  }

  const handleMarkAll = async () => {
    if (unreadCount === 0) return
    await markAllRead.mutateAsync()
  }

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar />

      <div className="flex-1 overflow-auto bg-[#F7F7F8]">
        <div className="max-w-4xl mx-auto p-8 space-y-6">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-[#3F4444]">Notificaciones</h1>
              <p className="text-sm text-[#8A8F8F]">Mantente al día con tus menciones y asignaciones.</p>
            </div>
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={unreadCount === 0 || markAllRead.isPending}
              className="px-4 py-2 text-sm font-semibold bg-[#6353FF] hover:bg-[#5244e6] text-white rounded-xl transition-colors disabled:opacity-50"
            >
              Marcar todas como leídas
            </button>
          </header>

          <section className="bg-white border border-[#E0E0E1] rounded-2xl p-6">
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-[#8A8F8F]">
                <Loader2 className="w-4 h-4 animate-spin" />
                Cargando notificaciones...
              </div>
            )}

            {!isLoading && (!notifications || notifications.length === 0) && (
              <div className="text-center py-10 text-[#8A8F8F]">
                <Bell className="w-8 h-8 mx-auto mb-3 text-[#B0B5B5]" />
                No tienes notificaciones todavía.
              </div>
            )}

            <div className="space-y-3">
              {(notifications || []).map(notification => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleOpen(notification)}
                  className={`w-full text-left border rounded-xl p-4 transition-colors ${
                    notification.is_read
                      ? 'border-[#E0E0E1] bg-white hover:bg-[#F7F7F8]'
                      : 'border-[#D6D2FF] bg-[#F5F3FF] hover:bg-[#EEE9FF]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-[#3F4444]">
                        {notification.message || 'Notificación'}
                      </p>
                      <p className="text-xs text-[#8A8F8F]">
                        {format(new Date(notification.created_at), 'dd/MM/yyyy HH:mm')}
                      </p>
                    </div>
                    {notification.ticket_id && (
                      <span className="text-xs font-semibold text-[#6353FF]">
                        Ver ticket
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
