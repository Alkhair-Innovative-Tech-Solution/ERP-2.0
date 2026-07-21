import { 
    Banknote, Mail, Activity, DollarSign, ShieldCheck, Edit, 
    RefreshCcw, Trash2, CheckCircle2, ArrowRightLeft, 
    ChevronDown, ChevronUp, Info
} from 'lucide-react';
import { useState, memo, Fragment } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ReceiptCode } from '@/app/(dashboard)/admin/deposits/page';

interface TransactionRegistryTableProps {
    filteredReceipts: ReceiptCode[];
    showArchived: boolean;
    getCourseName: (courseId: string | null) => string;
    handleOpenEdit: (receipt: ReceiptCode) => void;
    handleRestoreDeposit: (id: string) => void;
    handleDeleteDeposit: (id: string) => void;
    setShowReturnModal: (receipt: ReceiptCode) => void;
    onTransfer?: (receipt: ReceiptCode) => void;
    onVerify?: (receipt: ReceiptCode) => void;
}

export const TransactionRegistryTable = memo(({
    filteredReceipts,
    showArchived,
    getCourseName,
    handleOpenEdit,
    handleRestoreDeposit,
    handleDeleteDeposit,
    setShowReturnModal,
    onTransfer,
    onVerify
}: TransactionRegistryTableProps) => {
    const [expandedReceipts, setExpandedReceipts] = useState<Record<string, boolean>>({});

    const toggleExpand = (id: string) => {
        setExpandedReceipts(prev => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0">
                <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100">
                        <th className="w-10 px-2 py-4"></th>
                        <th className="px-2 py-4 text-[9px] font-black text-slate-600 uppercase tracking-widest">Scholar</th>
                        <th className="px-2 py-4 text-[9px] font-black text-slate-600 uppercase tracking-widest">Receipt</th>
                        <th className="px-2 py-4 text-[9px] font-black text-slate-600 uppercase tracking-widest">Program</th>
                        <th className="px-2 py-4 text-[9px] font-black text-slate-600 uppercase tracking-widest">Audit</th>
                        <th className="px-2 py-4 text-[9px] font-black text-slate-600 uppercase tracking-widest text-center">Status</th>
                        <th className="px-2 py-4 text-[9px] font-black text-slate-600 uppercase tracking-widest text-center">Sync</th>
                        <th className="px-4 py-4 text-[9px] font-black text-slate-600 uppercase tracking-widest text-right">Settlement</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/50">
                    {filteredReceipts.length === 0 ? (
                        <tr>
                            <td colSpan={8} className="py-24 text-center">
                                <div className="flex flex-col items-center gap-4 text-slate-200">
                                    <div className="w-20 h-20 bg-slate-50 rounded-[32px] flex items-center justify-center text-slate-100">
                                        <Banknote size={48} strokeWidth={1} />
                                    </div>
                                    <div>
                                        <p className="text-xl font-black text-slate-900 tracking-tighter">Treasury Records Clean</p>
                                        <p className="text-slate-600 font-medium text-sm mt-1">No transaction signatures detected for the current query.</p>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    ) : (
                        filteredReceipts.map((code) => (
                            <Fragment key={code.id}>
                                <tr className={cn(
                                    "hover:bg-brand-teal/5 transition-colors group cursor-pointer border-b border-slate-50",
                                    expandedReceipts[code.id] && "bg-brand-teal/5"
                                )} onClick={() => toggleExpand(code.id)}>
                                    <td className="px-2 py-3">
                                        <div className="w-5 h-5 rounded bg-slate-50 flex items-center justify-center text-slate-600 group-hover:bg-white group-hover:shadow-sm transition-all mx-auto">
                                            {expandedReceipts[code.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                        </div>
                                    </td>
                                    <td className="px-2 py-3">
                                        <div className="flex flex-col max-w-[130px]">
                                            <span className="font-black text-brand-teal bg-brand-teal/5 w-max px-1.5 py-0.5 rounded text-[8px] uppercase tracking-widest border border-brand-teal/10 mb-0.5">
                                                ID: {code.code?.slice(-6) || '...'}
                                            </span>
                                            <span className="font-black text-slate-900 tracking-tight text-xs uppercase truncate leading-tight">{code.student_name}</span>
                                            <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest truncate">
                                                {code.student_email}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-2 py-3">
                                        <div className="font-black text-slate-900 text-[9px] tracking-widest bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 uppercase whitespace-nowrap">
                                            {code.receipt_number?.slice(-8) || code.code?.slice(-8) || "REF-0000"}
                                        </div>
                                    </td>
                                    <td className="px-2 py-3">
                                        <div className="flex flex-col gap-0.5 max-w-[120px]">
                                            <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest border-l-2 border-brand-teal pl-1.5 truncate">
                                                {getCourseName(code.course_id)}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <Activity size={8} className="text-brand-teal" />
                                                <span className="text-[8px] font-bold text-slate-700 uppercase tracking-tighter">
                                                    Idx: {code.test_score === null ? <span className="text-slate-300 italic">N/A</span> : <span className={code.test_score >= 70 ? "text-emerald-500 font-black" : "text-rose-500 font-black"}>{code.test_score}%</span>}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-2 py-3">
                                        <div className="flex flex-col gap-0.5">
                                            <div className="font-black text-slate-900 text-[10px] tracking-tighter flex items-center gap-1">
                                                <DollarSign size={10} className={code.is_waived ? "text-emerald-500" : "text-brand-teal"} />
                                                {code.is_waived ? (
                                                    <span className="text-emerald-600 uppercase italic text-[8px]">Waiver</span>
                                                ) : (
                                                    `PKR ${code.deposit_amount?.toLocaleString() || 0}`
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {code.bag_taken && (
                                                    <span className={cn(
                                                        "text-[7px] font-black uppercase px-1 py-0.5 rounded",
                                                        code.bag_waived ? "bg-emerald-50 text-emerald-600" : 
                                                        code.bag_paid ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                                    )}>
                                                        G:{code.bag_waived ? "W" : code.bag_paid ? "P" : "D"}
                                                    </span>
                                                )}
                                                {code.id_card_taken && (
                                                    <span className={cn(
                                                        "text-[7px] font-black uppercase px-1 py-0.5 rounded",
                                                        code.id_card_waived ? "bg-emerald-50 text-emerald-600" : 
                                                        code.id_card_paid ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                                    )}>
                                                        ID:{code.id_card_waived ? "W" : code.id_card_paid ? "P" : "D"}
                                                    </span>
                                                )}
                                                {code.certificate_taken && (
                                                    <span className={cn(
                                                        "text-[7px] font-black uppercase px-1 py-0.5 rounded",
                                                        code.certificate_waived ? "bg-emerald-50 text-emerald-600" : 
                                                        code.certificate_paid ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                                    )}>
                                                        CT:{code.certificate_waived ? "W" : code.certificate_paid ? "P" : "D"}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1.5">
                                            <div className={cn(
                                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest w-fit group/verify relative",
                                                code.verified ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-500"
                                            )}>
                                                {code.verified ? 'Verified' : 'Pending'}
                                                {!code.verified && onVerify && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); onVerify(code); }}
                                                        className="absolute inset-0 opacity-0 group-hover/verify:opacity-100 bg-orange-500 text-white rounded-lg flex items-center justify-center transition-all duration-300 font-black text-[8px]"
                                                    >
                                                        Confirm
                                                    </button>
                                                )}
                                            </div>
                                            <div className={cn(
                                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest w-fit border border-slate-50",
                                                code.lms_account_created ? "text-brand-teal bg-brand-teal/5" : "text-slate-300 bg-slate-50"
                                            )}>
                                                {code.lms_account_created ? 'LMS_ACT' : 'NO_ACC'}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[9px] font-black text-slate-300 uppercase italic">Direct</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                         <div className="flex items-center justify-end gap-1.5">
                                            {onTransfer && (
                                                <Button 
                                                    onClick={() => onTransfer(code)} 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="w-8 h-8 p-0 rounded-lg hover:bg-amber-50 text-slate-300 hover:text-amber-600"
                                                >
                                                    <ArrowRightLeft size={12} />
                                                </Button>
                                            )}
                                            <Button onClick={() => handleOpenEdit(code)} variant="ghost" size="sm" className="w-8 h-8 p-0 rounded-lg hover:bg-brand-teal/10 text-slate-300 hover:text-brand-teal">
                                                <Edit size={12} />
                                            </Button>
                                            {showArchived ? (
                                                <Button onClick={() => handleRestoreDeposit(code.id)} variant="ghost" size="sm" className="w-8 h-8 p-0 rounded-lg hover:bg-emerald-50 text-slate-300 hover:text-emerald-600">
                                                    <RefreshCcw size={12} />
                                                </Button>
                                            ) : (
                                                <Button onClick={() => handleDeleteDeposit(code.id)} variant="ghost" size="sm" className="w-8 h-8 p-0 rounded-lg hover:bg-rose-50 text-slate-300 hover:text-rose-600">
                                                    <Trash2 size={12} />
                                                </Button>
                                            )}
                                            {!code.is_returned && (
                                                <Button 
                                                    onClick={() => setShowReturnModal(code)} 
                                                    className="h-8 px-3 rounded-lg bg-slate-900 hover:bg-brand-teal text-white text-[8px] font-black uppercase tracking-widest transition-all"
                                                >
                                                    Return
                                                </Button>
                                            )}
                                         </div>
                                    </td>
                                </tr>
                                {expandedReceipts[code.id] && (
                                    <tr className="bg-slate-50/50">
                                        <td colSpan={8} className="px-8 py-6 border-b border-slate-100">
                                            <div className="flex flex-col items-center py-4 text-slate-300">
                                                <Info size={24} className="mb-1" />
                                                <p className="text-[9px] font-black uppercase tracking-widest">No Linked Profile</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
});

function DetailItem({ icon, label, value, isCapitalized }: { icon?: React.ReactNode, label: string, value?: string | number | null, isCapitalized?: boolean }) {
    return (
        <div>
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1 flex items-center gap-2">
                {icon} {label}
            </p>
            <p className={cn(
                "text-[11px] font-black text-slate-700 tracking-tight leading-relaxed",
                isCapitalized && "capitalize"
            )}>
                {value || <span className="text-slate-300 italic font-medium">Undefined</span>}
            </p>
        </div>
    );
}

