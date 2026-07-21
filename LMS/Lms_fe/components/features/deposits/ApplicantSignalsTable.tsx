import { 
    Users, Calendar, Mail, Smartphone, Clock, CheckCircle, 
    XCircle, ArrowRight, ChevronDown, ChevronUp, User, 
    MapPin, BookOpen, Briefcase, Info, FileText, Fingerprint,
    ShieldCheck, Clock3, Edit3, GraduationCap
} from 'lucide-react';
import { useState, memo, Fragment, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useSortableData } from '@/hooks/useSortableData';
import { SortableTableHeader } from '@/components/ui/SortableTableHeader';
import { EntranceLead } from '@/app/(dashboard)/admin/leads/page';

interface ApplicantSignalsTableProps {
    filteredLeads: EntranceLead[];
    getCourseName: (courseId: string | null) => string;
    prefillFromLead: (lead: EntranceLead) => void;
    onEditLead?: (lead: EntranceLead) => void;
}

export const ApplicantSignalsTable = memo(({
    filteredLeads,
    getCourseName,
    prefillFromLead,
    onEditLead
}: ApplicantSignalsTableProps) => {
    const [expandedLeads, setExpandedLeads] = useState<Record<string, boolean>>({});
    const { sortedData, sortConfig, requestSort } = useSortableData(filteredLeads);

    const toggleExpand = (id: string) => {
        setExpandedLeads(prev => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0">
                <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100">
                        <th className="w-10 px-2 py-4"></th>
                        <SortableTableHeader label="Date" sortKey="created_at" currentSort={sortConfig} onSort={requestSort} />
                        <SortableTableHeader label="Lead ID" sortKey="id" currentSort={sortConfig} onSort={requestSort} />
                        <SortableTableHeader label="Applicant" sortKey="name" currentSort={sortConfig} onSort={requestSort} />
                        <SortableTableHeader label="Course" sortKey="course_name_requested" currentSort={sortConfig} onSort={requestSort} />
                        <SortableTableHeader label="Compliance" sortKey="test_score" currentSort={sortConfig} onSort={requestSort} />
                        <SortableTableHeader label="Deposit" sortKey="has_paid_deposit" currentSort={sortConfig} onSort={requestSort} />
                        <SortableTableHeader label="Status" sortKey="status" currentSort={sortConfig} onSort={requestSort} />
                        <th className="px-4 py-4 text-[9px] font-black text-slate-600 uppercase tracking-widest text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/50">
                    {filteredLeads.length === 0 ? (
                        <tr>
                            <td colSpan={9} className="py-24 text-center">
                                <div className="flex flex-col items-center gap-4 text-slate-200">
                                    <div className="w-20 h-20 bg-slate-50 rounded-[32px] flex items-center justify-center text-slate-100">
                                       <Users size={48} strokeWidth={1} />
                                    </div>
                                    <div>
                                       <p className="text-xl font-black text-slate-900 tracking-tighter">No signals</p>
                                       <p className="text-slate-600 font-medium text-sm mt-1">No pending applicant signals detected.</p>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    ) : (
                        sortedData.map((lead) => (
                            <Fragment key={lead.id}>
                                <tr key={lead.id} className={cn(
                                "hover:bg-brand-teal/5 transition-colors group cursor-pointer border-b border-slate-50",
                                expandedLeads[lead.id] && "bg-brand-teal/5"
                            )} onClick={() => toggleExpand(lead.id)}>
                                    <td className="px-2 py-3">
                                        <div className="w-5 h-5 rounded bg-slate-50 flex items-center justify-center text-slate-600 group-hover:bg-white group-hover:shadow-sm transition-all mx-auto">
                                            {expandedLeads[lead.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                        </div>
                                    </td>
                                    <td className="px-3 py-3">
                                        <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-600 uppercase tracking-widest whitespace-nowrap">
                                            <Calendar size={10} className="text-brand-teal" />
                                            {new Date(lead.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                        </div>
                                    </td>
                                    <td className="px-3 py-3">
                                        <span className="font-mono text-[9px] font-bold text-brand-teal bg-brand-teal/5 px-1.5 py-0.5 rounded border border-brand-teal/10">
                                            #{lead.id?.slice(-6).toUpperCase() || 'N/A'}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3">
                                        <div className="flex flex-col max-w-[140px]">
                                            <span className="font-black text-slate-900 tracking-tight text-xs uppercase truncate leading-tight">{lead.name}</span>
                                            <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest truncate mt-0.5">
                                                {lead.email}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-3">
                                        <div className="max-w-[120px]">
                                            <Badge variant="outline" className="text-[8px] font-black text-brand-teal bg-brand-teal/5 border-none px-2 py-0.5 rounded uppercase tracking-widest shadow-sm truncate block text-center">
                                                {lead.course_name_requested || getCourseName(lead.course_id) || 'Undecided'}
                                            </Badge>
                                        </div>
                                    </td>
                                    <td className="px-3 py-3">
                                        {lead.test_score !== null ? (
                                            <div className={cn(
                                                "font-black text-[10px] tracking-tighter whitespace-nowrap",
                                                lead.test_score >= 70 ? "text-emerald-500" : "text-rose-500"
                                            )}>
                                                {lead.test_score}% COMPLIANCE
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1 text-[8px] font-black text-slate-300 uppercase tracking-widest border border-slate-50 px-1.5 py-0.5 rounded bg-slate-50/50 w-fit">
                                                <Clock size={8} />
                                                PENDING
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-3 py-3">
                                        {lead.has_paid_deposit ? (
                                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 text-[8px] font-black uppercase tracking-widest w-fit whitespace-nowrap">
                                                <CheckCircle size={8} />
                                                PAID
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-50 text-slate-600 border border-slate-100 text-[8px] font-black uppercase tracking-widest w-fit whitespace-nowrap">
                                                <Clock size={8} />
                                                PENDING
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-3 py-3">
                                        <div className={cn(
                                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border shadow-sm whitespace-nowrap",
                                            lead.status === 'passed' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                            lead.status === 'failed' ? "bg-rose-50 text-rose-600 border-rose-100" :
                                            "bg-white text-slate-600 border-slate-100"
                                        )}>
                                            {lead.status === 'passed' && <CheckCircle className="w-2 h-2" />}
                                            {lead.status === 'failed' && <XCircle className="w-2 h-2" />}
                                            {lead.status === 'pending' && <Clock className="w-2 h-2 animate-pulse" />}
                                            {lead.status}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-end gap-2">
                                            {onEditLead && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => onEditLead(lead)}
                                                    className="h-7 w-7 p-0 text-slate-600 hover:text-brand-teal bg-slate-50 hover:bg-brand-teal/10 rounded-lg transition-all shadow-sm"
                                                >
                                                    <Edit3 size={12} />
                                                </Button>
                                            )}
                                            <Button
                                                size="sm"
                                                onClick={() => prefillFromLead(lead)}
                                                className={cn("h-7 px-3 text-white rounded font-black uppercase tracking-widest transition-all shadow-md active:scale-95 group/btn flex items-center gap-1.5 text-[8px]",
                                                    lead.status === 'passed' ? "bg-brand-teal hover:bg-brand-dark shadow-brand-teal/20" : "bg-slate-400 hover:bg-slate-500 shadow-slate-400/20"
                                                )}
                                            >
                                                {lead.status === 'passed' ? 'Authorize' : 'Enroll'} <ArrowRight size={10} className="group-hover/btn:translate-x-0.5 transition-transform" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                                {expandedLeads[lead.id] && (
                                    <tr className="bg-slate-50/50">
                                        <td colSpan={9} className="px-8 py-6 border-b border-slate-100">
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 animate-in fade-in slide-in-from-top-1 duration-300">
                                                {/* Personal Info */}
                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center shadow-sm">
                                                            <User size={16} />
                                                        </div>
                                                        <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Personal</p>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-3">
                                                        <DetailItem icon={<Fingerprint size={10} />} label="CNIC / ID" value={lead.cnic_number} />
                                                        <DetailItem icon={<Calendar size={10} />} label="DOB" value={lead.date_of_birth} />
                                                        <DetailItem icon={<Clock3 size={10} />} label="Age" value={lead.age} />
                                                        <DetailItem icon={<Users size={10} />} label="Gender" value={lead.gender} isCapitalized />
                                                        <DetailItem icon={<Smartphone size={10} />} label="WhatsApp" value={lead.whatsapp_number} />
                                                    </div>
                                                </div>

                                                {/* Family & Status */}
                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center shadow-sm">
                                                            <Users size={16} />
                                                        </div>
                                                        <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Administrative</p>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-3">
                                                        <DetailItem label="Guardian" value={lead.father_guardian_name} />
                                                        <DetailItem label="G. Contact" value={lead.guardian_contact} />
                                                        <DetailItem label="Relationship" value={lead.relationship_to_student} isCapitalized />
                                                        <DetailItem icon={<Briefcase size={10} />} label="Occupation" value={lead.study_work_status} />
                                                        <DetailItem icon={<ShieldCheck size={10} />} label="Terms Agreed" value={lead.is_terms_agreed ? 'YES' : 'NO'} />
                                                        {lead.converted_to_student !== undefined && (
                                                            <DetailItem
                                                                icon={<GraduationCap size={10} />}
                                                                label="Conversion"
                                                                value={lead.converted_to_student
                                                                    ? `ENROLLED${lead.lms_user_id ? ' (LMS)' : ''}`
                                                                    : 'PENDING'}
                                                            />
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Education & Address */}
                                                <div className="md:col-span-2 space-y-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center shadow-sm">
                                                            <BookOpen size={16} />
                                                        </div>
                                                        <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Logistics & Pedagogy</p>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        <div className="space-y-3">
                                                            <DetailItem icon={<FileText size={10} />} label="Last Qualification" value={lead.last_qualification} />
                                                            <DetailItem icon={<Info size={10} />} label="Prev Student" value={lead.studied_at_idara ? 'Yes' : 'No'} />
                                                        </div>
                                                        <DetailItem icon={<MapPin size={10} />} label="Full Address" value={lead.full_address} />
                                                    </div>
                                                    <div className="pt-2">
                                                        <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1 flex items-center gap-2">
                                                            <FileText size={10} className="text-brand-teal" /> Signature
                                                        </p>
                                                        <div className="p-2 bg-white border border-slate-100 rounded-lg text-[9px] font-medium text-slate-600 truncate">
                                                            {lead.signature || 'No Signature'}
                                                        </div>
                                                    </div>
                                                </div>
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
                {value || <span className="text-slate-300 italic font-medium">Data Not Provided</span>}
            </p>
        </div>
    );
}
