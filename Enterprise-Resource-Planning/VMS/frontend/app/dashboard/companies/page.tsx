"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Building2, TrendingUp, Users, Calendar, ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface CompanyRecord {
  company: string;
  visitor_count: number;
  total_visits: number;
  last_visit: string | null;
}

export default function CompaniesPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get("/companies/")
      .then(r => setCompanies(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = companies.filter(c =>
    c.company.toLowerCase().includes(search.toLowerCase())
  );

  const totalVisitors = companies.reduce((s, c) => s + c.visitor_count, 0);
  const totalVisits = companies.reduce((s, c) => s + c.total_visits, 0);

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900" style={{ fontFamily: "var(--font-display)" }}>
          Visiting Companies
        </h1>
        <p className="text-ink-400 text-sm mt-0.5">
          All companies whose representatives have visited
        </p>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        {[
          { label: "Total Companies", value: companies.length, icon: Building2, color: "#6366f1", bg: "#eef2ff" },
          { label: "Unique Visitors", value: totalVisitors, icon: Users, color: "#059669", bg: "#d1fae5" },
          { label: "Total Visits", value: totalVisits, icon: TrendingUp, color: "#d97706", bg: "#fef3c7" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} style={{ background: "white", borderRadius: "1rem", border: "1px solid #f0ede8", padding: "1.25rem", boxShadow: "0 1px 3px rgb(0,0,0,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ fontSize: "0.72rem", fontWeight: 500, color: "#8a8679", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
                <p style={{ fontSize: "2rem", fontWeight: 700, color: "#141310", marginTop: "0.4rem", lineHeight: 1 }}>{value}</p>
              </div>
              <div style={{ width: 38, height: 38, borderRadius: "0.75rem", background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon style={{ width: 18, height: 18, color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input"
          placeholder="Search company name..."
          style={{ maxWidth: 320 }}
        />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-ink-300 text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Building2 className="w-10 h-10 text-ink-200 mx-auto mb-2" />
            <p className="text-ink-300 text-sm">{search ? "No companies match your search" : "No company data yet"}</p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px 140px 28px", gap: "1rem", padding: "10px 20px", background: "#f9f8f6", borderBottom: "1px solid #f0ede8" }}>
              {["Company", "Visitors", "Visits", "Last Visit", ""].map(h => (
                <p key={h} style={{ fontSize: "0.7rem", fontWeight: 600, color: "#8a8679", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</p>
              ))}
            </div>
            <div className="divide-y divide-ink-50">
              {filtered.map((c) => (
                <div key={c.company}
                  onClick={() => router.push(`/dashboard/companies/${encodeURIComponent(c.company)}`)}
                  style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px 140px 28px", gap: "1rem", padding: "12px 20px", alignItems: "center", cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#fafaf9"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ""}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Link href={`/dashboard/companies/${encodeURIComponent(c.company)}`} style={{ width: 36, height: 36, borderRadius: 10, background: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, textDecoration: "none" }}>
                      <Building2 style={{ width: 16, height: 16, color: "#6366f1" }} />
                    </Link>
                    <Link href={`/dashboard/companies/${encodeURIComponent(c.company)}`} style={{ fontSize: "0.875rem", fontWeight: 600, color: "#111827", textDecoration: "none" }} className="hover:text-indigo-600 hover:underline">{c.company}</Link>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <Users style={{ width: 13, height: 13, color: "#9ca3af" }} />
                    <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>{c.visitor_count}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <TrendingUp style={{ width: 13, height: 13, color: "#9ca3af" }} />
                    <span style={{ fontSize: "0.875rem", color: "#374151" }}>{c.total_visits}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <Calendar style={{ width: 13, height: 13, color: "#9ca3af" }} />
                    <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                      {c.last_visit ? format(new Date(c.last_visit), "d MMM yyyy") : "—"}
                    </span>
                  </div>
                  <ChevronRight style={{ width: 14, height: 14, color: "#d1d5db" }} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
