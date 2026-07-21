'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, MapPin, Phone, Calendar, Save, GraduationCap, BookOpen } from 'lucide-react';
import { authAPI, courseAPI } from '@/lib/api';
import { getStoredUser, setStoredUser, getRoleDashboardPath, UserRole } from '@/lib/auth';
import toast from 'react-hot-toast';

export default function CompleteProfilePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [courses, setCourses] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        phone: '',
        address: '',
        date_of_birth: '',
        guardian_name: '',
        guardian_phone: '',
        qualification: '',
        experience_years: '',
        selected_course: '',
    });

    useEffect(() => {
        // Check authentication
        const storedUser = getStoredUser();
        if (!storedUser) {
            router.push('/login');
            return;
        }

        setUser(storedUser);

        // Pre-fill form
        setFormData(prev => ({
            ...prev,
            first_name: storedUser.first_name || '',
            last_name: storedUser.last_name || '',
        }));

        // Fetch courses if student
        if (storedUser.role === 'STUDENT') {
            fetchCourses();
        }

        // If already completed, redirect
        if (storedUser.profile_completed) {
            const dashboardPath = getRoleDashboardPath((storedUser.role as string).toUpperCase() as UserRole);
            router.push(dashboardPath);
        }
    }, [router]);

    const fetchCourses = async () => {
        try {
            const data = await courseAPI.getAll();
            setCourses(data);
        } catch (error) {
            console.error('Failed to fetch courses:', error);
            toast.error('Failed to load courses');
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload: any = {
                first_name: formData.first_name,
                last_name: formData.last_name,
                phone: formData.phone,
                address: formData.address,
                date_of_birth: formData.date_of_birth || null,
            };

            // Add role-specific fields
            if (user?.role === 'STUDENT') {
                if (formData.guardian_name) payload.guardian_name = formData.guardian_name;
                if (formData.guardian_phone) payload.guardian_phone = formData.guardian_phone;
            } else if (user?.role === 'TEACHER') {
                if (formData.qualification) payload.qualification = formData.qualification;
                if (formData.experience_years) payload.experience_years = parseInt(formData.experience_years);
            }

            console.log('Submitting profile update:', payload);
            const updatedUser = await authAPI.completeProfile(payload);

            // Enroll in course if selected (only for students)
            if (user?.role === 'STUDENT' && formData.selected_course) {
                try {
                    await courseAPI.enroll(formData.selected_course);
                    toast.success('Enrolled in course successfully!');
                } catch (enrollError: any) {
                    console.error('Enrollment failed:', enrollError);
                    const msg = enrollError?.response?.data?.detail || enrollError?.message || 'Enrollment failed';
                    toast.error(`Profile updated but course enrollment failed: ${msg}. You can enroll manually from dashboard.`);
                }
            }

            // Update local storage
            // Ensure profile_completed is true (backend should return it, but force it just in case)
            updatedUser.profile_completed = true;
            setStoredUser(updatedUser);

            toast.success('Profile completed successfully!');

            // Check if password needs to be changed
            let redirectPath;
            if (updatedUser.password_changed === false) {
                console.log('⚠️ Password not changed, redirecting to change-password page');
                redirectPath = '/change-password';
            } else {
                // Redirect to dashboard
                redirectPath = getRoleDashboardPath((updatedUser.role as string).toUpperCase() as UserRole);
            }

            window.location.href = redirectPath;

        } catch (error: any) {
            console.error('Profile update failed:', error);
            const msg = error.response?.data?.error || error.response?.data?.detail || 'Failed to update profile';

            // Handle validation errors object
            if (typeof msg === 'object') {
                const firstError = Object.values(msg)[0];
                toast.error(Array.isArray(firstError) ? firstError[0] : String(firstError));
            } else {
                toast.error(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl shadow-lg mb-4">
                        <GraduationCap className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">Complete Your Profile</h1>
                    <p className="text-lg text-gray-600">Just a few more details to get you started</p>
                </div>

                <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
                    <form onSubmit={handleSubmit} className="p-8 space-y-6">

                        {/* Personal Information */}
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">Personal Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                        <input
                                            type="text"
                                            name="first_name"
                                            value={formData.first_name}
                                            onChange={handleChange}
                                            className="moodle-input pl-10"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                        <input
                                            type="text"
                                            name="last_name"
                                            value={formData.last_name}
                                            onChange={handleChange}
                                            className="moodle-input pl-10"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                        <input
                                            type="tel"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleChange}
                                            className="moodle-input pl-10"
                                            placeholder="1234567890"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                        <input
                                            type="date"
                                            name="date_of_birth"
                                            value={formData.date_of_birth}
                                            onChange={handleChange}
                                            className="moodle-input pl-10"
                                        />
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                                        <textarea
                                            name="address"
                                            value={formData.address}
                                            onChange={handleChange}
                                            className="moodle-input pl-10 py-2"
                                            rows={3}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Course Selection for Students */}
                        {user.role === 'STUDENT' && (
                            <div>
                                <h3 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">Course Selection</h3>
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Your Course *</label>
                                    <div className="relative">
                                        <BookOpen className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                        <select
                                            name="selected_course"
                                            value={formData.selected_course}
                                            onChange={handleChange}
                                            className="moodle-input pl-10 appearance-none cursor-pointer"
                                            required
                                        >
                                            <option value="" disabled>-- Choose a course --</option>
                                            {courses.map((course) => (
                                                <option key={course.id} value={course.id}>
                                                    {course.code ? `${course.code} - ${course.name}` : course.name || 'Unnamed Course'}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <p className="mt-2 text-sm text-gray-600 flex items-center gap-1">
                                        <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                        You will be automatically enrolled in this course
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Role Specific Information */}
                        {user.role === 'STUDENT' && (
                            <div>
                                <h3 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">Guardian Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Guardian Name</label>
                                        <input
                                            type="text"
                                            name="guardian_name"
                                            value={formData.guardian_name}
                                            onChange={handleChange}
                                            className="moodle-input"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Guardian Phone</label>
                                        <input
                                            type="tel"
                                            name="guardian_phone"
                                            value={formData.guardian_phone}
                                            onChange={handleChange}
                                            className="moodle-input"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {user.role === 'TEACHER' && (
                            <div>
                                <h3 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">Professional Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Qualification</label>
                                        <input
                                            type="text"
                                            name="qualification"
                                            value={formData.qualification}
                                            onChange={handleChange}
                                            className="moodle-input"
                                            placeholder="e.g. PhD in Computer Science"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Experience (Years)</label>
                                        <input
                                            type="number"
                                            name="experience_years"
                                            value={formData.experience_years}
                                            onChange={handleChange}
                                            className="moodle-input"
                                            min="0"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full moodle-button py-3 flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        Saving Profile...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        Complete Profile & Continue
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
