"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.password) return;
    setLoading(true);
    try {
      const data = await login(form.username, form.password);
      if (data.warning) {
        toast(data.warning, { icon: "⚠️", duration: 6000, style: { background: "#2a2200", color: "#f59e0b", border: "1px solid #78350f" } });
      }
      router.push("/dashboard");
    } catch {
      toast.error("Invalid credentials or no VMS access");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0908", display: "flex", position: "relative", overflow: "hidden" }}>
      {/* Background decoration */}
      <div style={{ position: "absolute", top: -200, right: -200, width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, #6366f122 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -300, left: -200, width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle, #8b5cf611 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Left branding panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "4rem", borderRight: "1px solid #1e1c19" }}>
        <div style={{ maxWidth: 420 }}>
          <div style={{ width: 48, height: 48, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", borderRadius: "1rem", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "2rem" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/>
            </svg>
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.5rem", fontWeight: 800, color: "white", margin: "0 0 1rem", lineHeight: 1.1 }}>
            Visitor<br />Management
          </h1>
          <p style={{ color: "#514e48", fontSize: "1rem", lineHeight: 1.6, margin: 0 }}>
            Complete front desk solution — track visitors, manage check-ins, and keep your building secure.
          </p>

          <div style={{ marginTop: "3rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            {[
              { icon: "🔍", text: "Duplicate visitor detection" },
              { icon: "📱", text: "QR code self check-in" },
              { icon: "⚡", text: "Real-time approval notifications" },
            ].map(({ icon, text }) => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "1.125rem" }}>{icon}</span>
                <span style={{ color: "#6b6760", fontSize: "0.875rem" }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right login panel */}
      <div style={{ width: 440, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div style={{ width: "100%", maxWidth: 360 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.625rem", fontWeight: 700, color: "white", margin: "0 0 0.375rem" }}>Sign in</h2>
          <p style={{ color: "#514e48", fontSize: "0.875rem", margin: "0 0 2rem" }}>Front desk access only</p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, color: "#6b6760", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Username</label>
              <input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="receptionist" autoFocus
                style={{ width: "100%", padding: "0.75rem 1rem", background: "#141310", border: "1px solid #2a2825", borderRadius: "0.75rem", fontSize: "0.9rem", color: "white", outline: "none", fontFamily: "var(--font-body)", boxSizing: "border-box" }}
                onFocus={(e) => e.target.style.borderColor = "#6366f1"}
                onBlur={(e) => e.target.style.borderColor = "#2a2825"}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, color: "#6b6760", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Password</label>
              <div style={{ position: "relative" }}>
                <input type={showPw ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  style={{ width: "100%", padding: "0.75rem 3rem 0.75rem 1rem", background: "#141310", border: "1px solid #2a2825", borderRadius: "0.75rem", fontSize: "0.9rem", color: "white", outline: "none", fontFamily: "var(--font-body)", boxSizing: "border-box" }}
                  onFocus={(e) => e.target.style.borderColor = "#6366f1"}
                  onBlur={(e) => e.target.style.borderColor = "#2a2825"}
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#514e48", display: "flex", padding: 0 }}>
                  {showPw ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading || !form.username || !form.password}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                width: "100%", padding: "0.8125rem", marginTop: "0.5rem",
                background: loading ? "#3730a3" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: "white", fontWeight: 600, fontSize: "0.9rem",
                border: "none", borderRadius: "0.75rem", cursor: loading ? "not-allowed" : "pointer",
                opacity: (!form.username || !form.password) ? 0.5 : 1,
                transition: "all 0.2s",
              }}>
              {loading ? "Signing in..." : <><span>Sign in</span><ArrowRight style={{ width: 16, height: 16 }} /></>}
            </button>
          </form>

          <div style={{ marginTop: "1.5rem", padding: "0.875rem", background: "#141310", borderRadius: "0.75rem", border: "1px solid #1e1c19" }}>
            <p style={{ fontSize: "0.7rem", color: "#514e48", margin: "0 0 0.375rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Demo credentials</p>
            <p style={{ fontSize: "0.8125rem", color: "#6b6760", margin: 0, fontFamily: "var(--font-mono)" }}>receptionist / reception123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
