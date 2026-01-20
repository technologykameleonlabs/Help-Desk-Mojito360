import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { KanbanBoard } from '../components/KanbanBoard'
import { TicketDetail } from '../components/TicketDetail'
import { LayoutGrid, List } from 'lucide-react'
import { useRealtimeTickets } from '../hooks/useRealtime'



export function DashboardPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  
  // Subscribe to realtime ticket updates
  useRealtimeTickets()
  
  const handleTicketClick = (ticketId: string) => {
    navigate(`/ticket/${ticketId}`)
  }
  
  return (

    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-hidden flex flex-col">
          {/* Header */}
          <header className="h-16 border-b border-[#E0E0E1] flex items-center justify-between px-6 shrink-0 bg-white">
            <h1 className="text-lg font-semibold text-[#3F4444]">Dashboard</h1>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView('kanban')}
                className={`p-2 rounded-lg transition-colors ${
                  view === 'kanban' 
                    ? 'bg-[rgba(99,83,255,0.1)] text-[#6353FF]' 
                    : 'text-[#8A8F8F] hover:text-[#3F4444] hover:bg-[#F7F7F8]'
                }`}
                title="Vista Kanban"
              >
                <LayoutGrid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setView('list')}
                className={`p-2 rounded-lg transition-colors ${
                  view === 'list' 
                    ? 'bg-[rgba(99,83,255,0.1)] text-[#6353FF]' 
                    : 'text-[#8A8F8F] hover:text-[#3F4444] hover:bg-[#F7F7F8]'
                }`}
                title="Vista Lista"
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </header>
          
          {/* Content */}
          <div className="p-6 flex-1 overflow-auto bg-[#F7F7F8]">
            {view === 'kanban' ? (
              <KanbanBoard onTicketClick={handleTicketClick} />
            ) : (
              <div className="text-[#8A8F8F]">Vista de lista - próximamente</div>
            )}
          </div>
        </main>

        {id && <TicketDetail />}
      </div>
    </div>
  )
}

