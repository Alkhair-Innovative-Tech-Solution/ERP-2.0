"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Visit } from "@/lib/types";
import { ArrowLeft, Building2, Users, TrendingUp, Calendar, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { StatusBadge } from "@/components/StatusBadge";

interface CompanyStats {
  company: string;
  visitor_count: number;
  total_visits: number;
  last_visit: string | null;
}

interface VisitorRow {
  id: string;
  full_name: string;
  cnic: string | null;
  phone: string | null;
  email: string | null;
  visit_count: number;
  is_blacklisted: boolean;
}

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const companyName = decodeURIComponent(params.slug as string);

  const [visitors, setVisitors] = useState<VisitorRow[]>([]);
  const [recentVisits, setRecentVisits] = useState<Visit[]>([]);
  const [stats, setStats] = useState<CompanyStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [companies, vData, vVisits] = await Promise.all([
          api.get("/companies/").then(r => r.data as CompanyStats[]),
          api.get("/visitors/", { params: { company: companyName } }).then(r => r.data),
          api.get("/visits/", { params: { company: companyName } }).then(r => r.data),
        ]);
        const found = companies.find(
          c => c.company.toLowerCase() === companyName.toLowerCase()
        );
        setStats(found || null);
        setVisitors(Array.isArray(vData) ? vData : vData.results || []);
        setRecentVisits(Array.isArray(vVisits) ? vVisits : vVisits.results || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [companyName]);

  const statCards = [
    { label: "Unique Visitors", value: stats?.visitor_count ?? "—", icon: Users, color: "#6366f1", bg: "#eef2ff" },
    { label: "Total Visits", value: stats?.total_visits ?? "—", icon: TrendingUp, color: "#059669", bg: "#d1fae5" },
    {
      label: "Last Visit",
      value: stats?.last_visit ? format(new Date(stats.last_visit), "d MMM yyyy") : "—",
      icon: Calendar,
      color: "#d97706",
      bg: "#fef3c7",
    },
  ];

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="btn-secondary flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div>
          <h1
            className="text-2xl font-bold text-ink-900"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {companyName}
          </h1>
          <p className="text-ink-400 text-sm">Company visitor report</p>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-ink-300 text-sm">Loading...</div>
      ) : (
        <>
          {/* Stat cards */}
          <div
            style={{
              display: "grid" as const,
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            {statCards.map(({ label, value, icon: Icon, color, bg }) => (
              <div
                key={label}
                style={{
                  background: "white",
                  borderRadius: "1rem",
                  border: "1px solid #f0ede8",
                  padding: "1.25rem",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ display: "flex" as const, justifyContent: "space-between" as const, alignItems: "flex-start" as const }}>
                  <div>
                    <p
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        color: "#8a8679",
                        textTransform: "uppercase" as const,
                        letterSpacing: "0.06em",
                        margin: 0,
                      }}
                    >
                      {label}
                    </p>
                    <p
                      style={{
                        fontSize: "1.6rem",
                        fontWeight: 700,
                        color: "#141310",
                        marginTop: "0.3rem",
                        lineHeight: 1,
                      }}
                    >
                      {value}
                    </p>
                  </div>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: "0.75rem",
                      background: bg,
                      display: "flex" as const,
                      alignItems: "center" as const,
                      justifyContent: "center" as const,
                    }}
                  >
                    <Icon style={{ width: 18, height: 18, color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Visitors table */}
          <div className="card overflow-hidden mb-6">
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #f0ede8" }}>
              <h2 className="text-sm font-semibold text-ink-700">
                Visitors from {companyName}
              </h2>
            </div>
            {visitors.length === 0 ? (
              <div className="py-8 text-center text-ink-300 text-sm">No visitors found</div>
            ) : (
              <div className="divide-y divide-ink-50">
                {visitors.map(v => (
                  <div
                    key={v.id}
                    style={{ display: "flex" as const, alignItems: "center" as const, gap: 12, padding: "12px 20px" }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: v.is_blacklisted ? "#fee2e2" : "#f3f4f6",
                        display: "flex" as const,
                        alignItems: "center" as const,
                        justifyContent: "center" as const,
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        color: v.is_blacklisted ? "#dc2626" : "#6b7280",
                        flexShrink: 0,
                      }}
                    >
                      {v.full_name
                        .split(" ")
                        .map((n: string) => n[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          color: v.is_blacklisted ? "#dc2626" : "#111827",
                          margin: 0,
                        }}
                      >
                        {v.full_name}{" "}
                        {v.is_blacklisted && (
                          <span
                            style={{
                              fontSize: "0.65rem",
                              background: "#fef2f2",
                              color: "#dc2626",
                              border: "1px solid #fecaca",
                              borderRadius: 99,
                              padding: "1px 5px",
                            }}
                          >
                            BLACKLISTED
                          </span>
                        )}
                      </p>
                      <p style={{ fontSize: "0.72rem", color: "#9ca3af", margin: "2px 0 0" }}>
                        {[v.cnic, v.phone, v.email].filter(Boolean).join(" · ") ||
                          "No contact info"}
                      </p>
                    </div>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        background: "#f3f4f6",
                        color: "#6b7280",
                        padding: "3px 10px",
                        borderRadius: 99,
                        fontWeight: 600,
                      }}
                    >
                      {v.visit_count} visit{v.visit_count !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Visit history */}
          <div className="card overflow-hidden">
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #f0ede8" }}>
              <h2 className="text-sm font-semibold text-ink-700">Visit History</h2>
            </div>
            {recentVisits.length === 0 ? (
              <div className="py-8 text-center text-ink-300 text-sm">No visits found</div>
            ) : (
              <>
                <div
                  style={{
                    display: "grid" as const,
                    gridTemplateColumns: "1.5fr 1fr 1fr 90px 70px",
                    gap: "1rem",
                    padding: "10px 20px",
                    background: "#f9f8f6",
                    borderBottom: "1px solid #f0ede8",
                  }}
                >
                  {["Visitor", "Date", "Host", "Status", "Card"].map(h => (
                    <p
                      key={h}
                      style={{
                        fontSize: "0.68rem",
                        fontWeight: 600,
                        color: "#8a8679",
                        textTransform: "uppercase" as const,
                        letterSpacing: "0.05em",
                        margin: 0,
                      }}
                    >
                      {h}
                    </p>
                  ))}
                </div>
                <div className="divide-y divide-ink-50">
                  {recentVisits.slice(0, 30).map(v => (
                    <div
                      key={v.id}
                      style={{
                        display: "grid" as const,
                        gridTemplateColumns: "1.5fr 1fr 1fr 90px 70px",
                        gap: "1rem",
                        padding: "11px 20px",
                        alignItems: "center" as const,
                      }}
                    >
                      <p style={{ fontSize: "0.82rem", fontWeight: 500, color: "#111827", margin: 0 }}>
                        {v.visitor_name}
                      </p>
                      <p style={{ fontSize: "0.78rem", color: "#6b7280", margin: 0 }}>
                        {v.checked_in_at
                          ? format(new Date(v.checked_in_at), "d MMM, HH:mm")
                          : format(new Date(v.created_at), "d MMM")}
                      </p>
                      <p style={{ fontSize: "0.78rem", color: "#6b7280", margin: 0 }}>
                        {v.host_name || "—"}
                      </p>
                      <StatusBadge status={v.status} />
                      {v.status === "checked_in" ? (
                        <a
                          href={`/dashboard/visitor-card?visitId=${v.id}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "flex" as const,
                            alignItems: "center" as const,
                            gap: 4,
                            fontSize: "0.75rem",
                            color: "#6366f1",
                            textDecoration: "none" as const,
                          }}
                        >
                          <CreditCard style={{ width: 13, height: 13 }} /> View
                        </a>
                      ) : (
                        <span />
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
