"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Printer, ArrowLeft, Mail, MessageCircle, Loader2, AlertTriangle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Visit } from "@/lib/types";
import { api } from "@/lib/api";
import toast from "react-hot-toast";

function VisitorCardContent() {
  const params = useSearchParams();
  const router = useRouter();
  const visitId = params.get("visitId");
  const autoPrint = params.get("autoPrint") === "1";

  const [visit, setVisit] = useState<Visit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Email modal
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  const BASE_URL = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    if (!visitId) { setError("No visit ID provided"); setLoading(false); return; }
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    fetch(`/api/visits/${visitId}/`, { headers })
      .then(r => { if (!r.ok) throw new Error("not found"); return r.json(); })
      .then(d => {
        setVisit(d);
        setEmailInput(d.visitor?.email || d.visitor_email || "");
      })
      .catch(() => setError("Failed to load visit details"))
      .finally(() => setLoading(false));
  }, [visitId]);

  // Auto-print when loaded (triggered from PostApprovalModal)
  useEffect(() => {
    if (autoPrint && visit && !loading) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [autoPrint, visit, loading]);

  const handleBack = () => {
    if (window.history.length > 1) router.back();
    else window.close();
  };

  const handleWhatsApp = async () => {
    if (!visitId || !visit) return;
    try {
      const res = await api.get(`/visits/${visitId}/whatsapp-link/`);
      window.open(res.data.whatsapp_url, "_blank");
    } catch {
      // Frontend fallback
      const cardUrl = `${BASE_URL}/dashboard/visitor-card?visitId=${visitId}`;
      const name = visit.visitor_name || (visit as any).visitor?.full_name || "";
      const vid = visit.visiting_id || String(visit.id).slice(0, 8).toUpperCase();
      const host = visit.host_name || "—";
      const msg = `*VISITOR PASS*\n━━━━━━━━━━━━━━━━━━━\n*Name:* ${name}\n*ID:* ${vid}\n*Meeting:* ${host}\n━━━━━━━━━━━━━━━━━━━\nView card: ${cardUrl}`;
      const phone = ((visit as any).visitor?.phone || visit.visitor_phone || "").replace(/\D/g, "").replace(/^0/, "92");
      window.open(
        phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`,
        "_blank"
      );
    }
  };

  const handleSendEmail = async () => {
    if (!emailInput.trim()) { toast.error("Enter email address"); return; }
    setSendingEmail(true);
    try {
      await api.post(`/visits/${visitId}/send-card-email/`, { email: emailInput.trim() });
      toast.success(`Card sent to ${emailInput}`);
      setShowEmailModal(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to send email");
    } finally { setSendingEmail(false); }
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6" }}>
      <Loader2 style={{ width: 32, height: 32, color: "#9ca3af", animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error || !visit) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6" }}>
      <div style={{ textAlign: "center", background: "white", borderRadius: 16, padding: "2rem", maxWidth: 320 }}>
        <AlertTriangle style={{ width: 40, height: 40, color: "#ef4444", margin: "0 auto 1rem" }} />
        <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Not Found</h2>
        <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>{error || "Visit not found"}</p>
        <button onClick={handleBack} style={{ marginTop: "1rem", padding: "8px 20px", background: "#111827", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>Go Back</button>
      </div>
    </div>
  );

  const isExpired = visit.card_expired || visit.status === "checked_out";
  const checkinTime = visit.checked_in_at ? new Date(visit.checked_in_at) : null;
  const expectedOut = visit.expected_checkout_at ? new Date(visit.expected_checkout_at) : null;
  const checkedOutTime = visit.checked_out_at ? new Date(visit.checked_out_at) : null;
  const hostName = visit.host_name || "—";
  const visitorName = visit.visitor_name || (visit as any).visitor?.full_name || "";
  const visitorCnic = visit.visitor_cnic || (visit as any).visitor?.cnic || "";
  const visitorPhone = visit.visitor_phone || (visit as any).visitor?.phone || "";
  const visitorCompany = visit.visitor_company || (visit as any).visitor?.company || "";

  const CardComponent = () => (
    <div
      id="visitor-card"
      style={{
        width: 360,
        background: "white",
        borderRadius: 16,
        overflow: "hidden",
        border: isExpired ? "2px solid #fca5a5" : "2px solid #111827",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        position: "relative",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {isExpired && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, pointerEvents: "none" }}>
          <div style={{ transform: "rotate(-35deg)", background: "rgba(220,38,38,0.88)", color: "white", fontSize: "2.5rem", fontWeight: 900, padding: "10px 40px", borderRadius: 8, letterSpacing: 4 }}>
            EXPIRED
          </div>
        </div>
      )}
      <div style={{ background: "linear-gradient(135deg, #111827 0%, #374151 100%)", color: "white", padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.7, margin: 0 }}>VISITOR</p>
            <p style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.03em", margin: "2px 0 0" }}>ID CARD</p>
          </div>
          <div style={{ background: "white", borderRadius: 10, padding: 8 }}>
            <QRCodeSVG value={`${BASE_URL}/verify/${visit.visiting_id || visit.id}`} size={64} level="M" includeMargin={false} />
          </div>
        </div>
      </div>
      {visit.visiting_id && (
        <div style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb", padding: "10px 20px", textAlign: "center" }}>
          <p style={{ fontSize: "0.6rem", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>Visiting ID</p>
          <p style={{ fontSize: "1.6rem", fontWeight: 900, fontFamily: "monospace", letterSpacing: "0.1em", color: "#111827", margin: "2px 0 0" }}>{visit.visiting_id}</p>
        </div>
      )}
      <div style={{ padding: "14px 20px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {(
              [
                ["NAME", visitorName, true],
                ...(visitorCompany ? [["COMPANY", visitorCompany, false]] : []),
                ...(visitorCnic ? [["CNIC", visitorCnic, false]] : []),
                ...(visitorPhone ? [["PHONE", visitorPhone, false]] : []),
                ["MEETING", hostName, false],
                ["PURPOSE", visit.purpose_display || visit.purpose || "—", false],
              ] as [string, string, boolean][]
            ).map(([label, value, bold]) => (
              <tr key={label}>
                <td style={{ fontSize: "0.62rem", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: 8, paddingRight: 12, verticalAlign: "top", whiteSpace: "nowrap" }}>{label}</td>
                <td style={{ fontSize: "0.82rem", fontWeight: bold ? 700 : 500, color: "#111827", paddingBottom: 8, wordBreak: "break-word" }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 10, marginTop: 4, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <div>
            <p style={{ fontSize: "0.6rem", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Check-in</p>
            <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#16a34a", margin: "2px 0 0" }}>
              {checkinTime ? checkinTime.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" }) : "—"}
            </p>
            <p style={{ fontSize: "0.65rem", color: "#9ca3af", margin: "1px 0 0" }}>
              {checkinTime ? checkinTime.toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" }) : ""}
            </p>
          </div>
          {expectedOut && (
            <div>
              <p style={{ fontSize: "0.6rem", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Expected Out</p>
              <p style={{ fontSize: "0.8rem", fontWeight: 700, color: isExpired ? "#dc2626" : "#d97706", margin: "2px 0 0" }}>
                {expectedOut.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}
              </p>
              {checkedOutTime && (
                <p style={{ fontSize: "0.65rem", color: "#9ca3af", margin: "1px 0 0" }}>Out: {checkedOutTime.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}</p>
              )}
            </div>
          )}
        </div>
      </div>
      <div style={{ background: isExpired ? "#fef2f2" : "#fffbeb", borderTop: `1px solid ${isExpired ? "#fecaca" : "#fde68a"}`, padding: "10px 20px", textAlign: "center" }}>
        {isExpired
          ? <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#dc2626", margin: 0 }}>⚠ Card expired — visitor has checked out</p>
          : <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#92400e", margin: 0 }}>⚠ Must be worn visibly at all times</p>
        }
      </div>
    </div>
  );

  return (
    <>
      {/*
        Print styles:
        - Hide EVERYTHING except #visitor-card
        - No sidebar, no top bar, no buttons
        - Card centered on A4
      */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Print-only container — CSS hides on screen (#print-root{display:none}), shows on print */}
      <div id="print-root">
        <CardComponent />
      </div>

      {/* Screen layout */}
      <div className="no-print" style={{ minHeight: "100vh", background: "#f3f4f6" }}>
        {/* Top bar */}
        <div style={{ background: "white", borderBottom: "1px solid #e5e7eb", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 20 }}>
          <button onClick={handleBack}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", border: "1px solid #e5e7eb", borderRadius: 10, background: "white", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500, color: "#374151" }}>
            <ArrowLeft style={{ width: 15, height: 15 }} /> Back
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowEmailModal(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", border: "1px solid #e5e7eb", borderRadius: 10, background: "white", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500, color: "#374151" }}>
              <Mail style={{ width: 15, height: 15 }} /> Email
            </button>
            <button onClick={handleWhatsApp}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", border: "1.5px solid #25d366", borderRadius: 10, background: "#f0fdf4", cursor: "pointer", fontSize: "0.875rem", fontWeight: 600, color: "#15803d" }}>
              <MessageCircle style={{ width: 15, height: 15 }} /> WhatsApp
            </button>
            <button onClick={() => window.print()}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", border: "none", borderRadius: 10, background: "#111827", color: "white", cursor: "pointer", fontSize: "0.875rem", fontWeight: 600 }}>
              <Printer style={{ width: 15, height: 15 }} /> Print Card
            </button>
          </div>
        </div>

        {/* Card preview */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem", minHeight: "calc(100vh - 60px)" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem" }}>
            <CardComponent />
            {/* Quick action row under card */}
            <div style={{ display: "flex", gap: 10, width: 360 }}>
              <button onClick={() => window.print()}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", border: "none", borderRadius: 12, background: "#111827", color: "white", cursor: "pointer", fontSize: "0.875rem", fontWeight: 600 }}>
                <Printer style={{ width: 16, height: 16 }} /> Print
              </button>
              <button onClick={() => setShowEmailModal(true)}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", border: "1.5px solid #e5e7eb", borderRadius: 12, background: "white", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500, color: "#374151" }}>
                <Mail style={{ width: 16, height: 16 }} /> Email
              </button>
              <button onClick={handleWhatsApp}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", border: "1.5px solid #25d366", borderRadius: 12, background: "#f0fdf4", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500, color: "#15803d" }}>
                <MessageCircle style={{ width: 16, height: 16 }} /> WhatsApp
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="no-print" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "white", borderRadius: 16, padding: "1.5rem", maxWidth: 400, width: "100%", boxShadow: "0 25px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ fontWeight: 700, fontSize: "1rem", margin: 0 }}>Send Card by Email</h3>
              <button onClick={() => setShowEmailModal(false)} style={{ border: "none", background: "none", cursor: "pointer", color: "#9ca3af", fontSize: "1.2rem" }}>✕</button>
            </div>
            <p style={{ fontSize: "0.82rem", color: "#6b7280", marginBottom: "1rem" }}>A visitor pass will be sent to the address below.</p>
            <input
              type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)}
              placeholder="visitor@example.com"
              style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: "0.875rem", outline: "none", boxSizing: "border-box", marginBottom: "1rem" }}
              autoFocus
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowEmailModal(false)}
                style={{ flex: 1, padding: "10px", border: "1px solid #e5e7eb", borderRadius: 10, background: "white", cursor: "pointer", fontSize: "0.875rem" }}>
                Cancel
              </button>
              <button onClick={handleSendEmail} disabled={sendingEmail}
                style={{ flex: 1, padding: "10px", border: "none", borderRadius: 10, background: sendingEmail ? "#d1d5db" : "#111827", color: "white", cursor: sendingEmail ? "not-allowed" : "pointer", fontSize: "0.875rem", fontWeight: 600 }}>
                {sendingEmail ? "Sending..." : "Send Email"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function VisitorCardPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 style={{ width: 32, height: 32, animation: "spin 1s linear infinite", color: "#9ca3af" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <VisitorCardContent />
    </Suspense>
  );
}
