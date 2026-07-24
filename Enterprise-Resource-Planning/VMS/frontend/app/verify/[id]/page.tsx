"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle, XCircle, Clock, AlertTriangle, Loader2, Building2 } from "lucide-react";

interface VisitStatus {
  id: string;
  visiting_id: string;
  status: string;
  visitor_name: string;
  visitor_cnic?: string;
  visitor_phone?: string;
  visitor_company?: string;
  host_name?: string;
  purpose?: string;
  purpose_display?: string;
  checked_in_at?: string;
  expected_checkout_at?: string;
  checked_out_at?: string;
  card_expired?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  checked_in: {
    label: "ACTIVE — Currently Inside",
    color: "#16a34a",
    bg: "#f0fdf4",
    border: "#86efac",
    icon: <CheckCircle style={{ width: 40, height: 40, color: "#16a34a" }} />,
  },
  pending_approval: {
    label: "PENDING — Awaiting Approval",
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
    icon: <Clock style={{ width: 40, height: 40, color: "#d97706" }} />,
  },
  approved: {
    label: "APPROVED",
    color: "#2563eb",
    bg: "#eff6ff",
    border: "#bfdbfe",
    icon: <CheckCircle style={{ width: 40, height: 40, color: "#2563eb" }} />,
  },
  checked_out: {
    label: "EXPIRED — Visitor Has Left",
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    icon: <XCircle style={{ width: 40, height: 40, color: "#dc2626" }} />,
  },
  rejected: {
    label: "REJECTED",
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    icon: <XCircle style={{ width: 40, height: 40, color: "#dc2626" }} />,
  },
};

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <p style={{ margin: 0, fontSize: "0.6rem", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
      <p style={{ margin: "2px 0 0", fontSize: "0.9rem", fontWeight: 600, color: "#111827" }}>{value}</p>
    </div>
  );
}

