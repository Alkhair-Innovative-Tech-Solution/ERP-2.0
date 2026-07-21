"use client";

import React, { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, User, Mail, Briefcase, GraduationCap,
  Plus, Trash2, Check, ChevronRight, ChevronLeft, Loader2,
} from "lucide-react";
import ProtectedLayout from "@/components/ProtectedLayout";
import { fetchWithAuth } from "@/utils/api";
import { Controller } from "react-hook-form";
import PhoneInput from "@/components/PhoneInput";
import CNICInput from "@/components/CNICInput";
import toast from "react-hot-toast";

// ----- Validators (mirror backend) -----
const CNIC_RE = /^\d{5}-?\d{7}-?\d{1}$/;
const PK_PHONE_RE = /^(\+92|92|0|0092)?3\d{2}-?\d{7}$/;

const educationSchema = z.object({
  degree: z.string().trim().min(1, "Degree required"),
  institute: z.string().trim().min(1, "Institute required"),
  passingYear: z.string().regex(/^\d{4}$/, "Year must be 4 digits"),
});

const experienceSchema = z.object({
  employer: z.string().trim().min(1, "Employer required"),
  jobTitle: z.string().trim().min(1, "Job title required"),
  startDate: z.string().min(1, "Start date required"),
  endDate: z.string().optional().default(""),
  responsibilities: z.string().optional().default(""),
});

