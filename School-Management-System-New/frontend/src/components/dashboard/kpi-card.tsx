"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface KpiCardProps {
  title: string
  value: string | number
  description: string
  icon: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  progress?: {
    value: number
    max: number
    color?: string
  }
  className?: string
  bgColor?: string
  textColor?: string
}

export function KpiCard({ title, value, description, icon: Icon, trend, progress, className, bgColor, textColor }: KpiCardProps) {
  const isDark = bgColor || className?.includes('bg-[#') || className?.includes('bg-blue');

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-none transition-all duration-500 group hover:-translate-y-1 h-full rounded-[16px]",
        !bgColor && !className?.includes('bg-[#') && "bg-white shadow-md hover:shadow-lg",
        className
      )}
      style={bgColor ? { background: bgColor } : undefined}
    >
      {/* Decorative gradient overlay */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 transition-transform duration-700 group-hover:scale-110" />

      <div className="p-5 sm:p-6 flex flex-col h-full justify-between relative z-10">
        <div className="mb-4">
          <Icon className={cn(
            "h-[22px] w-[22px] mb-3 stroke-[1.5]",
            textColor ? textColor : (isDark ? "text-white" : "text-[#0A4174]")
          )} />
          <h3 className={cn(
            "text-[13px] font-medium leading-tight",
            textColor ? textColor : (isDark ? "text-white" : "text-gray-600")
          )}>
            {title}
          </h3>
        </div>

        <div>
          <div className={cn(
            "text-3xl sm:text-[34px] font-bold tracking-tight mb-1",
            textColor ? textColor : (isDark ? "text-white" : "text-gray-900")
          )}>
            {value}
          </div>
          <p className={cn(
            "text-[11px] font-normal",
            textColor ? textColor : (isDark ? "text-white/80" : "text-gray-500")
          )}>
            {description}
          </p>
        </div>
      </div>
    </Card>
  )
}
