'use client'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/AppLayout'
import { getApprovalRequests, approveTransaction, rejectTransaction, approveReplenishmentRequest, rejectReplenishmentRequest } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import toast from 'react-hot-toast'
import { CheckCircle, XCircle, Clock, Ban, AlertTriangle, ExternalLink, Search, Filter } from 'lucide-react'

export default function ApprovalsPage() {
  const { canApprove } = useAuth()
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [rejectModal, setRejectModal] = useState<{ id: number; type: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [filterType, setFilterType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const fetchRequests = async () => {
    const params: any = { status: 'pending' }
    if (filterType) params.content_type = filterType
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    const res = await getApprovalRequests(params)
    setRequests(res.data.results || res.data)
  }

  useEffect(() => {
    if (canApprove) fetchRequests().finally(() => setLoading(false))
    else setLoading(false)
  }, [])

  useEffect(() => {
    if (canApprove) fetchRequests()
  }, [filterType, dateFrom, dateTo])

  const handleApprove = async (req: any) => {
    try {
      if (req.content_type === 'replenishment') {
        await approveReplenishmentRequest(req.object_id)
      } else {
        await approveTransaction(req.object_id)
      }
      toast.success(`${req.content_type_display} approved`)
      fetchRequests()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to approve')
    }
  }

  const handleReject = async () => {
    if (!rejectModal || !rejectReason.trim()) return toast.error('Reason required')
    try {
      if (rejectModal.type === 'replenishment') {
        await rejectReplenishmentRequest(rejectModal.id, rejectReason)
      } else {
        await rejectTransaction(rejectModal.id, rejectReason)
      }
      toast.success('Rejected')
      setRejectModal(null)
      setRejectReason('')
      fetchRequests()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to reject')
    }
  }

  if (!canApprove) {
    return (
      <AppLayout>
        <div className="text-center py-16">
          <Ban size={48} className="mx-auto text-navy-300 mb-4" />
          <h2 className="text-lg font-semibold text-navy-700">Access Restricted</h2>
          <p className="text-sm text-navy-400 mt-1">Only managers can approve requests.</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-navy-900">Pending Approvals</h1>
            <p className="text-xs sm:text-sm text-navy-400 mt-0.5">Review and approve pending requests</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <input type="date" className="input text-xs w-32 sm:w-36" title="From date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <input type="date" className="input text-xs w-32 sm:w-36" title="To date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            <Filter size={14} className="text-navy-400 shrink-0" />
            <select className="select text-sm w-full sm:w-40" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">All Types</option>
              <option value="expense">Expenses</option>
              <option value="void">Voids</option>
              <option value="replenishment">Replenishments</option>
            </select>
          </div>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="divide-y divide-navy-50">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="p-5 animate-pulse">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-navy-100" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-navy-100 rounded w-48" />
                      <div className="h-3 bg-navy-50 rounded w-72" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="py-16 text-center text-navy-400 flex flex-col items-center gap-2">
              <CheckCircle size={40} className="text-emerald-300" />
              <p className="font-medium text-navy-500">All caught up!</p>
              <p className="text-sm">No pending approvals</p>
            </div>
          ) : (
            <div className="divide-y divide-navy-50">
              {requests.map((req) => {
                const detail = req.related_detail
                const isExpanded = expandedId === req.id
                return (
                  <div key={req.id} className="hover:bg-navy-50/40 transition-colors">
                    <div className="p-4 sm:p-5">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`p-2.5 rounded-xl shrink-0 ${
                            req.content_type === 'expense' ? 'bg-blue-50 text-blue-600' :
                            req.content_type === 'void' ? 'bg-red-50 text-red-600' :
                            'bg-amber-50 text-amber-600'
                          }`}>
                            {req.content_type === 'expense' ? <AlertTriangle size={18} /> :
                             req.content_type === 'void' ? <Ban size={18} /> : <Clock size={18} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-navy-900">
                                {req.content_type_display} {detail ? `- PKR ${Number(detail.amount || detail.amount_requested).toLocaleString()}` : `#${req.object_id}`}
                              </p>
                              <span className={`badge ${
                                req.content_type === 'expense' ? 'badge-navy' :
                                req.content_type === 'void' ? 'badge-red' : 'badge-amber'
                              } text-[10px]`}>{req.content_type_display}</span>
                            </div>
                            <p className="text-xs text-navy-400 mt-1">
                              Requested by {req.requested_by_name} &middot; {new Date(req.requested_at).toLocaleString()}
                            </p>
                            {detail && (
                              <div className="mt-2 space-y-0.5">
                                <p className="text-sm text-navy-700">{detail.description || detail.reason}</p>
                                <div className="flex flex-wrap gap-2 text-xs text-navy-400">
                                  {detail.category_name && <span>Category: {detail.category_name}</span>}
                                  {detail.vendor_name && <span>Vendor: {detail.vendor_name}</span>}
                                  {detail.date && <span>Date: {detail.date}</span>}
                                  {detail.program_tag && <span>Program: {detail.program_tag}</span>}
                                </div>
                              </div>
                            )}
                            {req.reason && !detail?.reason && (
                              <p className="text-xs text-navy-500 mt-1.5 bg-navy-50 px-3 py-1.5 rounded-lg inline-block">
                                {req.reason}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-2 shrink-0 sm:ml-4">
                          <button
                            onClick={() => handleApprove(req)}
                            className="btn-primary flex items-center justify-center gap-1.5 text-xs px-3 py-2"
                          >
                            <CheckCircle size={14} /> Approve
                          </button>
                          <button
                            onClick={() => setRejectModal({ id: req.object_id, type: req.content_type })}
                            className="btn-danger flex items-center justify-center gap-1.5 text-xs px-3 py-2"
                          >
                            <XCircle size={14} /> Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {rejectModal && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-strong w-full max-w-sm p-6 animate-fade-in">
            <h2 className="font-semibold text-navy-900 mb-1">Reject Request</h2>
            <p className="text-sm text-navy-400 mb-4">Provide a reason for rejection</p>
            <textarea
              className="input resize-none mb-4"
              rows={3}
              placeholder="Reason..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-3">
              <button onClick={() => { setRejectModal(null); setRejectReason('') }} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleReject} className="btn-danger flex-1">Reject</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
