"use client";
import React, { useState, useEffect } from "react";
import { getTeacherTimetable, getStoredUserProfile, getShiftTimings, refreshUserProfile } from "@/lib/api";
import { Clock } from "lucide-react";

interface PeriodAssignment {
    id: string; day: string; timeSlot: string;
    grade: string; section: string; subject: string;
    teacherId: number; teacherName: string;
}

const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT: Record<string, string> = {
    Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed",
    Thursday: "Thu", Friday: "Fri", Saturday: "Sat",
};
const DAY_COLORS: Record<string, string> = {
    Monday:    "bg-[#e05c5c] text-white",
    Tuesday:   "bg-[#5b8dc9] text-white",
    Wednesday: "bg-[#e09a3a] text-white",
    Thursday:  "bg-[#5ba88a] text-white",
    Friday:    "bg-[#7b7b8a] text-white",
    Saturday:  "bg-[#c05c8a] text-white",
};
const DAY_TEXT: Record<string, string> = {
    Monday:    "text-[#e05c5c]",
    Tuesday:   "text-[#5b8dc9]",
    Wednesday: "text-[#e09a3a]",
    Thursday:  "text-[#5ba88a]",
    Friday:    "text-[#7b7b8a]",
    Saturday:  "text-[#c05c8a]",
};


