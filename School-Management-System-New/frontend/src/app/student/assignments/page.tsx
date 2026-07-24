"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileText, Clock, CheckCircle2, ChevronRight, BookOpen,
  Eye, BookMarked, AlertCircle, Trophy, GraduationCap, ListTodo
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/api";
import { toast } from "sonner";
import { format, differenceInDays, differenceInHours } from "date-fns";

interface Assignment {
  id: number; title: string; subject_name: string;
  total_marks: number; due_date: string | null;
  is_published: boolean; assignment_type: string;
  classroom_label: string | null;
  my_submission: { id: number; status: string; grade: number | null; submitted_at: string } | null;
}

const SUBJECT_COLORS = [
  "bg-violet-100 text-violet-700",
  "bg-blue-100 text-blue-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-emerald-100 text-emerald-700",
  "bg-cyan-100 text-cyan-700",
  "bg-orange-100 text-orange-700",
  "bg-pink-100 text-pink-700",
];

const subjectColorMap = new Map<string, string>();
let colorIdx = 0;
function getSubjectColor(name: string) {
  if (!subjectColorMap.has(name)) {
    subjectColorMap.set(name, SUBJECT_COLORS[colorIdx % SUBJECT_COLORS.length]);
    colorIdx++;
  }
  return subjectColorMap.get(name)!;
}

function dueDateLabel(due: string) {
  const now = new Date();
  const d = new Date(due);
  const days = differenceInDays(d, now);
  const hours = differenceInHours(d, now);
  if (hours < 0) return { text: "Overdue", color: "text-red-600 bg-red-50" };
  if (hours < 24) return { text: `${hours}h left`, color: "text-orange-600 bg-orange-50" };
  if (days <= 3) return { text: `${days}d left`, color: "text-amber-600 bg-amber-50" };
  return { text: format(d, "dd MMM"), color: "text-gray-500 bg-gray-50" };
}

