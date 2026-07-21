'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { campusAPI, levelAPI, gradeAPI, classroomAPI } from '@/lib/api';
import { School, ArrowLeft, MapPin, Phone, Users, Building2, Loader2, Plus, Edit2, Trash2, BookOpen, ChevronRight, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface Campus {
  id: string;
  organization_id: string;
  campus_id: string;
  campus_code: string;
  campus_name: string;
  campus_type: string;
  status: string;
  shift_available: string;
  city: string | null;
  address: string | null;
  contact_phone: string | null;
  official_email: string | null;
  campus_head_name: string | null;
  campus_head_email: string | null;
  student_capacity: number;
  total_classrooms: number;
  total_staff_rooms: number;
  labs: boolean;
  library: boolean;
  transport: boolean;
  internet_available: boolean;
  power_backup: boolean;
  canteen_facility: boolean;
  is_active: boolean;
}

interface Level {
  id: string;
  name: string;
  shift: string | null;
  is_active: boolean;
}

interface Grade {
  id: string;
  level_id: string;
  name: string;
  is_active: boolean;
}

interface Classroom {
  id: string;
  grade_id: string;
  section: string;
  shift: string | null;
  capacity: number;
  is_active: boolean;
}

type Tab = 'overview' | 'structure' | 'settings';

export default function CampusProfilePage() {
  const router = useRouter();
  const params = useParams();
  const campusId = params.id as string;
  
  const [campus, setCampus] = useState<Campus | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  
  // Modal states
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [showClassroomModal, setShowClassroomModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [levelForm, setLevelForm] = useState({ name: '', shift: '' });
  const [gradeForm, setGradeForm] = useState({ level_id: '', name: '' });
  const [classroomForm, setClassroomForm] = useState({ grade_id: '', section: '', capacity: 40 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCampusData();
  }, [campusId]);

  const fetchCampusData = async () => {
    try {
      setLoading(true);
      const [campusData, levelsData, gradesData, classroomsData] = await Promise.all([
        campusAPI.get(campusId),
        levelAPI.getAll({ campus_id: campusId }),
        gradeAPI.getAll({ campus_id: campusId }),
        classroomAPI.getAll({ campus_id: campusId }),
      ]);
      setCampus(campusData);
      setLevels(levelsData);
      setGrades(gradesData);
      setClassrooms(classroomsData);
    } catch (error) {
      toast.error('Failed to load campus data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLevel = async () => {
    if (!levelForm.name) {
      toast.error('Level name is required');
      return;
    }
    setSaving(true);
    try {
      if (editingItem) {
        await levelAPI.update(editingItem.id, { ...levelForm, campus_id: campusId, organization_id: campus?.organization_id });
        toast.success('Level updated');
      } else {
        await levelAPI.create({ ...levelForm, campus_id: campusId, organization_id: campus?.organization_id });
        toast.success('Level created');
      }
      setShowLevelModal(false);
      setEditingItem(null);
      setLevelForm({ name: '', shift: '' });
      fetchCampusData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save level');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGrade = async () => {
    if (!gradeForm.name || !gradeForm.level_id) {
      toast.error('Level and Grade name are required');
      return;
    }
    setSaving(true);
    try {
      if (editingItem) {
        await gradeAPI.update(editingItem.id, { ...gradeForm, campus_id: campusId, organization_id: campus?.organization_id });
        toast.success('Grade updated');
      } else {
        await gradeAPI.create({ ...gradeForm, campus_id: campusId, organization_id: campus?.organization_id });
        toast.success('Grade created');
      }
      setShowGradeModal(false);
      setEditingItem(null);
      setGradeForm({ level_id: '', name: '' });
      fetchCampusData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save grade');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClassroom = async () => {
    if (!classroomForm.grade_id || !classroomForm.section) {
      toast.error('Grade and Section are required');
      return;
    }
    setSaving(true);
    try {
      if (editingItem) {
        await classroomAPI.update(editingItem.id, { ...classroomForm, campus_id: campusId, organization_id: campus?.organization_id });
        toast.success('Classroom updated');
      } else {
        await classroomAPI.create({ ...classroomForm, campus_id: campusId, organization_id: campus?.organization_id });
        toast.success('Classroom created');
      }
      setShowClassroomModal(false);
      setEditingItem(null);
      setClassroomForm({ grade_id: '', section: '', capacity: 40 });
      fetchCampusData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save classroom');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLevel = async (id: string) => {
    if (!confirm('Delete this level and all its grades/classrooms?')) return;
    try {
      await levelAPI.delete(id);
      toast.success('Level deleted');
      fetchCampusData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete level');
    }
  };

  const handleDeleteGrade = async (id: string) => {
    if (!confirm('Delete this grade and all its classrooms?')) return;
    try {
      await gradeAPI.delete(id);
      toast.success('Grade deleted');
      fetchCampusData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete grade');
    }
  };

  const handleDeleteClassroom = async (id: string) => {
    if (!confirm('Delete this classroom?')) return;
    try {
      await classroomAPI.delete(id);
      toast.success('Classroom deleted');
      fetchCampusData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete classroom');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-teal" />
      </div>
    );
  }

  if (!campus) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500 font-bold">Campus not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/admin/campuses')}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{campus.campus_name}</h1>
            <span className={cn(
              "text-[10px] font-black uppercase px-2 py-1 rounded",
              campus.campus_type === 'main' ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
            )}>
              {campus.campus_type}
            </span>
            <span className={cn(
              "text-[10px] font-black uppercase px-2 py-1 rounded",
              campus.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
            )}>
              {campus.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 font-bold">
            {campus.city && (
              <span className="flex items-center gap-1"><MapPin size={14} /> {campus.city}</span>
            )}
            {campus.campus_head_name && (
              <span className="flex items-center gap-1"><Users size={14} /> {campus.campus_head_name}</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="premium-card p-1">
        <div className="flex gap-1">
          {[
            { id: 'overview' as Tab, label: 'Overview', icon: Building2 },
            { id: 'structure' as Tab, label: 'Academic Structure', icon: Layers },
            { id: 'settings' as Tab, label: 'Settings', icon: Edit2 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all",
                activeTab === tab.id
                  ? "bg-brand-teal text-white"
                  : "text-slate-500 hover:bg-slate-100"
              )}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="premium-card p-5">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Levels</p>
            <p className="text-3xl font-black text-slate-900 mt-1">{levels.length}</p>
          </div>
          <div className="premium-card p-5">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Grades</p>
            <p className="text-3xl font-black text-slate-900 mt-1">{grades.length}</p>
          </div>
          <div className="premium-card p-5">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Classrooms</p>
            <p className="text-3xl font-black text-slate-900 mt-1">{classrooms.length}</p>
          </div>
          
          {/* Facilities */}
          <div className="premium-card p-5 md:col-span-3">
            <h3 className="text-sm font-black text-slate-900 mb-3">Facilities</h3>
            <div className="flex flex-wrap gap-2">
              {campus.labs && <span className="text-xs font-black bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg">💻 Labs</span>}
              {campus.library && <span className="text-xs font-black bg-green-50 text-green-600 px-3 py-1.5 rounded-lg">📚 Library</span>}
              {campus.transport && <span className="text-xs font-black bg-amber-50 text-amber-600 px-3 py-1.5 rounded-lg">🚌 Transport</span>}
              {campus.internet_available && <span className="text-xs font-black bg-cyan-50 text-cyan-600 px-3 py-1.5 rounded-lg">🌐 Internet</span>}
              {campus.power_backup && <span className="text-xs font-black bg-purple-50 text-purple-600 px-3 py-1.5 rounded-lg">⚡ Power Backup</span>}
              {campus.canteen_facility && <span className="text-xs font-black bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg">🍽️ Canteen</span>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'structure' && (
        <div className="space-y-4">
          {/* Levels */}
          <div className="premium-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-slate-900">Academic Levels</h3>
              <button
                onClick={() => { setEditingItem(null); setLevelForm({ name: '', shift: '' }); setShowLevelModal(true); }}
                className="flex items-center gap-1 text-xs font-black text-brand-teal hover:text-brand-teal/80"
              >
                <Plus size={14} /> Add Level
              </button>
            </div>
            {levels.length === 0 ? (
              <p className="text-sm text-slate-400 font-bold">No levels created yet</p>
            ) : (
              <div className="space-y-2">
                {levels.map((level) => (
                  <div key={level.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div>
                      <p className="text-sm font-black text-slate-900">{level.name}</p>
                      {level.shift && <p className="text-xs text-slate-500 font-bold capitalize">{level.shift}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setEditingItem(level); setLevelForm({ name: level.name, shift: level.shift || '' }); setShowLevelModal(true); }}
                        className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-brand-teal"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteLevel(level.id)}
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Grades */}
          <div className="premium-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-slate-900">Grades</h3>
              <button
                onClick={() => { setEditingItem(null); setGradeForm({ level_id: levels[0]?.id || '', name: '' }); setShowGradeModal(true); }}
                className="flex items-center gap-1 text-xs font-black text-brand-teal hover:text-brand-teal/80"
              >
                <Plus size={14} /> Add Grade
              </button>
            </div>
            {grades.length === 0 ? (
              <p className="text-sm text-slate-400 font-bold">No grades created yet</p>
            ) : (
              <div className="space-y-2">
                {grades.map((grade) => {
                  const level = levels.find(l => l.id === grade.level_id);
                  return (
                    <div key={grade.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <div>
                        <p className="text-sm font-black text-slate-900">{grade.name}</p>
                        <p className="text-xs text-slate-500 font-bold">{level?.name || 'Unknown Level'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setEditingItem(grade); setGradeForm({ level_id: grade.level_id, name: grade.name }); setShowGradeModal(true); }}
                          className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-brand-teal"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteGrade(grade.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Classrooms */}
          <div className="premium-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-slate-900">Classrooms</h3>
              <button
                onClick={() => { setEditingItem(null); setClassroomForm({ grade_id: grades[0]?.id || '', section: '', capacity: 40 }); setShowClassroomModal(true); }}
                className="flex items-center gap-1 text-xs font-black text-brand-teal hover:text-brand-teal/80"
              >
                <Plus size={14} /> Add Classroom
              </button>
            </div>
            {classrooms.length === 0 ? (
              <p className="text-sm text-slate-400 font-bold">No classrooms created yet</p>
            ) : (
              <div className="space-y-2">
                {classrooms.map((classroom) => {
                  const grade = grades.find(g => g.id === classroom.grade_id);
                  return (
                    <div key={classroom.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <div>
                        <p className="text-sm font-black text-slate-900">Section {classroom.section}</p>
                        <p className="text-xs text-slate-500 font-bold">{grade?.name || 'Unknown Grade'} | Capacity: {classroom.capacity}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setEditingItem(classroom); setClassroomForm({ grade_id: classroom.grade_id, section: classroom.section, capacity: classroom.capacity }); setShowClassroomModal(true); }}
                          className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-brand-teal"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteClassroom(classroom.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="premium-card p-8">
          <h3 className="text-lg font-black text-slate-900 mb-4">Campus Settings</h3>
          <p className="text-sm text-slate-500 font-bold">Campus settings coming soon...</p>
        </div>
      )}

      {/* Level Modal */}
      {showLevelModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => { setShowLevelModal(false); setEditingItem(null); }} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
            <h2 className="text-xl font-black text-slate-900 mb-6">{editingItem ? 'Edit Level' : 'Add Level'}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Level Name *</label>
                <input
                  type="text"
                  value={levelForm.name}
                  onChange={(e) => setLevelForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Beginner, Advanced"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Shift</label>
                <select
                  value={levelForm.shift}
                  onChange={(e) => setLevelForm(prev => ({ ...prev, shift: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm"
                >
                  <option value="">All Shifts</option>
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-8">
              <button onClick={() => { setShowLevelModal(false); setEditingItem(null); }} className="flex-1 px-5 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-black text-xs uppercase tracking-widest text-slate-600 transition-all">
                Cancel
              </button>
              <button onClick={handleSaveLevel} disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                {saving ? 'Saving...' : (editingItem ? 'Update' : 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grade Modal */}
      {showGradeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => { setShowGradeModal(false); setEditingItem(null); }} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
            <h2 className="text-xl font-black text-slate-900 mb-6">{editingItem ? 'Edit Grade' : 'Add Grade'}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Level *</label>
                <select
                  value={gradeForm.level_id}
                  onChange={(e) => setGradeForm(prev => ({ ...prev, level_id: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm"
                >
                  <option value="">Select Level</option>
                  {levels.map(level => (
                    <option key={level.id} value={level.id}>{level.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Grade Name *</label>
                <input
                  type="text"
                  value={gradeForm.name}
                  onChange={(e) => setGradeForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Web Dev 101"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-8">
              <button onClick={() => { setShowGradeModal(false); setEditingItem(null); }} className="flex-1 px-5 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-black text-xs uppercase tracking-widest text-slate-600 transition-all">
                Cancel
              </button>
              <button onClick={handleSaveGrade} disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                {saving ? 'Saving...' : (editingItem ? 'Update' : 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Classroom Modal */}
      {showClassroomModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => { setShowClassroomModal(false); setEditingItem(null); }} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
            <h2 className="text-xl font-black text-slate-900 mb-6">{editingItem ? 'Edit Classroom' : 'Add Classroom'}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Grade *</label>
                <select
                  value={classroomForm.grade_id}
                  onChange={(e) => setClassroomForm(prev => ({ ...prev, grade_id: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm"
                >
                  <option value="">Select Grade</option>
                  {grades.map(grade => {
                    const level = levels.find(l => l.id === grade.level_id);
                    return (
                      <option key={grade.id} value={grade.id}>{grade.name} ({level?.name})</option>
                    );
                  })}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Section *</label>
                  <input
                    type="text"
                    value={classroomForm.section}
                    onChange={(e) => setClassroomForm(prev => ({ ...prev, section: e.target.value.toUpperCase() }))}
                    placeholder="A"
                    maxLength={5}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm uppercase"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Capacity</label>
                  <input
                    type="number"
                    value={classroomForm.capacity}
                    onChange={(e) => setClassroomForm(prev => ({ ...prev, capacity: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl focus:outline-none focus:border-brand-teal/20 font-bold text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-8">
              <button onClick={() => { setShowClassroomModal(false); setEditingItem(null); }} className="flex-1 px-5 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-black text-xs uppercase tracking-widest text-slate-600 transition-all">
                Cancel
              </button>
              <button onClick={handleSaveClassroom} disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                {saving ? 'Saving...' : (editingItem ? 'Update' : 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
