import { NavLink, useNavigate } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Inbox, 
  User, 
  Archive, 
  LogOut,
  Plus
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCurrentUser } from '../hooks/useData'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/inbox', icon: Inbox, label: 'Inbox' },
  { to: '/my-tickets', icon: User, label: 'Mis Tickets' },
  { to: '/archive', icon: Archive, label: 'Archivo' },
]

export function Sidebar() {
  const navigate = useNavigate()
  const { data: user } = useCurrentUser()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <aside className="w-64 h-screen bg-[#F7F7F8] border-r border-[#E0E0E1] flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-[#E0E0E1]">
        <h1 className="text-xl font-bold text-[#3F4444]">
          Mojito<span className="text-[#6353FF]">360</span>
        </h1>
        <p className="text-xs text-[#8A8F8F] mt-1">Help Desk</p>
      </div>

      {/* New Ticket Button */}
      <div className="p-4">
        <button
          onClick={() => navigate('/new')}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-6 bg-[#6353FF] hover:bg-[#5244e6] text-white font-semibold rounded-full transition-colors lowercase"
        >
          <Plus className="w-4 h-4" />
          nuevo ticket
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[rgba(99,83,255,0.1)] text-[#6353FF]'
                  : 'text-[#5A5F5F] hover:text-[#3F4444] hover:bg-[#ECECED]'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-[#E0E0E1]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#6353FF] flex items-center justify-center text-white font-medium text-sm">
            {user?.full_name?.[0] || user?.email?.[0] || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#3F4444] truncate">
              {user?.full_name || 'Usuario'}
            </p>
            <p className="text-xs text-[#8A8F8F] truncate">{user?.email}</p>
          </div>
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
