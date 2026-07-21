"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface CircularProgressProps {
  percentage: number;
  size?: "sm" | "md" | "lg";
  color?: "teal" | "blue" | "orange" | "green" | "red";
  showLabel?: boolean;
  label?: string;
  className?: string;
}

const sizeMap = {
  sm: { width: 40, radius: 16, stroke: 4, fontSize: "text-xs" },
  md: { width: 64, radius: 26, stroke: 5, fontSize: "text-sm" },
  lg: { width: 96, radius: 40, stroke: 6, fontSize: "text-lg" },
};

const colorMap = {
  teal: "#2a9f90",
  blue: "#3b82f6",
  orange: "#c96928",
  green: "#34d399",
  red: "#f43f5e",
};

export default function CircularProgress({
  percentage,
  size = "md",
  color = "teal",
  showLabel = true,
  label,
  className,
}: CircularProgressProps) {
  const { width, radius, stroke, fontSize } = sizeMap[size];
  const normalizedRadius = radius - stroke;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const strokeColor = colorMap[color];

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg height={width} width={width} className="-rotate-90">
        {/* Background circle */}
        <circle
          stroke="#e5e7eb"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        {/* Progress circle */}
        <circle
          stroke={strokeColor}
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference + " " + circumference}
          style={{
            strokeDashoffset,
            transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
      {showLabel && (
        <span
          className={cn(
            "absolute font-bold text-slate-800",
            fontSize
          )}
        >
          {label || `${Math.round(percentage)}%`}
        </span>
      )}
    </div>
  );
}
