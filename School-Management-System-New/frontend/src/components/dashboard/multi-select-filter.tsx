"use client"

import { useState } from "react"
import { Check, ChevronDown, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface MultiSelectFilterProps {
  title: string
  options: string[] | number[]
  selectedValues: (string | number)[]
  onSelectionChange: (values: (string | number)[]) => void
  placeholder?: string
}

export function MultiSelectFilter({
  title,
  options,
  selectedValues,
  onSelectionChange,
  placeholder = "Select options...",
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false)

  const handleToggleOption = (option: string | number) => {
    const newSelection = selectedValues.includes(option)
      ? selectedValues.filter((item) => item !== option)
      : [...selectedValues, option]
    onSelectionChange(newSelection)
  }

  const handleSelectAll = () => {
    if (selectedValues.length === options.length) {
      onSelectionChange([])
    } else {
      onSelectionChange([...options])
    }
  }

  const displayText =
    selectedValues.length === 0
      ? placeholder
      : selectedValues.length === 1
        ? String(selectedValues[0])
        : `${selectedValues.length} selected`

  return (
    <div className="flex flex-col gap-1.5 w-full min-w-[140px] transition-all duration-300">
      <label className="text-[10px] font-black uppercase tracking-widest text-[#49769F] px-1">{title}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "h-11 w-full justify-between bg-white/50 backdrop-blur-sm border-blue-100 rounded-xl transition-all duration-300",
              "hover:bg-white hover:border-[#7BBDE8] hover:shadow-soft",
              selectedValues.length > 0 && "border-[#7BBDE8] bg-blue-50/30"
            )}
          >
            <span className={cn(
              "truncate text-sm",
              selectedValues.length > 0 ? "font-bold text-[#0A4174]" : "text-[#49769F]/60"
            )}>
              {displayText}
            </span>
            <ChevronDown className={cn(
              "ml-2 h-4 w-4 shrink-0 opacity-40 transition-transform duration-300",
              open && "rotate-180 opacity-100"
            )} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 shadow-blue border-blue-50 rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-[100] bg-white/95 backdrop-blur-xl" align="start">
          <div className="p-2 space-y-1">
            {options.length > 1 && (
              <>
                <div 
                  className="flex items-center gap-3 p-2.5 hover:bg-blue-50 rounded-xl cursor-pointer transition-colors group"
                  onClick={handleSelectAll}
                >
                  <div className={cn(
                    "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all",
                    selectedValues.length === options.length 
                      ? "bg-[#0A4174] border-[#0A4174]" 
                      : "border-blue-100 bg-white group-hover:border-[#7BBDE8]"
                  )}>
                    {selectedValues.length === options.length && <Check className="h-3.5 w-3.5 text-white" />}
                  </div>
                  <span className="text-sm font-bold text-[#0A4174]">Select All</span>
                </div>
                <div className="h-px bg-blue-50 my-1 mx-2" />
              </>
            )}
            
            <div className="max-h-64 overflow-y-auto pr-1 custom-scrollbar">
              {options.map((option) => (
                <div
                  key={option}
                  className="flex items-center gap-3 p-2.5 hover:bg-blue-50 rounded-xl cursor-pointer transition-colors group"
                  onClick={() => handleToggleOption(option)}
                >
                  <div className={cn(
                    "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all",
                    selectedValues.includes(option)
                      ? "bg-[#0A4174] border-[#0A4174]" 
                      : "border-blue-100 bg-white group-hover:border-[#7BBDE8]"
                  )}>
                    {selectedValues.includes(option) && <Check className="h-3.5 w-3.5 text-white" />}
                  </div>
                  <span className={cn(
                    "text-sm transition-colors",
                    selectedValues.includes(option) ? "text-[#0A4174] font-bold" : "text-[#49769F]"
                  )}>
                    {String(option)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      
      {/* Selected Tags */}
      {selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1 px-0.5">
          {selectedValues.slice(0, 2).map((value) => (
            <div 
              key={value} 
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#7BBDE8]/20 text-[#0A4174] text-[10px] font-black uppercase tracking-tighter border border-[#7BBDE8]/30 animate-in fade-in slide-in-from-top-1"
            >
              {String(value)}
              <X 
                className="h-2.5 w-2.5 opacity-50 hover:opacity-100 cursor-pointer" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleOption(value);
                }}
              />
            </div>
          ))}
          {selectedValues.length > 2 && (
            <div className="px-2 py-1 rounded-full bg-white text-[#49769F] text-[10px] font-bold border border-blue-100 shadow-sm">
              +{selectedValues.length - 2}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
