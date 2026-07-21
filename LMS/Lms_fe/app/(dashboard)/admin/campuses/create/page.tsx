'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { campusAPI, organizationAPI } from '@/lib/api';
import { School, ArrowLeft, ArrowRight, Check, Loader2, MapPin, Phone, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface Organization {
  id: string;
  name: string;
}

const STEPS = [
  { id: 1, label: 'General Info', icon: Building2 },
  { id: 2, label: 'Facilities', icon: School },
  { id: 3, label: 'Contact & Review', icon: Phone },
];

export default function CreateCampusPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [formData, setFormData] = useState({
    organization_id: '',
    campus_code: '',
    campus_name: '',
    campus_type: 'branch' as 'main' | 'branch',
    status: 'active',
    shift_available: 'morning',
    city: '',
    address: '',
    student_capacity: 200,
    total_classrooms: 0,
    total_staff_rooms: 0,
    labs: false,
    library: false,
    transport: false,
    internet_available: false,
    power_backup: false,
    canteen_facility: false,
    campus_head_name: '',
    campus_head_email: '',
    contact_phone: '',
    official_email: '',
  });

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const data = await organizationAPI.getAll();
      setOrganizations(data);
      if (data.length === 1) {
        setFormData(prev => ({ ...prev, organization_id: data[0].id }));
      }
    } catch (error) {
      toast.error('Failed to load organizations');
    }
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.campus_code || !formData.campus_name) {
        toast.error('Campus Code and Name are required');
        return;
      }
    }
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!formData.organization_id) {
      toast.error('Please select an organization');
      return;
    }
    setSaving(true);
    try {
      await campusAPI.create(formData);
      toast.success('Campus created successfully');
      router.push('/admin/campuses');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to create campus');
    } finally {
      setSaving(false);
    }
  };

  const toggleFacility = (key: keyof typeof formData) => {
    setFormData(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/admin/campuses')}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <School className="w-7 h-7 text-brand-teal" />
            Create New Campus
          </h1>
          <p className="text-sm text-slate-400 font-bold mt-1">Fill in the details to add a new campus</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="premium-card p-4">
        <div className="flex items-center justify-between">
          {STEPS.map((s, index) => (
            <div key={s.id} className="flex items-center">
              <div className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl transition-all",
                step === s.id ? "bg-brand-teal text-white" : 
                step > s.id ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
              )}>
                {step > s.id ? <Check size={16} /> : <s.icon size={16} />}
                <span className="text-xs font-black uppercase tracking-widest">{s.label}</span>
              </div>
              {index < STEPS.length - 1 && (
                <div className={cn(
                  "w-12 h-0.5 mx-2",
                  step > s.id ? "bg-emerald-300" : "bg-slate-200"
                )} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="premium-card p-8">
        {/* Step 1: General Info */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-lg font-black text-slate-900">General Information</h2>
            
            {/* Organization Selection */}
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Organization *</label>
              <select
                value={formData.organization_id}
                onChange={(e) => setFormData(prev => ({ ...prev, organization_id: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 focus:ring-4 focus:ring-brand-teal/5 font-bold text-sm"
              >
                <option value="">Select Organization</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Campus Code *</label>
                <input
                  type="text"
                  value={formData.campus_code}
                  onChange={(e) => setFormData(prev => ({ ...prev, campus_code: e.target.value.toUpperCase() }))}
                  placeholder="KHI-01"
                  maxLength={20}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 focus:ring-4 focus:ring-brand-teal/5 font-bold text-sm uppercase"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Campus Name *</label>
                <input
                  type="text"
                  value={formData.campus_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, campus_name: e.target.value }))}
                  placeholder="Karachi Main Campus"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 focus:ring-4 focus:ring-brand-teal/5 font-bold text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Campus Type</label>
                <select
                  value={formData.campus_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, campus_type: e.target.value as 'main' | 'branch' }))}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm"
                >
                  <option value="main">Main Campus</option>
                  <option value="branch">Branch Campus</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Shift Available</label>
                <select
                  value={formData.shift_available}
                  onChange={(e) => setFormData(prev => ({ ...prev, shift_available: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm"
                >
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="Karachi"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Address</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Full campus address..."
                rows={2}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 focus:ring-4 focus:ring-brand-teal/5 font-bold text-sm resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Student Capacity</label>
                <input
                  type="number"
                  value={formData.student_capacity}
                  onChange={(e) => setFormData(prev => ({ ...prev, student_capacity: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Total Classrooms</label>
                <input
                  type="number"
                  value={formData.total_classrooms}
                  onChange={(e) => setFormData(prev => ({ ...prev, total_classrooms: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Facilities */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-black text-slate-900">Facilities & Infrastructure</h2>
            <p className="text-sm text-slate-500 font-bold">Select the facilities available at this campus</p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { key: 'labs' as const, label: 'Computer Labs', icon: '💻' },
                { key: 'library' as const, label: 'Library', icon: '📚' },
                { key: 'transport' as const, label: 'Student Transport', icon: '🚌' },
                { key: 'internet_available' as const, label: 'Internet Access', icon: '🌐' },
                { key: 'power_backup' as const, label: 'Power Backup', icon: '⚡' },
                { key: 'canteen_facility' as const, label: 'Canteen', icon: '🍽️' },
              ].map((facility) => (
                <button
                  key={facility.key}
                  onClick={() => toggleFacility(facility.key)}
                  className={cn(
                    "p-4 rounded-xl border-2 transition-all text-left",
                    formData[facility.key]
                      ? "border-brand-teal bg-brand-teal/5"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  )}
                >
                  <div className="text-2xl mb-2">{facility.icon}</div>
                  <p className={cn(
                    "text-sm font-black",
                    formData[facility.key] ? "text-brand-teal" : "text-slate-700"
                  )}>
                    {facility.label}
                  </p>
                  <div className={cn(
                    "mt-2 w-4 h-4 rounded border-2 flex items-center justify-center",
                    formData[facility.key]
                      ? "border-brand-teal bg-brand-teal"
                      : "border-slate-300"
                  )}>
                    {formData[facility.key] && <Check size={12} className="text-white" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Contact & Review */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-black text-slate-900">Contact Information</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Campus Head Name</label>
                <input
                  type="text"
                  value={formData.campus_head_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, campus_head_name: e.target.value }))}
                  placeholder="John Doe"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Campus Head Email</label>
                <input
                  type="email"
                  value={formData.campus_head_email}
                  onChange={(e) => setFormData(prev => ({ ...prev, campus_head_email: e.target.value }))}
                  placeholder="head@ait.edu"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Contact Phone</label>
                <input
                  type="text"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                  placeholder="+92-XXX-XXXXXXX"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Official Email</label>
                <input
                  type="email"
                  value={formData.official_email}
                  onChange={(e) => setFormData(prev => ({ ...prev, official_email: e.target.value }))}
                  placeholder="campus@ait.edu"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm"
                />
              </div>
            </div>

            {/* Review Summary */}
            <div className="mt-8 p-4 bg-slate-50 rounded-xl">
              <h3 className="text-sm font-black text-slate-900 mb-3">Review Summary</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-400">Campus:</span> <span className="font-bold">{formData.campus_name || '-'}</span></div>
                <div><span className="text-slate-400">Code:</span> <span className="font-bold">{formData.campus_code || '-'}</span></div>
                <div><span className="text-slate-400">Type:</span> <span className="font-bold capitalize">{formData.campus_type}</span></div>
                <div><span className="text-slate-400">City:</span> <span className="font-bold">{formData.city || '-'}</span></div>
                <div><span className="text-slate-400">Shift:</span> <span className="font-bold capitalize">{formData.shift_available}</span></div>
                <div><span className="text-slate-400">Capacity:</span> <span className="font-bold">{formData.student_capacity}</span></div>
                <div className="col-span-2">
                  <span className="text-slate-400">Facilities:</span>{' '}
                  <span className="font-bold">
                    {[
                      formData.labs && 'Labs',
                      formData.library && 'Library',
                      formData.transport && 'Transport',
                      formData.internet_available && 'Internet',
                      formData.power_backup && 'Power Backup',
                      formData.canteen_facility && 'Canteen',
                    ].filter(Boolean).join(', ') || 'None'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleBack}
          disabled={step === 1}
          className={cn(
            "flex items-center gap-2 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all",
            step === 1
              ? "bg-slate-100 text-slate-300 cursor-not-allowed"
              : "bg-slate-100 hover:bg-slate-200 text-slate-600"
          )}
        >
          <ArrowLeft size={16} /> Back
        </button>
        
        {step < 3 ? (
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-5 py-3 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all"
          >
            Next <ArrowRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-3 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={16} />}
            {saving ? 'Creating...' : 'Create Campus'}
          </button>
        )}
      </div>
    </div>
  );
}