export default function StudentAssignmentsPage() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const profile = await apiGet<any>("/api/students/my-profile/");
        const classroomId = profile?.classroom_id ?? profile?.classroom ?? "";
        const url = classroomId ? `/api/assignments/?classroom_id=${classroomId}` : `/api/assignments/`;
        const data = await apiGet<any>(url);
        setAssignments(Array.isArray(data) ? data : data.results ?? []);
      } catch { toast.error("Could not load assignments"); }
      finally { setLoading(false); }
    })();
  }, []);

  const regular = assignments.filter(a => a.assignment_type !== "Material");
  const materials = assignments.filter(a => a.assignment_type === "Material");
  const pending = regular.filter(a => !a.my_submission);
  const submitted = regular.filter(a => a.my_submission && a.my_submission.status !== "GRADED");
  const graded = regular.filter(a => a.my_submission?.status === "GRADED");

  const stats = [
    { label: "Total", value: regular.length, icon: ListTodo, color: "bg-[#013a63]", light: "bg-blue-50 text-[#013a63]" },
    { label: "Pending", value: pending.length, icon: AlertCircle, color: "bg-amber-500", light: "bg-amber-50 text-amber-700" },
    { label: "Submitted", value: submitted.length, icon: CheckCircle2, color: "bg-cyan-600", light: "bg-cyan-50 text-cyan-700" },
    { label: "Graded", value: graded.length, icon: Trophy, color: "bg-emerald-600", light: "bg-emerald-50 text-emerald-700" },
  ];

  function AssignmentCard({ a }: { a: Assignment }) {
    const isMaterial = a.assignment_type === "Material";
    const isOverdue = !isMaterial && a.due_date && new Date(a.due_date) < new Date() && !a.my_submission;
    const isGraded = a.my_submission?.status === "GRADED";
    const isSubmitted = !!a.my_submission && !isGraded;
    const due = !isMaterial && a.due_date ? dueDateLabel(a.due_date) : null;

    const borderColor = isOverdue
      ? "border-l-red-400"
      : isGraded
      ? "border-l-emerald-400"
      : isSubmitted
      ? "border-l-cyan-400"
      : isMaterial
      ? "border-l-teal-400"
      : "border-l-[#013a63]";

    const iconBg = isOverdue
      ? "bg-red-100"
      : isGraded
      ? "bg-emerald-100"
      : isSubmitted
      ? "bg-cyan-100"
      : isMaterial
      ? "bg-teal-100"
      : "bg-blue-100";

    const iconColor = isOverdue
      ? "text-red-500"
      : isGraded
      ? "text-emerald-600"
      : isSubmitted
      ? "text-cyan-600"
      : isMaterial
      ? "text-teal-600"
      : "text-[#013a63]";

    const Icon = isMaterial ? BookMarked : isGraded ? Trophy : isSubmitted ? CheckCircle2 : FileText;

    return (
      <div
        onClick={() => router.push(`/student/assignments/${a.id}`)}
        className={`bg-white border border-gray-100 border-l-4 ${borderColor} rounded-xl px-5 py-4 flex items-center gap-4 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 group`}
      >
        <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <h3 className="font-semibold text-sm text-gray-900 leading-tight">{a.title}</h3>
            {isOverdue && (
              <Badge className="bg-red-100 text-red-600 border-0 text-[10px] px-1.5 py-0">Overdue</Badge>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${getSubjectColor(a.subject_name)}`}>
              {a.subject_name}
            </span>
            {!isMaterial && (
              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                <BookOpen className="h-3 w-3" /> {a.total_marks} marks
              </span>
            )}
            {isMaterial && (
              <span className="text-[11px] text-teal-600 font-medium flex items-center gap-1">
                <Eye className="h-3 w-3" /> Material
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {isGraded && a.my_submission?.grade != null && (
            <span className="text-sm font-bold text-emerald-600">
              {a.my_submission.grade}<span className="text-xs text-gray-400">/{a.total_marks}</span>
            </span>
          )}
          {due && !isGraded && !isSubmitted && (
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${due.color}`}>
              <Clock className="h-3 w-3" /> {due.text}
            </span>
          )}
          {isSubmitted && (
            <span className="text-[11px] font-medium text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-full">
              Awaiting grade
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
        </div>
      </div>
    );
  }

  function EmptyState({ icon: Icon, message, sub }: { icon: any; message: string; sub: string }) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
          <Icon className="h-8 w-8 text-gray-300" />
        </div>
        <p className="text-sm font-medium text-gray-500">{message}</p>
        <p className="text-xs text-gray-400 mt-1">{sub}</p>
      </div>
    );
  }

  if (loading) return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-10 rounded-xl w-full" />
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#013a63] to-[#01527a] rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-1">
          <GraduationCap className="h-6 w-6 opacity-80" />
          <h1 className="text-xl font-bold">My Assignments</h1>
        </div>
        <p className="text-sm text-blue-200 mb-5">Track, submit, and review your academic work</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white/10 backdrop-blur rounded-xl px-4 py-3 flex items-center gap-3">
              <div className={`w-8 h-8 ${color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <Icon className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold leading-none">{value}</p>
                <p className="text-[11px] text-blue-200 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending">
        <TabsList className="w-full bg-gray-100 p-1 rounded-xl h-auto gap-1">
          {[
            { value: "pending", label: "Pending", count: pending.length, dot: "bg-amber-400" },
            { value: "submitted", label: "Submitted", count: submitted.length, dot: "bg-cyan-500" },
            { value: "graded", label: "Graded", count: graded.length, dot: "bg-emerald-500" },
            ...(materials.length > 0 ? [{ value: "material", label: "Material", count: materials.length, dot: "bg-teal-500" }] : []),
          ].map(({ value, label, count, dot }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex-1 rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm py-2 flex items-center justify-center gap-2"
            >
              {count > 0 && <span className={`w-1.5 h-1.5 rounded-full ${dot} flex-shrink-0`} />}
              {label}
              <span className="bg-gray-200 data-[state=active]:bg-gray-100 text-gray-600 text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {count}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {pending.length === 0
            ? <EmptyState icon={CheckCircle2} message="All caught up!" sub="No pending assignments right now" />
            : <div className="space-y-2">{pending.map(a => <AssignmentCard key={a.id} a={a} />)}</div>
          }
        </TabsContent>

        <TabsContent value="submitted" className="mt-4">
          {submitted.length === 0
            ? <EmptyState icon={FileText} message="No submitted assignments" sub="Submit your pending work to see it here" />
            : <div className="space-y-2">{submitted.map(a => <AssignmentCard key={a.id} a={a} />)}</div>
          }
        </TabsContent>

        <TabsContent value="graded" className="mt-4">
          {graded.length === 0
            ? <EmptyState icon={Trophy} message="No graded assignments yet" sub="Your teacher will grade submitted work soon" />
            : <div className="space-y-2">{graded.map(a => <AssignmentCard key={a.id} a={a} />)}</div>
          }
        </TabsContent>

        {materials.length > 0 && (
          <TabsContent value="material" className="mt-4">
            <div className="space-y-2">{materials.map(a => <AssignmentCard key={a.id} a={a} />)}</div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
