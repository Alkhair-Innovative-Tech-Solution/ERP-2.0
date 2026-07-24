"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getVisits } from "@/lib/api";
import { Visit } from "@/lib/types";
import { VisitRow } from "@/components/VisitRow";
import { PostApprovalModal } from "@/components/VisitRow";
import { Filter } from "lucide-react";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "pending_approval", label: "Pending" },
  { value: "checked_in", label: "Checked In" },
  { value: "checked_out", label: "Checked Out" },
  { value: "scheduled", label: "Scheduled" },
];

function VisitsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Read from URL on every render so navigating from dashboard cards applies filter correctly
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [today] = useState(searchParams.get("today") === "1");

  // Sync status state when URL changes (e.g. dashboard card click)
  useEffect(() => {
    const urlStatus = searchParams.get("status") || "";
    setStatus(urlStatus);
  }, [searchParams]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);

  // postApproval lives HERE (parent) so it survives list re-renders
  const [postApproval, setPostApproval] = useState<{ visitId: string; visitorName: string; phone?: string } | null>(null);

  const fetchVisits = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (status) params.status = status;
      if (today) params.today = "1";
      const data = await getVisits(params);
      setVisits(data.results || []);
      setCount(data.count || 0);
    } catch {} finally {
      setLoading(false);
    }
  }, [status, today]);

  useEffect(() => { fetchVisits(); }, [fetchVisits]);

  const handleStatusChange = (val: string) => {
    setStatus(val);
    const url = new URL(window.location.href);
    if (val) url.searchParams.set("status", val);
    else url.searchParams.delete("status");
    router.replace(url.pathname + url.search, { scroll: false });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-900" style={{ fontFamily: "var(--font-display)" }}>
            Visits {today ? "— Today" : ""}
          </h1>
          <p className="text-ink-400 text-sm mt-0.5">{count} total records</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-ink-400" />
          <div className="flex gap-1 p-1 bg-ink-100 rounded-xl">
            {STATUS_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => handleStatusChange(value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  status === value ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-ink-300 text-sm">Loading...</div>
        ) : visits.length === 0 ? (
          <div className="py-16 text-center text-ink-300 text-sm">No visits found</div>
        ) : (
          <div className="divide-y divide-ink-50 px-2 py-2">
            {visits.map((v) => (
              <VisitRow
                key={v.id}
                visit={v}
                onRefresh={fetchVisits}
                onApproved={(visitId, visitorName, phone) => setPostApproval({ visitId, visitorName, phone })}
              />
            ))}
          </div>
        )}
      </div>

      {/* PostApprovalModal lives at page level — immune to list re-renders */}
      {postApproval && (
        <PostApprovalModal
          visitId={postApproval.visitId}
          visitorName={postApproval.visitorName}
          visitorPhone={postApproval.phone}
          onClose={() => { setPostApproval(null); fetchVisits(); }}
        />
      )}
    </div>
  );
}

export default function VisitsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-sm text-ink-300">Loading...</div>}>
      <VisitsContent />
    </Suspense>
  );
}
