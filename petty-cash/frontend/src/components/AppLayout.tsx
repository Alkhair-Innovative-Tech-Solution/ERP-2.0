'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Sidebar from '@/components/Sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <div className="w-9 h-9 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-navy-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar mobileOpen={mobileSidebarOpen} setMobileOpen={setMobileSidebarOpen} />
      <main className="flex-1 lg:ml-64 min-h-screen">
        <div className="fixed top-0 left-0 lg:left-64 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent z-10 pointer-events-none" />
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in pt-16 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  )
}
