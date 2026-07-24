"use client";
import { useState, useEffect } from "react";
import { Building2, Check, Clock, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { PURPOSE_OPTIONS, PurposeType, Host } from "@/lib/types";
import { formatCNICInput, validateCNIC, validatePhonePakistan, cleanPhone } from "@/lib/utils";

type Step = "form" | "waiting" | "approved" | "rejected" | "blacklisted" | "conflict" | "already_in";
const API = "/api";

// Issue #4: hosts endpoint is AllowAny — no auth token needed
async function fetchHosts(): Promise<Host[]> {
  try {
    const r = await fetch(`${API}/hosts/`, { cache: "no-store" });
    if (!r.ok) return [];
    const data = await r.json();
    // API may return array or paginated object
    return Array.isArray(data) ? data : (data.results || []);
  } catch { return []; }
}

async function submitQR(data: Record<string, unknown>) {
  const r = await fetch(`${API}/qr/checkin/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await r.json();
  if (!r.ok) throw json;
  return json;
}

async function pollStatus(id: string) {
  const r = await fetch(`${API}/visits/status/${id}/`);
  return r.json();
}

const IS: React.CSSProperties = {
  width: "100%", padding: "12px 14px", background: "white",
  border: "1.5px solid #e5e7eb", borderRadius: 12, fontSize: 15,
  color: "#111827", outline: "none" as const, boxSizing: "border-box",
  fontFamily: "inherit", WebkitAppearance: "none" as const,
};
const LS: React.CSSProperties = {
  display: "block" as const, fontSize: "0.7rem", fontWeight: 600, color: "#6b7280",
  marginBottom: 5, textTransform: "uppercase" as const, letterSpacing: "0.05em",
};

export default function CheckinPage() {
  const [step, setStep] = useState<Step>("form");
  const [visitId, setVisitId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const [conflictMsg, setConflictMsg] = useState("");
  const [alreadyInMsg, setAlreadyInMsg] = useState("");
  const [hosts, setHosts] = useState<Host[]>([]);
  const [hostsLoading, setHostsLoading] = useState(true);
  const [hostIsOther, setHostIsOther] = useState(false);

  // Issue #9: validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    full_name: "", cnic: "", phone: "+92", email: "",
    company: "", purpose: "" as PurposeType | "", purpose_other: "",
    interview_position: "",
    contractor_company: "", contractor_designation: "", contractor_address: "",
    delivery_company: "", official_department: "", official_rank: "", vip_category: "",
    host_id: "",
    internal_department: "",
  });

  // Issue #4: fetch hosts on mount
  useEffect(() => {
    setHostsLoading(true);
    fetchHosts()
      .then(setHosts)
      .finally(() => setHostsLoading(false));
  }, []);

  useEffect(() => {
    if (step !== "waiting" || !visitId) return;
    const t = setInterval(async () => {
      try {
        const d = await pollStatus(visitId);
        if (d.status === "checked_in") setStep("approved");
        else if (d.status === "rejected") setStep("rejected");
      } catch {}
    }, 3000);
    return () => clearInterval(t);
  }, [step, visitId]);

  const f = (k: string, v: string) => {
    setForm(p => ({ ...p, [k]: v }));
    setErrors(p => ({ ...p, [k]: "" }));
  };

  const handleHostChange = (val: string) => {
    if (val === "__other__") {
      setHostIsOther(true);
      f("host_id", "");
    } else {
      setHostIsOther(false);
      f("host_id", val);
    }
  };

  const handlePhone = (v: string) => {
    if (!v.startsWith("+92")) v = "+92";
    const digits = v.slice(3).replace(/\D/g, "").slice(0, 10);
    f("phone", "+92" + digits);
  };

  // Issue #9: validate all fields
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    const cnicErr = validateCNIC(form.cnic);
    if (cnicErr) newErrors.cnic = cnicErr;

    if (form.phone.length > 3) {
      const phoneErr = validatePhonePakistan(form.phone);
      if (phoneErr) newErrors.phone = phoneErr;
    }

    if (form.email) {
      const emailPattern = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
      if (!emailPattern.test(form.email)) newErrors.email = "Enter a valid email address";
    }

    if (form.purpose === "other" && !form.purpose_other) {
      newErrors.purpose_other = "Please specify purpose";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    // Internal visits don't need a host
    const isInternal = form.purpose === "internal";
    const payload: Record<string, unknown> = {
      full_name: form.full_name,
      cnic: form.cnic || undefined,
      phone: form.phone.length > 3 ? cleanPhone(form.phone) : undefined,
      email: form.email.toLowerCase() || undefined,
      company: form.company || undefined,
      purpose: form.purpose || undefined,
      purpose_other: form.purpose === "other" ? form.purpose_other : undefined,
      host_id: (!hostIsOther && !isInternal && form.host_id) ? form.host_id : undefined,
      host_is_other: !isInternal && hostIsOther,
    };
    if (form.purpose === "interview") payload.interview_position = form.interview_position;
    if (form.purpose === "contractor") {
      payload.contractor_company = form.contractor_company;
      payload.contractor_designation = form.contractor_designation;
      payload.contractor_address = form.contractor_address;
    }
    if (form.purpose === "delivery") payload.delivery_company = form.delivery_company;
    if (form.purpose === "official") {
      payload.official_department = form.official_department;
      payload.official_rank = form.official_rank;
    }
    if (form.purpose === "vip") payload.vip_category = form.vip_category;
    if (form.purpose === "internal" && form.internal_department) payload.internal_department = form.internal_department;

    try {
      const data = await submitQR(payload);
      setVisitId(data.visit_id);
      setIsReturning(data.is_returning);
      setStep("waiting");
    } catch (err: any) {
      if (err.blacklisted) setStep("blacklisted");
      else if (err.already_checked_in) {
        // Issue #1: visitor already checked in
        setAlreadyInMsg(err.error || "You are already checked in. Please check out first.");
        setStep("already_in");
      } else if (err.identity_conflict) {
        setConflictMsg(err.error);
        setStep("conflict");
      } else {
        const msg = err.non_field_errors?.[0] || err.error || err.detail || "Submission failed.";
        alert(msg);
      }
    } finally { setLoading(false); }
  };

  if (step === "already_in") return (
    <Screen>
      <StatusCard
        icon={<Clock style={{ width: 36, height: 36, color: "#d97706" }} />}
        bg="#fffbeb"
        title="Already Checked In"
        msg={alreadyInMsg}
      >
        <button onClick={() => setStep("form")}
          style={{ marginTop: "1rem", padding: "10px 24px", background: "#111827", color: "white", border: "none" as const, borderRadius: 10, fontWeight: 600, cursor: "pointer" as const, fontSize: "0.875rem" }}>
          Go Back
        </button>
      </StatusCard>
    </Screen>
  );

  if (step === "blacklisted") return (
    <Screen>
      <StatusCard icon={<AlertTriangle style={{ width: 36, height: 36, color: "#dc2626" }} />} bg="#fef2f2"
        title="Entry Denied" msg="Your entry has been denied. Please speak with the receptionist at the front desk." red />
    </Screen>
  );

  if (step === "conflict") return (
    <Screen>
      <StatusCard icon={<AlertTriangle style={{ width: 36, height: 36, color: "#d97706" }} />} bg="#fffbeb"
        title="Identity Mismatch" msg={conflictMsg || "Your details don't match our records. Please contact the receptionist."} />
    </Screen>
  );

  if (step === "waiting") return (
    <Screen>
      <div style={{ textAlign: "center" as const, padding: "2rem 0" }}>
        <div style={{ width: 72, height: 72, background: "#fffbeb", borderRadius: 20, display: "flex" as const, alignItems: "center" as const, justifyContent: "center" as const, margin: "0 auto 1.25rem" }}>
          <Loader2 style={{ width: 32, height: 32, color: "#f59e0b", animation: "spin 1s linear infinite" }} />
        </div>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#111827", marginBottom: 6 }}>
          {isReturning ? "Welcome back!" : "Request Submitted"}
        </h2>
        <p style={{ color: "#6b7280", fontSize: "0.9rem", marginBottom: "1.5rem", lineHeight: 1.6 }}>
          Your check-in request has been sent.<br />Please wait at the front desk for approval.
        </p>
        {hostIsOther && (
          <div style={{ padding: "10px 16px", background: "#fefce8", border: "1px solid #fde68a", borderRadius: 10, marginBottom: 12 }}>
            <p style={{ fontSize: "0.82rem", color: "#92400e", fontWeight: 500 }}>
              The receptionist will assign your host — please stay at the front desk.
            </p>
          </div>
        )}
        <div style={{ display: "flex" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 8, padding: "12px 20px", background: "#fffbeb", borderRadius: 12, border: "1px solid #fde68a" }}>
          <Clock style={{ width: 16, height: 16, color: "#d97706" }} />
          <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "#92400e" }}>Waiting for approval...</span>
        </div>
        {isReturning && <p style={{ marginTop: 12, fontSize: "0.8rem", color: "#7c3aed", background: "#f5f3ff", padding: "8px 14px", borderRadius: 10 }}>✓ Recognized as a returning visitor</p>}
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </Screen>
  );

  if (step === "approved") return (
    <Screen>
      <StatusCard icon={<Check style={{ width: 40, height: 40, color: "#16a34a", strokeWidth: 3 }} />} bg="#f0fdf4" title="Welcome!" msg="Your entry has been approved. Please collect your visitor pass from the receptionist." green />
    </Screen>
  );

  if (step === "rejected") return (
    <Screen>
      <StatusCard icon={<XCircle style={{ width: 36, height: 36, color: "#dc2626" }} />} bg="#fef2f2" title="Entry Declined" msg="Please check at the front desk for assistance." red />
    </Screen>
  );

  return (
    <Screen>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#111827", marginBottom: 4 }}>Visitor Check-in</h1>
      <p style={{ color: "#9ca3af", fontSize: "0.85rem", marginBottom: "1.5rem" }}>Fill in your details below</p>

      <form onSubmit={handleSubmit} style={{ display: "flex" as const, flexDirection: "column" as const, gap: "1rem" }}>
        <div>
          <label style={LS}>Full Name *</label>
          <input type="text" value={form.full_name} onChange={e => f("full_name", e.target.value)}
            style={IS} placeholder="Muhammad Ali" required autoFocus />
        </div>

        <div>
          <label style={LS}>CNIC</label>
          <input type="text" value={form.cnic} onChange={e => f("cnic", formatCNICInput(e.target.value))}
            style={{ ...IS, borderColor: errors.cnic ? "#ef4444" : "#e5e7eb" }}
            placeholder="42201-1234567-1" inputMode="numeric" />
          {errors.cnic && <p style={{ color: "#ef4444", fontSize: "0.72rem", marginTop: 4 }}>{errors.cnic}</p>}
        </div>

        <div>
          <label style={LS}>Phone Number</label>
          <input type="tel" value={form.phone} onChange={e => handlePhone(e.target.value)}
            style={{ ...IS, borderColor: errors.phone ? "#ef4444" : "#e5e7eb" }}
            placeholder="+92XXXXXXXXXX" />
          {errors.phone && <p style={{ color: "#ef4444", fontSize: "0.72rem", marginTop: 4 }}>{errors.phone}</p>}
        </div>

        <div>
          <label style={LS}>Email</label>
          <input type="email" value={form.email} onChange={e => f("email", e.target.value.toLowerCase())}
            style={{ ...IS, borderColor: errors.email ? "#ef4444" : "#e5e7eb" }}
            placeholder="you@example.com" inputMode="email" />
          {errors.email && <p style={{ color: "#ef4444", fontSize: "0.72rem", marginTop: 4 }}>{errors.email}</p>}
        </div>

        <div>
          <label style={LS}>Company / Organization</label>
          <input type="text" value={form.company} onChange={e => f("company", e.target.value)} style={IS} placeholder="Optional" />
        </div>

        <div>
          <label style={LS}>Purpose of Visit</label>
          <select value={form.purpose} onChange={e => f("purpose", e.target.value)} style={IS}>
            <option value="">Select purpose...</option>
            {PURPOSE_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        {form.purpose === "other" && (
          <div>
            <label style={LS}>Please specify *</label>
            <input type="text" value={form.purpose_other} onChange={e => f("purpose_other", e.target.value)}
              style={{ ...IS, borderColor: errors.purpose_other ? "#ef4444" : "#e5e7eb" }}
              placeholder="Describe your purpose..." required />
            {errors.purpose_other && <p style={{ color: "#ef4444", fontSize: "0.72rem", marginTop: 4 }}>{errors.purpose_other}</p>}
          </div>
        )}
        {form.purpose === "interview" && <div><label style={LS}>Applied Position</label><input type="text" value={form.interview_position} onChange={e => f("interview_position", e.target.value)} style={IS} placeholder="Software Engineer" /></div>}
        {form.purpose === "contractor" && <>
          <div><label style={LS}>Contractor Company</label><input type="text" value={form.contractor_company} onChange={e => f("contractor_company", e.target.value)} style={IS} /></div>
          <div><label style={LS}>Designation</label><input type="text" value={form.contractor_designation} onChange={e => f("contractor_designation", e.target.value)} style={IS} /></div>
          <div><label style={LS}>Company Address</label><textarea value={form.contractor_address} onChange={e => f("contractor_address", e.target.value)} style={{ ...IS, resize: "none" as const }} rows={2} /></div>
        </>}
        {form.purpose === "delivery" && <div><label style={LS}>Delivery Company</label><input type="text" value={form.delivery_company} onChange={e => f("delivery_company", e.target.value)} style={IS} /></div>}
        {form.purpose === "official" && <>
          <div><label style={LS}>Department</label><input type="text" value={form.official_department} onChange={e => f("official_department", e.target.value)} style={IS} placeholder="FBR, NADRA..." /></div>
          <div><label style={LS}>Rank / Designation</label><input type="text" value={form.official_rank} onChange={e => f("official_rank", e.target.value)} style={IS} placeholder="Inspector" /></div>
        </>}
        {form.purpose === "vip" && <div><label style={LS}>Category</label><input type="text" value={form.vip_category} onChange={e => f("vip_category", e.target.value)} style={IS} placeholder="VIP / Client / Donor" /></div>}
        {form.purpose === "internal" && <div><label style={LS}>Department / Campus / Branch</label><input type="text" value={form.internal_department} onChange={e => f("internal_department", e.target.value)} style={IS} placeholder="e.g. Medical College, Campus B, Hospital" /></div>}

        {/* Host section — hidden for internal visits */}
        {form.purpose === "internal" ? (
          <div style={{ padding: "14px 16px", background: "#eff6ff", border: "2px solid #bfdbfe", borderRadius: 12 }}>
            <div style={{ display: "flex" as const, gap: 10, alignItems: "flex-start" as const }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#3b82f6", display: "flex" as const, alignItems: "center" as const, justifyContent: "center" as const, flexShrink: 0, marginTop: 1 }}>
                <span style={{ color: "white", fontSize: "0.65rem", fontWeight: 700 }}>i</span>
              </div>
              <div>
                <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#1e40af", marginBottom: 4 }}>Internal Visit — No Host Required</p>
                <p style={{ fontSize: "0.8rem", color: "#1d4ed8", lineHeight: 1.5 }}>
                  Since you are visiting from one of our affiliated campuses, colleges, or hospitals, no host is needed. The receptionist will verify your visit.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <label style={LS}>Meeting With *</label>
            {hostsLoading ? (
              <div style={{ ...IS, display: "flex" as const, alignItems: "center" as const, gap: 8, color: "#9ca3af" }}>
                <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
                <span style={{ fontSize: "0.85rem" }}>Loading hosts...</span>
              </div>
            ) : (
              <select
                value={hostIsOther ? "__other__" : form.host_id}
                onChange={e => handleHostChange(e.target.value)}
                style={IS}
                required
              >
                <option value="">Select person...</option>
                {hosts.map(h => (
                  <option key={h.id} value={h.id}>{h.name}{h.department ? ` — ${h.department}` : ""}</option>
                ))}
                <option value="__other__">Other (not in list)</option>
              </select>
            )}
            {hosts.length === 0 && !hostsLoading && (
              <p style={{ fontSize: "0.72rem", color: "#9ca3af", marginTop: 4 }}>
                No hosts available. Select "Other" and the receptionist will assign one.
              </p>
            )}
            {hostIsOther && (
              <div style={{ marginTop: 10, padding: "12px 14px", background: "#fffbeb", border: "2px solid #f59e0b", borderRadius: 10 }}>
                <div style={{ display: "flex" as const, gap: 8, alignItems: "flex-start" as const }}>
                  <AlertTriangle style={{ width: 16, height: 16, color: "#d97706", flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "#92400e", marginBottom: 2 }}>Host not in list</p>
                    <p style={{ fontSize: "0.78rem", color: "#78350f", lineHeight: 1.5 }}>
                      The receptionist will assign the correct employee during approval. Please stay at the front desk.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <button type="submit" disabled={loading || !form.full_name}
          style={{ padding: "14px", background: loading || !form.full_name ? "#d1d5db" : "#111827", color: "white", border: "none" as const, borderRadius: 14, fontSize: "0.95rem", fontWeight: 700, cursor: loading || !form.full_name ? "not-allowed" : "pointer", marginTop: 4 }}>
          {loading ? "Submitting..." : "Submit Check-in Request"}
        </button>
        <p style={{ textAlign: "center" as const, fontSize: "0.72rem", color: "#d1d5db", paddingBottom: 8 }}>
          Your data is used only for building security purposes.
        </p>
      </form>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </Screen>
  );
}

function StatusCard({ icon, bg, title, msg, green, red, children }: any) {
  return (
    <div style={{ textAlign: "center" as const, padding: "2.5rem 0" }}>
      <div style={{ width: 72, height: 72, background: bg, borderRadius: 20, display: "flex" as const, alignItems: "center" as const, justifyContent: "center" as const, margin: "0 auto 1.25rem" }}>{icon}</div>
      <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#111827", marginBottom: 8 }}>{title}</h2>
      <p style={{ color: "#6b7280", fontSize: "0.9rem", lineHeight: 1.6 }}>{msg}</p>
      {children}
    </div>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", display: "flex" as const, flexDirection: "column" as const }}>
      <div style={{ background: "white", borderBottom: "1px solid #f3f4f6", padding: "14px 20px", display: "flex" as const, alignItems: "center" as const, gap: 12, position: "sticky" as const, top: 0, zIndex: 10 }}>
        <div style={{ width: 32, height: 32, background: "#16a34a", borderRadius: 10, display: "flex" as const, alignItems: "center" as const, justifyContent: "center" as const }}>
          <Building2 style={{ width: 16, height: 16, color: "white" }} />
        </div>
        <div>
          <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#111827" }}>Visitor Check-in</p>
          <p style={{ fontSize: "0.72rem", color: "#9ca3af" }}>Front Desk</p>
        </div>
      </div>
      <div style={{ flex: 1, padding: "1.5rem 1.25rem", maxWidth: 480, margin: "0 auto", width: "100%" }}>{children}</div>
    </div>
  );
}
