'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { 
    FileText, Video, Link as LinkIcon, Download, Trash2, 
    Plus, ArrowLeft, File, ExternalLink, Save, X, 
    Globe, Layers, Filter, PlayCircle, Clock, BookOpen
} from 'lucide-react';
import { courseAPI, contentAPI, getFileUrl } from '@/lib/api';
import toast from 'react-hot-toast';

const t = (key: string) => key;

function ContentPageInner() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const moduleId = searchParams.get('module_id');
    
    const [module, setModule] = useState<any>(null);
    const [lessons, setLessons] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddLesson, setShowAddLesson] = useState(false);
    
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        duration_minutes: 10,
    });

    useEffect(() => {
        if (params.courseId && moduleId) {
            fetchModuleData();
        }
    }, [params.courseId, moduleId]);

    const fetchModuleData = async () => {
        try {
            setLoading(true);
            const curriculum = await contentAPI.getCurriculum(params.courseId as string);
            const currentModule = curriculum.find((m: any) => m.id === moduleId);
            if (currentModule) {
                setModule(currentModule);
                setLessons(currentModule.lessons || []);
            }
        } catch (error) {
            console.error('Error fetching module data:', error);
            toast.error('Failed to load module content');
        } finally {
            setLoading(false);
        }
    };

    const handleAddLesson = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await contentAPI.createLesson({
                module_id: moduleId as string,
                title: formData.title,
                description: formData.description,
                duration_minutes: formData.duration_minutes,
                order: lessons.length + 1
            });
            toast.success('Lesson added successfully');
            setShowAddLesson(false);
            setFormData({ title: '', description: '', duration_minutes: 10 });
            fetchModuleData();
        } catch (error) {
            toast.error('Failed to add lesson');
        }
    };

    const [showAddItem, setShowAddItem] = useState(false);
    const [selectedLessonId, setSelectedLessonId] = useState<string>('');
    const [itemFormData, setItemFormData] = useState({
        title: '',
        content_type: 'VIDEO',
        url: '',
        file: null as File | null
    });

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const data = new FormData();
            data.append('lesson_id', selectedLessonId);
            data.append('title', itemFormData.title);
            data.append('content_type', itemFormData.content_type);
            if (itemFormData.url) data.append('url', itemFormData.url);
            if (itemFormData.file) data.append('file', itemFormData.file);

            // Using the new lesson-based content creation (assuming contentAPI handles this)
            // If not, I'll update contentAPI in lib/api.ts
            await contentAPI.createContentItem(data);
            
            toast.success('Item added to lesson');
            setShowAddItem(false);
            setItemFormData({ title: '', content_type: 'VIDEO', url: '', file: null });
            fetchModuleData();
        } catch (error) {
            toast.error('Failed to add item');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                            <BookOpen className="w-7 h-7 text-brand-teal" />
                            {module?.title || 'Course Content'}
                        </h1>
                        <p className="text-sm text-slate-400 font-bold mt-1">{t('Manage lessons and materials')}</p>
                    </div>
                </div>
                <button 
                    onClick={() => setShowAddLesson(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Add Lesson
                </button>
            </div>

            <div className="space-y-4">
                {lessons.length === 0 ? (
                    <div className="bg-white rounded-2xl border-2 border-dashed border-gray-100 p-12 text-center">
                        <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                        <p className="text-gray-400">{t('No lessons in this module yet.')}</p>
                    </div>
                ) : (
                    lessons.map((lesson, idx) => (
                        <div key={lesson.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:border-blue-200 transition-all group">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                                        {idx + 1}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900">{lesson.title}</h3>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                                                <Clock className="w-3 h-3" />
                                                {lesson.duration_minutes}m
                                            </span>
                                            <span className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                                                <PlayCircle className="w-3 h-3" />
                                                {lesson.contents?.length || 0} items
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => { setSelectedLessonId(lesson.id); setShowAddItem(true); }} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                                        <Plus className="w-5 h-5" />
                                    </button>
                                    <button onClick={async () => { if (confirm('Delete this lesson?')) { await contentAPI.deleteLesson(lesson.id); fetchModuleData(); toast.success('Lesson deleted'); } }} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Content Items within Lesson */}
                            {lesson.contents && lesson.contents.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-gray-50 space-y-2">
                                    {lesson.contents.map((item: any) => (
                                        <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                                            <div className="flex items-center gap-3">
                                                {item.content_type === 'VIDEO' ? <Video className="w-4 h-4 text-red-500" /> : <File className="w-4 h-4 text-blue-500" />}
                                                <span className="text-sm text-gray-700 font-medium">{item.title}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {item.file_url && (
                                                    <a href={getFileUrl(item.file_url)} target="_blank" className="p-1.5 text-gray-400 hover:text-blue-600">
                                                        <Download className="w-4 h-4" />
                                                    </a>
                                                )}
                                                <button onClick={async () => { if (confirm('Delete this item?')) { await contentAPI.deleteContentItem(item.id); fetchModuleData(); toast.success('Item deleted'); } }} className="p-1.5 text-gray-400 hover:text-red-600">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Add Lesson Modal */}
            {showAddLesson && (
                <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-gray-900">{t('Add New Lesson')}</h2>
                            <button onClick={() => setShowAddLesson(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleAddLesson} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t('Lesson Title')}</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="e.g. Setting up the Environment"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t('Duration (minutes)')}</label>
                                <input
                                    type="number"
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.duration_minutes}
                                    onChange={e => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                                />
                            </div>
                            <button 
                                type="submit"
                                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 mt-4 transition-all"
                            >
                                Save Lesson
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Item Modal */}
            {showAddItem && (
                <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-gray-900">{t('Add Content Item')}</h2>
                            <button onClick={() => setShowAddItem(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleAddItem} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t('Title')}</label>
                                <input
                                    type="text" required
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="e.g. Introduction Video"
                                    value={itemFormData.title}
                                    onChange={e => setItemFormData({ ...itemFormData, title: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t('Content Type')}</label>
                                <select
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={itemFormData.content_type}
                                    onChange={e => setItemFormData({ ...itemFormData, content_type: e.target.value })}
                                >
                                    <option value="VIDEO">{t('Video')}</option>
                                    <option value="DOCUMENT">{t('Document')}</option>
                                    <option value="PRESENTATION">{t('Presentation')}</option>
                                    <option value="IMAGE">{t('Image')}</option>
                                    <option value="LINK">{t('Link')}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t('URL (optional)')}</label>
                                <input
                                    type="url"
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="https://..."
                                    value={itemFormData.url}
                                    onChange={e => setItemFormData({ ...itemFormData, url: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t('File (optional)')}</label>
                                <input
                                    type="file"
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                    onChange={e => setItemFormData({ ...itemFormData, file: e.target.files?.[0] || null })}
                                />
                            </div>
                            <button type="submit"
                                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 mt-4 transition-all"
                            >
                                Save Item
                            </button>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}

export default function CourseContentPage() {
    return (
        <Suspense fallback={<div>{t('Loading content...')}</div>}>
            <ContentPageInner />
        </Suspense>
    );
}
