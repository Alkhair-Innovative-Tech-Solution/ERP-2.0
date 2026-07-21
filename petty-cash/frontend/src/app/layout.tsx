import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'NGO Expense Management',
  description: 'NGO Expense & Petty Cash Record System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#fff',
                color: '#0f172a',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '14px',
                boxShadow: '0 4px 12px rgb(15 23 42 / 0.08)',
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  )
}
