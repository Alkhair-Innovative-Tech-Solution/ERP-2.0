"use client";
import { useState, useEffect } from "react";
import { Visit, Employee } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { format } from "date-fns";
import {
  CheckCircle, XCircle, LogOut, RotateCcw, AlertTriangle,
  CreditCard, Search, Check, Edit2, Clock, Printer, MessageCircle
} from "lucide-react";
import toast from "react-hot-toast";

interface Props { visit: Visit; onRefresh: () => void; onApproved: (visitId: string, visitorName: string, phone?: string) => void; }

async function apiCall(url: string, data?: object, method = "POST") {
  const r = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("access_token")}`,
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  const json = await r.json();
  if (!r.ok) throw json;
  return json;
}

async function searchEmployees(q: string): Promise<Employee[]> {
  if (q.length < 2) return [];
  const r = await fetch(`/api/employees/?q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
  });
  return r.ok ? r.json() : [];
}

const purposeEmoji: Record<string, string> = {
  interview: "📋", meeting: "🤝", delivery: "📦",
  contractor: "🔧", official: "🏛️", vip: "⭐", other: "📌",
};

// ── Edit Fields Modal ─────────────────────────────────────────────────────────
function EditFieldsModal({ visit, onClose, onSaved }: { visit: Visit; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    full_name: visit.visitor_name || "",
    phone: visit.visitor_phone || "",
    company: visit.visitor_company || "",
    purpose: visit.purpose || "",
    purpose_other: visit.purpose_other || "",
    notes: "",
    expected_checkout_at: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiCall(`/api/visits/${visit.id}/overwrite/`, form, "PATCH");
      toast.success("Visit details updated!");
      onSaved(); onClose();
    } catch (err: any) { toast.error(err.error || "Update failed"); }
    finally { setSaving(false); }
  };

  const IS: React.CSSProperties = { width: "100%", padding: "8px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: "0.875rem", outline: "none", boxSizing: "border-box" };
  const LS: React.CSSProperties = { display: "block", fontSize: "0.7rem", fontWeight: 600, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ background: "white", borderRadius: 16, padding: "1.5rem", maxWidth: 480, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#111827" }}>Edit Visit Details</h3>
            <p style={{ fontSize: "0.78rem", color: "#6b7280", marginTop: 2 }}>Overwrite fields for <strong>{visit.visitor_name}</strong></p>
          </div>
          <button onClick={onClose} style={{ padding: 6, border: "none", background: "none", cursor: "pointer", color: "#9ca3af", fontSize: "1.2rem" }}>✕</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <div><label style={LS}>Full Name</label><input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} style={IS} /></div>
          <div><label style={LS}>Phone</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={IS} placeholder="0300-1234567" /></div>
          <div><label style={LS}>Company</label><input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} style={IS} /></div>
          <div><label style={LS}>Purpose</label>
            <select value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} style={IS}>
              <option value="">Select...</option>
              {["interview","meeting","delivery","contractor","official","vip","other"].map(p => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select></div>
          {form.purpose === "other" && (
            <div><label style={LS}>Specify Purpose</label><input value={form.purpose_other} onChange={e => setForm(f => ({ ...f, purpose_other: e.target.value }))} style={IS} /></div>
          )}
          <div><label style={LS}>Expected Checkout</label>
            <input type="datetime-local" value={form.expected_checkout_at} onChange={e => setForm(f => ({ ...f, expected_checkout_at: e.target.value }))} style={IS} min={new Date().toISOString().slice(0, 16)} /></div>
          <div><label style={LS}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ ...IS, resize: "none" }} rows={2} placeholder="Optional notes..." /></div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: "1.25rem" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "9px", border: "1px solid #e5e7eb", borderRadius: 10, background: "white", fontSize: "0.875rem", cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: "9px", border: "none", borderRadius: 10, background: saving ? "#d1d5db" : "#111827", color: "white", fontSize: "0.875rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Post-Approval Actions Modal ───────────────────────────────────────────────
