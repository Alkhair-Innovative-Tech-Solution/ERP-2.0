'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import toast from 'react-hot-toast'
import { Building2, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) return toast.error('Please fill all fields')
    setLoading(true)
    try {
      await login(username, password)
      toast.success('Welcome back!')
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface via-white to-surface flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/3 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-navy-500/3 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-400/2 rounded-full blur-3xl" />

      <div className="w-full max-w-[420px] relative">
        {/* Logo */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-navy-900 rounded-2xl mb-3 sm:mb-4 shadow-strong ring-1 ring-emerald-500/10">
            <Building2 size={24} className="text-emerald-400" />
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-navy-900 tracking-tight">NGO Expense System</h1>
          <p className="text-xs sm:text-sm text-navy-400 mt-1 sm:mt-1.5">Sign in to manage expenses</p>
        </div>

        {/* Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-strong border border-navy-100/60 p-5 sm:p-7">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Username</label>
              <input
                className="input"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy-600 transition-colors"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-6 pt-5 border-t border-navy-100">
            <p className="text-[11px] text-navy-400 mb-3 font-semibold uppercase tracking-widest">Quick Login</p>
            <div className="space-y-2">
              <DemoButton
                label="Accounts Head"
                detail="Full access — all branches"
                username="accounts_head"
                onClick={() => { setUsername('accounts_head'); setPassword('Admin@1234') }}
              />
              <DemoButton
                label="Branch Manager (HQ)"
                detail="Own branch only"
                username="manager_hq"
                onClick={() => { setUsername('manager_hq'); setPassword('Admin@1234') }}
              />
              <DemoButton
                label="Branch Manager (School)"
                detail="School Campus 1"
                username="manager_sch01"
                onClick={() => { setUsername('manager_sch01'); setPassword('Admin@1234') }}
              />
              <DemoButton
                label="Finance Head"
                detail="NGO-wide authority"
                username="finance_head"
                onClick={() => { setUsername('finance_head'); setPassword('Admin@1234') }}
              />
              <DemoButton
                label="Auditor"
                detail="Read-only access"
                username="auditor1"
                onClick={() => { setUsername('auditor1'); setPassword('Admin@1234') }}
              />
              <DemoButton
                label="Data Entry"
                detail="Entry only — no approvals"
                username="data_entry"
                onClick={() => { setUsername('data_entry'); setPassword('Admin@1234') }}
              />
              <DemoButton
                label="Program Officer"
                detail="View programs only"
                username="program_officer"
                onClick={() => { setUsername('program_officer'); setPassword('Admin@1234') }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DemoButton({ label, detail, onClick }: { label: string; detail?: string; username?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-medium text-navy-600 bg-navy-50/80 hover:bg-navy-100 transition-all border border-navy-100/70 hover:border-navy-200 group"
    >
      <span className="text-navy-800 font-semibold">{label}</span>
      {detail && <span className="text-navy-400 ml-1 sm:ml-2">— {detail}</span>}
    </button>
  )
}
