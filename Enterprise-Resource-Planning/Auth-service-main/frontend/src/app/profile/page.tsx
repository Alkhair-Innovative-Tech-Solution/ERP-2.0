"use client";

import React, { useState, useRef, useEffect } from "react";
import ProtectedLayout from "@/components/ProtectedLayout";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { User, Mail, Building, Camera, Calendar, ArrowLeft, Users, Layers, Briefcase, Activity } from "lucide-react";

export default function ProfilePage() {
    const { user } = useAuth();

    const [message, setMessage] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [services, setServices] = useState<string[]>([]);
    const [loadingServices, setLoadingServices] = useState(true);

    useEffect(() => {
        const fetchServices = async () => {
            try {
                const token = localStorage.getItem("access_token");
                if (!token) return;

                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"}/permissions/services`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                
                if (res.ok) {
                    const data = await res.json();
                    setServices(data.available_services || []);
                }
            } catch (error) {
                console.error("Failed to fetch services", error);
            } finally {
                setLoadingServices(false);
            }
        };

        if (user) {
            fetchServices();
        }
    }, [user]);

    if (!user) return null;

    const roleText = user.is_superadmin
        ? "System Administrator"
        : user.designation || "User";
    const roleDesc = user.is_superadmin
        ? "Full system access and management"
        : "Standard system access and management";
    const memberSince = "29/04/2026";

    const SERVICE_MAP: Record<string, { name: string; icon: any; color: string; bg: string }> = {
        ems: { name: "EMS", icon: Users, color: "text-blue-700", bg: "bg-blue-100" },
        hdms: { name: "HDMS", icon: Layers, color: "text-purple-700", bg: "bg-purple-100" },
        vms: { name: "VMS", icon: Building, color: "text-emerald-700", bg: "bg-emerald-100" },
        sis: { name: "SIS", icon: User, color: "text-orange-700", bg: "bg-orange-100" },
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const imageUrl = URL.createObjectURL(file);
        setPreviewImage(imageUrl);
        setMessage("Profile picture updated locally.");
        setTimeout(() => setMessage(""), 3000);
    };

    const triggerImageUpload = () => {
        fileInputRef.current?.click();
    };

    return (
        <ProtectedLayout>
            <div className="w-full max-w-3xl mx-auto  xs:px-2 sm:px-6  sm:py-3 lg:py-6 animate-in fade-in duration-500">

                {/* Back Button */}
                <div className="mb-2 sm:mb-3">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-600 text-[10px] xs:text-xs font-black uppercase tracking-widest rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm active:scale-95"
                    >
                        <ArrowLeft size={13} />
                        Back to Dashboard
                    </Link>
                </div>

                {/* Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">

                    {/* Header */}
                    <div className="flex flex-col items-center justify-center text-center px-5 xs:px-6 pt-5 sm:pt-6 pb-4 sm:pb-5">
                        <div className="h-12 w-12 xs:h-14 xs:w-14 bg-theme-800 rounded-full flex items-center justify-center mb-3 shadow-md shadow-theme-800/20">
                            <User size={22} className="text-white" strokeWidth={2} />
                        </div>
                        <h1 className="text-xl xs:text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                            Profile Settings
                        </h1>
                        <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1.5 max-w-xs sm:max-w-none">
                            Manage your account information and preferences
                        </p>
                    </div>

                    {/* Success Message */}
                    {message && (
                        <div className="mx-4 xs:mx-6 mb-2 p-2.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs sm:text-sm font-bold text-center animate-in fade-in slide-in-from-top-4 border border-emerald-100 shadow-sm">
                            {message}
                        </div>
                    )}

                    {/* Body */}
                    <div className="px-4 xs:px-5 sm:px-8 pb-6 sm:pb-8 space-y-6 sm:space-y-8">

                        {/* ── Personal Information ── */}
                        <section>
                            <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                                    Personal Information
                                </h3>
                            </div>

                            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-4 sm:gap-5">
                                {/* Full Name */}
                                <div>
                                    <label className="flex items-center gap-1.5 text-[9px] xs:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                        <User size={11} /> Full Name
                                    </label>
                                    <div className="w-full bg-slate-50/40 border border-slate-100 rounded-xl px-3 py-3 xs:py-3.5 text-xs xs:text-sm text-slate-900 font-bold shadow-sm truncate">
                                        {user.full_name}
                                    </div>
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="flex items-center gap-1.5 text-[9px] xs:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                        <Mail size={11} /> Email Address
                                    </label>
                                    <div className="w-full bg-slate-50/40 border border-slate-100 rounded-xl px-3 py-3 xs:py-3.5 text-xs xs:text-sm text-slate-900 font-bold shadow-sm truncate">
                                        {user.email}
                                    </div>
                                </div>

                                {/* Department */}
                                <div>
                                    <label className="flex items-center gap-1.5 text-[9px] xs:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                        <Building size={11} /> Department
                                    </label>
                                    <div className="w-full bg-slate-50/40 border border-slate-100 rounded-xl px-3 py-3 xs:py-3.5 text-xs xs:text-sm text-slate-900 font-bold shadow-sm truncate">
                                        {user.department || "Unassigned"}
                                    </div>
                                </div>

                                {/* Role */}
                                <div>
                                    <label className="flex items-center gap-1.5 text-[9px] xs:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                        <div className="h-2 w-2 rounded-full border-[1.5px] border-slate-400" />
                                        Role
                                    </label>
                                    <div className="w-full bg-slate-50/40 border border-purple-100 rounded-xl px-3 py-3 xs:py-3.5 text-xs xs:text-sm text-theme-800 font-black shadow-sm truncate">
                                        {user.is_superadmin ? "Admin" : (user.designation || "User")}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* ── Profile Picture ── */}
                        <section className="border-t border-slate-100 pt-5 sm:pt-6">
                            <h3 className="text-sm sm:text-base font-black text-slate-900 mb-3 sm:mb-4">
                                Profile Picture
                            </h3>

                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 xs:p-5 sm:p-6 lg:p-8 flex flex-col xs:flex-row items-center gap-4 group">
                                {/* Avatar */}
                                <div className="h-20 w-20 xs:h-24 xs:w-24 shrink-0 rounded-2xl xs:rounded-3xl bg-white flex items-center justify-center text-2xl xs:text-3xl font-black text-theme-800 shadow-lg shadow-theme-800/10 border border-slate-100 overflow-hidden group-hover:scale-105 transition-transform duration-300">
                                    {previewImage ? (
                                        <img
                                            src={previewImage}
                                            alt="Profile"
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        user.full_name?.charAt(0)
                                    )}
                                </div>

                                {/* Text + Button */}
                                <div className="flex-1 text-center xs:text-left">
                                    <p className="text-[10px] xs:text-[11px] text-slate-500 mb-3 leading-relaxed font-semibold max-w-xs mx-auto xs:mx-0">
                                        Update your profile picture to help people recognize you easily.
                                        The image will appear in your navbar across all pages.
                                    </p>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        ref={fileInputRef}
                                        onChange={handleImageChange}
                                        className="hidden"
                                    />
                                    <button
                                        onClick={triggerImageUpload}
                                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-[9px] xs:text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm active:scale-95 whitespace-nowrap"
                                    >
                                        <Camera size={13} /> Upload Picture
                                    </button>
                                </div>
                            </div>
                        </section>

                        {/* ── Role Information ── */}
                        <section className="border-t border-slate-100 pt-5 sm:pt-6">
                            <h3 className="text-sm sm:text-base font-black text-slate-900 mb-3 sm:mb-4">
                                Role Information
                            </h3>

                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 xs:p-5 sm:p-6 flex flex-col xs:flex-row justify-between items-start xs:items-center gap-3">
                                {/* Role text */}
                                <div className="min-w-0">
                                    <p className="text-sm sm:text-base text-slate-900 font-black tracking-tight mb-1 truncate">
                                        {roleText}
                                    </p>
                                    <p className="text-[10px] xs:text-xs text-slate-500 font-medium">
                                        {roleDesc}
                                    </p>
                                </div>

                                {/* Since badge */}
                                <div className="flex items-center gap-2 px-3 xs:px-4 py-2 xs:py-2.5 bg-white rounded-lg border border-slate-100 shadow-sm text-[9px] xs:text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap shrink-0">
                                    <Calendar size={13} className="text-theme-800" />
                                    <span>Since {memberSince}</span>
                                </div>
                            </div>
                        </section>

                        {/* ── Assigned Services ── */}
                        <section className="border-t border-slate-100 pt-5 sm:pt-6">
                            <div className="flex items-center justify-between mb-3 sm:mb-4">
                                <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                                    <Activity size={18} className="text-theme-800" />
                                    Assigned Services
                                </h3>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2.5 py-1 rounded-md">
                                    {loadingServices ? "..." : services.length} Active
                                </div>
                            </div>

                            <div className="bg-white border border-slate-100 rounded-2xl p-4 xs:p-5 sm:p-6 shadow-sm">
                                {loadingServices ? (
                                    <div className="flex justify-center items-center py-6">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-theme-800"></div>
                                    </div>
                                ) : services.length > 0 ? (
                                    <div className="grid grid-cols-2 min-[480px]:grid-cols-3 sm:grid-cols-4 gap-3 sm:gap-4">
                                        {services.map((serviceCode) => {
                                            const srv = SERVICE_MAP[serviceCode.toLowerCase()] || { 
                                                name: serviceCode.toUpperCase(), 
                                                icon: Briefcase, 
                                                color: "text-slate-700", 
                                                bg: "bg-slate-100" 
                                            };
                                            const Icon = srv.icon;
                                            return (
                                                <div 
                                                    key={serviceCode}
                                                    className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-100 rounded-xl hover:shadow-md hover:border-theme-200 transition-all group"
                                                >
                                                    <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-full ${srv.bg} ${srv.color} flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform`}>
                                                        <Icon size={20} strokeWidth={2.5} />
                                                    </div>
                                                    <span className="text-[10px] sm:text-xs font-black text-slate-700 tracking-tight text-center uppercase">
                                                        {srv.name}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-6 text-center">
                                        <div className="h-12 w-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                                            <Briefcase size={20} className="text-slate-400" />
                                        </div>
                                        <p className="text-sm font-bold text-slate-700">No Services Assigned</p>
                                        <p className="text-xs text-slate-500 mt-1">You currently don't have access to any services.</p>
                                    </div>
                                )}
                            </div>
                        </section>

                    </div>
                </div>
            </div>
        </ProtectedLayout>
    );
}