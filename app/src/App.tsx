import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { supabase } from './lib/supabase'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { NewTicketPage } from './pages/NewTicketPage'
import { InboxPage } from './pages/InboxPage'
import { MyTicketsPage } from './pages/MyTicketsPage'
import { ArchivePage } from './pages/ArchivePage'
import { UsersPage } from './pages/UsersPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      refetchOnWindowFocus: false,
    },
  },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {

  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthenticated(!!session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setAuthenticated(!!session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F8]">
        <div className="text-[#8A8F8F]">Cargando...</div>
      </div>
    )
  }

  return authenticated ? <>{children}</> : <Navigate to="/login" />
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Routes>
                  {/* Dashboard */}
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/ticket/:id" element={<DashboardPage />} />
                  
                  {/* New Ticket */}
                  <Route path="/new" element={<NewTicketPage />} />
                  
                  {/* Inbox */}
                  <Route path="/inbox" element={<InboxPage />} />
                  <Route path="/inbox/:id" element={<InboxPage />} />
                  
                  {/* My Tickets */}
                  <Route path="/my-tickets" element={<MyTicketsPage />} />
                  <Route path="/my-tickets/:id" element={<MyTicketsPage />} />
                  
                  {/* Archive */}
                  <Route path="/archive" element={<ArchivePage />} />
                  <Route path="/archive/:id" element={<ArchivePage />} />

                  {/* Users */}
                  <Route path="/users" element={<UsersPage />} />
                </Routes>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App

