'use client';

import React from 'react';

interface PageSkeletonProps {
  rows?: number;
}

const PageSkeleton: React.FC<PageSkeletonProps> = ({ rows = 5 }) => {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>
      ))}
    </div>
  );
};

export default PageSkeleton;

