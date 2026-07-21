'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import Cookies from 'js-cookie'
import { login as apiLogin, getMe } from '@/lib/api'

interface Branch {
  id: number
  type: string
  type_display: string
  name: string
  code: string
}

interface User {
  id: number
  username: string
  full_name: string
  role: 'finance_head' | 'accounts_head' | 'branch_manager' | 'data_entry_operator' | 'program_officer' | 'auditor'
  role_display: string
  department: string
  employee_id: string
  spending_limit: string
  branch: Branch | null
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  isFinanceHead: boolean
  isAccountsHead: boolean
  isBranchManager: boolean
  isAuditor: boolean
  isDataEntryOperator: boolean
  isProgramOfficer: boolean
  canEdit: boolean
  canApprove: boolean
  canViewAllBranches: boolean
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

const APPROVAL_ROLES = ['branch_manager', 'accounts_head', 'finance_head']
const EDIT_ROLES = ['data_entry_operator', 'branch_manager', 'accounts_head', 'finance_head']
const VIEW_ALL_ROLES = ['accounts_head', 'finance_head', 'program_officer']

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = Cookies.get('access_token')
    if (token) {
      getMe()
        .then((res) => setUser(res.data))
        .catch(() => {
          Cookies.remove('access_token')
          Cookies.remove('refresh_token')
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (username: string, password: string) => {
    const res = await apiLogin(username, password)
    Cookies.set('access_token', res.data.access, { expires: 1 })
    Cookies.set('refresh_token', res.data.refresh, { expires: 7 })
    setUser(res.data.user)
  }

  const logout = () => {
    Cookies.remove('access_token')
    Cookies.remove('refresh_token')
    setUser(null)
    window.location.href = '/login'
  }

  const role = user?.role || ''

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      isFinanceHead: role === 'finance_head',
      isAccountsHead: role === 'accounts_head',
      isBranchManager: role === 'branch_manager',
      isAuditor: role === 'auditor',
      isDataEntryOperator: role === 'data_entry_operator',
      isProgramOfficer: role === 'program_officer',
      canEdit: EDIT_ROLES.includes(role),
      canApprove: APPROVAL_ROLES.includes(role),
      canViewAllBranches: VIEW_ALL_ROLES.includes(role),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
