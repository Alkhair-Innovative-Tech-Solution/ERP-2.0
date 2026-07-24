"use client";
import { useState, useEffect } from "react";
import { getVisitorList, getVisitorHistory, blacklistVisitor, unblacklistVisitor } from "@/lib/api";
import { Visitor, Visit } from "@/lib/types";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Users, History, Shield, ShieldOff, AlertTriangle, Eye, X } from "lucide-react";

export default function VisitorHistoryPage() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [filterBlacklisted, setFilterBlacklisted] = useState<"all" | "active" | "blacklisted">("all");
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [visitorVisits, setVisitorVisits] = useState<Visit[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [blacklistReason, setBlacklistReason] = useState("");
  const [showBlacklistModal, setShowBlacklistModal] = useState(false);

  useEffect(() => {
    fetchVisitors();
  }, [filterBlacklisted]);

  const fetchVisitors = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterBlacklisted === "blacklisted") params.blacklisted = "true";
      else if (filterBlacklisted === "active") params.blacklisted = "false";
      if (searchQ) params.q = searchQ;
      
      const data = await getVisitorList(params);
      setVisitors(data);
    } catch {
      toast.error("Failed to load visitors");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchVisitors();
  };

  const viewHistory = async (visitor: Visitor) => {
    setSelectedVisitor(visitor);
    setLoadingVisits(true);
    try {
      const data = await getVisitorHistory(visitor.id);
      setVisitorVisits(data.visits || []);
    } catch {
      toast.error("Failed to load visit history");
    } finally {
      setLoadingVisits(false);
    }
  };

  const handleBlacklist = async (visitor: Visitor) => {
    setSelectedVisitor(visitor);
    setBlacklistReason(visitor.blacklist_reason || "");
    setShowBlacklistModal(true);
  };

  const confirmBlacklist = async () => {
    if (!selectedVisitor) return;
    try {
      if (selectedVisitor.is_blacklisted) {
        await unblacklistVisitor(selectedVisitor.id);
        toast.success("Visitor removed from blacklist");
      } else {
        await blacklistVisitor(selectedVisitor.id, blacklistReason);
        toast.success("Visitor blacklisted");
      }
      setShowBlacklistModal(false);
      fetchVisitors();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update blacklist");
    }
  };

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900" style={{ fontFamily: "var(--font-display)" }}>
          Visitor History & Management
        </h1>
        <p className="text-ink-400 text-sm mt-0.5">View all visitors, their history, and manage blacklisted visitors</p>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="flex gap-4 flex-wrap">
          <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search by name, CNIC, phone, email, company..."
              className="input"
            />
          </form>
          <div className="flex gap-2">
            {([
              ["all", "All"],
              ["active", "Active"],
              ["blacklisted", "Blacklisted"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilterBlacklisted(value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filterBlacklisted === value
                    ? "bg-ink-900 text-white"
                    : "bg-ink-100 text-ink-600 hover:bg-ink-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Visitor List */}
      <div className="card">
        {loading ? (
          <div className="p-8 text-center text-ink-400">Loading...</div>
        ) : visitors.length === 0 ? (
          <div className="p-8 text-center text-ink-400">No visitors found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-ink-200 bg-ink-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink-600 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink-600 uppercase">CNIC</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink-600 uppercase">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink-600 uppercase">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink-600 uppercase">Visits</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visitors.map((v) => (
                  <tr key={v.id} className="border-b border-ink-100 hover:bg-ink-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-ink-100 flex items-center justify-center text-xs font-semibold text-ink-600">
                          {v.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                        </div>
                        <span className="font-medium text-ink-900">{v.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-ink-600 font-mono">{v.cnic || "-"}</td>
                    <td className="px-4 py-3 text-sm text-ink-600">{v.phone || "-"}</td>
                    <td className="px-4 py-3 text-sm text-ink-600">{v.company || "-"}</td>
                    <td className="px-4 py-3 text-sm text-ink-600">{v.visit_count || 0}</td>
                    <td className="px-4 py-3">
                      {v.is_blacklisted ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-700">
                          <AlertTriangle className="w-3 h-3" />
                          Blacklisted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-jade-100 text-jade-700">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => viewHistory(v)}
                          className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-500"
                          title="View History"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleBlacklist(v)}
                          className={`p-1.5 rounded-lg hover:bg-rose-100 ${
                            v.is_blacklisted ? "text-jade-600" : "text-rose-600"
                          }`}
                          title={v.is_blacklisted ? "Remove from blacklist" : "Blacklist visitor"}
                        >
                          {v.is_blacklisted ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* History Modal */}
      {selectedVisitor && visitorVisits.length > 0 && !showBlacklistModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-ink-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-ink-900" style={{ fontFamily: "var(--font-display)" }}>
                  Visit History
                </h2>
                <p className="text-sm text-ink-500">{selectedVisitor.full_name}</p>
              </div>
              <button onClick={() => { setSelectedVisitor(null); setVisitorVisits([]); }} className="p-2 rounded-lg hover:bg-ink-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {loadingVisits ? (
                <div className="text-center text-ink-400 py-8">Loading...</div>
              ) : (
                <div className="space-y-3">
                  {visitorVisits.map((visit) => (
                    <div key={visit.id} className="p-4 border border-ink-200 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-ink-900">
                          {visit.purpose_display || visit.purpose || "No purpose"}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          visit.status === "checked_in" ? "bg-jade-100 text-jade-700" :
                          visit.status === "checked_out" ? "bg-blue-100 text-blue-700" :
                          visit.status === "pending_approval" ? "bg-amber-100 text-amber-700" :
                          "bg-ink-100 text-ink-700"
                        }`}>
                          {visit.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="text-xs text-ink-500 space-y-1">
                        <p>Host: {visit.host_name || "N/A"}</p>
                        <p>Check-in: {visit.checked_in_at ? format(new Date(visit.checked_in_at), "PPp") : "N/A"}</p>
                        <p>Entry: {visit.entry_type.replace(/_/g, " ")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Blacklist Modal */}
      {showBlacklistModal && selectedVisitor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6 border-b border-ink-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedVisitor.is_blacklisted ? (
                  <ShieldOff className="w-6 h-6 text-jade-600" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-rose-600" />
                )}
                <h2 className="text-lg font-bold text-ink-900">
                  {selectedVisitor.is_blacklisted ? "Remove from Blacklist" : "Blacklist Visitor"}
                </h2>
              </div>
              <button onClick={() => setShowBlacklistModal(false)} className="p-2 rounded-lg hover:bg-ink-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-ink-600 mb-4">
                {selectedVisitor.is_blacklisted
                  ? "Remove this visitor from the blacklist?"
                  : "Add this visitor to the blacklist? They will not be permitted entry."}
              </p>
              {!selectedVisitor.is_blacklisted && (
                <div className="mb-4">
                  <label className="label">Reason (optional)</label>
                  <textarea
                    value={blacklistReason}
                    onChange={(e) => setBlacklistReason(e.target.value)}
                    className="input resize-none"
                    rows={3}
                    placeholder="Reason for blacklisting..."
                  />
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setShowBlacklistModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button
                  onClick={confirmBlacklist}
                  className={`btn-primary flex-1 ${
                    selectedVisitor.is_blacklisted ? "" : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {selectedVisitor.is_blacklisted ? "Remove" : "Blacklist"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