export default function VerifyPage() {
  const params = useParams();
  const id = params?.id as string;

  const [visit, setVisit] = useState<VisitStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) { setError("Invalid link"); setLoading(false); return; }

    // Use verify endpoint which handles both UUID and visiting_id (VID-XXXXXXXX)
    fetch(`/api/visits/verify/${id}/`)
      .then(r => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then(d => setVisit({ ...d, id: d.visit_id }))
      .catch(() => setError("Visit not found or link is invalid."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6" }}>
      <div style={{ textAlign: "center" }}>
        <Loader2 style={{ width: 36, height: 36, color: "#9ca3af", animation: "spin 1s linear infinite", margin: "0 auto" }} />
        <p style={{ marginTop: 12, color: "#6b7280", fontSize: "0.875rem" }}>Verifying visitor...</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error || !visit) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6", padding: "1rem" }}>
      <div style={{ textAlign: "center", background: "white", borderRadius: 16, padding: "2rem", maxWidth: 340, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <AlertTriangle style={{ width: 44, height: 44, color: "#ef4444", margin: "0 auto 1rem" }} />
        <h2 style={{ fontWeight: 700, fontSize: "1.1rem", margin: "0 0 8px" }}>Invalid QR Code</h2>
        <p style={{ color: "#6b7280", fontSize: "0.875rem", margin: 0 }}>{error || "This visitor pass could not be found."}</p>
      </div>
    </div>
  );

  const cfg = STATUS_CONFIG[visit.status] || STATUS_CONFIG.checked_in;
  const isExpired = visit.card_expired || visit.status === "checked_out" || visit.status === "rejected";
  const checkinTime = visit.checked_in_at ? new Date(visit.checked_in_at) : null;
  const checkoutTime = visit.checked_out_at ? new Date(visit.checked_out_at) : null;
  const expectedOut = visit.expected_checkout_at ? new Date(visit.expected_checkout_at) : null;
  const BASE_URL = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: "100%", maxWidth: 400 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "white", borderRadius: 12, padding: "8px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <Building2 style={{ width: 18, height: 18, color: "#6b7280" }} />
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151" }}>Visitor Management System</span>
          </div>
        </div>

        {/* Status Banner */}
        <div style={{
          background: cfg.bg,
          border: `2px solid ${cfg.border}`,
          borderRadius: 16,
          padding: "1.25rem",
          textAlign: "center",
          marginBottom: 12,
        }}>
          <div style={{ marginBottom: 8 }}>{cfg.icon}</div>
          <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 800, color: cfg.color, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {cfg.label}
          </p>
        </div>

        {/* Main Card */}
        <div style={{
          background: "white",
          borderRadius: 16,
          overflow: "hidden",
          border: isExpired ? "2px solid #fca5a5" : "2px solid #111827",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          position: "relative",
        }}>
          {/* Expired overlay */}
          {isExpired && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, pointerEvents: "none" }}>
              <div style={{ transform: "rotate(-35deg)", background: "rgba(220,38,38,0.85)", color: "white", fontSize: "2rem", fontWeight: 900, padding: "8px 32px", borderRadius: 8, letterSpacing: 4 }}>
                EXPIRED
              </div>
            </div>
          )}

          {/* Card Header */}
          <div style={{ background: "linear-gradient(135deg, #111827 0%, #374151 100%)", color: "white", padding: "14px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: "0.6rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.7, margin: 0 }}>VISITOR</p>
                <p style={{ fontSize: "1.4rem", fontWeight: 800, letterSpacing: "-0.03em", margin: "2px 0 0" }}>ID CARD</p>
              </div>
              <div style={{ background: "white", borderRadius: 8, padding: 6 }}>
                <QRCodeSVG value={`${BASE_URL}/verify/${id}`} size={56} level="M" includeMargin={false} />
              </div>
            </div>
          </div>

          {/* Visiting ID */}
          {visit.visiting_id && (
            <div style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb", padding: "8px 18px", textAlign: "center" }}>
              <p style={{ fontSize: "0.58rem", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>Visiting ID</p>
              <p style={{ fontSize: "1.5rem", fontWeight: 900, fontFamily: "monospace", letterSpacing: "0.1em", color: "#111827", margin: "2px 0 0" }}>{visit.visiting_id}</p>
            </div>
          )}

          {/* Details */}
          <div style={{ padding: "14px 18px" }}>
            <Field label="Name" value={visit.visitor_name} />
            <Field label="Company" value={visit.visitor_company} />
            <Field label="CNIC" value={visit.visitor_cnic} />
            <Field label="Phone" value={visit.visitor_phone} />
            <Field label="Meeting With" value={visit.host_name} />
            <Field label="Purpose" value={visit.purpose_display || visit.purpose} />

            {/* Timing */}
            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 10, marginTop: 6, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
              {checkinTime && (
                <div>
                  <p style={{ fontSize: "0.6rem", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Check-in</p>
                  <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "#16a34a", margin: "2px 0 0" }}>
                    {checkinTime.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p style={{ fontSize: "0.65rem", color: "#9ca3af", margin: "1px 0 0" }}>
                    {checkinTime.toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              )}
              {expectedOut && (
                <div>
                  <p style={{ fontSize: "0.6rem", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
                    {checkoutTime ? "Checked Out" : "Expected Out"}
                  </p>
                  <p style={{ fontSize: "0.82rem", fontWeight: 700, color: isExpired ? "#dc2626" : "#d97706", margin: "2px 0 0" }}>
                    {(checkoutTime || expectedOut).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{
            background: isExpired ? "#fef2f2" : "#fffbeb",
            borderTop: `1px solid ${isExpired ? "#fecaca" : "#fde68a"}`,
            padding: "10px 18px",
            textAlign: "center",
          }}>
            {isExpired ? (
              <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#dc2626", margin: 0 }}>⚠ This visitor has checked out</p>
            ) : (
              <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#92400e", margin: 0 }}>✓ Valid pass — must be worn visibly</p>
            )}
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: "0.7rem", color: "#9ca3af", marginTop: 16 }}>
          Scanned at {new Date().toLocaleString("en-PK")}
        </p>
      </div>
    </div>
  );
}
