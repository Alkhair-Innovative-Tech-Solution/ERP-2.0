'use client';

interface ProgressBarProps {
  progress: number;
  label?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-3',
};

export default function ProgressBar({
  progress,
  label,
  showPercentage = true,
  size = 'md',
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="flex items-center justify-between mb-2">
          {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
          {showPercentage && (
            <span className="text-sm font-semibold text-primary-600">{clampedProgress}%</span>
          )}
        </div>
      )}
      <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${sizeClasses[size]}`}>
        <div
          className={`bg-primary-500 h-full rounded-full transition-all duration-500 ${
            clampedProgress === 100 ? 'bg-success' : ''
          }`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
}

