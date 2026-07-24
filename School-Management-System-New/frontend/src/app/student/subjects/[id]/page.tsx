"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronDown, ChevronRight, FileText, Video, Link2, Image as ImageIcon,
  BookOpen, ArrowLeft, CheckCircle2, Circle, ExternalLink, Download
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet, apiPost } from "@/lib/api";
import { toast } from "sonner";

const CONTENT_TYPE_ICONS: Record<string, any> = {
  VIDEO: Video, DOCUMENT: FileText, PRESENTATION: FileText,
  LINK: Link2, IMAGE: ImageIcon, QUIZ: BookOpen,
};

interface ContentItem { id: number; title: string; content_type: string; file_url: string | null; url: string | null; }
interface Lesson { id: number; title: string; duration_minutes: number; is_completed: boolean; contents: ContentItem[]; }
interface Module { id: number; title: string; description: string | null; lessons: Lesson[]; }

export default function StudentSubjectContentPage() {
  const { id: subjectId } = useParams();
  const router = useRouter();
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectName, setSubjectName] = useState("");
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set());
  const [completingLesson, setCompletingLesson] = useState<number | null>(null);

  useEffect(() => { loadData(); }, [subjectId]);

  async function loadData() {
    try {
      const [curriculum, subject] = await Promise.all([
        apiGet<Module[]>(`/api/content/modules/curriculum/${subjectId}/`),
        apiGet<any>(`/api/subjects/${subjectId}/`),
      ]);
      setModules(curriculum);
      setSubjectName(subject.name);
      if (curriculum.length > 0) setExpandedModules(new Set([curriculum[0].id]));
    } catch { toast.error("Failed to load content"); }
    finally { setLoading(false); }
  }

  async function markComplete(lessonId: number, completed: boolean) {
    setCompletingLesson(lessonId);
    try {
      await apiPost("/api/content/progress/", { lesson_id: lessonId, is_completed: completed });
      setModules(prev => prev.map(m => ({
        ...m,
        lessons: m.lessons.map(l => l.id === lessonId ? { ...l, is_completed: completed } : l)
      })));
    } catch { toast.error("Failed to update progress"); }
    finally { setCompletingLesson(null); }
  }

  function toggleModule(id: number) {
    setExpandedModules(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const completedLessons = modules.reduce((sum, m) => sum + m.lessons.filter(l => l.is_completed).length, 0);
  const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  if (loading) return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded-md hover:bg-gray-100">
          <ArrowLeft className="h-4 w-4 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[#013a63]">{subjectName}</h1>
          <p className="text-xs text-gray-500 mt-0.5">{completedLessons}/{totalLessons} lessons completed</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-[#013a63]">{progress}%</p>
          <p className="text-xs text-gray-500">Progress</p>
        </div>
      </div>

      {/* Progress bar */}
      {totalLessons > 0 && (
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-[#013a63] rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      )}

      {modules.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No content available yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {modules.map((mod) => (
            <div key={mod.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
              <button
                onClick={() => toggleModule(mod.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  {expandedModules.has(mod.id) ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                  <span className="font-medium text-[#013a63] text-sm">{mod.title}</span>
                  <Badge variant="secondary" className="text-xs">
                    {mod.lessons.filter(l => l.is_completed).length}/{mod.lessons.length}
                  </Badge>
                </div>
              </button>

              {expandedModules.has(mod.id) && (
                <div className="border-t border-gray-100">
                  {mod.lessons.map((lesson) => (
                    <div key={lesson.id} className="border-b border-gray-50 last:border-0 px-6 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => markComplete(lesson.id, !lesson.is_completed)}
                          disabled={completingLesson === lesson.id}
                          className="flex-shrink-0"
                        >
                          {lesson.is_completed
                            ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                            : <Circle className="h-5 w-5 text-gray-300 hover:text-gray-400" />}
                        </button>
                        <span className={`text-sm flex-1 ${lesson.is_completed ? "line-through text-gray-400" : "text-gray-700"}`}>
                          {lesson.title}
                        </span>
                        {lesson.duration_minutes > 0 && (
                          <span className="text-xs text-gray-400">{lesson.duration_minutes} min</span>
                        )}
                      </div>

                      {lesson.contents.length > 0 && (
                        <div className="ml-8 mt-2 space-y-1.5">
                          {lesson.contents.map((item) => {
                            const Icon = CONTENT_TYPE_ICONS[item.content_type] || FileText;
                            const href = item.file_url ?? item.url;
                            return (
                              <div key={item.id} className="flex items-center gap-2 text-xs text-gray-500">
                                <Icon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                                {href ? (
                                  <a href={href} target="_blank" rel="noreferrer"
                                    className="hover:text-[#013a63] hover:underline flex items-center gap-1 truncate">
                                    {item.title}
                                    <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-60" />
                                  </a>
                                ) : <span className="truncate">{item.title}</span>}
                                <Badge variant="outline" className="text-[10px] ml-auto flex-shrink-0">{item.content_type}</Badge>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