const fmt12 = (t: string) => {
    const [hStr, mStr] = t.split(":");
    let h = parseInt(hStr, 10);
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${mStr} ${ap}`;
};

export default function TeacherTimetablePage() {
    const [assignments, setAssignments] = useState<PeriodAssignment[]>([]);
    const [teacherName, setTeacherName] = useState("");
    const [teacherCode, setTeacherCode] = useState("");
    const [shift, setShift] = useState("Morning");
    const [timeSlots, setTimeSlots] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            setLoading(true);
            let profile = getStoredUserProfile();
            try { const f = await refreshUserProfile(); if (f) profile = f; } catch {}

            const teacherId = profile?.teacher_id || profile?.id || profile?.pk;
            setTeacherName(profile?.full_name || profile?.name || profile?.username || "Teacher");
            setTeacherCode(profile?.employee_code || profile?.username || "");
            setShift(profile?.shift ? profile.shift.charAt(0).toUpperCase() + profile.shift.slice(1) : "Morning");

            if (!teacherId) { setLoading(false); return; }

            let campusId = 1;
            const campusObj = profile?.campus || profile?.current_campus;
            if (campusObj && typeof campusObj === 'object') campusId = campusObj.id;
            else if (typeof campusObj === 'number') campusId = campusObj;
            else if (profile?.campus_id) campusId = Number(profile.campus_id);
            else campusId = parseInt(localStorage.getItem('sis_campus_id') || '1');

            const [slots, periods] = await Promise.all([
                getShiftTimings(campusId, profile?.shift || 'morning'),
                getTeacherTimetable({ teacher: teacherId }),
            ]);

            const filtered = (slots || [])
                .filter((s: any) => (s.timetable_type || 'class') === 'teacher')
                .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setTimeSlots(filtered);

            const mapped = (periods || []).map((p: any) => {
                const fmt = (t: string) => t.split(":").slice(0, 2).join(":");
                return {
                    id: p.id?.toString() || "",
                    day: p.day?.charAt(0).toUpperCase() + p.day?.slice(1) || "",
                    timeSlot: `${fmt(p.start_time)} - ${fmt(p.end_time)}`,
                    grade: p.grade || p.classroom?.grade || "",
                    section: p.section || p.classroom?.section || "",
                    subject: p.subject_name || p.subject?.name || "",
                    teacherId: p.teacher || teacherId,
                    teacherName: profile?.full_name || "",
                };
            });
            setAssignments(mapped);
            setLoading(false);
        })();
    }, []);

    const getCell = (slotStart: string, slotEnd: string, day: string) => {
        const slot = `${slotStart.split(":").slice(0,2).join(":")} - ${slotEnd.split(":").slice(0,2).join(":")}`;
        return assignments.find(a =>
            a.day.toLowerCase() === day.toLowerCase() &&
            a.timeSlot.replace(/\s/g,'').toLowerCase() === slot.replace(/\s/g,'').toLowerCase()
        );
    };

    return (
        <div className="px-4 py-4 space-y-3">
            {/* Compact header */}
            <div className="bg-[#274c77] rounded-xl px-5 py-3 flex items-center justify-between">
                <div>
                    <p className="text-white/50 text-[10px] font-semibold uppercase tracking-wider">My Timetable</p>
                    <p className="text-white font-bold text-sm leading-tight">{teacherName || "—"}</p>
                    {teacherCode && <p className="text-white/40 text-[11px]">{teacherCode}</p>}
                </div>
                <span className="inline-flex items-center gap-1.5 bg-white/10 text-white/80 text-[11px] font-semibold px-3 py-1.5 rounded-full">
                    <Clock className="h-3 w-3" /> {shift}
                </span>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="text-center py-16 text-slate-400 text-sm">Loading schedule…</div>
            ) : timeSlots.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-sm">No schedule available.</div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-xs" style={{ minWidth: 640 }}>
                            <thead>
                                <tr>
                                    {/* Time header cell */}
                                    <th className="w-28 bg-slate-50 border-b border-r border-slate-200 px-3 py-2">
                                        <div className="flex items-center justify-center">
                                            <Clock className="h-4 w-4 text-slate-400" />
                                        </div>
                                    </th>
                                    {WEEK_DAYS.map(day => (
                                        <th key={day} className={`border-b border-r border-slate-200 px-2 py-2 text-center font-bold text-xs last:border-r-0 ${DAY_COLORS[day]}`}>
                                            {DAY_SHORT[day]}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {timeSlots.map((slot, idx) => {
                                    const isBreak = slot.is_break;
                                    const start = fmt12(slot.start_time);
                                    const end = fmt12(slot.end_time);

                                    if (isBreak) return (
                                        <tr key={idx} className="bg-orange-50 border-b border-orange-100">
                                            <td className="border-r border-orange-100 px-3 py-2 text-center whitespace-nowrap">
                                                <p className="text-orange-500 font-bold text-xs">{start}</p>
                                                <p className="text-orange-400 text-[11px]">– {end}</p>
                                            </td>
                                            {WEEK_DAYS.map(day => (
                                                <td key={day} className="border-r border-orange-100 last:border-r-0 px-2 py-2 text-center align-middle">
                                                    <span className="text-orange-400 font-semibold text-[11px] uppercase tracking-wide">— Break —</span>
                                                </td>
                                            ))}
                                        </tr>
                                    );

                                    return (
                                        <tr key={idx} className="hover:bg-slate-50/50 border-b border-slate-100 last:border-b-0">
                                            {/* Time column */}
                                            <td className="border-r border-slate-100 px-3 py-3 bg-slate-50/50 text-center whitespace-nowrap">
                                                <p className="text-[#274c77] font-bold text-xs">{start}</p>
                                                <p className="text-slate-400 text-[11px]">– {end}</p>
                                            </td>
                                            {/* Day cells */}
                                            {WEEK_DAYS.map(day => {
                                                const p = getCell(slot.start_time, slot.end_time, day);
                                                return (
                                                    <td key={day} className="border-r border-slate-100 px-2 py-3 last:border-r-0 text-center align-middle">
                                                        {p ? (
                                                            <div className="flex flex-col items-center gap-0.5">
                                                                <span className={`text-[13px] font-semibold ${DAY_TEXT[day]}`}>
                                                                    {p.subject}
                                                                </span>
                                                                <span className="text-slate-400 text-[11px]">
                                                                    {p.grade}-{p.section}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-200 text-xs">—</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
