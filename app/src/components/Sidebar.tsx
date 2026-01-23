import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Inbox,
  User,
  Archive,
  Users,
  Building2,
  Tag,
  ChevronRight,
  ChevronLeft,
  LogOut,
  Plus,
  Bell
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCurrentUser } from '../hooks/useData'
import { useUnreadNotificationCount } from '../hooks/useNotifications'
import { useRealtimeNotifications } from '../hooks/useRealtime'
import type { ComponentType } from 'react'

type NavItem = {
  to: string
  icon: ComponentType<{ className?: string }>
  label: string
  badge?: string | number
}

export function Sidebar() {
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(true)
  const { data: user } = useCurrentUser()
  const { data: unreadCount } = useUnreadNotificationCount()

  useRealtimeNotifications()

  const badgeText =
    unreadCount && unreadCount > 99 ? '99+' : unreadCount || 0

  const navItems: NavItem[] = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/inbox', icon: Inbox, label: 'Inbox' },
    { to: '/my-tickets', icon: User, label: 'Mis Tickets' },
    { to: '/archive', icon: Archive, label: 'Archivo' },
    { to: '/notifications', icon: Bell, label: 'Notificaciones', badge: badgeText },
  ]
  const adminItems: NavItem[] = user?.role === 'admin'
    ? [
        { to: '/users', icon: Users, label: 'Usuarios' },
        { to: '/entities', icon: Building2, label: 'Entidades' },
        { to: '/labels', icon: Tag, label: 'Labels' },
      ]
    : []

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <aside className={`${collapsed ? 'w-20' : 'w-64'} h-screen bg-[#F7F7F8] border-r border-[#E0E0E1] flex flex-col transition-all duration-200 relative`}>
      {/* Logo */}
      <div className="h-16 px-4 border-b border-[#E0E0E1] flex items-center justify-center">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-[#3F4444]">
            {collapsed ? (
              <>
                M<span className="text-[#6353FF]">360</span>
              </>
            ) : (
              <>
                Mojito<span className="text-[#6353FF]">360</span>
              </>
            )}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setCollapsed(prev => !prev)}
        className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white border border-[#E0E0E1] text-[#8A8F8F] hover:text-[#3F4444] hover:bg-[#ECECED] transition-colors flex items-center justify-center shadow-sm"
        title={collapsed ? 'Expandir' : 'Colapsar'}
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* New Ticket Button */}
      <div className="p-4">
        <button
          onClick={() => navigate('/new')}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#6353FF] hover:bg-[#5244e6] text-white font-semibold rounded-full transition-colors"
          title={collapsed ? 'Nuevo ticket' : undefined}
        >
          <Plus className="w-4 h-4" />
          {!collapsed && 'Nuevo ticket'}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1">
        {[...navItems, ...adminItems].map(({ to, icon: Icon, label, badge }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-3'} py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[rgba(99,83,255,0.1)] text-[#6353FF]'
                  : 'text-[#5A5F5F] hover:text-[#3F4444] hover:bg-[#ECECED]'
              }`
            }
          >
            <div className="relative">
              <Icon className="w-5 h-5" />
              {!!badge && (
                <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-[#6353FF] text-white text-[10px] font-semibold flex items-center justify-center">
                  {badge}
                </span>
              )}
            </div>
            {!collapsed && label}
          </NavLink>
        ))}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-[#E0E0E1]">
        <div className={`flex items-center ${collapsed ? 'flex-col gap-2' : 'gap-3'}`}>
          <div className="w-9 h-9 rounded-full bg-[#6353FF] flex items-center justify-center text-white font-medium text-sm">
            {user?.full_name?.[0] || user?.email?.[0] || '?'}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#3F4444] truncate">
                {user?.full_name || 'Usuario'}
              </p>
              <p className="text-xs text-[#8A8F8F] truncate">{user?.email}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="p-2 text-[#8A8F8F] hover:text-[#3F4444] hover:bg-[#ECECED] rounded-lg transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
