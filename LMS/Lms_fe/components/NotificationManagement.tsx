'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell, Search, Send, Target, Users, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { courseAPI, notificationAPI } from '@/lib/api';

type AudienceType = 'ALL' | 'ROLE' | 'COURSE' | 'CLASS' | 'CUSTOM';

interface Broadcast {
  id: string;
  title: string;
  message: string;
  audience_type: AudienceType;
  target_role: string;
  course_id?: string;
  scheduled_class_id?: string;
  delivery_count?: number;
  created_at: string;
}

const audienceOptions = [
  { value: 'ALL', label: 'Everyone' },
  { value: 'ROLE', label: 'Role Based' },
  { value: 'COURSE', label: 'Course Specific' },
  { value: 'CLASS', label: 'Class Specific' },
  { value: 'CUSTOM', label: 'Custom Recipients' },
];

const roleOptions = [
  { value: 'ALL', label: 'All Roles' },
  { value: 'STUDENT', label: 'Students' },
  { value: 'TEACHER', label: 'Teachers' },
  { value: 'COORDINATOR', label: 'Coordinators' },
  { value: 'ADMIN', label: 'Admins' },
];

export default function NotificationManagement() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    audience_type: 'ALL' as AudienceType,
    target_role: 'ALL',
    course_id: '',
    scheduled_class_id: '',
    recipient_ids: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [broadcastResponse, courseResponse, classResponse] = await Promise.all([
        notificationAPI.listBroadcasts(),
        courseAPI.getAll().catch(() => []),
        courseAPI.getScheduledClasses().catch(() => []),
      ]);

      setBroadcasts(Array.isArray(broadcastResponse) ? broadcastResponse : []);
      const courseList = Array.isArray(courseResponse) ? courseResponse : courseResponse?.results || [];
      setCourses(courseList);
      const classList = Array.isArray(classResponse) ? classResponse : classResponse?.results || [];
      setClasses(classList);
    } catch (error) {
      console.error('Error loading notifications:', error);
      toast.error('Unable to load notification data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      title: '',
      message: '',
      audience_type: 'ALL',
      target_role: 'ALL',
      course_id: '',
      scheduled_class_id: '',
      recipient_ids: '',
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.title.trim() || !formData.message.trim()) {
      toast.error('Title and message are required');
      return;
    }

    const payload: any = {
      title: formData.title.trim(),
      message: formData.message.trim(),
      audience_type: formData.audience_type,
      target_role: formData.target_role,
    };

    if (formData.audience_type === 'COURSE') {
      if (!formData.course_id) {
        toast.error('Please select a course');
        return;
      }
      payload.course_id = formData.course_id;
    }

    if (formData.audience_type === 'CLASS') {
      if (!formData.scheduled_class_id) {
        toast.error('Please select a scheduled class');
        return;
      }
      payload.scheduled_class_id = formData.scheduled_class_id;
    }

    if (formData.audience_type === 'CUSTOM') {
      const recipients = formData.recipient_ids
        .split(',')
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => !Number.isNaN(id));
      if (!recipients.length) {
        toast.error('Enter at least one valid recipient ID');
        return;
      }
      payload.recipient_ids = recipients;
    }

    try {
      setSubmitting(true);
      await notificationAPI.createBroadcast(payload);
      toast.success('Notification sent');
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Error sending notification:', error);
      toast.error(error?.response?.data?.error || 'Failed to send notification');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredBroadcasts = useMemo(() => {
    return broadcasts.filter((broadcast) =>
      broadcast.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [broadcasts, searchTerm]);

  if (loading) {
    return <div className="text-center py-12">Loading notifications...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Notification Management</h2>
          <p className="text-gray-600 mt-1">
            Broadcast announcements to students, teachers, or entire cohorts
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              className="moodle-input"
              placeholder="Exam reminder"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Audience</label>
            <select
              name="audience_type"
              value={formData.audience_type}
              onChange={handleInputChange}
              className="moodle-input"
            >
              {audienceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Role</label>
            <select
              name="target_role"
              value={formData.target_role}
              onChange={handleInputChange}
              className="moodle-input"
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {formData.audience_type === 'COURSE' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
              <select
                name="course_id"
                value={formData.course_id}
                onChange={handleInputChange}
                className="moodle-input"
              >
                <option value="">Select course</option>
                {courses.map((course: any) => (
                  <option key={course.id} value={course.id}>
                    {course.course_code || 'N/A'} - {course.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {formData.audience_type === 'CLASS' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Class</label>
              <select
                name="scheduled_class_id"
                value={formData.scheduled_class_id}
                onChange={handleInputChange}
                className="moodle-input"
              >
                <option value="">Select class</option>
                {classes.map((scheduled: any) => (
                  <option key={scheduled.id} value={scheduled.id}>
                    {scheduled.class_name || scheduled.course?.title} ({scheduled.course?.course_code || 'N/A'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {formData.audience_type === 'CUSTOM' && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recipient IDs (comma separated)
              </label>
              <input
                type="text"
                name="recipient_ids"
                value={formData.recipient_ids}
                onChange={handleInputChange}
                className="moodle-input"
                placeholder="101, 102, 103"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <textarea
            name="message"
            value={formData.message}
            onChange={handleInputChange}
            rows={4}
            className="moodle-input"
            placeholder="Share important updates, deadlines, or resources..."
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="moodle-button-secondary"
            onClick={resetForm}
            disabled={submitting}
          >
            Clear
          </button>
          <button
            type="submit"
            className="moodle-button flex items-center gap-2"
            disabled={submitting}
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Sending...' : 'Send Notification'}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary-500" />
            Broadcast History
          </h3>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search broadcasts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {filteredBroadcasts.map((broadcast) => (
            <div key={broadcast.id} className="p-6 hover:bg-gray-50 transition">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                      <Bell className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">{broadcast.title}</h4>
                      <p className="text-sm text-gray-500">
                        Sent {new Date(broadcast.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <p className="text-gray-700">{broadcast.message}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-600">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-50 text-indigo-700">
                      <Target className="w-3 h-3" />
                      {broadcast.audience_type}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                      <Users className="w-3 h-3" />
                      {broadcast.target_role}
                    </span>
                    {broadcast.course_id && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                        Course ID: {broadcast.course_id}
                      </span>
                    )}
                    {broadcast.scheduled_class_id && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-50 text-yellow-700">
                        Class ID: {broadcast.scheduled_class_id}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                      <Calendar className="w-3 h-3" />
                      Deliveries: {broadcast.delivery_count ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredBroadcasts.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Bell className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>No broadcasts yet. Send a notification to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
