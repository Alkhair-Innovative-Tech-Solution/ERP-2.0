"use client";
import { useState, useEffect } from "react";
import { receptionistEntry, scheduledEntry, searchVisitor, getHosts, getEmployees, checkDuplicate } from "@/lib/api";
import { Host, Visitor, Employee, PURPOSE_OPTIONS, PurposeType } from "@/lib/types";
import { formatCNICInput, validateCNIC, validatePhonePakistan, cleanPhone } from "@/lib/utils";
import toast from "react-hot-toast";
import { Search, UserPlus, Hash, Check, AlertTriangle, Users, Building2, CreditCard } from "lucide-react";

type Mode = "manual" | "scheduled";

export default function EntryPage() {
  const [mode, setMode] = useState<Mode>("manual");
  const [hosts, setHosts] = useState<Host[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<Visitor[]>([]);
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ visitId?: string; name: string } | null>(null);
  const [showBlacklistAlert, setShowBlacklistAlert] = useState(false);
  const [duplicates, setDuplicates] = useState<Visitor[]>([]);

  const [showEmployeeSearch, setShowEmployeeSearch] = useState(false);
  const [employeeSearchQ, setEmployeeSearchQ] = useState("");
  const [employeeResults, setEmployeeResults] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const [form, setForm] = useState({
    full_name: "", cnic: "", phone: "", email: "",
    company: "", host_id: "", host_name_manual: "",
    purpose: "" as PurposeType | "", purpose_other: "",
    interview_position: "",
    contractor_company: "", contractor_designation: "", contractor_address: "",
    delivery_company: "", official_department: "", official_rank: "",
    vip_category: "", internal_department: "", expected_checkout_at: "", notes: "",
  });

  const [visitingId, setVisitingId] = useState("");

  useEffect(() => { getHosts().then(setHosts).catch(() => {}); }, []);

  useEffect(() => {
    if (employeeSearchQ.length < 2) { setEmployeeResults([]); return; }
    const t = setTimeout(async () => {
      try { setEmployeeResults(await getEmployees(employeeSearchQ)); } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [employeeSearchQ]);

  useEffect(() => {
    if (searchQ.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const data = await searchVisitor(searchQ);
        setSearchResults(data.results || []);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ]);

  useEffect(() => {
    if (!form.cnic && !form.phone && !form.email) { setDuplicates([]); return; }
    const t = setTimeout(async () => {
      try {
        const result = await checkDuplicate({
          cnic: form.cnic, phone: form.phone, email: form.email,
          exclude_visitor_id: selectedVisitor?.id,
        });
        setDuplicates(result.duplicates || []);
      } catch {}
    }, 500);
    return () => clearTimeout(t);
  }, [form.cnic, form.phone, form.email, selectedVisitor?.id]);

  const fillFromVisitor = (v: Visitor) => {
    if (v.is_blacklisted) { setShowBlacklistAlert(true); return; }
    setSelectedVisitor(v);
    setForm(f => ({ ...f, full_name: v.full_name, cnic: v.cnic || "", phone: v.phone || "", email: v.email || "", company: v.company || "" }));
    setSearchQ(""); setSearchResults([]);
  };

  const selectEmployee = (emp: Employee) => {
    setSelectedEmployee(emp);
    setEmployeeSearchQ(`${emp.name} — ${emp.designation} (${emp.department})`);
    setEmployeeResults([]);
    setForm(f => ({ ...f, host_id: "__employee__", host_name_manual: "" }));
  };

  const resetForm = () => {
    setForm({ full_name: "", cnic: "", phone: "", email: "", company: "", host_id: "", host_name_manual: "", purpose: "", purpose_other: "", interview_position: "", contractor_company: "", contractor_designation: "", contractor_address: "", delivery_company: "", official_department: "", official_rank: "", vip_category: "", internal_department: "", expected_checkout_at: "", notes: "" });
    setSelectedVisitor(null); setDuplicates([]);
    setShowEmployeeSearch(false); setSelectedEmployee(null); setEmployeeSearchQ(""); setEmployeeResults([]);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name) return toast.error("Name is required");
    const cnicError = validateCNIC(form.cnic);
    if (cnicError) return toast.error(cnicError);
    const phoneError = validatePhonePakistan(form.phone);
    if (phoneError) return toast.error(phoneError);
    if (!form.expected_checkout_at) return toast.error("Expected checkout time is required");
    if (form.purpose === "other" && !form.purpose_other) return toast.error("Please specify the purpose");

    const payload: Record<string, unknown> = {
      full_name: form.full_name,
      cnic: form.cnic || undefined,
      phone: form.phone ? cleanPhone(form.phone) : undefined,
      email: form.email.toLowerCase() || undefined,
      company: form.company || undefined,
      purpose: form.purpose || undefined,
      purpose_other: form.purpose === "other" ? form.purpose_other : undefined,
      expected_checkout_at: form.expected_checkout_at,
      notes: form.notes || undefined,
    };

    if (form.purpose === "interview") payload.interview_position = form.interview_position;
    if (form.purpose === "contractor") { payload.contractor_company = form.contractor_company; payload.contractor_designation = form.contractor_designation; payload.contractor_address = form.contractor_address; }
    if (form.purpose === "delivery") payload.delivery_company = form.delivery_company;
    if (form.purpose === "official") { payload.official_department = form.official_department; payload.official_rank = form.official_rank; }
    if (form.purpose === "vip") payload.vip_category = form.vip_category;

    if (form.purpose === "internal" && form.internal_department) {
      payload.internal_department = form.internal_department;
    }

    if (form.purpose !== "internal") {
      if (form.host_id && form.host_id !== "__employee__") payload.host_id = form.host_id;
      else if (form.host_id === "__employee__" && selectedEmployee) payload.employee_host_id = selectedEmployee.id;
      else if (form.host_name_manual) payload.host_name_manual = form.host_name_manual;
    }

    setLoading(true);
    try {
      const data = await receptionistEntry(payload);
      setSuccess({ visitId: data.visit_id, name: form.full_name });
      toast.success(`${form.full_name} checked in!`);
      resetForm();
    } catch (err: any) {
      const msg = err.response?.data?.non_field_errors?.[0] || err.response?.data?.error || "Entry failed";
      if (msg.toLowerCase().includes("blacklist")) setShowBlacklistAlert(true);
      else toast.error(msg);
    } finally { setLoading(false); }
  };

  const handleScheduledSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitingId) return toast.error("Visiting ID required");
    setLoading(true);
    try {
      const data = await scheduledEntry(visitingId);
      setSuccess({ name: data.visitor_name });
      toast.success(data.message);
      setVisitingId("");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Invalid visiting ID");
    } finally { setLoading(false); }
  };

  if (showBlacklistAlert) return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <div className="card p-10 text-center max-w-sm w-full border-2 border-rose-500 bg-rose-50">
        <div className="w-16 h-16 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-rose-600" />
        </div>
        <h2 className="text-xl font-bold text-rose-900 mb-1">RED ALERT</h2>
        <p className="text-rose-700 text-sm mb-6">This visitor is blacklisted and not permitted entry.</p>
        <button onClick={() => setShowBlacklistAlert(false)} className="btn-primary">Go Back</button>
      </div>
    </div>
  );

  if (success) return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <div className="card p-10 text-center max-w-sm w-full">
        <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-ink-900 mb-1">Entry Granted</h2>
        <p className="text-ink-500 text-sm mb-6">{success.name} has been checked in.</p>
        {success.visitId && (
          <a
            href={`/dashboard/visitor-card?visitId=${success.visitId}`}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary mb-3 flex items-center gap-2 justify-center w-full"
          >
            <CreditCard className="w-4 h-4" /> View Visitor Card
          </a>
        )}
        <button onClick={() => setSuccess(null)} className="btn-primary w-full justify-center">
          <UserPlus className="w-4 h-4" /> New Entry
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900" style={{ fontFamily: "var(--font-display)" }}>New Entry</h1>
        <p className="text-ink-400 text-sm mt-0.5">Register a walk-in visitor or process a scheduled visit</p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-6 p-1 bg-ink-100 rounded-xl w-fit">
        {([ ["manual", "Manual Entry", UserPlus], ["scheduled", "Visiting ID", Hash] ] as const).map(([m, label, Icon]) => (
          <button key={m} onClick={() => setMode(m)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === m ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"}`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {mode === "manual" && (
        <div className="card p-6">
          {/* Search existing visitor */}
          <div className="mb-5 pb-5 border-b border-ink-100">
            <label className="label">Search Existing Visitor</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
              <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)}
                placeholder="Search by name, CNIC, or phone..." className="input pl-9" />
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 bg-white border border-ink-200 rounded-xl overflow-hidden shadow-lg">
                {searchResults.map(v => (
                  <button key={v.id} onClick={() => fillFromVisitor(v)}
                    className="flex items-center gap-3 w-full px-4 py-3 hover:bg-ink-50 text-left transition-colors border-b border-ink-100 last:border-0">
                    <div className="w-8 h-8 rounded-lg bg-ink-100 flex items-center justify-center text-xs font-semibold text-ink-600">
                      {v.full_name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink-900">{v.full_name}</p>
                      <p className="text-xs text-ink-400">{v.cnic || v.phone || v.email} · {v.visit_count}× visits</p>
                    </div>
                    {selectedVisitor?.id === v.id && <Check className="w-4 h-4 text-green-600 ml-auto" />}
                  </button>
                ))}
              </div>
            )}
            {selectedVisitor && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200">
                <Check className="w-3.5 h-3.5 text-green-600" />
                <span className="text-xs text-green-700 font-medium">Returning visitor — {selectedVisitor.visit_count}× previous visits</span>
                <button onClick={() => { setSelectedVisitor(null); setForm(f => ({ ...f, full_name: "", cnic: "", phone: "", email: "", company: "" })); }}
                  className="ml-auto text-green-500 hover:text-green-700 text-xs">Clear</button>
              </div>
            )}
          </div>

          {/* Duplicate warning */}
          {duplicates.length > 0 && (
            <div className="mb-4 p-4 bg-amber-50 border-2 border-amber-300 rounded-lg">
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-800">⚠ Similar visitor(s) found</p>
                  {duplicates.map(d => (
                    <p key={d.id} className="text-xs text-amber-700 mt-1">{d.full_name} · {d.cnic || d.phone} · {d.visit_count}× visits</p>
                  ))}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleManualSubmit} className="space-y-4">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Full Name *</label>
                <input type="text" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className="input" placeholder="Muhammad Ali" required />
              </div>
              <div>
                <label className="label">CNIC</label>
                <input type="text" value={form.cnic} onChange={e => setForm(f => ({ ...f, cnic: formatCNICInput(e.target.value) }))} className="input" placeholder="42201-1234567-1" maxLength={15} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="input" placeholder="0300-1234567" />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value.toLowerCase() }))} className="input" placeholder="ali@example.com" />
              </div>
              <div>
                <label className="label">Company</label>
                <input type="text" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} className="input" placeholder="ABC Corp" />
              </div>
            </div>

            {/* Purpose */}
            <div>
              <label className="label">Purpose of Visit</label>
              <select value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value as PurposeType, purpose_other: "" }))} className="input">
                <option value="">Select purpose...</option>
                {PURPOSE_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>

            {form.purpose === "other" && (
              <div>
                <label className="label">Specify Purpose *</label>
                <input type="text" value={form.purpose_other} onChange={e => setForm(f => ({ ...f, purpose_other: e.target.value }))} className="input" required />
              </div>
            )}
            {form.purpose === "interview" && (
              <div>
                <label className="label">Position Applied For</label>
                <input type="text" value={form.interview_position} onChange={e => setForm(f => ({ ...f, interview_position: e.target.value }))} className="input" placeholder="e.g. Software Engineer" />
              </div>
            )}
            {form.purpose === "contractor" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Company Name</label><input type="text" value={form.contractor_company} onChange={e => setForm(f => ({ ...f, contractor_company: e.target.value }))} className="input" /></div>
                  <div><label className="label">Designation</label><input type="text" value={form.contractor_designation} onChange={e => setForm(f => ({ ...f, contractor_designation: e.target.value }))} className="input" /></div>
                </div>
                <div><label className="label">Company Address</label><textarea value={form.contractor_address} onChange={e => setForm(f => ({ ...f, contractor_address: e.target.value }))} className="input resize-none" rows={2} /></div>
              </div>
            )}
            {form.purpose === "delivery" && (
              <div><label className="label">Delivery Company</label><input type="text" value={form.delivery_company} onChange={e => setForm(f => ({ ...f, delivery_company: e.target.value }))} className="input" placeholder="e.g. TCS, Leopards" /></div>
            )}
            {form.purpose === "official" && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Department / Organization</label><input type="text" value={form.official_department} onChange={e => setForm(f => ({ ...f, official_department: e.target.value }))} className="input" /></div>
                <div><label className="label">Rank / Designation</label><input type="text" value={form.official_rank} onChange={e => setForm(f => ({ ...f, official_rank: e.target.value }))} className="input" /></div>
              </div>
            )}
            {form.purpose === "vip" && (
              <div><label className="label">Category</label><input type="text" value={form.vip_category} onChange={e => setForm(f => ({ ...f, vip_category: e.target.value }))} className="input" placeholder="e.g. VIP, Client, Donor" /></div>
            )}

            {/* Host section — conditional on purpose */}
            {form.purpose === "internal" ? (
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-blue-800 mb-1">ℹ Internal Visit — No Host Required</p>
                  <p className="text-xs text-blue-600">Visitor is from an affiliated campus, college, or hospital.</p>
                </div>
                <div>
                  <label className="label">Department / Campus / Branch</label>
                  <input
                    type="text"
                    value={form.internal_department}
                    onChange={e => setForm(f => ({ ...f, internal_department: e.target.value }))}
                    placeholder="e.g. Medical College, Campus B, Hospital"
                    className="input"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="label">Host / Meeting With</label>
                  <select
                    value={form.host_id}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === "__other__") {
                        setShowEmployeeSearch(true);
                        setForm(f => ({ ...f, host_id: "", host_name_manual: "" }));
                        setSelectedEmployee(null);
                        setEmployeeSearchQ("");
                      } else {
                        setShowEmployeeSearch(false);
                        setForm(f => ({ ...f, host_id: val, host_name_manual: "" }));
                        setSelectedEmployee(null);
                      }
                    }}
                    className="input"
                  >
                    <option value="">Select host...</option>
                    {hosts.map(h => <option key={h.id} value={h.id}>{h.name} — {h.department}</option>)}
                    <option value="__other__">🔍 Other (Search Employee)</option>
                  </select>
                </div>

                {/* Employee search */}
                {showEmployeeSearch && (
                  <div className="p-4 bg-blue-50 border-2 border-blue-300 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      <h3 className="text-sm font-bold text-blue-900">Search Employee</h3>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                      <input
                        type="text"
                        value={employeeSearchQ}
                        onChange={e => { setEmployeeSearchQ(e.target.value); setSelectedEmployee(null); }}
                        className="input pl-9 border-blue-200"
                        placeholder="Search by name, department..."
                        autoFocus
                      />
                    </div>
                    {employeeResults.length > 0 && (
                      <div className="mt-2 bg-white border border-blue-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {employeeResults.map(emp => (
                          <button key={emp.id} type="button" onClick={() => selectEmployee(emp)}
                            className="flex items-center gap-3 w-full px-4 py-3 hover:bg-blue-50 text-left transition-colors border-b border-blue-100 last:border-0">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-600">
                              {emp.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{emp.name}</p>
                              <p className="text-xs text-gray-500">{emp.designation} — {emp.department}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedEmployee && (
                      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-green-800">{selectedEmployee.name}</p>
                          <p className="text-xs text-green-600">{selectedEmployee.designation} — {selectedEmployee.department}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Manual host name fallback */}
                {!showEmployeeSearch && form.host_id === "" && (
                  <input
                    type="text"
                    value={form.host_name_manual}
                    onChange={e => setForm(f => ({ ...f, host_name_manual: e.target.value }))}
                    className="input"
                    placeholder="Or type host name manually"
                  />
                )}
              </div>
            )}

            {/* Expected checkout — always required */}
            <div>
              <label className="label">Expected Checkout Time *</label>
              <input
                type="datetime-local"
                value={form.expected_checkout_at}
                onChange={e => setForm(f => ({ ...f, expected_checkout_at: e.target.value }))}
                className="input"
                min={new Date().toISOString().slice(0, 16)}
                required
              />
              <p className="text-xs text-ink-400 mt-1">System will send a late alert if visitor stays beyond this time</p>
            </div>

            <div>
              <label className="label">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input resize-none" rows={2} placeholder="Any additional notes..." />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
              <UserPlus className="w-4 h-4" />
              {loading ? "Processing..." : "Check In Visitor"}
            </button>
          </form>
        </div>
      )}

      {mode === "scheduled" && (
        <div className="card p-8 text-center max-w-sm">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Hash className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-ink-900 mb-1">Scheduled Visit Entry</h2>
          <p className="text-sm text-ink-400 mb-6">Enter the visiting ID provided during booking</p>
          <form onSubmit={handleScheduledSubmit} className="space-y-3">
            <input
              type="text"
              value={visitingId}
              onChange={e => setVisitingId(e.target.value.toUpperCase())}
              className="input text-center font-mono text-lg tracking-widest"
              placeholder="VID-XXXXXXXX"
              maxLength={12}
            />
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
              {loading ? "Processing..." : "Grant Entry"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