// After approval, receptionist gets DIRECT print + WhatsApp buttons — no preview needed
export function PostApprovalModal({ visitId, visitorName, visitorPhone, onClose }: {
  visitId: string; visitorName: string; visitorPhone?: string; onClose: () => void;
}) {
  const [waLoading, setWaLoading] = useState(false);

  const handlePrint = () => {
    // Open card in new window and immediately trigger print
    const w = window.open(`/dashboard/visitor-card?visitId=${visitId}&autoPrint=1`, "_blank");
    if (!w) toast.error("Popup blocked — allow popups and try again");
  };

  const handleWhatsApp = async () => {
    setWaLoading(true);
    try {
      const r = await fetch(`/api/visits/${visitId}/whatsapp-link/`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
      });
      const data = await r.json();
      if (data.whatsapp_url) {
        window.open(data.whatsapp_url, "_blank");
      } else {
        throw new Error("No URL");
      }
    } catch {
      // Fallback: build WA link on frontend
      const cardUrl = `${window.location.origin}/dashboard/visitor-card?visitId=${visitId}`;
      const msg = `*VISITOR PASS*\n━━━━━━━━━━━━━━━━━━━\n*Name:* ${visitorName}\nView card: ${cardUrl}`;
      const phone = (visitorPhone || "").replace(/\D/g, "").replace(/^0/, "92");
      const waUrl = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(waUrl, "_blank");
    } finally { setWaLoading(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ background: "white", borderRadius: 20, padding: "1.75rem", maxWidth: 380, width: "100%", boxShadow: "0 30px 80px rgba(0,0,0,0.35)", textAlign: "center" }}>
        {/* Success icon */}
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#d1fae5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
          <CheckCircle style={{ width: 28, height: 28, color: "#16a34a" }} />
        </div>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>Entry Approved!</h3>
        <p style={{ fontSize: "0.85rem", color: "#6b7280", margin: "0 0 1.5rem" }}>
          <strong>{visitorName}</strong> can now enter. Share their visitor pass:
        </p>

        {/* Action buttons — big and clear */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={handlePrint}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "13px", border: "none", borderRadius: 12, background: "#111827", color: "white", fontSize: "0.95rem", fontWeight: 700, cursor: "pointer", width: "100%" }}>
            <Printer style={{ width: 18, height: 18 }} /> Print Card
          </button>
          <button onClick={handleWhatsApp} disabled={waLoading}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "13px", border: "2px solid #25d366", borderRadius: 12, background: "#f0fdf4", color: "#15803d", fontSize: "0.95rem", fontWeight: 700, cursor: waLoading ? "not-allowed" : "pointer", width: "100%", opacity: waLoading ? 0.7 : 1 }}>
            <MessageCircle style={{ width: 18, height: 18 }} />
            {waLoading ? "Opening..." : "Send on WhatsApp"}
          </button>
          <button onClick={onClose}
            style={{ padding: "11px", border: "1px solid #e5e7eb", borderRadius: 12, background: "white", color: "#6b7280", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer", width: "100%" }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Approve Modal ─────────────────────────────────────────────────────────────
function ApproveModal({ visit, onClose, onApproved }: {
  visit: Visit; onClose: () => void; onApproved: (visitId: string, phone?: string) => void;
}) {
  const needsHost = visit.host_name_manual === "__OTHER__" ||
    (visit.entry_type === "qr_self" && !visit.host_name && !visit.host_type);

  const [empQ, setEmpQ] = useState("");
  const [empResults, setEmpResults] = useState<Employee[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [expectedCheckout, setExpectedCheckout] = useState("");
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    if (!empQ) { setEmpResults([]); return; }
    const t = setTimeout(() => searchEmployees(empQ).then(setEmpResults), 300);
    return () => clearTimeout(t);
  }, [empQ]);

  const handleApprove = async () => {
    if (!expectedCheckout) { toast.error("Expected checkout time is required"); return; }
    if (needsHost && !selectedEmp) { toast.error("Please assign a host employee first"); return; }
    setApproving(true);
    try {
      const payload: Record<string, unknown> = { expected_checkout_at: expectedCheckout };
      if (selectedEmp) payload.employee_host_id = selectedEmp.id;
      const res = await apiCall(`/api/visits/approve/${visit.id}/`, payload);
      toast.success(`${visit.visitor_name} approved!`);
      // Close approve modal FIRST, then signal parent to show PostApprovalModal
      // This order prevents React from unmounting PostApprovalModal during re-render
      onClose();
      onApproved(res.visit_id || visit.id, (visit as any).visitor?.phone || visit.visitor_phone);
    } catch (err: any) { toast.error(err.error || "Approval failed"); }
    finally { setApproving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ background: "white", borderRadius: 16, padding: "1.5rem", maxWidth: 460, width: "100%", boxShadow: "0 25px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ marginBottom: "1rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#111827" }}>Approve Check-in</h3>
          <p style={{ fontSize: "0.82rem", color: "#6b7280", marginTop: 4 }}>Approving <strong>{visit.visitor_name}</strong></p>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "#374151", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            <Clock style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />Expected Checkout Time *
          </label>
          <input type="datetime-local" value={expectedCheckout}
            onChange={e => setExpectedCheckout(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: "0.875rem", outline: "none", boxSizing: "border-box" }} />
        </div>

        {needsHost && (
          <div style={{ marginBottom: "1rem", padding: "12px", background: "#fefce8", borderRadius: 10, border: "1.5px solid #fde68a" }}>
            <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "#92400e", marginBottom: 8 }}>⚠ Visitor selected "Other" — assign host</p>
            <div style={{ position: "relative" }}>
              <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "#9ca3af", pointerEvents: "none" }} />
              <input type="text" value={empQ} onChange={e => { setEmpQ(e.target.value); setSelectedEmp(null); }}
                style={{ width: "100%", padding: "8px 12px 8px 32px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: "0.875rem", outline: "none", boxSizing: "border-box" }}
                placeholder="Search employee..." autoFocus />
            </div>
            {empResults.length > 0 && (
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", maxHeight: 180, overflowY: "auto", marginTop: 6 }}>
                {empResults.map(emp => (
                  <button key={emp.id} onClick={() => { setSelectedEmp(emp); setEmpQ(emp.name); setEmpResults([]); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", border: "none", borderBottom: "1px solid #f9fafb", background: selectedEmp?.id === emp.id ? "#f0fdf4" : "white", cursor: "pointer", textAlign: "left" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 700, flexShrink: 0 }}>
                      {emp.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <div><p style={{ fontSize: "0.82rem", fontWeight: 600 }}>{emp.name}</p><p style={{ fontSize: "0.7rem", color: "#6b7280" }}>{emp.designation} · {emp.department}</p></div>
                    {selectedEmp?.id === emp.id && <Check style={{ width: 13, height: 13, color: "#16a34a", marginLeft: "auto" }} />}
                  </button>
                ))}
              </div>
            )}
            {selectedEmp && (
              <div style={{ marginTop: 8, padding: "7px 10px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #86efac", display: "flex", alignItems: "center", gap: 6 }}>
                <Check style={{ width: 13, height: 13, color: "#16a34a" }} />
                <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "#15803d" }}>{selectedEmp.name} · {selectedEmp.department}</p>
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "9px", border: "1px solid #e5e7eb", borderRadius: 10, background: "white", fontSize: "0.875rem", cursor: "pointer" }}>Cancel</button>
          <button onClick={handleApprove} disabled={approving}
            style={{ flex: 1, padding: "9px", border: "none", borderRadius: 10, background: approving ? "#d1d5db" : "#16a34a", color: "white", fontSize: "0.875rem", fontWeight: 600, cursor: approving ? "not-allowed" : "pointer" }}>
            {approving ? "Approving..." : "Approve →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main VisitRow ─────────────────────────────────────────────────────────────
export function VisitRow({ visit, onRefresh, onApproved }: Props) {
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const handleReject = async () => {
    if (!confirm(`Reject ${visit.visitor_name}?`)) return;
    try {
      await apiCall(`/api/visits/reject/${visit.id}/`, { reason: "Rejected by receptionist" });
      toast.error("Visit rejected");
      onRefresh();
    } catch { toast.error("Failed"); }
  };

  const handleCheckout = async () => {
    if (!confirm(`Check out ${visit.visitor_name}?`)) return;
    try {
      await apiCall(`/api/visits/checkout/${visit.id}/`);
      toast.success(`${visit.visitor_name} checked out`);
      onRefresh();
    } catch (err: any) { toast.error(err.error || "Checkout failed"); }
  };

  // After approval → lift up to parent (visits/page.tsx) so modal survives list refresh
  const handleApproved = (visitId: string, phone?: string) => {
    onApproved(visitId, visit.visitor_name, phone);
  };

  const initials = visit.visitor_name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <>
      <div
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, transition: "background 0.15s" }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#f9f8f6"}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
      >
        {/* Avatar */}
        <div style={{ width: 36, height: 36, borderRadius: 10, background: visit.visitor_is_blacklisted ? "#fee2e2" : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, color: visit.visitor_is_blacklisted ? "#dc2626" : "#6b7280", flexShrink: 0 }}>
          {visit.visitor_is_blacklisted ? <AlertTriangle style={{ width: 14, height: 14 }} /> : initials}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: visit.visitor_is_blacklisted ? "#dc2626" : "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {visit.visitor_name}
            </span>
            {visit.is_returning && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 5px", background: "#f5f3ff", color: "#7c3aed", fontSize: "0.62rem", fontWeight: 600, borderRadius: 99, flexShrink: 0 }}>
                <RotateCcw style={{ width: 8, height: 8 }} /> Return
              </span>
            )}
            {visit.is_late && (
              <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#dc2626", background: "#fef2f2", padding: "1px 5px", borderRadius: 99, flexShrink: 0 }}>LATE</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>{visit.visitor_phone || visit.visitor_cnic || "—"}</span>
            {visit.visitor_company && <><span style={{ color: "#d1d5db" }}>·</span><span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>{visit.visitor_company}</span></>}
            {visit.host_name && visit.host_name !== "__OTHER__" && (
              <><span style={{ color: "#d1d5db" }}>·</span><span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>→ {visit.host_name}</span></>
            )}
            {visit.host_name === "__OTHER__" && (
              <><span style={{ color: "#d1d5db" }}>·</span><span style={{ fontSize: "0.7rem", color: "#d97706", fontWeight: 600 }}>⚠ Host unassigned</span></>
            )}
          </div>
        </div>

        {/* Purpose */}
        <span style={{ fontSize: "1rem", flexShrink: 0 }} title={visit.purpose_display}>
          {purposeEmoji[visit.purpose || ""] || "📌"}
        </span>

        {/* Duration */}
        {visit.duration_minutes !== null && visit.status === "checked_in" && (
          <span style={{ fontSize: "0.68rem", color: "#9ca3af", flexShrink: 0 }}>
            {visit.duration_minutes! < 60 ? `${visit.duration_minutes}m` : `${Math.floor(visit.duration_minutes! / 60)}h ${visit.duration_minutes! % 60}m`}
          </span>
        )}

        <StatusBadge status={visit.status} />

        <span style={{ fontSize: "0.7rem", color: "#9ca3af", flexShrink: 0, width: 34, textAlign: "right" }}>
          {format(new Date(visit.checked_in_at || visit.created_at), "HH:mm")}
        </span>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
          {(visit.status === "pending_approval" || visit.status === "checked_in") && (
            <button onClick={() => setShowEditModal(true)} title="Edit visit details"
              style={{ padding: 6, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", color: "#6b7280", display: "flex" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#f3f4f6"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
              <Edit2 style={{ width: 14, height: 14 }} />
            </button>
          )}

          {visit.status === "pending_approval" && (
            <>
              <button onClick={() => setShowApproveModal(true)} title="Approve"
                style={{ padding: 6, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", color: "#16a34a", display: "flex" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#f0fdf4"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                <CheckCircle style={{ width: 16, height: 16 }} />
              </button>
              <button onClick={handleReject} title="Reject"
                style={{ padding: 6, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", color: "#dc2626", display: "flex" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#fef2f2"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                <XCircle style={{ width: 16, height: 16 }} />
              </button>
            </>
          )}

          {visit.status === "checked_in" && (
            <>
              <a href={`/dashboard/visitor-card?visitId=${visit.id}`} target="_blank"
                style={{ padding: 6, borderRadius: 8, display: "flex", color: "#6b7280", textDecoration: "none" }}
                title="View visitor card"
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#f3f4f6"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                <CreditCard style={{ width: 15, height: 15 }} />
              </a>
              <button onClick={handleCheckout} title="Check out"
                style={{ padding: 6, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", color: "#6b7280", display: "flex" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#f3f4f6"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                <LogOut style={{ width: 16, height: 16 }} />
              </button>
            </>
          )}
        </div>
      </div>

      {showApproveModal && (
        <ApproveModal visit={visit} onClose={() => setShowApproveModal(false)} onApproved={handleApproved} />
      )}
      {showEditModal && (
        <EditFieldsModal visit={visit} onClose={() => setShowEditModal(false)} onSaved={onRefresh} />
      )}

    </>
  );
}
