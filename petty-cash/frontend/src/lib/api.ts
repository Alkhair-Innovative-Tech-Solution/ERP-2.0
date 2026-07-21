import axios from 'axios'
import Cookies from 'js-cookie'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = Cookies.get('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = Cookies.get('refresh_token')
      if (refresh) {
        try {
          const res = await axios.post(`${API_URL}/auth/refresh/`, { refresh })
          Cookies.set('access_token', res.data.access, { expires: 1 })
          original.headers.Authorization = `Bearer ${res.data.access}`
          return api(original)
        } catch {
          Cookies.remove('access_token')
          Cookies.remove('refresh_token')
          window.location.href = '/login'
        }
      } else {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// Auth
export const login = (username: string, password: string) =>
  api.post('/auth/login/', { username, password })

// Dashboard
export const getDashboard = () => api.get('/dashboard/')

// Branches
export const getBranches = () => api.get('/branches/')
export const getBranch = (id: number) => api.get(`/branches/${id}/`)
export const createBranch = (data: object) => api.post('/branches/', data)
export const updateBranch = (id: number, data: object) => api.patch(`/branches/${id}/`, data)

// Transactions
export const getTransactions = (params?: Record<string, string | number>) =>
  api.get('/transactions/', { params })
export const getTransaction = (id: number) => api.get(`/transactions/${id}/`)
export const createTransaction = (data: FormData) =>
  api.post('/transactions/', data, { headers: { 'Content-Type': 'multipart/form-data' } })
export const voidTransaction = (id: number, reason: string) =>
  api.post(`/transactions/${id}/void/`, { reason })
export const approveTransaction = (id: number) =>
  api.post(`/transactions/${id}/approve/`)
export const rejectTransaction = (id: number, reason: string) =>
  api.post(`/transactions/${id}/reject/`, { reason })
export const amendTransaction = (id: number, data: object) =>
  api.post(`/transactions/${id}/amend/`, data)

// Categories
export const getCategories = () => api.get('/categories/')
export const createCategory = (data: object) => api.post('/categories/', data)
export const updateCategory = (id: number, data: object) => api.patch(`/categories/${id}/`, data)

// Budget
export const getBudgets = () => api.get('/budgets/')
export const getCurrentBudget = () => api.get('/budgets/current/')
export const createBudget = (data: object) => api.post('/budgets/', data)
export const updateBudget = (id: number, data: object) => api.patch(`/budgets/${id}/`, data)

// Fund Types
export const getFundTypes = () => api.get('/fund-types/')
export const createFundType = (data: object) => api.post('/fund-types/', data)
export const updateFundType = (id: number, data: object) => api.patch(`/fund-types/${id}/`, data)

// Cash Fund
export const getCashFund = (params?: Record<string, string | number>) =>
  api.get('/cash-fund/', { params })
export const getAllCashFunds = () => api.get('/cash-fund/all/')
export const updateCashFund = (data: object) => api.patch('/cash-fund/', data)
export const updateCashFundById = (id: number, data: object) => api.patch(`/cash-fund/?id=${id}`, data)

// Replenishments
export const getReplenishments = (params?: Record<string, string>) =>
  api.get('/replenishments/', { params })
export const createReplenishment = (data: object) => api.post('/replenishments/', data)

// Replenishment Requests
export const getReplenishmentRequests = (params?: Record<string, string>) =>
  api.get('/replenishment-requests/', { params })
export const createReplenishmentRequest = (data: object) =>
  api.post('/replenishment-requests/', data)
export const approveReplenishmentRequest = (id: number) =>
  api.post(`/replenishment-requests/${id}/approve/`)
export const rejectReplenishmentRequest = (id: number, reason: string) =>
  api.post(`/replenishment-requests/${id}/reject/`, { reason })

// Approval Requests
export const getApprovalRequests = (params?: Record<string, string>) =>
  api.get('/approval-requests/', { params })

// Fund Transfers
export const getFundTransfers = () => api.get('/fund-transfers/')
export const createFundTransfer = (data: object) => api.post('/fund-transfers/', data)
export const executeFundTransfer = (id: number) =>
  api.post(`/fund-transfers/${id}/execute/`)

// Notifications
export const getNotifications = () => api.get('/notifications/')
export const markNotificationRead = (id: number) =>
  api.post(`/notifications/${id}/mark_read/`)
export const markAllNotificationsRead = () =>
  api.post('/notifications/mark_all_read/')

// System Settings
export const getSettings = () => api.get('/settings/')
export const updateSetting = (id: number, data: object) =>
  api.patch(`/settings/${id}/`, data)

// Report Templates
export const getReportTemplates = () => api.get('/report-templates/')
export const createReportTemplate = (data: object) =>
  api.post('/report-templates/', data)
export const updateReportTemplate = (id: number, data: object) =>
  api.patch(`/report-templates/${id}/`, data)
export const deleteReportTemplate = (id: number) =>
  api.delete(`/report-templates/${id}/`)
export const generateReport = (data: object) =>
  api.post('/reports/generate/', data)

// Exports
export const exportCashbook = (year?: number, month?: number) => {
  const params = new URLSearchParams()
  if (year) params.set('year', String(year))
  if (month) params.set('month', String(month))
  const token = Cookies.get('access_token')
  return fetch(`${API_URL}/export/cashbook/?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}
export const exportTransactions = (year?: number, month?: number) => {
  const params = new URLSearchParams()
  if (year) params.set('year', String(year))
  if (month) params.set('month', String(month))
  const token = Cookies.get('access_token')
  return fetch(`${API_URL}/export/transactions/?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}
export const exportReplenishments = (year?: number, month?: number) => {
  const params = new URLSearchParams()
  if (year) params.set('year', String(year))
  if (month) params.set('month', String(month))
  const token = Cookies.get('access_token')
  return fetch(`${API_URL}/export/replenishments/?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

// Audit Logs
export const getAuditLogs = (params?: Record<string, string>) =>
  api.get('/audit-logs/', { params })

// Users
export const getUsers = () => api.get('/users/')
export const getUser = (id: number) => api.get(`/users/${id}/`)
export const updateUser = (id: number, data: object) => api.patch(`/users/${id}/`, data)
export const getMe = () => api.get('/me/')

export default api
