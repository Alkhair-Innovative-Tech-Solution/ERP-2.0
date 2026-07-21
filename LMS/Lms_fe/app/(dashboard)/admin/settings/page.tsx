'use client';

import { useState } from 'react';
import {
    User,
    Lock,
    Bell,
    Palette,
    Globe,
    Shield,
    Save,
    Smartphone,
    Mail,
    Globe2,
    Eye,
    EyeOff,
    Upload,
    CheckCircle2,
    ChevronRight,
    Camera,
    ShieldCheck,
    Cpu,
    Sparkles,
    Settings,
    Moon,
    Key
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Tab = 'profile' | 'security' | 'system' | 'branding';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<Tab>('profile');
    const [showPassword, setShowPassword] = useState(false);

    const tabs = [
        { id: 'profile', label: 'Identity Protocol', icon: User, desc: 'Manage scholar credentials' },
        { id: 'security', label: 'Security Vault', icon: Shield, desc: 'Authentication & Privacy' },
        { id: 'system', label: 'Global System', icon: Cpu, desc: 'Preferences & Logic' },
        { id: 'branding', label: 'Visual Synergy', icon: Palette, desc: 'Aesthetics & Theme' }
    ];

    const handleSave = () => {
        toast.promise(
            new Promise(resolve => setTimeout(resolve, 1000)),
            {
                loading: 'Synchronizing protocols...',
                success: 'Core updated successfully!',
                error: 'Failed to update settings.'
            }
        );
    };

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">
            
            {/* ── Header Section ── */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <p className="text-brand-teal font-black tracking-[0.2em] text-[10px] uppercase mb-2">Central Configuration</p>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                        <Settings className="w-7 h-7 text-brand-teal" />
                        Institutional Settings
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Configure global platform parameters, security audits, and institutional branding.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 px-6">
                
                {/* ── Navigation Sidebar ── */}
                <div className="lg:col-span-3 space-y-3">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as Tab)}
                            className={cn(
                                "w-full flex items-center gap-4 px-6 py-5 rounded-[24px] text-left transition-all duration-300 border-none",
                                activeTab === tab.id
                                    ? "bg-white shadow-premium text-brand-teal scale-105"
                                    : "text-slate-400 hover:text-slate-600 hover:bg-white/50"
                            )}
                        >
                            <div className={cn(
                                "w-11 h-11 rounded-xl flex items-center justify-center transition-all shadow-sm",
                                activeTab === tab.id ? "bg-brand-teal text-white" : "bg-slate-100 text-slate-400"
                            )}>
                                <tab.icon size={20} strokeWidth={2.5} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-black uppercase tracking-widest truncate">{tab.label}</p>
                                <p className="text-[9px] font-bold text-slate-400 truncate mt-0.5">{tab.desc}</p>
                            </div>
                            {activeTab === tab.id && <ChevronRight size={16} className="text-brand-teal" />}
                        </button>
                    ))}
                </div>

                {/* ── Configuration Matrix ── */}
                <div className="lg:col-span-9">
                    <div className="premium-card p-0 overflow-hidden bg-white border-none shadow-premium min-h-[650px] flex flex-col">
                        
                        <div className="p-10 md:p-12 flex-1">
                            {/* ── Identity Protocol Content ── */}
                            {activeTab === 'profile' && (
                                <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
                                    <div className="border-b border-slate-50 pb-8 flex items-end justify-between gap-4">
                                        <div>
                                            <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Identity Protocol</h2>
                                            <p className="text-sm text-slate-500 mt-1 font-medium italic">Global administrator identity and communication signature.</p>
                                        </div>
                                        <div className="w-12 h-12 rounded-2xl bg-brand-teal/10 flex items-center justify-center text-brand-teal shadow-sm">
                                            <ShieldCheck size={24} />
                                        </div>
                                    </div>

                                    <div className="flex flex-col md:flex-row gap-12 items-start">
                                        <div className="relative group/avatar">
                                            <div className="w-32 h-32 rounded-[32px] bg-slate-50 flex items-center justify-center border-4 border-white shadow-2xl group-hover/avatar:border-brand-teal transition-all overflow-hidden relative">
                                                <div className="absolute inset-0 bg-gradient-to-tr from-brand-teal/20 to-transparent opacity-0 group-hover/avatar:opacity-100 transition-opacity" />
                                                <User className="w-14 h-14 text-slate-200 group-hover/avatar:text-brand-teal transition-colors relative z-10" />
                                            </div>
                                            <button className="absolute -bottom-2 -right-2 w-11 h-11 rounded-2xl shadow-xl bg-white text-brand-teal hover:scale-110 active:scale-95 transition-all flex items-center justify-center border border-slate-100 hover:bg-brand-teal hover:text-white group/cam">
                                                <Camera size={18} className="group-hover/cam:rotate-12 transition-transform" />
                                            </button>
                                        </div>

                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Primary Node Name</label>
                                                <input type="text" defaultValue="Admin" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/40 transition-all uppercase tracking-tight shadow-inner" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Secondary Surname</label>
                                                <input type="text" defaultValue="User" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/40 transition-all uppercase tracking-tight shadow-inner" />
                                            </div>
                                            <div className="space-y-2 md:col-span-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Global Signal ID (Email)</label>
                                                <div className="relative">
                                                     <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                                     <input type="email" defaultValue="admin@ait.com" className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/40 transition-all shadow-inner" />
                                                </div>
                                                <p className="text-[9px] font-black text-brand-teal flex items-center gap-2 mt-3 uppercase tracking-widest opacity-60"><Shield size={12} /> Institutional security layer active.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── Security Vault Content ── */}
                            {activeTab === 'security' && (
                                <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
                                    <div className="border-b border-slate-50 pb-8 flex items-end justify-between gap-4">
                                        <div>
                                            <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Security Vault</h2>
                                            <p className="text-sm text-slate-500 mt-1 font-medium italic">Encrypt and manage access protocols for institutional integrity.</p>
                                        </div>
                                        <div className="w-12 h-12 rounded-2xl bg-brand-teal/10 flex items-center justify-center text-brand-teal shadow-sm">
                                            <Lock size={24} />
                                        </div>
                                    </div>

                                    <div className="max-w-md space-y-10">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Root Access Signature (Current Password)</label>
                                            <div className="relative">
                                                <input type={showPassword ? "text" : "password"} defaultValue="institutional_secret" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/40 transition-all shadow-inner" />
                                                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 hover:text-brand-teal transition-colors">
                                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Generate New Signature</label>
                                            <input type="password" placeholder="••••••••••••" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-800 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/40 transition-all shadow-inner" />
                                        </div>

                                        <div className="premium-card p-8 bg-slate-900 rounded-[32px] flex gap-6 relative group/security overflow-hidden border-none shadow-2xl">
                                            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover/security:opacity-20 transition-opacity">
                                                 <Key size={80} className="text-brand-teal" />
                                            </div>
                                            <div className="w-14 h-14 rounded-2xl bg-brand-teal/10 flex items-center justify-center text-brand-teal shadow-sm transition-transform group-hover/security:scale-110 relative z-10">
                                                <Smartphone size={24} />
                                            </div>
                                            <div className="relative z-10">
                                                <p className="text-[11px] font-black text-white uppercase tracking-widest">Multi-Factor Synergy</p>
                                                <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-widest">Dynamic authentication Layer.</p>
                                                <button className="mt-5 text-[10px] font-black text-brand-teal hover:text-white uppercase tracking-widest flex items-center gap-2 group/btn transition-colors">
                                                    Activate MFA Protocol <Save size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── Global System Content ── */}
                            {activeTab === 'system' && (
                                <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
                                    <div className="border-b border-slate-50 pb-8 flex items-end justify-between gap-4">
                                        <div>
                                            <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Global System</h2>
                                            <p className="text-sm text-slate-500 mt-1 font-medium italic">Logic preferences and internationalization protocols.</p>
                                        </div>
                                        <div className="w-12 h-12 rounded-2xl bg-brand-teal/10 flex items-center justify-center text-brand-teal shadow-sm">
                                            <Cpu size={24} />
                                        </div>
                                    </div>

                                    <div className="space-y-12">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                            <div className="space-y-6">
                                                <div className="flex items-center gap-3 text-slate-900 font-black uppercase text-[10px] tracking-widest pl-1">
                                                    <Globe2 size={16} className="text-brand-teal" />
                                                    <span>Lingual Node</span>
                                                </div>
                                                <div className="flex flex-wrap gap-3">
                                                    {['Institutional English', 'Integrated Urdu'].map(lang => (
                                                        <button key={lang} className={cn(
                                                            "px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border",
                                                            lang === 'Institutional English' ? "bg-white text-brand-teal border-brand-teal shadow-brand-teal/5 scale-105" : "bg-slate-50 text-slate-400 border-slate-100 hover:border-slate-200"
                                                        )}>
                                                            {lang}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-6">
                                                <div className="flex items-center gap-3 text-slate-900 font-black uppercase text-[10px] tracking-widest pl-1">
                                                    <Bell size={16} className="text-brand-teal" />
                                                    <span>Signal Relay</span>
                                                </div>
                                                <div className="space-y-5">
                                                    <label className="flex items-center gap-4 cursor-pointer group w-fit">
                                                        <div className="w-12 h-6.5 bg-brand-teal rounded-full relative p-1.5 shadow-inner transition-all border border-brand-teal/20">
                                                            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-lg" />
                                                        </div>
                                                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest truncate group-hover:text-brand-teal transition-colors">Relay Scholar Activity</span>
                                                    </label>
                                                    <label className="flex items-center gap-4 cursor-pointer group w-fit">
                                                        <div className="w-12 h-6.5 bg-slate-100 rounded-full relative p-1.5 shadow-inner border border-slate-200 transition-all overflow-hidden group-hover:bg-slate-200">
                                                            <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-sm" />
                                                        </div>
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate group-hover:text-slate-600 transition-colors">Digest Weekly Audits</span>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── Visual Synergy Content ── */}
                            {activeTab === 'branding' && (
                                <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
                                    <div className="border-b border-slate-50 pb-8 flex items-end justify-between gap-4">
                                        <div>
                                            <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Visual Synergy</h2>
                                            <p className="text-sm text-slate-500 mt-1 font-medium italic">Custom institutional aesthetics and branding architecture.</p>
                                        </div>
                                        <div className="w-12 h-12 rounded-2xl bg-brand-teal/10 flex items-center justify-center text-brand-teal shadow-sm">
                                            <Palette size={24} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                        <div className="space-y-6">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-3">
                                                <Sparkles size={16} className="text-brand-teal" /> Institutional Palette
                                            </label>
                                            <div className="flex flex-wrap gap-4">
                                                {['#2a9f90', '#000000', '#f97316', '#c96928', '#ffffff'].map(color => (
                                                    <button
                                                        key={color}
                                                        className={cn(
                                                            "w-12 h-12 rounded-[20px] border-4 transition-all hover:scale-110 shadow-lg relative group/color",
                                                            color === '#2a9f90' ? "border-brand-teal/20 scale-110 shadow-brand-teal/20 ring-4 ring-brand-teal/10" : "border-white"
                                                        )}
                                                        style={{ backgroundColor: color }}
                                                    >
                                                        {color === '#2a9f90' && <CheckCircle2 size={14} className="text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 drop-shadow-sm" />}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-3">
                                                <Moon size={16} className="text-brand-teal" /> UI Manifestation
                                            </label>
                                            <div className="grid grid-cols-1 gap-4">
                                                <button className="flex items-center justify-between p-4 bg-white border border-brand-teal rounded-2xl shadow-premium group/mode">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-brand-teal/10 flex items-center justify-center text-brand-teal">
                                                            <Sparkles size={18} />
                                                        </div>
                                                        <div className="text-left">
                                                            <p className="text-[10px] font-black text-slate-900 uppercase">Institutional Light</p>
                                                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 tracking-tighter">Premium brand experience</p>
                                                        </div>
                                                    </div>
                                                    <div className="w-5 h-5 rounded-full border-4 border-brand-teal bg-white flex items-center justify-center shadow-inner" />
                                                </button>
                                                <button className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl group/mode opacity-50 hover:opacity-100 transition-opacity">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400">
                                                            <Moon size={18} />
                                                        </div>
                                                        <div className="text-left">
                                                            <p className="text-[10px] font-black text-slate-400 uppercase">Deep Observation (Dark)</p>
                                                            <p className="text-[9px] font-bold text-slate-300 uppercase mt-0.5 tracking-tighter">Coming Soon in Synergetic Update</p>
                                                        </div>
                                                    </div>
                                                    <div className="w-5 h-5 rounded-full border-2 border-slate-200" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-6 md:col-span-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-3">
                                                <Upload size={16} className="text-brand-teal" /> Institutional Iconography (Logo)
                                            </label>
                                            <div className="p-16 md:p-24 bg-slate-50 border-4 border-dashed border-slate-100 rounded-[48px] flex flex-col items-center justify-center text-center group/upload cursor-pointer hover:border-brand-teal/40 hover:bg-brand-teal/5 transition-all shadow-inner relative overflow-hidden group">
                                                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <div className="w-20 h-20 rounded-[32px] bg-white shadow-2xl flex items-center justify-center text-slate-200 mb-6 group-hover/upload:scale-110 group-hover/upload:text-brand-teal transition-all relative z-10">
                                                    <Upload size={32} />
                                                </div>
                                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] relative z-10 group-hover/upload:text-brand-teal">Upload Identity</p>
                                                <p className="text-[10px] font-bold text-slate-300 mt-2 uppercase tracking-tighter relative z-10">Scalable Vector Format Preferred (MAX 4MB)</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* ── Persistent Action Terminal ── */}
                        <div className="p-8 md:p-10 bg-slate-50/50 border-t border-slate-50 flex items-center justify-between sticky bottom-0 backdrop-blur-md">
                            <div className="hidden md:flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-brand-teal">
                                    <Settings size={18} className="animate-spin-slow" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Protocol Active</p>
                                    <p className="text-[10px] font-black text-slate-700 uppercase tracking-tight">Configuration Mode Stable</p>
                                </div>
                            </div>
                            <Button
                                onClick={handleSave}
                                className="h-16 px-12 bg-brand-teal hover:bg-brand-dark text-white rounded-[28px] font-black uppercase text-[11px] tracking-[0.2em] shadow-2xl shadow-brand-teal/20 flex items-center gap-3 active:scale-95 border-none min-w-[240px] group"
                            >
                                <Save size={20} className="group-hover:rotate-12 transition-transform" />
                                Synchronize Protocols
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Add this to your globals.css or keep it here if using Tailwind custom animation
// @keyframes spin-slow {
//   from { transform: rotate(0deg); }
//   to { transform: rotate(360deg); }
// }
// .animate-spin-slow {
//   animation: spin-slow 8s linear infinite;
// }