const schema = z.object({
  fullName: z.string().trim().min(2, "Name too short").max(100),
  cnic: z.string().regex(CNIC_RE, "Format: XXXXX-XXXXXXX-X"),
  dob: z.string().optional().default(""),
  gender: z.enum(["male", "female"]),
  maritalStatus: z.enum(["single", "married", "divorced", "widowed"]).optional(),
  nationality: z.string().default("Pakistani"),
  religion: z.string().optional().default(""),

  personalEmail: z.string().email("Invalid email"),
  mobile: z.string().regex(PK_PHONE_RE, "Invalid PK mobile (03XX-XXXXXXX)"),
  orgEmail: z.string().email("Invalid email").or(z.literal("")).optional(),
  orgPhone: z.string().regex(PK_PHONE_RE, "Invalid PK mobile").or(z.literal("")).optional(),
  emergencyName: z.string().optional().default(""),
  emergencyPhone: z.string().regex(PK_PHONE_RE, "Invalid PK mobile").or(z.literal("")).optional(),
  residentialAddress: z.string().trim().min(3, "Address required"),
  permanentAddress: z.string().optional().default(""),
  city: z.string().optional().default(""),

  organizationCode: z.string().min(1, "Organization required"),
  institutionCode: z.string().optional().default(""),
  branchCode: z.string().optional().default(""),
  departmentCode: z.string().min(1, "Department required"),
  designationCode: z.string().min(1, "Designation required"),
  joiningDate: z.string().min(1, "Joining date required"),
  shift: z.enum(["general", "morning", "afternoon", "night", "hourly", "both"]).default("general"),
  isActive: z.boolean().optional().default(true),

  bankName: z.string().optional().default(""),
  accountNumber: z.string().optional().default(""),

  education: z.array(educationSchema).optional().default([]),
  experience: z.array(experienceSchema).optional().default([]),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

type Institution = { inst_code: string; name: string };
type Branch = { branch_code: string; branch_name: string };
type Department = { dept_code: string; dept_name: string };
type Designation = { position_code: string; position_name: string };

const STEPS = [
  { id: 1, label: "Identity", icon: User },
  { id: 2, label: "Contact", icon: Mail },
  { id: 3, label: "Placement", icon: Briefcase },
  { id: 4, label: "History", icon: GraduationCap },
];

const FIELDS_PER_STEP: Record<number, (keyof FormInput)[]> = {
  1: ["fullName", "cnic", "dob", "gender", "maritalStatus", "nationality", "religion"],
  2: ["personalEmail", "mobile", "orgEmail", "orgPhone", "emergencyName", "emergencyPhone", "residentialAddress", "permanentAddress", "city"],
  3: ["organizationCode", "institutionCode", "branchCode", "departmentCode", "designationCode", "joiningDate", "shift", "bankName", "accountNumber"],
  4: ["education", "experience"],
};

export default function EditEmployeePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<{ org_code: string; name: string }[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);

  const form = useForm<FormInput, any, FormOutput>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      fullName: "", cnic: "", dob: "", gender: "male", maritalStatus: "single",
      nationality: "Pakistani", religion: "",
      personalEmail: "", mobile: "", orgEmail: "", orgPhone: "",
      emergencyName: "", emergencyPhone: "",
      residentialAddress: "", permanentAddress: "", city: "",
      organizationCode: "", institutionCode: "", branchCode: "",
      departmentCode: "", designationCode: "",
      joiningDate: new Date().toISOString().slice(0, 10),
      shift: "general", bankName: "", accountNumber: "",
      education: [], experience: [],
    },
  });

  const { register, handleSubmit, trigger, watch, reset, setError, control, formState: { errors, isSubmitting } } = form;
  const eduArr = useFieldArray({ control: form.control, name: "education" });
  const expArr = useFieldArray({ control: form.control, name: "experience" });

  const instCode = watch("institutionCode");
  const deptCode = watch("departmentCode");

  // Load employee + metadata
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [oRes, iRes, dRes, eRes] = await Promise.all([
          fetchWithAuth("/employees/organizations"),
          fetchWithAuth("/employees/institutions"),
          fetchWithAuth("/employees/departments"),
          fetchWithAuth(`/employees/employees/${id}`),
        ]);
        if (oRes.ok) { const orgs = await oRes.json(); setOrganizations(Array.isArray(orgs) ? orgs : []); }
        if (iRes.ok) setInstitutions(await iRes.json());
        if (dRes.ok) setDepartments(await dRes.json());

        if (!eRes.ok) {
          setLoadError(`Employee not found (${eRes.status})`);
          setLoading(false);
          return;
        }
        const emp = await eRes.json();
        const primary = (emp.assignments || []).find((a: any) => a.is_primary) || emp.assignments?.[0] || {};

        reset({
          fullName: emp.full_name || "",
          cnic: emp.cnic || "",
          dob: emp.dob ? emp.dob.slice(0, 10) : "",
          gender: (emp.gender || "male") as any,
          maritalStatus: (emp.marital_status || "single") as any,
          nationality: emp.nationality || "Pakistani",
          religion: emp.religion || "",
          personalEmail: emp.personal_email || "",
          mobile: emp.personal_phone || "",
          orgEmail: emp.org_email || "",
          orgPhone: emp.org_phone || "",
          emergencyName: emp.emergency_contact?.name || "",
          emergencyPhone: emp.emergency_contact?.phone || "",
          residentialAddress: emp.address?.residential || "",
          permanentAddress: emp.address?.permanent || "",
          city: emp.address?.city || "",
          organizationCode: emp.organization_code || "",
          institutionCode: primary.institution_code || "",
          branchCode: primary.branch_code || "",
          departmentCode: primary.department_code || "",
          designationCode: primary.designation_code || "",
          joiningDate: primary.joining_date ? primary.joining_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
          shift: (primary.shift || "general") as any,
          isActive: emp.is_active ?? true,
          bankName: emp.bank_info?.bank_name || "",
          accountNumber: emp.bank_info?.account_number || "",
          education: (emp.education_history || []).map((e: any) => ({
            degree: e.degree || "", institute: e.institute || "", passingYear: String(e.passingYear || e.passing_year || ""),
          })),
          experience: (emp.work_experience || []).map((e: any) => ({
            employer: e.employer || "", jobTitle: e.jobTitle || e.job_title || "",
            startDate: e.startDate || e.start_date || "",
            endDate: e.endDate || e.end_date || "",
            responsibilities: e.responsibilities || "",
          })),
        });
      } catch (err: any) {
        setLoadError(err?.message || "Failed to load employee");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, reset]);

  // Branches depend on institution
  useEffect(() => {
    if (!instCode) { setBranches([]); return; }
    (async () => {
      const r = await fetchWithAuth(`/employees/branches?institution_code=${instCode}`);
      if (r.ok) setBranches(await r.json());
    })();
  }, [instCode]);

  // Designations depend on department
  useEffect(() => {
    if (!deptCode) { setDesignations([]); return; }
    (async () => {
      const r = await fetchWithAuth(`/employees/designations?department_code=${deptCode}`);
      if (r.ok) setDesignations(await r.json());
    })();
  }, [deptCode]);

  const next = async () => {
    const ok = await trigger(FIELDS_PER_STEP[step] as any);
    if (ok) setStep((s) => Math.min(4, s + 1));
  };
  const prev = () => setStep((s) => Math.max(1, s - 1));

  const onSubmit = async (values: FormOutput) => {
    setSubmitError(null);
    try {
      const res = await fetchWithAuth(`/employees/employees/${id}`, {
        method: "PUT",
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.field_errors) {
          for (const [field, msgs] of Object.entries(data.field_errors)) {
            const text = Array.isArray(msgs) ? msgs.map(String).join(", ") : String(msgs);
            setError(field as any, { message: text });
          }
          setSubmitError("Please fix the highlighted fields.");
          return;
        }
        if (Array.isArray(data?.detail)) {
          setSubmitError(data.detail.map((d: any) => d?.msg || JSON.stringify(d)).join("; "));
          return;
        }
        setSubmitError(
          typeof data?.error === "string" ? data.error :
          typeof data?.detail === "string" ? data.detail :
          `Request failed (${res.status})`
        );
        return;
      }
      toast.success("Employee Updated Successfully", { style: { backgroundColor: '#3b82f6', color: '#fff' } });
      router.push("/employees");
    } catch (e: any) {
      setSubmitError(e.message || "Network error");
    }
  };

  if (loading) {
    return (
      <ProtectedLayout>
        <div className="max-w-4xl mx-auto px-6 py-8 text-sm text-slate-500 flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading employee…
        </div>
      </ProtectedLayout>
    );
  }

  if (loadError) {
    return (
      <ProtectedLayout>
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Link href="/employees" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-6">
            <ArrowLeft size={16} /> Back
          </Link>
          <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700">{loadError}</div>
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <Link href="/employees" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft size={16} /> Back to employees
          </Link>
        </div>

        <h1 className="text-2xl font-semibold text-slate-900">Edit employee</h1>
        <p className="text-sm text-slate-500 mt-1">Update and save. Step {step} of 4.</p>

        <ol className="flex items-center gap-3 mt-8 mb-12">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = step === s.id;
            const done = step > s.id;
            return (
              <li key={s.id} className="flex items-center flex-1 group">
                <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-500 ${
                  active ? "bg-theme-800 text-white border-theme-800 shadow-xl shadow-theme-800/20 -translate-y-1" :
                  done ? "bg-emerald-50 text-emerald-700 border-emerald-100 shadow-sm" :
                  "bg-white text-slate-400 border-slate-100 shadow-sm opacity-60"
                }`}>
                  <div className={`h-6 w-6 rounded-lg flex items-center justify-center ${active ? 'bg-white/20' : done ? 'bg-emerald-100' : 'bg-slate-50'}`}>
                    {done ? <Check size={14} strokeWidth={3} /> : <Icon size={14} strokeWidth={2.5} />}
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-wider">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-1 mx-4 rounded-full transition-all duration-700 ${done ? 'bg-emerald-200' : 'bg-slate-100'}`} />
                )}
              </li>
            );
          })}
        </ol>

        {submitError && (
          <div className="mb-6 p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          {step === 1 && (
            <>
              <Field label="Full name *" error={errors.fullName?.message}>
                <input {...register("fullName")} className={inputCls(errors.fullName)} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="CNIC *" error={errors.cnic?.message}>
                  <Controller name="cnic" control={control} render={({ field }) => (
                    <CNICInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} className={inputCls(errors.cnic)} />
                  )} />
                </Field>
                <Field label="Date of birth" error={errors.dob?.message}>
                  <input type="date" {...register("dob")} className={inputCls(errors.dob)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Gender *" error={errors.gender?.message}>
                  <select {...register("gender")} className={inputCls(errors.gender)}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </Field>
                <Field label="Marital status" error={errors.maritalStatus?.message}>
                  <select {...register("maritalStatus")} className={inputCls(errors.maritalStatus)}>
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                    <option value="divorced">Divorced</option>
                    <option value="widowed">Widowed</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Nationality" error={errors.nationality?.message}>
                  <input {...register("nationality")} className={inputCls(errors.nationality)} />
                </Field>
                <Field label="Religion" error={errors.religion?.message}>
                  <input {...register("religion")} className={inputCls(errors.religion)} />
                </Field>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Personal email *" error={errors.personalEmail?.message}>
                  <input type="email" {...register("personalEmail")} className={inputCls(errors.personalEmail)} />
                </Field>
                <Field label="Mobile *" error={errors.mobile?.message}>
                  <Controller name="mobile" control={control} render={({ field }) => (
                    <PhoneInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} className={inputCls(errors.mobile)} />
                  )} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Org email" error={errors.orgEmail?.message}>
                  <input type="email" {...register("orgEmail")} className={inputCls(errors.orgEmail)} />
                </Field>
                <Field label="Org phone" error={errors.orgPhone?.message}>
                  <Controller name="orgPhone" control={control} render={({ field }) => (
                    <PhoneInput value={field.value ?? ''} onChange={field.onChange} onBlur={field.onBlur} className={inputCls(errors.orgPhone)} />
                  )} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Emergency contact name" error={errors.emergencyName?.message}>
                  <input {...register("emergencyName")} className={inputCls(errors.emergencyName)} />
                </Field>
                <Field label="Emergency contact phone" error={errors.emergencyPhone?.message}>
                  <Controller name="emergencyPhone" control={control} render={({ field }) => (
                    <PhoneInput value={field.value ?? ''} onChange={field.onChange} onBlur={field.onBlur} className={inputCls(errors.emergencyPhone)} />
                  )} />
                </Field>
              </div>
              <Field label="Residential address *" error={errors.residentialAddress?.message}>
                <textarea {...register("residentialAddress")} rows={2} className={inputCls(errors.residentialAddress)} />
              </Field>
              <Field label="Permanent address" error={errors.permanentAddress?.message}>
                <textarea {...register("permanentAddress")} rows={2} className={inputCls(errors.permanentAddress)} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="City" error={errors.city?.message}>
                  <input {...register("city")} className={inputCls(errors.city)} />
                </Field>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Organization *" error={errors.organizationCode?.message}>
                  <select {...register("organizationCode")} className={inputCls(errors.organizationCode)}>
                    <option value="">— select org —</option>
                    {organizations.map((o) => (
                      <option key={o.org_code} value={o.org_code}>{o.name} ({o.org_code})</option>
                    ))}
                  </select>
                </Field>
                <Field label="Institution" error={errors.institutionCode?.message}>
                  <select {...register("institutionCode")} className={inputCls(errors.institutionCode)}>
                    <option value="">— none —</option>
                    {institutions.map((i) => (
                      <option key={i.inst_code} value={i.inst_code}>{i.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Branch" error={errors.branchCode?.message}>
                  <select {...register("branchCode")} disabled={!instCode} className={inputCls(errors.branchCode)}>
                    <option value="">— none —</option>
                    {branches.map((b) => (
                      <option key={b.branch_code} value={b.branch_code}>{b.branch_name}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Department *" error={errors.departmentCode?.message}>
                  <select {...register("departmentCode")} className={inputCls(errors.departmentCode)}>
                    <option value="">— select —</option>
                    {departments.map((d) => (
                      <option key={d.dept_code} value={d.dept_code}>{d.dept_name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Designation *" error={errors.designationCode?.message}>
                  <select {...register("designationCode")} disabled={!deptCode} className={inputCls(errors.designationCode)}>
                    <option value="">— select —</option>
                    {designations.map((d) => (
                      <option key={d.position_code} value={d.position_code}>{d.position_name}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Joining date *" error={errors.joiningDate?.message}>
                  <input type="date" {...register("joiningDate")} className={inputCls(errors.joiningDate)} />
                </Field>
                <Field label="Shift" error={errors.shift?.message}>
                  <select {...register("shift")} className={inputCls(errors.shift)}>
                    <option value="general">General / Office</option>
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="night">Night</option>
                    <option value="hourly">Hourly</option>
                    <option value="both">Both (M+A)</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Bank name" error={errors.bankName?.message}>
                  <input {...register("bankName")} className={inputCls(errors.bankName)} />
                </Field>
                <Field label="Account number" error={errors.accountNumber?.message}>
                  <input {...register("accountNumber")} className={inputCls(errors.accountNumber)} />
                </Field>
              </div>
              <div className="flex items-center gap-4 pt-2">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Account Status</span>
                <Controller name="isActive" control={control} render={({ field }) => (
                  <button
                    type="button"
                    onClick={() => field.onChange(!field.value)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${field.value ? 'bg-emerald-500' : 'bg-zinc-300'}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${field.value ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                )} />
                <span className="text-sm font-bold text-zinc-600">{control._formValues.isActive ? 'Active' : 'Inactive'}</span>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-900">Education</h3>
                  <button type="button" onClick={() => eduArr.append({ degree: "", institute: "", passingYear: "" })}
                    className="inline-flex items-center gap-1 text-sm text-slate-700 hover:text-slate-900">
                    <Plus size={14} /> Add
                  </button>
                </div>
                {eduArr.fields.length === 0 && <p className="text-sm text-slate-400 italic">No records added.</p>}
                {eduArr.fields.map((f, i) => (
                  <div key={f.id} className="grid grid-cols-[1fr_1fr_120px_auto] gap-3 mb-3">
                    <input {...register(`education.${i}.degree`)} placeholder="Degree" className={inputCls(errors.education?.[i]?.degree)} />
                    <input {...register(`education.${i}.institute`)} placeholder="Institute" className={inputCls(errors.education?.[i]?.institute)} />
                    <input {...register(`education.${i}.passingYear`)} placeholder="YYYY" className={inputCls(errors.education?.[i]?.passingYear)} />
                    <button type="button" onClick={() => eduArr.remove(i)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </section>

              <section className="pt-6 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-900">Work experience</h3>
                  <button type="button" onClick={() => expArr.append({ employer: "", jobTitle: "", startDate: "", endDate: "", responsibilities: "" })}
                    className="inline-flex items-center gap-1 text-sm text-slate-700 hover:text-slate-900">
                    <Plus size={14} /> Add
                  </button>
                </div>
                {expArr.fields.length === 0 && <p className="text-sm text-slate-400 italic">No records added.</p>}
                {expArr.fields.map((f, i) => (
                  <div key={f.id} className="space-y-2 mb-4 p-3 border border-slate-200 rounded-lg">
                    <div className="grid grid-cols-2 gap-3">
                      <input {...register(`experience.${i}.employer`)} placeholder="Employer" className={inputCls(errors.experience?.[i]?.employer)} />
                      <input {...register(`experience.${i}.jobTitle`)} placeholder="Job title" className={inputCls(errors.experience?.[i]?.jobTitle)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input type="date" {...register(`experience.${i}.startDate`)} className={inputCls(errors.experience?.[i]?.startDate)} />
                      <input type="date" {...register(`experience.${i}.endDate`)} className={inputCls(errors.experience?.[i]?.endDate)} />
                    </div>
                    <textarea {...register(`experience.${i}.responsibilities`)} rows={2} placeholder="Responsibilities" className={inputCls()} />
                    <button type="button" onClick={() => expArr.remove(i)} className="inline-flex items-center gap-1 text-sm text-rose-600 hover:text-rose-700">
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>
                ))}
              </section>
            </>
          )}

          <div className="flex items-center justify-between pt-8 border-t border-slate-50 mt-10">
            <button 
              type="button" 
              onClick={prev} 
              disabled={step === 1}
              className="inline-flex items-center gap-3 px-8 h-14 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-white border border-slate-100 rounded-2xl hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm"
            >
              <ChevronLeft size={18} /> Back
            </button>

            {step < 4 ? (
              <button 
                type="button" 
                onClick={next}
                className="inline-flex items-center gap-3 px-10 h-14 text-[10px] font-black uppercase tracking-widest text-white bg-slate-900 rounded-2xl hover:bg-theme-800 transition-all active:scale-95 shadow-xl shadow-slate-900/10"
              >
                Next Step <ChevronRight size={18} />
              </button>
            ) : (
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="inline-flex items-center gap-3 px-10 h-14 text-[10px] font-black uppercase tracking-widest text-white bg-indigo-600 rounded-2xl hover:bg-indigo-700 disabled:opacity-60 transition-all active:scale-95 shadow-xl shadow-indigo-600/20"
              >
                {isSubmitting ? (
                  <><Loader2 size={18} className="animate-spin" /> Saving Changes…</>
                ) : (
                  <><Check size={18} strokeWidth={3} /> Update Profile</>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </ProtectedLayout>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-700 mb-1.5">{label}</span>
      {children}
      {error && <span className="block text-xs text-rose-600 mt-1">{error}</span>}
    </label>
  );
}

function inputCls(err?: any) {
  const base = "w-full px-3 py-2 text-sm bg-white border rounded-lg outline-none transition focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-50 disabled:text-slate-400";
  return `${base} ${err ? "border-rose-300 focus:border-rose-400" : "border-slate-200 focus:border-slate-400"}`;
}
