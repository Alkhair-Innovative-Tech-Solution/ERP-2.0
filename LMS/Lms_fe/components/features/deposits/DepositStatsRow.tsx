import { Banknote, Clock, ShieldCheck, TrendingUp, TrendingDown, DollarSign, Users, RotateCcw, HeartHandshake } from 'lucide-react';
import { cn } from '@/lib/utils';
import { memo } from 'react';

interface DepositStatsRowProps {
    totalReceipts: number;
    awaitingRefunds: number;
    qualifiedLeads?: number;
    totalCollection?: number;
    totalRefunded?: number;
    netRevenue?: number;
    activeDeposits?: number;
    totalReturned?: number;
    waivedDeposits?: number;
}

function formatPKR(amount: number): string {
    return `PKR ${amount.toLocaleString()}`;
}

export const DepositStatsRow = memo(({ 
    totalReceipts, 
    awaitingRefunds, 
    qualifiedLeads,
    totalCollection,
    totalRefunded,
    netRevenue,
    activeDeposits,
    totalReturned,
    waivedDeposits
}: DepositStatsRowProps) => {
    const hasFinancials = totalCollection !== undefined;

    const stats = [
        { label: 'Total Receipts & Deposits', value: totalReceipts, icon: Banknote, color: 'blue' },
        { label: 'Awaiting Refund Settlement', value: awaitingRefunds, icon: Clock, color: 'orange' },
    ];
    if (qualifiedLeads !== undefined) {
        stats.push({ label: 'Qualified Entrance Leads', value: qualifiedLeads, icon: ShieldCheck, color: 'teal' });
    }

    const financialCards = hasFinancials ? [
        { label: 'Total Collection', value: formatPKR(totalCollection!), icon: DollarSign, color: 'emerald', subtitle: 'Gross deposit receipts' },
        { label: 'Total Refunded', value: formatPKR(totalRefunded!), icon: TrendingDown, color: 'rose', subtitle: 'Amount returned to students' },
        { label: 'Net Revenue', value: formatPKR(netRevenue!), icon: TrendingUp, color: 'blue', subtitle: 'Net after refunds' },
        { label: 'Active Deposits', value: activeDeposits!, icon: Users, color: 'teal', subtitle: `${totalReturned!} returned total` },
        ...(waivedDeposits !== undefined ? [{ label: 'Waived Students', value: waivedDeposits, icon: HeartHandshake, color: 'emerald', subtitle: 'Full deposit waivers granted' }] : []),
    ] : [];

    return (
        <div className="space-y-6">
            <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-6", qualifiedLeads !== undefined && "lg:grid-cols-3")}>
                {stats.map((stat, i) => (
                    <div key={i} className="premium-card p-6 flex items-center gap-6 group border-none shadow-premium bg-white">
                        <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm shrink-0",
                            stat.color === 'blue' ? "bg-blue-50 text-blue-600" :
                            stat.color === 'teal' ? "bg-brand-teal/10 text-brand-teal" :
                            "bg-orange-50 text-orange-600"
                        )}>
                            <stat.icon size={18} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-900 tracking-tighter leading-none mb-1">{stat.value}</h3>
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-none">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {hasFinancials && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {financialCards.map((card, i) => (
                        <div key={i} className="premium-card p-5 group border-none shadow-premium bg-white">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                                    card.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
                                    card.color === 'rose' ? "bg-rose-50 text-rose-600" :
                                    card.color === 'blue' ? "bg-blue-50 text-blue-600" :
                                    "bg-brand-teal/10 text-brand-teal"
                                )}>
                                    <card.icon size={16} strokeWidth={2.5} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-black text-slate-900 tracking-tight truncate">{card.value}</p>
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest truncate">{card.label}</p>
                                    {card.subtitle && (
                                        <p className="text-[8px] font-medium text-slate-400 tracking-tight mt-0.5">{card.subtitle}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});
