"use client";
import { useState, useEffect } from "react";
import { getHosts, getEmployees, api } from "@/lib/api";
import { Host, Employee } from "@/lib/types";
import toast from "react-hot-toast";
import { Plus, Building2, Phone, Mail, X, Search, Check, Users } from "lucide-react";

export default function HostsPage() {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Issue #5: employee search instead of manual form
  const [empSearch, setEmpSearch] = useState("");
  const [empResults, setEmpResults] = useState<Employee[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchHosts = async () => {
    setLoading(true);
    try {
      const data = await getHosts();
      setHosts(data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchHosts(); }, []);

  // Search employees as user types
  useEffect(() => {
    if (empSearch.length < 2) { setEmpResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const data = await getEmployees(empSearch);
        setEmpResults(data);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [empSearch]);

  const selectEmployee = (emp: Employee) => {
    setSelectedEmp(emp);
    setEmpSearch(`${emp.name} — ${emp.designation} (${emp.department})`);
    setEmpResults([]);
  };

  // Issue #5: create host from employee via new endpoint
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return toast.error("Please select an employee first");
    setSaving(true);
    try {
      await api.post("/hosts/from-employee/", { employee_id: selectedEmp.id });
      toast.success(`${selectedEmp.name} added as host!`);
      setSelectedEmp(null);
      setEmpSearch("");
      setEmpResults([]);
      setShowForm(false);
      fetchHosts();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || "Failed to add host";
      // If already exists that's fine
      if (msg.includes("already exists")) {
        toast.success("Host already exists in the system.");
        setShowForm(false);
        fetchHosts();
      } else {
        toast.error(msg);
      }
    } finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-900" style={{ fontFamily: "var(--font-display)" }}>Hosts</h1>
          <p className="text-ink-400 text-sm mt-0.5">Employees who receive visitors</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setSelectedEmp(null); setEmpSearch(""); }} className="btn-primary">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Cancel" : "Add Host"}
        </button>
      </div>

      {/* Issue #5: Select from employees only */}
      {showForm && (
        <div className="card p-5 mb-6 animate-in">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-ink-700">Add Host from Employee Directory</h2>
          </div>
          <p className="text-xs text-ink-400 mb-4">
            Only existing employees can be designated as hosts. Search and select an employee below.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
                <input
                  type="text"
                  value={empSearch}
                  onChange={e => { setEmpSearch(e.target.value); setSelectedEmp(null); }}
                  className="input pl-9"
                  placeholder="Search by name, department, designation..."
                  autoFocus
                />
              </div>

              {empResults.length > 0 && (
                <div className="mt-2 bg-white border border-ink-200 rounded-xl overflow-hidden shadow-lg z-10 max-h-52 overflow-y-auto">
                  {empResults.map(emp => (
                    <button key={emp.id} type="button" onClick={() => selectEmployee(emp)}
                      className="flex items-center gap-3 w-full px-4 py-3 hover:bg-ink-50 text-left transition-colors border-b border-ink-100 last:border-0">
                      <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">
                        {emp.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ink-900">{emp.name}</p>
                        <p className="text-xs text-ink-400">{emp.designation} · {emp.department}</p>
                        {emp.email && <p className="text-xs text-ink-300">{emp.email}</p>}
                      </div>
                      <span className="text-xs font-mono text-ink-400 bg-ink-100 px-2 py-0.5 rounded">{emp.employee_id}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {empSearch.length > 0 && empSearch.length < 2 && (
              <p className="text-xs text-ink-400">Type at least 2 characters to search...</p>
            )}

            {selectedEmp && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-800">{selectedEmp.name}</p>
                    <p className="text-xs text-green-600">{selectedEmp.designation} · {selectedEmp.department}</p>
                    <p className="text-xs text-green-500">{selectedEmp.email} · ID: {selectedEmp.employee_id}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-1">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving || !selectedEmp} className="btn-primary">
                <Check className="w-4 h-4" />
                {saving ? "Adding..." : "Add as Host"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-ink-300 text-sm">Loading...</div>
        ) : hosts.length === 0 ? (
          <div className="py-12 text-center">
            <Building2 className="w-10 h-10 text-ink-200 mx-auto mb-2" />
            <p className="text-ink-300 text-sm">No hosts yet</p>
            <p className="text-ink-200 text-xs mt-1">Click "Add Host" to designate an employee as a host</p>
          </div>
        ) : (
          <div className="divide-y divide-ink-50">
            {hosts.map((h) => (
              <div key={h.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-ink-50/50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-ink-100 flex items-center justify-center text-sm font-semibold text-ink-600 flex-shrink-0">
                  {h.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-900">{h.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {h.department && (
                      <span className="text-xs text-ink-400 flex items-center gap-1">
                        <Building2 className="w-3 h-3" /> {h.department}
                      </span>
                    )}
                    {h.phone && (
                      <span className="text-xs text-ink-400 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {h.phone}
                      </span>
                    )}
                    {h.email && (
                      <span className="text-xs text-ink-400 flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {h.email}
                      </span>
                    )}
                  </div>
                </div>
                {h.employee_id && (
                  <span className="text-xs font-mono text-ink-400 bg-ink-100 px-2 py-1 rounded-lg flex-shrink-0">
                    {h.employee_id}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
