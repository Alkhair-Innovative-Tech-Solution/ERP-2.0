"use client"

import { useState, useEffect, useRef } from "react"
import {
    Receipt, CheckCircle2, AlertTriangle, Clock, Upload,
    XCircle, ChevronDown, ChevronUp, Building2, FileText,
    RefreshCw, Eye, X, ExternalLink
} from "lucide-react"
import { getCurrentUserRole } from "@/lib/permissions"
import { useRouter } from "next/navigation"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Invoice {
    id: number
    invoice_number: string
    invoice_type: 'initial' | 'recurring'
    organization: number
    organization_name: string
    plan_name: string | null
    amount: string
    status: 'pending' | 'receipt_uploaded' | 'paid' | 'rejected' | 'overdue'
    status_display: string
    due_date: string
    billing_period_start: string
    billing_period_end: string
    receipt: string | null
    receipt_uploaded_at: string | null
    approved_by_name: string | null
    approved_at: string | null
    rejection_note: string
    notes: string
    created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_BASE_URL

function token() {
    return localStorage.getItem('sis_access_token') || ''
}

function fmt(date: string | null) {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })
}

function pkr(amount: string) {
    return `PKR ${parseFloat(amount).toLocaleString('en-PK', { minimumFractionDigits: 0 })}`
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: any; label: string }> = {
    pending:          { color: '#f59e0b', bg: '#fffbeb', icon: Clock,         label: 'Pending' },
    receipt_uploaded: { color: '#6366f1', bg: '#eef2ff', icon: Eye,           label: 'Under Review' },
    paid:             { color: '#10b981', bg: '#ecfdf5', icon: CheckCircle2,  label: 'Paid' },
    rejected:         { color: '#ef4444', bg: '#fef2f2', icon: XCircle,       label: 'Rejected' },
    overdue:          { color: '#ef4444', bg: '#fef2f2', icon: AlertTriangle, label: 'Overdue' },
}

// ── Invoice Card ──────────────────────────────────────────────────────────────

