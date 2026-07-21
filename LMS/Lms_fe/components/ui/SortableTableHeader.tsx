import { ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SortConfig } from '@/hooks/useSortableData';

interface SortableTableHeaderProps {
  label: string;
  sortKey: string;
  currentSort: SortConfig | null;
  onSort: (key: string) => void;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export function SortableTableHeader({
  label,
  sortKey,
  currentSort,
  onSort,
  className,
  align = 'left',
}: SortableTableHeaderProps) {
  const isActive = currentSort?.key === sortKey;

  return (
    <th
      className={cn(
        'px-3 py-4 text-[9px] font-black uppercase tracking-widest cursor-pointer select-none hover:text-slate-900 transition-colors',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        isActive ? 'text-brand-teal' : 'text-slate-500',
        className
      )}
      onClick={() => onSort(sortKey)}
    >
      <div className={cn('flex items-center gap-1', align === 'right' && 'justify-end', align === 'center' && 'justify-center')}>
        <span>{label}</span>
        {isActive ? (
          currentSort.direction === 'asc' ? (
            <ChevronUp size={12} className="shrink-0" />
          ) : (
            <ChevronDown size={12} className="shrink-0" />
          )
        ) : (
          <ArrowUpDown size={10} className="shrink-0 opacity-30" />
        )}
      </div>
    </th>
  );
}
