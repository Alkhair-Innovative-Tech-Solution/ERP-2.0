"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ReportCard } from "@/components/admin/report-card";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";

export default function ReportCardPreviewPage() {
  const searchParams = useSearchParams();
  const key = searchParams.get("key");
  const [data, setData] = useState<{ student: any; results: any[]; activeMonth?: string; availableMonths?: string[] } | null>(null);

  useEffect(() => {
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        setData(JSON.parse(raw));
        setTimeout(() => localStorage.removeItem(key), 5000);
      }
    } catch { /* ignore */ }
  }, [key]);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Loading report card...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="print:hidden sticky top-0 z-10 bg-white border-b shadow-sm px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => window.close()}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 font-medium"
        >
          <ArrowLeft className="h-4 w-4" /> Close
        </button>
        <span className="font-bold text-[#274c77] text-base">Student Report Card</span>
        <Button onClick={() => window.print()} className="flex gap-2 bg-[#274c77] hover:bg-[#1a3459]">
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>
      <div className="print:m-0 print:p-0">
        <ReportCard
          student={data.student}
          results={data.results}
          activeMonth={data.activeMonth}
          availableMonths={data.availableMonths}
          className="print:shadow-none"
        />
      </div>
    </div>
  );
}
