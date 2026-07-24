"use client";
import { useState, useEffect } from "react";
import { scheduleVisit, getHosts } from "@/lib/api";
import { Host, PURPOSE_OPTIONS, PurposeType } from "@/lib/types";
import { formatCNICInput, validateCNIC, validatePhonePakistan, cleanPhone } from "@/lib/utils";
import toast from "react-hot-toast";
import { CalendarClock, Copy, Check } from "lucide-react";

export default function SchedulePage() {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ visiting_id: string; visitor_name: string; scheduled_at: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    full_name: "", cnic: "", phone: "", email: "",
    company: "", host_id: "", host_name_manual: "",
    purpose: "" as PurposeType | "", purpose_other: "",
    interview_position: "",
    contractor_company: "", contractor_designation: "", contractor_address: "",
    delivery_company: "",
    official_department: "", official_rank: "",
    vip_category: "",
    internal_department: "",
    scheduled_at: "",
  });

  useEffect(() => { getHosts().then(setHosts).catch(() => {}); }, []);

  // Get minimum date (today) for datetime-local input
  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  const handleCNICChange = (value: string) => {
    const formatted = formatCNICInput(value);
    setForm({ ...form, cnic: formatted });
  };

  const handlePurposeChange = (value: PurposeType) => {
    setForm({ ...form, purpose: value, purpose_other: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.scheduled_at) return toast.error("Name and date are required");
    
    const cnicError = validateCNIC(form.cnic);
    if (cnicError) return toast.error(cnicError);
    
    const phoneError = validatePhonePakistan(form.phone);
    if (phoneError) return toast.error(phoneError);

    if (form.purpose === "other" && !form.purpose_other) {
      return toast.error("Please specify the purpose of visit");
    }

    // Check future date
    const scheduledDate = new Date(form.scheduled_at);
    if (scheduledDate <= new Date()) {
      return toast.error("Scheduled date must be in the future");
    }

    setLoading(true);
    try {
      const scheduleData: Record<string, unknown> = {
        full_name: form.full_name,
        cnic: form.cnic,
        phone: form.phone ? cleanPhone(form.phone) : "",
        email: form.email.toLowerCase(),
        company: form.company,
        purpose: form.purpose || undefined,
        purpose_other: form.purpose === "other" ? form.purpose_other : undefined,
        scheduled_at: form.scheduled_at,
      };

      // Add condition-based fields
      if (form.purpose === "interview") {
        scheduleData.interview_position = form.interview_position;
      } else if (form.purpose === "contractor") {
        scheduleData.contractor_company = form.contractor_company;
        scheduleData.contractor_designation = form.contractor_designation;
        scheduleData.contractor_address = form.contractor_address;
      } else if (form.purpose === "delivery") {
        scheduleData.delivery_company = form.delivery_company;
      } else if (form.purpose === "official") {
        scheduleData.official_department = form.official_department;
        scheduleData.official_rank = form.official_rank;
      } else if (form.purpose === "vip") {
        scheduleData.vip_category = form.vip_category;
      } else if (form.purpose === "internal") {
        if (form.internal_department) scheduleData.internal_department = form.internal_department;
      }

      // Host handling
      if (form.host_id) {
        scheduleData.host_id = form.host_id;
      } else if (form.host_name_manual) {
        scheduleData.host_name_manual = form.host_name_manual;
      }

      const data = await scheduleVisit(scheduleData);
      setResult(data);
      toast.success("Visit scheduled!");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to schedule");
    } finally {
      setLoading(false);
    }
  };

  const copyId = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.visiting_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (result) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="card p-10 text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CalendarClock className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-ink-900 mb-1" style={{ fontFamily: "var(--font-display)" }}>
            Visit Scheduled
          </h2>
          <p className="text-ink-500 text-sm mb-4">{result.visitor_name}</p>
          <div className="bg-ink-50 rounded-xl p-4 mb-6">
            <p className="text-xs text-ink-400 mb-1">Visiting ID</p>
            <p className="text-2xl font-bold text-ink-900 font-mono tracking-widest">{result.visiting_id}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={copyId} className="btn-secondary flex-1 justify-center">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy ID"}
            </button>
            <button onClick={() => setResult(null)} className="btn-primary flex-1 justify-center">
              New Schedule
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900" style={{ fontFamily: "var(--font-display)" }}>Schedule Visit</h1>
        <p className="text-ink-400 text-sm mt-0.5">Pre-register a future visitor — they'll get a visiting ID for fast entry</p>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Full Name *</label>
              <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="input" placeholder="Visitor's full name" required />
            </div>
            <div>
              <label className="label">CNIC</label>
              <input type="text" value={form.cnic} onChange={(e) => handleCNICChange(e.target.value)} className="input" placeholder="42201-1234567-1" maxLength={15} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" placeholder="0300-1234567" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value.toLowerCase() })} className="input" placeholder="visitor@example.com" />
            </div>
            <div>
              <label className="label">Company</label>
              <input type="text" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="input" placeholder="Company name" />
            </div>
          </div>

          <div>
            <label className="label">Purpose of Visit</label>
            <select value={form.purpose} onChange={(e) => handlePurposeChange(e.target.value as PurposeType)} className="input">
              <option value="">Select purpose...</option>
              {PURPOSE_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Condition-based fields */}
          {form.purpose === "other" && (
            <div>
              <label className="label">Specify Purpose *</label>
              <input type="text" value={form.purpose_other} onChange={(e) => setForm({ ...form, purpose_other: e.target.value })} className="input" placeholder="Please describe the purpose of your visit" required />
            </div>
          )}
          {form.purpose === "interview" && (
            <div>
              <label className="label">Position Applied For</label>
              <input type="text" value={form.interview_position} onChange={(e) => setForm({ ...form, interview_position: e.target.value })} className="input" placeholder="e.g. Software Engineer" />
            </div>
          )}
          {form.purpose === "contractor" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Company Name</label>
                  <input type="text" value={form.contractor_company} onChange={(e) => setForm({ ...form, contractor_company: e.target.value })} className="input" placeholder="Company name" />
                </div>
                <div>
                  <label className="label">Designation</label>
                  <input type="text" value={form.contractor_designation} onChange={(e) => setForm({ ...form, contractor_designation: e.target.value })} className="input" placeholder="e.g. Worker, Supervisor" />
                </div>
              </div>
              <div>
                <label className="label">Company Address</label>
                <textarea value={form.contractor_address} onChange={(e) => setForm({ ...form, contractor_address: e.target.value })} className="input resize-none" rows={2} placeholder="Full company address" />
              </div>
            </div>
          )}
          {form.purpose === "delivery" && (
            <div>
              <label className="label">Delivery/Courier Company</label>
              <input type="text" value={form.delivery_company} onChange={(e) => setForm({ ...form, delivery_company: e.target.value })} className="input" placeholder="e.g. TCS, Leopards, Trax" />
            </div>
          )}
          {form.purpose === "official" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Department/Organization</label>
                <input type="text" value={form.official_department} onChange={(e) => setForm({ ...form, official_department: e.target.value })} className="input" placeholder="e.g. Any department/organization" />
              </div>
              <div>
                <label className="label">Rank/Designation</label>
                <input type="text" value={form.official_rank} onChange={(e) => setForm({ ...form, official_rank: e.target.value })} className="input" placeholder="e.g. Officer, Manager" />
              </div>
            </div>
          )}
          {form.purpose === "vip" && (
            <div>
              <label className="label">Category</label>
              <input type="text" value={form.vip_category} onChange={(e) => setForm({ ...form, vip_category: e.target.value })} className="input" placeholder="e.g. VIP, Client, Donor" />
            </div>
          )}
          {form.purpose === "internal" && (
            <div>
              <label className="label">Department</label>
              <input type="text" value={form.internal_department} onChange={(e) => setForm({ ...form, internal_department: e.target.value })} className="input" placeholder="e.g. HR, IT, Administration" />
            </div>
          )}

          <div>
            <label className="label">Host</label>
            <select value={form.host_id} onChange={(e) => setForm({ ...form, host_id: e.target.value })} className="input">
              <option value="">Select host...</option>
              <option value="__other__">Other (specify manually)</option>
              {hosts.map((h) => (
                <option key={h.id} value={h.id}>{h.name} — {h.department}</option>
              ))}
            </select>
            {form.host_id === "__other__" && (
              <input
                type="text"
                value={form.host_name_manual}
                onChange={(e) => setForm({ ...form, host_id: "", host_name_manual: e.target.value })}
                className="input mt-2"
                placeholder="Type host name manually"
              />
            )}
          </div>

          <div>
            <label className="label">Date & Time *</label>
            <input
              type="datetime-local"
              value={form.scheduled_at}
              onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
              className="input"
              min={getMinDateTime()}
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
            <CalendarClock className="w-4 h-4" />
            {loading ? "Scheduling..." : "Schedule Visit"}
          </button>
        </form>
      </div>
    </div>
  );
}
