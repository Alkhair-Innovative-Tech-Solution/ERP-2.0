import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'full';
  showText?: boolean;
  showSubtitle?: boolean;
  className?: string;
  onClick?: () => void; // Add onClick prop
}

export const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  showText = true,
  showSubtitle = false,
  className = '',
  onClick
}) => {
  const iconSizes = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-20 h-20',
    full: 'w-16 h-16'
  };

  const textSizes = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl',
    full: 'text-4xl'
  };

  return (
    <div 
      className={`flex items-center gap-3 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {/* Logo Icon - Image from public folder (Beside HDMS) */}
      <div className={`${iconSizes[size]} rounded-xl bg-white flex items-center justify-center shadow-[0_2px_8px_0_rgba(96,150,186,0.2)] overflow-hidden transition-transform hover:scale-105`}>
        <img 
          src="/Logo.png" 
          alt="HDMS Logo"
          className="w-full h-full object-contain p-1"
        />
      </div>
      
      {/* Logo Text (Beside Logo) */}
      {showText && (
        <div className="flex flex-col">
          <span className={`${textSizes[size]} font-bold text-[#274c77] drop-shadow-lg tracking-[0.02em]`}>
            HDMS
          </span>
          {showSubtitle && (
            <span className="text-xs font-medium text-[#274c77]/70 mt-1 tracking-wider">
              HELP DESK MANAGEMENT SYSTEM
            </span>
          )}
        </div>
      )}
    </div>
  );
};

