import { useState } from 'react';
import { Search, Plus, BookOpen, Eye, Edit, Trash2 } from 'lucide-react';

interface CourseManagementTabProps {
    courses: any[];
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    onRefresh: () => void;
}

export default function CourseManagementTab({ courses, searchTerm, setSearchTerm, onRefresh }: CourseManagementTabProps) {
    const [showCreateModal, setShowCreateModal] = useState(false);

    const filteredCourses = courses.filter((course: any) =>
        course.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Course Management</h2>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center gap-2 transition"
                >
                    <Plus className="w-5 h-5" />
                    Create Course
                </button>
            </div>

            {/* Search */}
            <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search courses..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    />
                </div>
            </div>

            {/* Courses Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCourses.map((course: any) => (
                    <div key={course.id} className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition">
                        <div className="flex items-start justify-between mb-4">
                            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                                <BookOpen className="w-6 h-6 text-primary-600" />
                            </div>
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${course.is_published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                                {course.is_published ? 'Published' : 'Draft'}
                            </span>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{course.title}</h3>
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{course.description}</p>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">
                                {new Date(course.created_at).toLocaleDateString()}
                            </span>
                            <div className="flex items-center gap-2">
                                <button className="text-primary-600 hover:text-primary-900" title="View">
                                    <Eye className="w-4 h-4" />
                                </button>
                                <button className="text-blue-600 hover:text-blue-900" title="Edit">
                                    <Edit className="w-4 h-4" />
                                </button>
                                <button className="text-red-600 hover:text-red-900" title="Delete">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filteredCourses.length === 0 && (
                <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow-sm">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>No courses found</p>
                </div>
            )}
        </div>
    );
}
