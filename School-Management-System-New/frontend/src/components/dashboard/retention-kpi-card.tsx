"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UserCheck, UserMinus } from "lucide-react"
import { getEnrollmentKPIs } from "@/lib/api"

// Retention Rate = % of the previous year's enrolled cohort still enrolled this
// year (any grade; graduates excluded). Org Admin → whole org (no campusId);
// Principal → their campus (campusId).
export default function RetentionKPICard({
  campusId,
  academicYear,
}: {
  campusId?: number | string
  academicYear?: string
}) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    getEnrollmentKPIs({ academic_year: academicYear, campus_id: campusId })
      .then((d: any) => { if (alive) setData(d) })
      .catch(() => { if (alive) setData(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [campusId, academicYear])

  const r = data?.retention
  const leavers = data?.leavers
  const dropout = data?.dropout
  const rate = r?.retention_rate ?? 0
  const tone = rate >= 85 ? "text-emerald-600" : rate >= 60 ? "text-amber-600" : "text-rose-600"

  return (
    <Card className="border border-gray-100">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold text-[#274c77] flex items-center gap-2">
          <UserCheck className="h-4 w-4" /> Retention Rate
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-gray-400 py-2">Loading…</p>
        ) : (
          <>
            <p className={`text-3xl font-black ${tone}`}>{rate}%</p>
            <p className="text-xs text-gray-500 mt-1">
              <span className="font-semibold text-gray-700">{r?.retained ?? 0}</span> of{" "}
              <span className="font-semibold text-gray-700">{r?.cohort_size ?? 0}</span> students who passed{" "}
              {r?.previous_year ?? "—"} are enrolled in {r?.academic_year ?? "—"}
            </p>
            {r && !r.has_data && (
              <p className="text-[11px] text-amber-600 mt-1.5">
                Needs {r.previous_year} Final-exam results — fills in once last year's passes are recorded.
              </p>
            )}
            {leavers && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                <UserMinus className="h-4 w-4 text-rose-500" />
                <span className="text-xs text-gray-600">
                  <span className="font-bold text-rose-600">{leavers.total_exits ?? 0}</span> left this year
                  {(leavers.transferred > 0 || leavers.graduated > 0) && (
                    <span className="text-gray-400">
                      {" "}({leavers.left} left{leavers.transferred ? `, ${leavers.transferred} transferred` : ""}{leavers.graduated ? `, ${leavers.graduated} graduated` : ""})
                    </span>
                  )}
                </span>
              </div>
            )}

            {dropout && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Dropout Rate (by gender)</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-blue-50/60 px-2.5 py-1.5">
                    <p className="text-[10px] text-blue-500 font-semibold">Boys</p>
                    <p className="text-lg font-black text-blue-700">{dropout.male?.dropout_rate ?? 0}%</p>
                    <p className="text-[10px] text-gray-400">{dropout.male?.dropouts ?? 0} of {dropout.male?.enrolled ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-pink-50/60 px-2.5 py-1.5">
                    <p className="text-[10px] text-pink-500 font-semibold">Girls</p>
                    <p className="text-lg font-black text-pink-700">{dropout.female?.dropout_rate ?? 0}%</p>
                    <p className="text-[10px] text-gray-400">{dropout.female?.dropouts ?? 0} of {dropout.female?.enrolled ?? 0}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
