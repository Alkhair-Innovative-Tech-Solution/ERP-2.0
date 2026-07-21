'use client';

import React, { ReactNode } from 'react';

interface DashboardContainerProps {
  children: ReactNode;
  className?: string;
}

export const DashboardContainer: React.FC<DashboardContainerProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div className={`min-h-screen ${className}`}>
      {children}
    </div>
  );
};

export default DashboardContainer;