function InvoiceCard({
    invoice,
    role,
    onUpload,
    onApprove,
    onReject,
}: {
    invoice: Invoice
    role: string
    onUpload: (id: number, file: File) => Promise<void>
    onApprove: (id: number) => Promise<void>
    onReject: (id: number, note: string) => Promise<void>
}) {
    const router = useRouter()
    const [expanded, setExpanded] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [approving, setApproving] = useState(false)
    const [rejecting, setRejecting] = useState(false)
    const [showRejectForm, setShowRejectForm] = useState(false)
    const [rejectNote, setRejectNote] = useState('')
    const fileRef = useRef<HTMLInputElement>(null)

    const cfg = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.pending
    const Icon = cfg.icon

    const canUpload = role === 'org_admin' && ['pending', 'rejected', 'overdue'].includes(invoice.status)
    const canApproveReject = ['superadmin', 'admin'].includes(role) && invoice.status === 'receipt_uploaded'

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        try {
            await onUpload(invoice.id, file)
        } finally {
            setUploading(false)
            if (fileRef.current) fileRef.current.value = ''
        }
    }

    async function handleApprove() {
        setApproving(true)
        try { await onApprove(invoice.id) }
        finally { setApproving(false) }
    }

    async function handleReject() {
        setRejecting(true)
        try {
            await onReject(invoice.id, rejectNote)
            setShowRejectForm(false)
            setRejectNote('')
        } finally { setRejecting(false) }
    }

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(e => !e)}
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl" style={{ background: cfg.bg }}>
                        <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <p className="text-[12px] font-black text-slate-800 uppercase tracking-wide">{invoice.invoice_number}</p>
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>
                                {cfg.label}
                            </span>
                            {invoice.invoice_type === 'recurring' && (
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Recurring</span>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold">
                            {invoice.organization_name} · Due {fmt(invoice.due_date)}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <p className="text-[14px] font-black text-slate-800">{pkr(invoice.amount)}</p>
                    {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
            </div>

            {/* Expanded detail */}
            {expanded && (
                <div className="px-5 pb-5 border-t border-gray-50">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Plan</p>
                            <p className="text-[11px] font-bold text-slate-700">{invoice.plan_name || '—'}</p>
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Period</p>
                            <p className="text-[11px] font-bold text-slate-700">{fmt(invoice.billing_period_start)} – {fmt(invoice.billing_period_end)}</p>
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Created</p>
                            <p className="text-[11px] font-bold text-slate-700">{fmt(invoice.created_at)}</p>
                        </div>
                        {invoice.approved_by_name && (
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Approved By</p>
                                <p className="text-[11px] font-bold text-slate-700">{invoice.approved_by_name} · {fmt(invoice.approved_at)}</p>
                            </div>
                        )}
                    </div>

                    {invoice.rejection_note && (
                        <div className="mt-3 p-3 bg-rose-50 border border-rose-100 rounded-xl">
                            <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-0.5">Rejection Reason</p>
                            <p className="text-[11px] text-rose-600">{invoice.rejection_note}</p>
                        </div>
                    )}

                    {invoice.receipt && (
                        <div className="mt-3 flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 text-indigo-400" />
                            <a
                                href={invoice.receipt}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] font-bold text-indigo-500 hover:text-indigo-700 underline underline-offset-2"
                            >
                                View Receipt · Uploaded {fmt(invoice.receipt_uploaded_at)}
                            </a>
                        </div>
                    )}

                    {/* View Invoice button */}
                    <div className="mt-4">
                        <button
                            onClick={() => router.push(`/admin/billing/invoice/${invoice.id}`)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-slate-600 text-[11px] font-black uppercase tracking-widest hover:bg-gray-50 transition-colors"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            View / Print Invoice
                        </button>
                    </div>

                    {/* Org admin upload */}
                    {canUpload && (
                        <div className="mt-4">
                            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFileChange} />
                            <button
                                onClick={() => fileRef.current?.click()}
                                disabled={uploading}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                            >
                                <Upload className="w-3.5 h-3.5" />
                                {uploading ? 'Uploading…' : 'Upload Payment Receipt'}
                            </button>
                            <p className="text-[9px] text-slate-400 mt-1.5">PDF, JPG, or PNG — max 10MB</p>
                        </div>
                    )}

                    {/* Admin approve / reject */}
                    {canApproveReject && !showRejectForm && (
                        <div className="mt-4 flex items-center gap-2">
                            <button
                                onClick={handleApprove}
                                disabled={approving}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                            >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {approving ? 'Approving…' : 'Approve Payment'}
                            </button>
                            <button
                                onClick={() => setShowRejectForm(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-[11px] font-black uppercase tracking-widest hover:bg-rose-100 transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                                Reject
                            </button>
                        </div>
                    )}

                    {canApproveReject && showRejectForm && (
                        <div className="mt-4 space-y-2">
                            <textarea
                                value={rejectNote}
                                onChange={e => setRejectNote(e.target.value)}
                                placeholder="Rejection reason (shown to org admin)…"
                                className="w-full p-3 rounded-xl border border-gray-200 text-[11px] text-slate-700 resize-none focus:outline-none focus:border-indigo-300"
                                rows={2}
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleReject}
                                    disabled={rejecting || !rejectNote.trim()}
                                    className="px-4 py-2 rounded-xl bg-rose-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-rose-700 disabled:opacity-50 transition-colors"
                                >
                                    {rejecting ? 'Rejecting…' : 'Confirm Reject'}
                                </button>
                                <button
                                    onClick={() => { setShowRejectForm(false); setRejectNote('') }}
                                    className="px-4 py-2 rounded-xl border border-gray-200 text-slate-600 text-[11px] font-black uppercase tracking-widest hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BillingPage() {
    const role = getCurrentUserRole()
    const [invoices, setInvoices] = useState<Invoice[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [filter, setFilter] = useState<string>('all')

    async function load() {
        setLoading(true)
        setError('')
        try {
            const res = await fetch(`${API}/api/invoices/`, {
                headers: { Authorization: `Bearer ${token()}` }
            })
            if (!res.ok) throw new Error('Failed to load invoices')
            const data = await res.json()
            setInvoices(Array.isArray(data) ? data : (data.results || []))
        } catch (e: any) {
            setError(e.message || 'Could not load invoices')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [])

    async function handleUpload(id: number, file: File) {
        const form = new FormData()
        form.append('receipt', file)
        const res = await fetch(`${API}/api/invoices/${id}/upload-receipt/`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token()}` },
            body: form,
        })
        if (!res.ok) {
            const d = await res.json()
            throw new Error(d.error || 'Upload failed')
        }
        await load()
    }

    async function handleApprove(id: number) {
        const res = await fetch(`${API}/api/invoices/${id}/approve/`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        })
        if (!res.ok) {
            const d = await res.json()
            throw new Error(d.error || 'Approval failed')
        }
        await load()
    }

    async function handleReject(id: number, note: string) {
        const res = await fetch(`${API}/api/invoices/${id}/reject/`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ rejection_note: note }),
        })
        if (!res.ok) {
            const d = await res.json()
            throw new Error(d.error || 'Rejection failed')
        }
        await load()
    }

    const FILTERS = [
        { key: 'all',             label: 'All' },
        { key: 'pending',         label: 'Pending' },
        { key: 'receipt_uploaded',label: 'Under Review' },
        { key: 'paid',            label: 'Paid' },
        { key: 'rejected',        label: 'Rejected' },
        { key: 'overdue',         label: 'Overdue' },
    ]

    const filtered = filter === 'all' ? invoices : invoices.filter(i => i.status === filter)

    const counts = {
        pending: invoices.filter(i => i.status === 'pending').length,
        receipt_uploaded: invoices.filter(i => i.status === 'receipt_uploaded').length,
        overdue: invoices.filter(i => i.status === 'overdue').length,
        paid: invoices.filter(i => i.status === 'paid').length,
    }

    if (loading) {
        return (
            <div className="p-6 space-y-4 animate-pulse">
                <div className="h-9 w-64 bg-gray-200 rounded-xl" />
                <div className="grid grid-cols-4 gap-4">
                    {[0,1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl" />)}
                </div>
                {[0,1,2].map(i => <div key={i} className="h-20 bg-gray-50 rounded-2xl" />)}
            </div>
        )
    }

    return (
        <div className="p-6 space-y-5 bg-gray-50 min-h-screen">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Billing & Invoices</h1>
                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                        {role === 'org_admin' ? 'Subscription invoices for your organization' : 'Manage subscription invoices across all organizations'}
                    </p>
                </div>
                <button onClick={load} className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-white transition-colors">
                    <RefreshCw className="w-3 h-3" />
                    Refresh
                </button>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Pending',      count: counts.pending,          color: '#f59e0b', bg: '#fffbeb', icon: Clock },
                    { label: 'Under Review', count: counts.receipt_uploaded,  color: '#6366f1', bg: '#eef2ff', icon: Eye },
                    { label: 'Overdue',      count: counts.overdue,           color: '#ef4444', bg: '#fef2f2', icon: AlertTriangle },
                    { label: 'Paid',         count: counts.paid,              color: '#10b981', bg: '#ecfdf5', icon: CheckCircle2 },
                ].map(({ label, count, color, bg, icon: Icon }) => (
                    <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-3">
                        <div className="p-2.5 rounded-xl" style={{ background: bg }}>
                            <Icon className="w-4 h-4" style={{ color }} />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                            <p className="text-xl font-black" style={{ color }}>{count}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1.5 flex-wrap">
                {FILTERS.map(f => (
                    <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${
                            filter === f.key
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white border border-gray-200 text-slate-500 hover:bg-gray-50'
                        }`}
                    >
                        {f.label}
                        {f.key !== 'all' && invoices.filter(i => i.status === f.key).length > 0 && (
                            <span className="ml-1 opacity-70">({invoices.filter(i => i.status === f.key).length})</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Error */}
            {error && (
                <div className="bg-rose-50 border border-rose-100 rounded-xl px-4 py-3 text-[11px] text-rose-600 font-bold">
                    {error}
                </div>
            )}

            {/* Invoice list */}
            {filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-16 text-slate-300">
                    <Receipt className="w-12 h-12 mb-3 opacity-30" />
                    <p className="text-[12px] font-black uppercase tracking-widest">No invoices found</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(inv => (
                        <InvoiceCard
                            key={inv.id}
                            invoice={inv}
                            role={role}
                            onUpload={handleUpload}
                            onApprove={handleApprove}
                            onReject={handleReject}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
