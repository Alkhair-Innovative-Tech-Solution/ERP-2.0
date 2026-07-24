"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Image from "next/image"
import { Printer, ArrowLeft } from "lucide-react"
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
    status: string
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
    return typeof window !== 'undefined' ? localStorage.getItem('sis_access_token') || '' : ''
}

function fmt(date: string | null) {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })
}

function pkr(amount: string) {
    return `PKR ${parseFloat(amount).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`
}

// ── Invoice Page ──────────────────────────────────────────────────────────────

export default function InvoicePrintPage() {
    const params = useParams()
    const router = useRouter()
    const [invoice, setInvoice] = useState<Invoice | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch(`${API}/api/invoices/${params.id}/`, {
                    headers: { Authorization: `Bearer ${token()}` }
                })
                if (!res.ok) throw new Error('Invoice not found')
                setInvoice(await res.json())
            } catch (e: any) {
                setError(e.message)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [params.id])

    if (loading) return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
        </div>
    )

    if (error || !invoice) return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center text-gray-500 text-sm">
            {error || 'Invoice not found'}
        </div>
    )

    const isPaid    = invoice.status === 'paid'
    const isPending = ['pending', 'receipt_uploaded'].includes(invoice.status)
    const isOverdue = invoice.status === 'overdue'

    // Break amount into line items
    const baseAmount  = parseFloat(invoice.amount)

    return (
        <>
            {/* Controls — hidden on print */}
            <div className="print:hidden bg-gray-100 px-8 py-4 flex items-center gap-3 border-b border-gray-200">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </button>
                <div className="flex-1" />
                <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
                >
                    <Printer className="w-4 h-4" />
                    Print / Save PDF
                </button>
            </div>

            {/* Invoice document */}
            <div className="bg-gray-100 min-h-screen py-10 print:py-0 print:bg-white">
                <div
                    className="bg-white mx-auto shadow-sm print:shadow-none"
                    style={{ width: '794px', minHeight: '1123px', padding: '64px 72px', fontFamily: 'Georgia, "Times New Roman", serif' }}
                >
                    {/* ── Header ─────────────────────────────────────────── */}
                    <div className="flex items-start justify-between mb-10">
                        <div>
                            <h1 className="text-4xl font-bold text-gray-900 tracking-tight" style={{ fontFamily: 'Arial, sans-serif' }}>
                                {isPaid ? 'Receipt' : 'Invoice'}
                            </h1>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <Image src="/IAK_LOGO.png" alt="IAK Logo" width={56} height={56} className="object-contain" />
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">IAK NGO</span>
                        </div>
                    </div>

                    {/* ── Invoice meta ───────────────────────────────────── */}
                    <div className="mb-8" style={{ fontFamily: 'Arial, sans-serif' }}>
                        <table className="text-sm text-gray-700">
                            <tbody>
                                <tr>
                                    <td className="pr-6 py-0.5 text-gray-500">Invoice number</td>
                                    <td className="font-semibold">{invoice.invoice_number}</td>
                                </tr>
                                <tr>
                                    <td className="pr-6 py-0.5 text-gray-500">Invoice type</td>
                                    <td className="font-semibold capitalize">{invoice.invoice_type}</td>
                                </tr>
                                <tr>
                                    <td className="pr-6 py-0.5 text-gray-500">Issue date</td>
                                    <td className="font-semibold">{fmt(invoice.created_at)}</td>
                                </tr>
                                <tr>
                                    <td className="pr-6 py-0.5 text-gray-500">Due date</td>
                                    <td className="font-semibold">{fmt(invoice.due_date)}</td>
                                </tr>
                                {isPaid && invoice.approved_at && (
                                    <tr>
                                        <td className="pr-6 py-0.5 text-gray-500">Date paid</td>
                                        <td className="font-semibold">{fmt(invoice.approved_at)}</td>
                                    </tr>
                                )}
                                <tr>
                                    <td className="pr-6 py-0.5 text-gray-500">Status</td>
                                    <td>
                                        <span className={`font-bold text-xs uppercase tracking-wide px-2 py-0.5 rounded ${
                                            isPaid ? 'bg-green-100 text-green-700' :
                                            isOverdue ? 'bg-red-100 text-red-700' :
                                            'bg-amber-100 text-amber-700'
                                        }`}>
                                            {invoice.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* ── Addresses ──────────────────────────────────────── */}
                    <div className="grid grid-cols-2 gap-8 mb-10" style={{ fontFamily: 'Arial, sans-serif' }}>
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">From</p>
                            <p className="font-bold text-gray-900 text-sm">IAK NGO</p>
                            <p className="text-sm text-gray-600">Alkhair Innovative Tech Solutions</p>
                            <p className="text-sm text-gray-600">A 01, Block B, Alamgir Society</p>
                            <p className="text-sm text-gray-600">Model Colony, Karachi-75080</p>
                            <p className="text-sm text-gray-600">Pakistan</p>
                            <p className="text-sm text-gray-600 mt-1">billing@iak.ngo</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Bill To</p>
                            <p className="font-bold text-gray-900 text-sm">{invoice.organization_name}</p>
                            {invoice.plan_name && (
                                <p className="text-sm text-gray-600">Plan: {invoice.plan_name}</p>
                            )}
                        </div>
                    </div>

                    {/* ── Amount headline ────────────────────────────────── */}
                    <div className="mb-8 pb-6 border-b border-gray-200">
                        <p className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Arial, sans-serif' }}>
                            {pkr(invoice.amount)}
                            {isPaid && invoice.approved_at
                                ? ` paid on ${fmt(invoice.approved_at)}`
                                : isPending
                                ? ' due'
                                : isOverdue
                                ? ' overdue'
                                : ''}
                        </p>
                        {isPending && (
                            <div className="mt-3 text-sm text-gray-500" style={{ fontFamily: 'Arial, sans-serif' }}>
                                <p>Please transfer the amount to our bank account and upload the payment receipt.</p>
                                <p className="mt-2 font-semibold text-gray-700">Payment Details:</p>
                                <p>Bank: Meezan Bank</p>
                                <p>Account Title: IAK NGO</p>
                                <p>IBAN: PK00 MEZN 0000 0000 0000 0000</p>
                            </div>
                        )}
                    </div>

                    {/* ── Line items table ───────────────────────────────── */}
                    <div className="mb-8" style={{ fontFamily: 'Arial, sans-serif' }}>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200">
                                    <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                                    <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-16">Qty</th>
                                    <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Unit Price</th>
                                    <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-gray-100">
                                    <td className="py-3 text-gray-800">
                                        <p className="font-medium">{invoice.plan_name || 'Subscription'} Plan</p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {fmt(invoice.billing_period_start)} – {fmt(invoice.billing_period_end)}
                                        </p>
                                    </td>
                                    <td className="py-3 text-right text-gray-700">1</td>
                                    <td className="py-3 text-right text-gray-700">{pkr(invoice.amount)}</td>
                                    <td className="py-3 text-right text-gray-700">{pkr(invoice.amount)}</td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Totals */}
                        <div className="mt-4 ml-auto" style={{ width: '280px' }}>
                            <div className="flex justify-between py-1.5 text-sm text-gray-600">
                                <span>Subtotal</span>
                                <span>{pkr(invoice.amount)}</span>
                            </div>
                            <div className="flex justify-between py-1.5 text-sm text-gray-600">
                                <span>Tax (0%)</span>
                                <span>PKR 0.00</span>
                            </div>
                            <div className="flex justify-between py-2 text-sm font-bold text-gray-900 border-t border-gray-200 mt-1">
                                <span>Total</span>
                                <span>{pkr(invoice.amount)}</span>
                            </div>
                            {isPaid && (
                                <div className="flex justify-between py-2 text-sm font-bold text-gray-900 border-t border-gray-200">
                                    <span>Amount paid</span>
                                    <span>{pkr(invoice.amount)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Payment history (paid invoices only) ───────────── */}
                    {isPaid && invoice.approved_at && (
                        <div className="mt-10" style={{ fontFamily: 'Arial, sans-serif' }}>
                            <h2 className="text-lg font-bold text-gray-900 mb-4">Payment History</h2>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200">
                                        <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Verified by</th>
                                        <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                                        <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount Paid</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="py-3 text-gray-700">{invoice.approved_by_name || 'Admin'}</td>
                                        <td className="py-3 text-gray-700">{fmt(invoice.approved_at)}</td>
                                        <td className="py-3 text-right font-semibold text-gray-900">{pkr(invoice.amount)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* ── Notes ──────────────────────────────────────────── */}
                    {invoice.notes && (
                        <div className="mt-8 pt-6 border-t border-gray-100" style={{ fontFamily: 'Arial, sans-serif' }}>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                            <p className="text-sm text-gray-600">{invoice.notes}</p>
                        </div>
                    )}

                    {/* ── Footer ─────────────────────────────────────────── */}
                    <div className="mt-16 pt-4 border-t border-gray-100 flex justify-between items-end">
                        <p className="text-xs text-gray-400" style={{ fontFamily: 'Arial, sans-serif' }}>
                            IAK NGO · Karachi, Pakistan · billing@iak.ngo
                        </p>
                        <p className="text-xs text-gray-400" style={{ fontFamily: 'Arial, sans-serif' }}>
                            Page 1 of 1
                        </p>
                    </div>
                </div>
            </div>

            {/* Print styles */}
            <style jsx global>{`
                @media print {
                    @page { margin: 0; size: A4; }
                    body { margin: 0; }
                    .print\\:hidden { display: none !important; }
                }
            `}</style>
        </>
    )
}
