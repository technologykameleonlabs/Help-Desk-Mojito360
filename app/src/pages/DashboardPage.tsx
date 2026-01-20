import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { KanbanBoard } from '../components/KanbanBoard'
import type { Ticket } from '../lib/supabase'
import { LayoutGrid, List } from 'lucide-react'


export function DashboardPage() {
  const navigate = useNavigate()
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  
  const handleTicketClick = (ticket: Ticket) => {
    navigate(`/ticket/${ticket.id}`)
  }
  
  return (
    <div className="flex h-screen bg-zinc-950">
      <Sidebar />
      
      <main className="flex-1 overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6">
          <h1 className="text-lg font-semibold text-white">Dashboard</h1>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('kanban')}
              className={`p-2 rounded-lg transition-colors ${
                view === 'kanban' 
                  ? 'bg-primary-500/10 text-primary-400' 
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
              title="Vista Kanban"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-2 rounded-lg transition-colors ${
                view === 'list' 
                  ? 'bg-primary-500/10 text-primary-400' 
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
              title="Vista Lista"
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </header>
        
        {/* Content */}
        <div className="p-6 h-[calc(100vh-4rem)] overflow-auto">
          {view === 'kanban' ? (
            <KanbanBoard onTicketClick={handleTicketClick} />
          ) : (
            <div className="text-zinc-500">Vista de lista - próximamente</div>
          )}
        </div>
      </main>
    </div>
  )
}
