"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronRight, GraduationCap, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/api";
import { toast } from "sonner";

interface Subject {
  id: number; name: string; subject_code: string | null;
  grade_name: string | null; campus_name: string | null;
}

export default function StudentSubjectsPage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [classroomId, setClassroomId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Get student classroom from profile
        const profile = await apiGet<any>("/api/students/my-profile/");
        const cid = profile?.classroom_id ?? profile?.classroom ?? null;
        setClassroomId(cid);
        const url = cid
          ? `/api/subjects/my-subjects/?classroom_id=${cid}`
          : `/api/subjects/my-subjects/`;
        const data = await apiGet<any>(url);
        setSubjects(Array.isArray(data) ? data : data.results ?? []);
      } catch {
        toast.error("Could not load subjects");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = subjects.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.subject_code ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#013a63]">My Subjects</h1>
        <p className="text-sm text-gray-500 mt-1">View content and assignments for your subjects</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input placeholder="Search subjects..." value={search}
          onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <GraduationCap className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-sm">No subjects available</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((subject) => (
            <Card
              key={subject.id}
              className="cursor-pointer hover:shadow-md transition-shadow border border-gray-200 rounded-xl"
              onClick={() => router.push(`/student/subjects/${subject.id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <BookOpen className="h-5 w-5 text-[#013a63]" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400 mt-1" />
                </div>
                <h3 className="font-semibold text-[#013a63] text-base">{subject.name}</h3>
                {subject.subject_code && <p className="text-xs text-gray-400 mt-0.5">{subject.subject_code}</p>}
                {subject.grade_name && (
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <GraduationCap className="h-3 w-3" /> {subject.grade_name}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
