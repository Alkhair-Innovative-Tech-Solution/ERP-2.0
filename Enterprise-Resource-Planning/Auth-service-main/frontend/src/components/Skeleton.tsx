"use client";

import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'rectangle' | 'circle' | 'text';
  width?: string | number;
  height?: string | number;
}

const Skeleton: React.FC<SkeletonProps> = ({ 
  className = "", 
  variant = 'rectangle', 
  width, 
  height 
}) => {
  const baseClass = "animate-pulse bg-blue-50/50 dark:bg-zinc-800/50";
  
  const variantClasses = {
    rectangle: "rounded-xl",
    circle: "rounded-full",
    text: "rounded-md h-3 w-full"
  };

  const style: React.CSSProperties = {
    width: width,
    height: height
  };

  return (
    <div 
      className={`${baseClass} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  );
};

export default Skeleton;
