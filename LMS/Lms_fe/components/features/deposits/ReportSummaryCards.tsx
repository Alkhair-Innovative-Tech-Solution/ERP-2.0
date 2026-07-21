import { memo } from 'react';
import { Banknote, ArrowUpRight, ArrowDownRight, RotateCcw, Users, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReportSummaryCardsProps {
    totalCollection: number;
    totalRefunded: number;
    netRevenue: number;
    activeDeposits: number;
    totalReturned: number;
}

function formatPKR(amount: number): string {
    return amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export const ReportSummaryCards = memo(({
    totalCollection,
    totalRefunded,
    netRevenue,
    activeDeposits,
    totalReturned,
}: ReportSummaryCardsProps) => {
    const cards = [
        {
            label: 'Total Collection',
            value: `PKR ${formatPKR(totalCollection)}`,
            icon: Banknote,
            color: 'emerald',
            bg: 'bg-emerald-50',
            iconBg: 'bg-emerald-100 text-emerald-700',
            subtitle: 'Gross deposit receipts',
            trend: 'up',
            trendLabel: `${((totalRefunded / totalCollection) * 100).toFixed(1)}% refunded`,
        },
        {
            label: 'Refunded Amount',
            value: `PKR ${formatPKR(totalRefunded)}`,
            icon: ArrowDownRight,
            color: 'rose',
            bg: 'bg-rose-50',
            iconBg: 'bg-rose-100 text-rose-700',
            subtitle: 'Amount returned to students',
            trend: 'down',
            trendLabel: `${totalReturned} deposits returned`,
        },
        {
            label: 'Net Revenue',
            value: `PKR ${formatPKR(netRevenue)}`,
            icon: ShieldCheck,
            color: 'blue',
            bg: 'bg-blue-50',
            iconBg: 'bg-blue-100 text-blue-700',
            subtitle: 'Net after refunds',
            trend: 'up',
            trendLabel: `${((netRevenue / totalCollection) * 100).toFixed(1)}% retention`,
        },
        {
            label: 'Active / Returned',
            value: `${activeDeposits} / ${totalReturned}`,
            icon: RotateCcw,
            color: 'teal',
            bg: 'bg-teal-50',
            iconBg: 'bg-teal-100 text-teal-700',
            subtitle: `${activeDeposits + totalReturned} total deposits`,
            trend: 'neutral',
            trendLabel: `${((activeDeposits / (activeDeposits + totalReturned || 1)) * 100).toFixed(0)}% active`,
        },
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((card, i) => (
                <div
                    key={i}
                    className={cn(
                        "rounded-2xl p-5 border transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5",
                        card.bg,
                        "border-transparent"
                    )}
                >
                    <div className="flex items-start justify-between mb-3">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", card.iconBg)}>
                            <card.icon size={18} strokeWidth={2.5} />
                        </div>
                        {card.trend === 'up' && (
                            <div className="flex items-center gap-1 bg-emerald-200/50 text-emerald-800 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                                <ArrowUpRight size={10} />
                                {card.trendLabel}
                            </div>
                        )}
                        {card.trend === 'down' && (
                            <div className="flex items-center gap-1 bg-rose-200/50 text-rose-800 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                                <ArrowDownRight size={10} />
                                {card.trendLabel}
                            </div>
                        )}
                    </div>
                    <p className="text-xl font-black text-slate-900 tracking-tight mb-0.5">{card.value}</p>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{card.label}</p>
                    <p className="text-[8px] font-medium text-slate-500 mt-0.5">{card.subtitle}</p>
                </div>
            ))}
        </div>
    );
});
