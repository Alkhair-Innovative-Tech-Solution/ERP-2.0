"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Lock, User, AlertCircle, Eye, EyeOff,
  Users, Building2, LayoutGrid, Briefcase, Shield, ArrowRight,
} from "lucide-react";

export default function LoginPage() {
  const [employeeCode, setEmployeeCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { login } = useAuth();

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"}/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employee_code: employeeCode, password }),
        }
      );
      const data = await response.json();
      if (response.ok) {
        login(data.access_token, data.employee);
      } else {
        setError(data.detail || data.error || "Invalid credentials");
      }
    } catch {
      setError("Backend server se connection nahi ho paa raha.");
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    { icon: Building2,  label: "Institution Management", sub: "Multi-branch" },
    { icon: LayoutGrid, label: "Department Management",  sub: "Structured"   },
    { icon: Briefcase,  label: "Designation Management", sub: "Role-based"   },
    { icon: Users,      label: "Employee Management",    sub: "Full lifecycle"},
    { icon: Shield,     label: "Service Access Control", sub: "Permissions"  },
  ];

  const s = (delay: number) =>
    `transition-all duration-500 ease-out ${
      mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
    }` + ` [transition-delay:${delay}ms]`;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');

        @keyframes cardIn {
          from { opacity: 0; transform: translateY(24px) scale(.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1);   }
        }
        @keyframes shimmer {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        @keyframes dotPulse {
          0%, 80%, 100% { opacity: .25; transform: scale(.8); }
          40%           { opacity: 1;   transform: scale(1);   }
        }
        @keyframes spinRing {
          to { transform: rotate(360deg); }
        }

        .login-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: #f0f4f8;
          background-image:
            radial-gradient(circle at 20% 20%, rgba(10,65,116,.07) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(0,29,57,.05) 0%, transparent 50%);
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        /* ── card ── */
        .lc-card {
          width: 100%;
          max-width: 900px;
          display: flex;
          flex-direction: column;
          background: #fff;
          border-radius: 20px;
          overflow: hidden;
          box-shadow:
            0 0 0 1px rgba(0,0,0,.06),
            0 8px 24px rgba(0,29,57,.08),
            0 32px 64px rgba(0,29,57,.06);
          animation: cardIn .55s cubic-bezier(.22,1,.36,1) both;
          position: relative;
        }
        /* top accent bar */
        .lc-card::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 2px; z-index: 10;
          background: linear-gradient(90deg, #001D39 0%, #0A4174 30%, #49769F 55%, #7BBDE8 75%, #49769F 90%, #001D39 100%);
          background-size: 200% auto;
          animation: shimmer 4s linear infinite;
        }

        /* ── LEFT panel ── */
        .lc-left {
          background: #001D39;
          padding: 40px 32px;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
        }
        /* dot grid */
        .lc-left::before {
          content: '';
          position: absolute; inset: 0; pointer-events: none;
          background-image: radial-gradient(rgba(255,255,255,.055) 1.5px, transparent 1.5px);
          background-size: 28px 28px;
        }
        /* bottom glow */
        .lc-left::after {
          content: '';
          position: absolute; bottom: -60px; right: -60px;
          width: 240px; height: 240px; border-radius: 50%;
          background: radial-gradient(circle, rgba(73,118,159,.25) 0%, transparent 70%);
          pointer-events: none;
        }

        .lc-logo {
          display: flex; align-items: center; gap: 10px;
          position: relative; z-index: 1;
        }
        .lc-logo-icon {
          width: 36px; height: 36px; border-radius: 10px;
          background: #49769F;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 12px rgba(73,118,159,.4);
          flex-shrink: 0;
        }
        .lc-logo-text {
          font-size: 14px; font-weight: 800; color: #fff; letter-spacing: .04em;
        }

        .lc-headline {
          margin-top: 32px;
          position: relative; z-index: 1;
        }
        .lc-headline h2 {
          font-size: 26px; font-weight: 900; color: #fff; line-height: 1.2;
          letter-spacing: -.02em;
        }
        .lc-headline p {
          margin-top: 8px; font-size: 13px; color: rgba(189,216,233,.65);
          line-height: 1.6; max-width: 260px;
        }

        /* divider */
        .lc-divider {
          margin: 24px 0; height: 1px;
          background: rgba(255,255,255,.08);
          position: relative; z-index: 1;
        }

        /* feature nav items — same style as sidebar nav */
        .lc-features { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 4px; }
        .lc-feat {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px; border-radius: 12px;
          background: rgba(255,255,255,.05);
          border: 1px solid rgba(255,255,255,.07);
          transition: background .2s, transform .2s;
          cursor: default;
        }
        .lc-feat:hover {
          background: rgba(255,255,255,.10);
          transform: translateX(3px);
        }
        .lc-feat-icon {
          width: 28px; height: 28px; border-radius: 8px;
          background: rgba(73,118,159,.35);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .lc-feat-label { font-size: 12.5px; font-weight: 600; color: #fff; }
        .lc-feat-sub   { font-size: 10.5px; color: rgba(123,189,232,.55); margin-left: auto; }

        /* bottom tagline */
        .lc-tagline {
          margin-top: auto; padding-top: 28px;
          position: relative; z-index: 1;
          font-size: 10.5px; font-weight: 600;
          color: rgba(189,216,233,.3);
          text-transform: uppercase; letter-spacing: .1em;
        }

        /* ── RIGHT panel ── */
        .lc-right {
          flex: 1;
          padding: 40px 36px 44px;
          display: flex; flex-direction: column; justify-content: center;
          background: #fff;
        }

        .lc-title { margin-bottom: 28px; }
        .lc-title h1 {
          font-size: 26px; font-weight: 900;
          color: #001D39; letter-spacing: -.025em; line-height: 1.15;
        }
        .lc-title p {
          margin-top: 5px; font-size: 13px; color: #94a3b8; font-weight: 500;
        }

        /* field wrapper */
        .lc-field { display: flex; flex-direction: column; gap: 6px; }
        .lc-label {
          font-size: 12px; font-weight: 700;
          color: #64748b; text-transform: uppercase; letter-spacing: .07em;
        }
        .lc-input-wrap { position: relative; }
        .lc-input-icon {
          position: absolute; left: 13px; top: 50%; transform: translateY(-50%);
          color: #94a3b8; pointer-events: none;
          display: flex; align-items: center;
          transition: color .2s;
        }
        .lc-input {
          width: 100%; height: 46px;
          padding-left: 40px; padding-right: 14px;
          border-radius: 10px;
          border: 1.5px solid #e2e8f0;
          background: #f8fafc;
          font-size: 14px; font-weight: 500; color: #0f172a;
          font-family: inherit;
          outline: none;
          transition: border-color .2s, background .2s, box-shadow .2s;
        }
        .lc-input::placeholder { color: #cbd5e1; font-weight: 400; font-size: 13px; }
        .lc-input:focus {
          border-color: #0A4174;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(10,65,116,.09);
        }
        .lc-input:focus ~ .lc-input-icon,
        .lc-input-wrap:focus-within .lc-input-icon { color: #0A4174; }

        /* password eye */
        .lc-eye {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          background: none; border: none; padding: 4px;
          color: #94a3b8; cursor: pointer; border-radius: 6px;
          display: flex; align-items: center;
          transition: color .2s, background .2s;
        }
        .lc-eye:hover { color: #0A4174; background: #f1f5f9; }

        /* error */
        .lc-error {
          display: flex; align-items: flex-start; gap: 8px;
          background: #fef2f2; border: 1.5px solid #fecaca;
          color: #dc2626; font-size: 12.5px; font-weight: 500;
          border-radius: 10px; padding: 10px 12px;
        }

        /* submit button */
        .lc-btn {
          width: 100%; height: 46px; border: none; border-radius: 10px;
          background: #0A4174; color: #fff;
          font-size: 14.5px; font-weight: 800; font-family: inherit;
          letter-spacing: .02em;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(10,65,116,.3);
          transition: background .2s, transform .15s, box-shadow .2s;
          position: relative; overflow: hidden;
        }
        .lc-btn::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,.12) 0%, transparent 60%);
          pointer-events: none;
        }
        .lc-btn:hover:not(:disabled) {
          background: #49769F;
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(10,65,116,.28);
        }
        .lc-btn:active:not(:disabled) { transform: translateY(0); }
        .lc-btn:disabled { opacity: .65; cursor: not-allowed; }

        /* dot loader */
        .lc-dots { display: flex; align-items: center; gap: 5px; }
        .lc-dots span {
          width: 5px; height: 5px; border-radius: 50%; background: #fff;
          animation: dotPulse 1.3s ease-in-out infinite;
          display: inline-block;
        }
        .lc-dots span:nth-child(2) { animation-delay: .15s; }
        .lc-dots span:nth-child(3) { animation-delay: .3s;  }

        /* ── breakpoints ── */
        @media (min-width: 680px) {
          .lc-card { flex-direction: row; min-height: 560px; }
          .lc-left { width: 42%; flex-shrink: 0; }
          .lc-right { padding: 52px 48px; }
        }
      `}</style>

      <div className="login-root">
        <div className="lc-card">

          {/* ═══ LEFT ═══ */}
          <div className="lc-left">

            {/* Logo — matches sidebar exactly */}
            <div className={`lc-logo ${s(0)}`}>
              <div className="lc-logo-icon">
                <Users size={18} color="#fff" />
              </div>
              <span className="lc-logo-text">EMS Dashboard</span>
            </div>

            {/* Headline */}
            <div className={`lc-headline ${s(80)}`}>
              <h2>Employee Management System</h2>
              <p>Manage your workforce, departments, and organizational structure from one unified platform.</p>
            </div>

            <div className={`lc-divider ${s(140)}`} />

            {/* Feature list — same spirit as sidebar nav */}
            <div className="lc-features">
              {features.map(({ icon: Icon, label, sub }, i) => (
                <div key={label} className={`lc-feat ${s(180 + i * 50)}`}>
                  <div className="lc-feat-icon">
                    <Icon size={13} color="#7BBDE8" />
                  </div>
                  <span className="lc-feat-label">{label}</span>
                  <span className="lc-feat-sub">{sub}</span>
                </div>
              ))}
            </div>

            <div className={`lc-tagline ${s(480)}`}>
              Idara al-Khair NGO · ERP Suite
            </div>
          </div>

          {/* ═══ RIGHT ═══ */}
          <div className="lc-right">

            <div className={`lc-title ${s(60)}`}>
              <h1>Welcome Back</h1>
              <p>Sign in with your employee credentials</p>
            </div>

            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Error */}
              {error && (
                <div className="lc-error">
                  <AlertCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              {/* Employee Code */}
              <div className={`lc-field ${s(160)}`}>
                <label className="lc-label">Employee Code</label>
                <div className="lc-input-wrap">
                  <span className="lc-input-icon"><User size={15} /></span>
                  <input
                    type="text"
                    required
                    value={employeeCode}
                    onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
                    placeholder="e.g. AIT01-G-26-T-0001"
                    className="lc-input"
                    style={{ textTransform: "uppercase" }}
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Password */}
              <div className={`lc-field ${s(220)}`}>
                <label className="lc-label">Password</label>
                <div className="lc-input-wrap">
                  <span className="lc-input-icon"><Lock size={15} /></span>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="lc-input"
                    style={{ paddingRight: 44 }}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="lc-eye"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <div className={s(300)} style={{ marginTop: 4 }}>
                <button type="submit" disabled={isLoading} className="lc-btn">
                  {isLoading ? (
                    <div className="lc-dots"><span /><span /><span /></div>
                  ) : (
                    <>
                      Log In
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>

        </div>
      </div>
    </>
  );
}
