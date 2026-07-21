'use client';

import React, { useState, useEffect } from 'react';
import { 
    Shield, LayoutDashboard, GraduationCap, Users, 
    BookOpen, Layers, Award, FileText, Receipt, 
    ArrowRightLeft, Bell, Settings, ChevronDown, 
    ChevronRight, Check, X, Loader2, Info
} from 'lucide-react';
import { rolePermissionAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

// Roles in the system
const ROLES = [
    { id: 'ADMIN', label: 'Admin' },
    { id: 'COORDINATOR', label: 'Coordinator' },
    { id: 'ACCOUNT_OFFICER', label: 'Account Officer' },
    { id: 'TEACHER', label: 'Teacher' },
    { id: 'STUDENT', label: 'Student' },
    { id: 'TA', label: 'TA' }
];

// Categories / Tabs
const CATEGORIES = [
    { id: 'DASHBOARD', label: 'DASHBOARD / ANALYTICS', icon: LayoutDashboard },
    { id: 'ACADEMIC', label: 'ACADEMIC', icon: GraduationCap },
    { id: 'FINANCE', label: 'FINANCE', icon: Receipt },
    { id: 'MANAGEMENT', label: 'STAFF & USERS', icon: Users },
];

// Capability Groups mapping
const CAPABILITIES: Record<string, any[]> = {
    DASHBOARD: [
        { id: 'view_admin_dashboard', label: 'Admin Dashboard', description: 'Access to the main administrative dashboard.' },
        { id: 'view_coordinator_dashboard', label: 'Coordinator Dashboard', description: 'Access to the coordinator oversight dashboard.' },
        { id: 'view_teacher_dashboard', label: 'Teacher Dashboard', description: 'Access to teacher course management dashboard.' },
        { id: 'view_student_dashboard', label: 'Student Dashboard', description: 'Access to student learning dashboard.' },
        { id: 'view_analytics', label: 'Advanced Analytics', description: 'Detailed reporting and system analytics.' },
    ],
    ACADEMIC: [
        { id: 'manage_courses', label: 'Course Management', description: 'Create, edit, and delete academic courses.' },
        { id: 'manage_classes', label: 'Class Schedules', icon: GraduationCap, description: 'Manage session timings and room assignments.' },

        { id: 'manage_enrollments', label: 'Enrollments', description: 'Approve or reject student course enrollments.' },
        { id: 'manage_assignments', label: 'Assignments', description: 'Create and grade student assignments.' },
        { id: 'manage_certifications', label: 'Certifications', description: 'Generate and verify student certificates.' },
        { id: 'id_generator', label: 'ID Card Generator', description: 'Generate student identification cards.' },
    ],
    FINANCE: [
        { id: 'view_deposits', label: 'Deposit Records', description: 'View student security deposit logs.' },
        { id: 'view_entrance_leads', label: 'Entrance Leads', description: 'View and manage applicant entrance signals.' },
        { id: 'manage_refunds', label: 'Refund Processing', description: 'Process and approve deposit refunds.' },
        { id: 'manage_transfers', label: 'Course Transfers', description: 'Handle student course/batch transfer requests.' },
        { id: 'manage_receipts', label: 'Receipt Codes', description: 'Manage institutional receipt and voucher codes.' },
        { id: 'view_fee_structures', label: 'Fee Structures', description: 'Configure course and time-slot fee plans.' },
        { id: 'manage_fee_records', label: 'Fee Collection', description: 'Track and collect student maintenance fees.' },
        { id: 'view_fee_analytics', label: 'Fee Analytics', description: 'Revenue reports and collection analytics.' },
    ],
    MANAGEMENT: [
        { id: 'manage_users', label: 'User Directory', description: 'Full access to create and manage system users.' },
        { id: 'manage_teachers', label: 'Teacher Directory', description: 'Manage teacher profiles and specializations.' },
        { id: 'view_students', label: 'Student Directory', description: 'View and search student profiles.' },
        { id: 'view_attendance', label: 'Attendance Logs', description: 'View student and staff attendance records.' },
        { id: 'manage_notifications', label: 'System Broadcasts', description: 'Send global notifications to roles or batches.' },
    ]
};

export default function PlatformPermissions() {
    const [activeCategory, setActiveCategory] = useState('DASHBOARD');
    const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({});
    const [loading, setLoading] = useState(true);
    const [expandedGroup, setExpandedGroup] = useState<string | null>('DASHBOARD');
    const [saving, setSaving] = useState<string | null>(null);

    useEffect(() => {
        fetchPermissions();
    }, []);

    const fetchPermissions = async () => {
        try {
            setLoading(true);
            const data = await rolePermissionAPI.getAll();
            // Data format: [{ role: 'ADMIN', permissions: {...} }, ...]
            const permMap: any = {};
            data.forEach((item: any) => {
                permMap[item.role] = item.permissions || {};
            });
            setPermissions(permMap);
        } catch (error) {
            console.error('Error fetching permissions:', error);
            // Fallback for demo if no data
            setPermissions({});
        } finally {
            setLoading(false);
        }
    };

    const togglePermission = async (role: string, capId: string) => {
        const currentRolePerms = permissions[role] || {};
        const newState = !currentRolePerms[capId];
        
        const updatedRolePerms = {
            ...currentRolePerms,
            [capId]: newState
        };

        // Optimistic UI
        setPermissions({
            ...permissions,
            [role]: updatedRolePerms
        });

        try {
            setSaving(`${role}-${capId}`);
            await rolePermissionAPI.update(role, updatedRolePerms);
        } catch (error) {
            toast.error(`Failed to update ${role} permissions`);
            // Rollback
            setPermissions({
                ...permissions,
                [role]: currentRolePerms
            });
        } finally {
            setSaving(null);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <div className="w-12 h-12 rounded-full border-4 border-brand-teal/10 border-t-brand-teal animate-spin" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Initializing Permission Matrix...</p>
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope">
            
            {/* ── Header Section ── */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <p className="text-brand-teal font-black tracking-[0.2em] text-[10px] uppercase mb-2">Permissions</p>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                        <Shield className="w-7 h-7 text-brand-teal" />
                        Platform Setup & Permissions
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Configure granular feature access via dedicated capability modules.</p>
                </div>
            </div>

            {/* ── Category Selection (Tabs) ── */}
            <div className="bg-white p-2 rounded-[2rem] shadow-sm border border-slate-100 mb-8 inline-flex gap-2">
                {CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const isActive = activeCategory === cat.id;
                    return (
                        <button
                            key={cat.id}
                            onClick={() => {
                                setActiveCategory(cat.id);
                                setExpandedGroup(cat.id);
                            }}
                            className={cn(
                                "flex items-center gap-3 px-8 py-3.5 rounded-[1.5rem] transition-all duration-300 text-[10px] font-black uppercase tracking-widest",
                                isActive 
                                    ? "bg-slate-100 text-slate-900 shadow-inner" 
                                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                            )}
                        >
                            <Icon size={16} />
                            {cat.label}
                        </button>
                    );
                })}
            </div>

            {/* ── Permissions Matrix ── */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="p-8 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 min-w-[300px]">
                                    CAPABILITY GROUPS
                                </th>
                                {ROLES.map(role => (
                                    <th key={role.id} className="p-8 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 min-w-[120px]">
                                        {role.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {/* Group Header */}
                            <tr className="group cursor-pointer hover:bg-slate-50/30 transition-colors" onClick={() => setExpandedGroup(expandedGroup === activeCategory ? null : activeCategory)}>
                                <td className="p-8 border-b border-slate-50">
                                    <div className="flex items-center gap-4">
                                        {expandedGroup === activeCategory ? <ChevronDown size={20} className="text-slate-400" /> : <ChevronRight size={20} className="text-slate-400" />}
                                        <div>
                                            <h3 className="text-lg font-black text-slate-900">{CATEGORIES.find(c => c.id === activeCategory)?.label.split(' / ')[0]} Access</h3>
                                            <p className="text-xs font-medium text-slate-400">Toggle primary module access for different roles.</p>
                                        </div>
                                    </div>
                                </td>
                                {ROLES.map(role => (
                                    <td key={role.id} className="p-8 text-center border-b border-slate-50">
                                        <div className="flex justify-center">
                                            <Toggle 
                                                checked={ROLES.some(r => r.id === role.id)} // This is just a group toggle placeholder
                                                disabled 
                                                variant="role-header"
                                            />
                                        </div>
                                    </td>
                                ))}
                            </tr>

                            {/* Sub-Capabilities */}
                            {expandedGroup === activeCategory && CAPABILITIES[activeCategory].map((cap) => (
                                <tr key={cap.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="py-6 px-12 border-b border-slate-50">
                                        <div className="flex items-center gap-4">
                                            <div className="w-2 h-2 rounded-full bg-slate-200" />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-sm font-black text-slate-700">{cap.label}</h4>
                                                    <span className="text-[9px] font-black uppercase text-brand-teal bg-brand-teal/10 px-1.5 py-0.5 rounded">Read</span>
                                                </div>
                                                <p className="text-[11px] text-slate-400 font-medium max-w-[250px] leading-tight mt-0.5">{cap.description}</p>
                                            </div>
                                        </div>
                                    </td>
                                    {ROLES.map(role => {
                                        const isAllowed = permissions[role.id]?.[cap.id] === true;
                                        const isSaving = saving === `${role.id}-${cap.id}`;

                                        return (
                                            <td key={role.id} className="p-6 text-center border-b border-slate-50">
                                                <div className="flex justify-center">
                                                    <button
                                                        onClick={() => togglePermission(role.id, cap.id)}
                                                        disabled={isSaving}
                                                        className={cn(
                                                            "relative w-12 h-6 rounded-full transition-all duration-500 flex items-center px-1",
                                                            isAllowed ? "bg-emerald-400" : "bg-slate-900",
                                                            isSaving && "opacity-50"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "w-4 h-4 rounded-full bg-white transition-all duration-500 shadow-sm flex items-center justify-center",
                                                            isAllowed ? "translate-x-6" : "translate-x-0"
                                                        )}>
                                                            {isSaving && <Loader2 size={8} className="text-slate-400 animate-spin" />}
                                                        </div>
                                                    </button>
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Legend / Info ── */}
            <div className="mt-8 flex items-center gap-6 text-slate-400">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Active Capability</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-slate-900" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Locked / Restricted</span>
                </div>
                <div className="flex items-center gap-2 ml-auto bg-slate-50 px-4 py-2 rounded-full">
                    <Info size={14} className="text-slate-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Super Admin roles always possess full overriding clearance.</span>
                </div>
            </div>
        </div>
    );
}

// Internal Toggle Component for clean UI
function Toggle({ checked, disabled, variant }: { checked: boolean, disabled?: boolean, variant?: string }) {
    return (
        <div className={cn(
            "relative w-12 h-6 rounded-full transition-all duration-500 flex items-center px-1 cursor-default",
            checked ? "bg-brand-teal/20" : "bg-slate-200",
            disabled && "opacity-60"
        )}>
            <div className={cn(
                "w-4 h-4 rounded-full bg-white transition-all duration-500 shadow-sm",
                checked ? "translate-x-6" : "translate-x-0"
            )} />
        </div>
    );
}
