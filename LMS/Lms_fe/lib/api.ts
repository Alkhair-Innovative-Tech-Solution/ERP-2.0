import axios from 'axios';
import { getAuthHeaders, clearAuth, getStoredUser } from './auth';

const getBaseUrl = () => {
  // 1. Smart Detection for Local Development
  if (typeof window !== 'undefined') {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('192.168.');
    const isDevPort = window.location.port === '3000' || window.location.port === '3001' || window.location.port === '3002' || window.location.port === '3003' || window.location.port === '3004' || window.location.port === '3005';

    if (isLocal && isDevPort) {
      return 'http://localhost:8000';
    }
  }

  // 2. Use environment variable if set
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // Standard Production: Use relative URL so it hits the same origin via Nginx
  return '';
};

const API_BASE_URL = getBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getFileUrl = (path: string | null | undefined) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

// Request interceptor to add auth token and org_id
api.interceptors.request.use(
  (config) => {
    // Always try to get token from localStorage directly
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('lms_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      // 🔹 Multi-Tenancy: Add org_id and campus_id headers
      const orgId = localStorage.getItem('selected_org_id');
      const campusId = localStorage.getItem('selected_campus_id');
      if (orgId) {
        config.headers['X-Org-Id'] = orgId;
      }
      if (campusId) {
        config.headers['X-Campus-Id'] = campusId;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only redirect to login if we're not already on login page
    if (error.response?.status === 401) {
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
      // Don't redirect if already on login/register pages
      if (!currentPath.startsWith('/login') && !currentPath.startsWith('/register')) {
        console.warn('🚫 401 Unauthorized - Token may be invalid or expired');
        // Check if token exists before clearing
        const token = typeof window !== 'undefined' ? localStorage.getItem('lms_token') : null;
        if (!token) {
          console.warn('⚠️ No token found, redirecting to login');
          clearAuth();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        } else {
          console.warn('⚠️ Token exists but request failed - may be expired or invalid');
          // Don't redirect immediately, let the component handle it
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// ─── Pagination Utility ────────────────────────────────
interface PaginationParams {
  maxPages?: number;
  pageSize?: number;
}

async function fetchAllPages<T>(
  baseUrl: string,
  params: PaginationParams = {},
  extractItems?: (data: any) => T[]
): Promise<T[]> {
  const { maxPages = 3, pageSize = 100 } = params;
  const allItems: T[] = [];
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    const separator = baseUrl.includes('?') ? '&' : '?';
    const response = await api.get(`${baseUrl}${separator}page=${page}&page_size=${pageSize}`);
    const data = response.data;

    const items = extractItems
      ? extractItems(data)
      : data.results || data.items || data.data || (Array.isArray(data) ? data : []);

    allItems.push(...items);

    const totalPages = data.pages || data.total_pages || (data.count ? Math.ceil(data.count / pageSize) : page);
    hasNext = page < totalPages && items.length > 0 && page < maxPages;
    page++;
  }

  return allItems;
}

// Auth API
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await api.post('/api/auth/login', { email, password });
    const responseData = response.data;
    return {
      token: responseData.access || responseData.access_token || responseData.token,
      refresh_token: responseData.refresh || responseData.refresh_token,
      user: responseData.user,
    };
  },
  register: async (data: {
    username: string;
    email: string;
    password: string;
    role: 'STUDENT' | 'TEACHER';
    first_name?: string;
    last_name?: string;
  }) => {
    const endpoint = data.role === 'STUDENT' ? '/api/v1/auth/register/student/' : '/api/v1/auth/register/teacher/';
    const response = await api.post(endpoint, data);
    const responseData = response.data;
    return {
      token: responseData.access_token || responseData.token,
      refresh_token: responseData.refresh_token,
      user: responseData.user,
    };
  },
  getCurrentUser: async () => {
    const response = await api.get('/api/auth/me/');
    return response.data;
  },
  completeProfile: async (data: any) => {
    const response = await api.patch('/api/v1/auth/profile/complete/', data);
    return response.data;
  },
  changePassword: async (oldPassword: string, newPassword: string) => {
    const response = await api.post('/api/v1/auth/change-password/', {
      old_password: oldPassword,
      new_password: newPassword,
    });
    return response.data;
  },
  requestPasswordReset: async (email: string) => {
    const response = await api.post('/api/v1/auth/password-reset/request/', { email });
    return response.data;
  },
  confirmPasswordReset: async (data: any) => {
    const response = await api.post('/api/v1/auth/password-reset/confirm/', data);
    return response.data;
  },
  sendVerificationOtp: async (email: string) => {
    const response = await api.post('/api/auth/send-verification-otp', { email });
    return response.data;
  },
  forcePasswordChange: async (data: { email: string; otp: string; new_password: string }) => {
    const response = await api.post('/api/auth/force-password-change', data);
    return response.data;
  },
getAnalyticsOverview: async (branch_id?: string, organization_id?: string) => {
    let url = '/api/auth/analytics/overview/';
    const params = new URLSearchParams();
    if (branch_id) params.set('branch_id', branch_id);
    // 🔹 Multi-Tenancy: Add org_id filter
    if (organization_id) params.set('organization_id', organization_id);
    if (params.toString()) url += '?' + params.toString();
    const response = await api.get(url);
    return response.data;
},
  getTeacherAttendance: async (date: string) => {
    const response = await api.get(`/api/auth/coordinator/teachers/attendance/?date=${date}`);
    return response.data;
  },
  markTeacherAttendance: async (teacher_id: string, date: string, status: string, remarks: string = "") => {
    const response = await api.post('/api/auth/coordinator/teachers/attendance/', {
      teacher_id, date, status, remarks
    });
    return response.data;
  },
};

// Branch API
export const branchAPI = {
  getAll: async (isActive?: boolean) => {
    const params = isActive !== undefined ? `?is_active=${isActive}` : '';
    const response = await api.get(`/api/auth/branches/${params}`);
    return response.data;
  },
  create: async (data: { code: string; name: string; address?: string; city?: string; contact_phone?: string }) => {
    const response = await api.post('/api/auth/branches/', data);
    return response.data;
  },
  update: async (branchId: string, data: Partial<{ code: string; name: string; address: string; city: string; contact_phone: string; is_active: boolean }>) => {
    const response = await api.put(`/api/auth/branches/${branchId}/`, data);
    return response.data;
  },
  delete: async (branchId: string) => {
    const response = await api.delete(`/api/auth/branches/${branchId}/`);
    return response.data;
  },
};



// Fee Management API
export const feeAPI = {
  getFeeStructures: async (organization_id?: string, courseId?: string, isActive?: boolean) => {
    let url = '/api/courses/fee-structures/';
    const params = new URLSearchParams();
    // 🔹 Multi-Tenancy: Add org_id filter
    if (organization_id) params.set('organization_id', organization_id);
    if (courseId) params.set('course_id', courseId);
    if (isActive !== undefined) params.set('is_active', String(isActive));
    if (params.toString()) url += '?' + params.toString();
    const response = await api.get(url);
    return response.data;
  },
  createFeeStructure: async (data: any) => {
    const response = await api.post('/api/courses/fee-structures/', data);
    return response.data;
  },
  updateFeeStructure: async (feeId: string, data: any) => {
    const response = await api.put(`/api/courses/fee-structures/${feeId}/`, data);
    return response.data;
  },
  deleteFeeStructure: async (feeId: string) => {
    const response = await api.delete(`/api/courses/fee-structures/${feeId}/`);
    return response.data;
  },
  getFeeRecords: async (params: { page?: number; limit?: number; student_id?: string; course_id?: string; payment_status?: string; fee_month?: string; search?: string; organization_id?: string } = {}) => {
    const { page = 1, limit = 50, ...filters } = params;
    let url = `/api/courses/fee-records/?page=${page}&limit=${limit}`;
    // 🔹 Multi-Tenancy: Add org_id filter
    Object.entries(filters).forEach(([key, val]) => { if (val) url += `&${key}=${encodeURIComponent(val)}`; });
    const response = await api.get(url);
    return response.data;
  },
  lookupStudent: async (studentId: string) => {
    const response = await api.get(`/api/courses/fee-records/lookup/?student_id=${encodeURIComponent(studentId)}`);
    return response.data;
  },
  recordPayment: async (recordId: string, data: { amount: number; payment_method: string; transaction_reference?: string; received_by_id?: string; received_by_name?: string; remarks?: string }) => {
    const response = await api.post(`/api/courses/fee-records/${recordId}/pay/`, data);
    return response.data;
  },
  recordFullPayment: async (data: {
    student_id: string; course_id: string; scheduled_class_id?: string;
    payment_method: string; transaction_reference?: string;
    received_by_id?: string; received_by_name?: string;
    discount_type?: string; discount_value?: number; remarks?: string;
    amount?: number;
  }) => {
    const response = await api.post('/api/courses/fee-records/full-pay/', data);
    return response.data;
  },
  waiveFee: async (recordId: string) => {
    const response = await api.post(`/api/courses/fee-records/${recordId}/waive/`);
    return response.data;
  },
  getMyFees: async () => {
    const response = await api.get('/api/courses/fee-records/my-fees/');
    return response.data;
  },
  getTodaySummary: async (branchId?: string, organization_id?: string) => {
    let url = '/api/courses/fee-records/today-summary/';
    const params = new URLSearchParams();
    if (branchId) params.set('branch_id', branchId);
    // 🔹 Multi-Tenancy: Add org_id filter
    if (organization_id) params.set('organization_id', organization_id);
    if (params.toString()) url += '?' + params.toString();
    const response = await api.get(url);
    return response.data;
  },
  getReceiptData: async (recordId: string) => {
    const response = await api.get(`/api/courses/fee-records/${recordId}/receipt/`);
    return response.data;
  },
  getFeeAnalytics: async (branchId?: string, organization_id?: string) => {
    let url = '/api/courses/fee-analytics/';
    const params = new URLSearchParams();
    if (branchId) params.set('branch_id', branchId);
    // 🔹 Multi-Tenancy: Add org_id filter
    if (organization_id) params.set('organization_id', organization_id);
    if (params.toString()) url += '?' + params.toString();
    const response = await api.get(url);
    return response.data;
  },
};



// Course API
export const courseAPI = {
  getAll: async (opts?: { archived?: boolean; search?: string; branch_id?: string; maxPages?: number; organization_id?: string }) => {
    try {
      const { archived = false, search, branch_id, maxPages = 3, organization_id } = opts || {};
      let url = `/api/courses/courses/?archived=${archived}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (branch_id) url += `&branch_id=${branch_id}`;
      // 🔹 Multi-Tenancy: Add org_id filter
      if (organization_id) url += `&organization_id=${organization_id}`;

      const courses = await fetchAllPages<any>(url, { maxPages });
      console.log('📚 Courses API response: total', courses.length);
      return courses;
    } catch (error) {
      console.error('❌ Error fetching courses:', error);
      throw error;
    }
  },

  getAllPaginated: async (opts?: { page?: number; limit?: number; archived?: boolean; search?: string; branch_id?: string }) => {
    const { page = 1, limit = 20, archived = false, search, branch_id } = opts || {};
    let url = `/api/courses/courses/?page=${page}&limit=${limit}&archived=${archived}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (branch_id) url += `&branch_id=${branch_id}`;
    const response = await api.get(url);
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/api/courses/courses/${id}/`);
    return response.data;
  },
  enroll: async (courseId: string, scheduledClassId?: string, branchId?: string) => {
    try {
      const userStr = localStorage.getItem('lms_user');
      if (!userStr) throw new Error('User not found');
      const user = JSON.parse(userStr);

      const payload: any = {
        course_id: courseId,
        student_id: user.id,
      };
      if (scheduledClassId) payload.scheduled_class_id = scheduledClassId;
      if (branchId) payload.branch_id = branchId;

      const response = await api.post('/api/courses/enrollments/', payload);
      return response.data;
    } catch (error) {
      console.error('Error enrolling in course:', error);
      throw error;
    }
  },
  getMyEnrollments: async () => {
    try {
      const userStr = localStorage.getItem('lms_user');
      if (!userStr) throw new Error('User not found');
      const user = JSON.parse(userStr);
      const response = await api.get(`/api/courses/enrollments/?student_id=${user.id}`);
      console.log('📚 Enrollments API response:', response.data);
      const data = response.data;
      if (data && data.items && !data.results) {
        data.results = data.items;
      }
      return data;
    } catch (error) {
      console.error('Error fetching enrollments:', error);
      throw error;
    }
  },
  getEnrollments: async (params: { page?: number; limit?: number; student_id?: string; course_id?: string; branch_id?: string; status?: string; class_status?: string; search?: string; archived?: boolean; organization_id?: string } = {}) => {
    const { page = 1, limit = 20, student_id, course_id, branch_id, status, class_status, search, archived = false, organization_id } = params;
    let url = `/api/courses/enrollments/?page=${page}&limit=${limit}&archived=${archived}`;
    if (student_id) url += `&student_id=${student_id}`;
    if (course_id && course_id !== 'ALL') url += `&course_id=${course_id}`;
    if (branch_id) url += `&branch_id=${branch_id}`;
    if (status && status !== 'ALL') url += `&status=${status}`;
    if (class_status && class_status !== 'ALL') url += `&class_status=${class_status}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    // 🔹 Multi-Tenancy: Add org_id filter
    if (organization_id) url += `&organization_id=${organization_id}`;
    const response = await api.get(url);
    const data = response.data;
    if (data && data.items && !data.results) {
      data.results = data.items;
    }
    return data;
  },
  getEnrollmentsByInstructor: async (instructorId: string | number, maxPages: number = 3) => {
    try {
      const url = `/api/courses/enrollments/?instructor_id=${instructorId}`;
      const enrollments = await fetchAllPages<any>(url, { maxPages });
      console.log(`👨‍🏫 Enrollments by instructor: Fetched ${enrollments.length} total enrollments`);
      return enrollments;
    } catch (error) {
      console.error('Error fetching enrollments by instructor:', error);
      throw error;
    }
  },
  getScheduledClasses: async (courseId?: string, instructorId?: string | number, branchId?: string, status?: string, active?: boolean) => {
    try {
      const params = new URLSearchParams();
      if (courseId) params.append('course_id', courseId);
      if (instructorId) params.append('instructor_id', String(instructorId));
      if (branchId) params.append('branch_id', branchId);
      if (status) params.append('status', status);
      if (active !== undefined) params.append('active', String(active));

      const url = params.toString()
        ? `/api/courses/scheduled-classes/?${params.toString()}`
        : '/api/courses/scheduled-classes/';
      const response = await api.get(url);
      console.log('📅 Scheduled Classes API response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching scheduled classes:', error);
      throw error;
    }
  },
  getScheduledClassById: async (id: string) => {
    try {
      const response = await api.get(`/api/courses/scheduled-classes/${id}/`);
      console.log('📅 Scheduled Class API response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching scheduled class:', error);
      throw error;
    }
  },
  getClassWhatsAppLink: async (classId: string) => {
    try {
      const response = await api.get(`/api/courses/scheduled-classes/${classId}/whatsapp-link/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching WhatsApp link:', error);
      return { link: '' };
    }
  },
  getCourseContent: async (courseId?: string, scheduledClassId?: string) => {
    const params = new URLSearchParams();
    if (courseId) params.append('course_id', courseId);
    if (scheduledClassId) params.append('scheduled_class_id', scheduledClassId);

    const url = params.toString() ? `/api/content/?${params.toString()}` : '/api/content/';
    const response = await api.get(url);
    return response.data;
  },
  createCourseContent: async (data: FormData) => {
    const response = await api.post('/api/content/', data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  deleteCourseContent: async (contentId: string) => {
    await api.delete(`/api/content/${contentId}/`);
  },
  getMyCourses: async () => {
    try {
      const userStr = localStorage.getItem('lms_user');
      if (!userStr) throw new Error('User not found');
      const user = JSON.parse(userStr);
      const response = await api.get(`/api/courses/courses/?instructor_id=${user.id}`);
      console.log('👨‍🏫 My Courses API response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching my courses:', error);
      throw error;
    }
  },
  create: async (data: any) => {
    const formData = new FormData();
    formData.append('name', data.name);
    if (data.description) formData.append('description', data.description);
    formData.append('active', String(data.active ?? true));
    formData.append('specialization', data.specialization);
    formData.append('level', String(data.level || 0));
    formData.append('duration', String(data.duration || 6));
    
    if (data.image instanceof File) {
      formData.append('image', data.image);
    }
    
    const response = await api.post('/api/courses/courses/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  update: async (id: string, data: any) => {
    const formData = new FormData();
    if (data.name) formData.append('name', data.name);
    if (data.description) formData.append('description', data.description);
    if (data.active !== undefined) formData.append('active', String(data.active));
    if (data.specialization) formData.append('specialization', data.specialization);
    if (data.level !== undefined) formData.append('level', String(data.level));
    if (data.duration !== undefined) formData.append('duration', String(data.duration));
    
    if (data.image instanceof File) {
      formData.append('image', data.image);
    }

    const response = await api.patch(`/api/courses/courses/${id}/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  delete: async (id: string) => {
    await api.delete(`/api/courses/courses/${id}/`);
  },
  restore: async (id: string) => {
    await api.post(`/api/courses/courses/${id}/restore/`);
  },
  enrollStudent: async (data: { student_id: string; course_id: string; scheduled_class_id?: string; branch_id?: string }) => {
    const response = await api.post('/api/courses/enrollments/', data);
    return response.data;
  },
  deleteEnrollment: async (id: string | number) => {
    await api.delete(`/api/courses/enrollments/${id}/`);
  },
  updateEnrollment: async (id: string | number, data: any) => {
    const response = await api.patch(`/api/courses/enrollments/${id}/`, data);
    return response.data;
  },
  createScheduledClass: async (data: any) => {
    const response = await api.post('/api/courses/scheduled-classes/', data);
    return response.data;
  },
  updateScheduledClass: async (id: string, data: any) => {
    const response = await api.patch(`/api/courses/scheduled-classes/${id}/`, data);
    return response.data;
  },
  deleteScheduledClass: async (id: string) => {
    await api.delete(`/api/courses/scheduled-classes/${id}/`);
  },
  getRooms: async () => {
    const response = await api.get('/api/courses/rooms/');
    return response.data;
  },
  createRoom: async (data: any) => {
    const response = await api.post('/api/courses/rooms/', {
      name: data.name,
      capacity: data.capacity,
      branch_id: data.branch_id || undefined
    });
    return response.data;
  },
  getSpecializations: async (organization_id?: string) => {
    let url = '/api/courses/specialization/all';
    // 🔹 Multi-Tenancy: Add org_id filter
    if (organization_id) url += `?organization_id=${organization_id}`;
    const response = await api.get(url);
    return response.data;
  },
  createSpecialization: async (data: any) => {
    const response = await api.post('/api/courses/specialization', data);
    return response.data;
  },
  updateSpecialization: async (id: string, data: any) => {
    const response = await api.patch(`/api/courses/specialization/${id}/`, data);
    return response.data;
  },
  deleteSpecialization: async (id: string) => {
    const response = await api.delete(`/api/courses/specialization/${id}/`);
    return response.data;
  },
  restoreSpecialization: async (id: string) => {
    const response = await api.post(`/api/courses/specialization/${id}/restore/`);
    return response.data;
  },
  getBatches: async () => {
    const response = await api.get('/api/courses/batches/all');
    return response.data;
  },
  getDepositsByStudent: async (studentId: string) => {
    const response = await api.get(`/api/courses/deposits/?student_id=${studentId}`);
    return response.data;
  },
  getFeeStructure: async (courseId: string, scheduledClassId?: string) => {
    let url = `/api/courses/fee-structures/?course_id=${courseId}&is_active=true`;
    if (scheduledClassId) url += `&scheduled_class_id=${scheduledClassId}`;
    const response = await api.get(url);
    return response.data;
  },
  reenrollAlumni: async (studentId: string, courseId: string, scheduledClassId?: string) => {
    const data: any = { student_id: studentId, course_id: courseId };
    if (scheduledClassId) data.scheduled_class_id = scheduledClassId;
    const response = await api.post('/api/courses/enrollments/re-enroll/', data);
    return response.data;
  },

  // ─── Coordinator Section & Warning APIs ─────────────────────
  getCoordinatorSectionsSummary: async (params?: { status?: string; today?: boolean }) => {
    const response = await api.get('/api/courses/coordinator/sections-summary/', { params });
    return response.data;
  },

  getCoordinatorSectionStudents: async (sectionId: string) => {
    const response = await api.get(`/api/courses/coordinator/sections/${sectionId}/students/`);
    return response.data;
  },

  getCoordinatorAtRiskStudents: async (sectionId: string, threshold: number = 75) => {
    const response = await api.get(`/api/courses/coordinator/sections/${sectionId}/at-risk-students/?threshold=${threshold}`);
    return response.data;
  },

  getCoordinatorWarnings: async (params?: { student_id?: string; section_id?: string; resolved?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.student_id) query.append('student_id', params.student_id);
    if (params?.section_id) query.append('section_id', params.section_id);
    if (params?.resolved !== undefined) query.append('resolved', String(params.resolved));
    const url = `/api/courses/coordinator/warnings/${query.toString() ? '?' + query.toString() : ''}`;
    const response = await api.get(url);
    return response.data;
  },

  createCoordinatorWarning: async (data: {
    student_id: string;
    scheduled_class_id?: string;
    warning_type: string;
    description?: string;
  }) => {
    const response = await api.post('/api/courses/coordinator/warnings/', data);
    return response.data;
  },

  resolveCoordinatorWarning: async (warningId: string, data: { resolution_notes?: string }) => {
    const response = await api.patch(`/api/courses/coordinator/warnings/${warningId}/resolve/`, data);
    return response.data;
  },

  getDashboardStats: async () => {
    const response = await api.get('/api/courses/coordinator/dashboard/stats/');
    return response.data;
  },
};

// Content API (Port 8003 via Gateway)
export const contentAPI = {
  getCurriculum: async (courseId: string, userId?: string) => {
    const url = userId
      ? `/api/content/${courseId}/curriculum/?user_id=${userId}`
      : `/api/content/${courseId}/curriculum/`;
    const response = await api.get(url);
    return response.data;
  },
  updateProgress: async (lessonId: string, isCompleted: boolean) => {
    const response = await api.post('/api/content/progress/', {
      lesson_id: lessonId,
      is_completed: isCompleted
    });
    return response.data;
  },
  createModule: async (data: { course_id: string; title: string; description?: string; order?: number }) => {
    const response = await api.post('/api/content/modules/', data);
    return response.data;
  },
  createLesson: async (data: { module_id: string; title: string; description?: string; order?: number; duration_minutes?: number }) => {
    const response = await api.post('/api/content/lessons/', data);
    return response.data;
  },
  createContentItem: async (data: FormData) => {
    const response = await api.post('/api/content/items/', data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },
  deleteLesson: async (lessonId: string) => {
    const response = await api.delete(`/api/content/lessons/${lessonId}/`);
    return response.data;
  },
  deleteContentItem: async (itemId: string) => {
    const response = await api.delete(`/api/content/items/${itemId}/`);
    return response.data;
  }
};

// Batch API
export const batchAPI = {
  getAll: async () => {
    const response = await api.get('/api/courses/batches/all');
    return response.data.data || response.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/api/courses/batches/${id}`);
    return response.data.data || response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/api/courses/batch', data);
    return response.data.data || response.data;
  },
  update: async (id: string, data: any) => {
    const response = await api.patch(`/api/courses/batches/${id}`, data);
    return response.data.data || response.data;
  },
  delete: async (id: string) => {
    await api.delete(`/api/courses/batches/${id}`);
  },
  getAnalytics: async (id: string) => {
    const response = await api.get(`/api/courses/batches/${id}/analytics`);
    return response.data;
  },
};

// Interview API
export const interviewAPI = {
  getAll: async () => {
    const response = await api.get('/api/admission/interviews/');
    return response.data.results || response.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/api/admission/interviews/${id}/`);
    return response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/api/admission/interviews/', data);
    return response.data;
  },
  update: async (id: string, data: any) => {
    const response = await api.patch(`/api/admission/interviews/${id}/`, data);
    return response.data;
  },
  delete: async (id: string) => {
    await api.delete(`/api/admission/interviews/${id}/`);
  },
};

// Attendance API
export const attendanceAPI = {
  getAttendance: async (scheduledClassId?: string, date?: string, instructorId?: string | number) => {
    try {
      const params = new URLSearchParams();
      if (scheduledClassId) params.append('scheduled_class_id', scheduledClassId);
      if (date) params.append('date', date);
      if (instructorId) params.append('instructor_id', String(instructorId));

      const url = params.toString()
        ? `/api/courses/attendance/?${params.toString()}`
        : '/api/courses/attendance/';
      const response = await api.get(url);
      console.log('📋 Attendance API response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching attendance:', error);
      throw error;
    }
  },
  markAttendance: async (scheduledClassId: string, date: string, studentAttendance: Array<{ student_id: number, status: string, remarks?: string }>, instructorId?: string | number) => {
    try {
      const payload: any = {
        scheduled_class_id: scheduledClassId,
        date: date,
        student_attendance: studentAttendance,
      };
      if (instructorId) {
        payload.instructor_id = instructorId;
      }
      const response = await api.post('/api/courses/attendance/mark/', payload);
      console.log('✅ Attendance marked:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error marking attendance:', error);
      throw error;
    }
  },
  getByCourse: async (courseId: string, date?: string) => {
    const url = date
      ? `/api/courses/attendance/?course_id=${courseId}&date=${date}`
      : `/api/courses/attendance/?course_id=${courseId}`;
    const response = await api.get(url);
    return response.data;
  },
  markBulk: async (data: { course_id?: string; scheduled_class_id?: string; date: string; records: any[]; graded_by_id?: string | number }) => {
    const response = await api.post('/api/courses/attendance/bulk/', data);
    return response.data;
  },
  getStudentStats: async (studentId: string) => {
    const response = await api.get(`/api/courses/attendance/stats/${studentId}/`);
    return response.data;
  },
  getSuggestedDates: async (scheduledClassId: string) => {
    try {
      const response = await api.get(`/api/courses/attendance/scheduled-class/${scheduledClassId}/suggested-dates/`);
      console.log('📅 Suggested dates:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching suggested dates:', error);
      throw error;
    }
  },
  getScheduledClassStudents: async (scheduledClassId: string) => {
    try {
      const response = await api.get(`/api/courses/attendance/scheduled-class/${scheduledClassId}/students/`);
      console.log('👥 Scheduled class students:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching scheduled class students:', error);
      throw error;
    }
  },
};

// Assignment API
export const assignmentAPI = {
  getAll: async (courseId?: string, instructorId?: string | number, scheduledClassId?: string, page: number = 1, limit: number = 20) => {
    try {
      const params = new URLSearchParams();
      if (courseId) params.append('course_id', courseId);
      if (instructorId) params.append('instructor_id', String(instructorId));
      if (scheduledClassId) params.append('scheduled_class_id', scheduledClassId);
      params.append('page', String(page));
      params.append('limit', String(limit));

      const response = await api.get(`/api/courses/assignments/?${params.toString()}`);
      const data = response.data;
      
      if (Array.isArray(data)) return data;
      return data.results || [];
    } catch (error) {
      console.error('Error fetching assignments:', error);
      return [];
    }
  },
  getById: async (id: string) => {
    const response = await api.get(`/api/courses/assignments/${id}/`);
    return response.data;
  },
  create: async (assignmentData: {
    course_id: string;
    title: string;
    description?: string;
    instructions?: string;
    total_marks: number;
    due_date?: string;
    assignment_type?: string;
    is_published?: boolean;
    created_by_id?: string | number;
    attachment?: File;
    instructor_id?: string | number;
    scheduled_class_id?: string;
  }) => {
    const formData = new FormData();
    formData.append('course_id', assignmentData.course_id);
    formData.append('title', assignmentData.title);
    if (assignmentData.description) formData.append('description', assignmentData.description);
    if (assignmentData.instructions) formData.append('instructions', assignmentData.instructions);
    formData.append('total_marks', String(assignmentData.total_marks));
    if (assignmentData.due_date) formData.append('due_date', assignmentData.due_date);
    if (assignmentData.assignment_type) formData.append('assignment_type', assignmentData.assignment_type);
    if (assignmentData.is_published !== undefined) formData.append('is_published', String(assignmentData.is_published));
    if (assignmentData.created_by_id) formData.append('created_by_id', String(assignmentData.created_by_id));
    if (assignmentData.attachment) {
      formData.append('attachment', assignmentData.attachment);
    }
    if (assignmentData.scheduled_class_id) {
      formData.append('scheduled_class_id', assignmentData.scheduled_class_id);
    }

    let url = '/api/courses/assignments/';
    if (assignmentData.instructor_id) {
      url += `?instructor_id=${assignmentData.instructor_id}`;
    }

    const response = await api.post(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

export const submissionAPI = {
  getAll: async (assignmentId?: string, studentId?: string | number) => {
    try {
      const params = new URLSearchParams();
      if (assignmentId) params.append('assignment_id', assignmentId);
      if (studentId) params.append('student_id', studentId.toString());
      
      const response = await api.get(`/api/courses/submissions/?${params.toString()}`);
      const data = response.data;
      return Array.isArray(data) ? data : (data.results || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      return [];
    }
  },
  getUngradedCount: async (instructorId: string | number) => {
    try {
      const response = await api.get(`/api/courses/submissions/ungraded-count/?instructor_id=${instructorId}`);
      return response.data.count || 0;
    } catch {
      return 0;
    }
  },
  getById: async (id: string) => {
    const response = await api.get(`/api/courses/submissions/${id}/`);
    return response.data;
  },
  submit: async (assignmentId: string, file: File | null, submissionText?: string) => {
    const user = getStoredUser();

    const formData = new FormData();
    formData.append('assignment_id', assignmentId);
    if (user?.id) {
      formData.append('student_id', user.id);
    }
    if (file) formData.append('submitted_file', file);
    if (submissionText) formData.append('submission_text', submissionText);
    const response = await api.post('/api/courses/submissions/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  grade: async (submissionId: string, grade: number, feedback: string, gradedById: string | number) => {
    const response = await api.post(`/api/courses/submissions/${submissionId}/grade/`, {
      grade,
      feedback,
      graded_by_id: gradedById,
    });
    return response.data;
  },
};

// Notification API
export const notificationAPI = {
  listBroadcasts: async (organization_id?: string) => {
    const fetchBroadcasts = async (url: string) => {
      const response = await api.get(url);
      const data = response.data;
      if (Array.isArray(data)) return data;
      return data.results || [];
    };

    // 🔹 Multi-Tenancy: Add org_id filter
    const orgParam = organization_id ? `?organization_id=${organization_id}` : '';
    
    try {
      return await fetchBroadcasts(`/api/notifications/broadcasts/${orgParam}`);
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return await fetchBroadcasts('/api/v1/notifications/broadcasts/');
      }
      throw error;
    }
  },
  createBroadcast: async (payload: {
    title: string;
    message: string;
    audience_type: string;
    target_role?: string;
    course_id?: string;
    scheduled_class_id?: string;
    recipient_ids?: number[];
    metadata?: Record<string, any>;
  }) => {
    const createAt = async (url: string) => {
      const response = await api.post(url, payload);
      return response.data;
    };

    try {
      return await createAt('/api/notifications/broadcasts/');
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return await createAt('/api/v1/notifications/broadcasts/');
      }
      throw error;
    }
  },
  listMy: async (options?: { is_read?: boolean; limit?: number }) => {
    const params = new URLSearchParams();
    if (options?.is_read !== undefined) {
      params.append('is_read', String(options.is_read));
    }
    const path = params.toString() ? `?${params.toString()}` : '';

    const fetchDeliveries = async (url: string) => {
      const response = await api.get(`${url}${path}`);
      const data = response.data;
      const list = Array.isArray(data) ? data : data.results || [];
      if (options?.limit) {
        return list.slice(0, options.limit);
      }
      return list;
    };

    try {
      return await fetchDeliveries('/api/notifications/deliveries/');
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return await fetchDeliveries('/api/v1/notifications/deliveries/');
      }
      throw error;
    }
  },
  markRead: async (deliveryId: string, isRead: boolean) => {
    const markAt = async (url: string) => {
      const response = await api.post(`${url}${deliveryId}/mark_read/`, {
        is_read: isRead,
      });
      return response.data;
    };

    try {
      return await markAt('/api/notifications/deliveries/');
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return await markAt('/api/v1/notifications/deliveries/');
      }
      throw error;
    }
  },
};

// User API
export const userAPI = {
  getList: async (params: { page?: number; limit?: number; search?: string; archived?: boolean; role?: string; organization_id?: string; campus_id?: string } = {}) => {
    const { page = 1, limit = 100, search, archived = false, role, organization_id, campus_id } = params;
    let url = `/api/auth/users/?page=${page}&limit=${limit}&archived=${archived}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (role && role !== 'ALL') url += `&role=${role}`;
    // 🔹 Multi-Tenancy: Add org_id and campus_id filters
    if (organization_id) url += `&organization_id=${organization_id}`;
    if (campus_id) url += `&campus_id=${campus_id}`;
    const response = await api.get(url);
    return response.data;
  },
  getAll: async (archived: boolean = false, maxPages: number = 3) => {
    try {
      const url = `/api/auth/users/?archived=${archived}`;
      const users = await fetchAllPages<any>(url, { maxPages }, (data) => data.items || data.results);
      console.log('👥 Users API response: total', users.length);
      return users.map(user => {
        const nameParts = user.full_name?.split(' ') || ['', ''];
        return {
          ...user,
          first_name: nameParts[0] || '',
          last_name: nameParts.slice(1).join(' ') || '',
          role: user.role?.toUpperCase() || 'STUDENT'
        };
      });
    } catch (error) {
      console.error('❌ Error fetching users:', error);
      throw error;
    }
  },
  getTeachers: async () => {
    try {
      const response = await api.get('/api/auth/teachers/');
      const data = response.data;
      const list = Array.isArray(data) ? data : (data.results || []);
      return list.map((u: any) => ({
        ...u,
        role: (u.role || 'teacher').toUpperCase(),
        full_name: u.full_name || u.email,
      }));
    } catch (error) {
      console.error('❌ Error fetching teachers:', error);
      return [];
    }
  },
  getStudentIdCard: async () => {
    const response = await api.get('/api/student/identity-card/');
    return response.data;
  },
  uploadStudentPhoto: async (file: File) => {
    const formData = new FormData();
    formData.append('photo', file);
    const response = await api.post('/api/student/upload-photo/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/api/auth/users/${id}/`);
    return response.data;
  },
  get: async (id: string) => {
    const response = await api.get(`/api/auth/users/${id}/`);
    return response.data;
  },
  update: async (id: string, data: any) => {
    const response = await api.patch(`/api/auth/users/${id}/`, data);
    return response.data;
  },
  getByIds: async (userIds: (string | number)[]) => {
    try {
      if (!userIds || userIds.length === 0) return [];

      const response = await api.post('/api/auth/users/bulk/', {
        ids: userIds,
      });
      return response.data || [];
    } catch (error: any) {
      console.error('❌ Error fetching users by IDs:', error?.response?.data || error.message);
      try {
        const fallbackResponse = await api.post('/api/v1/auth/users-by-ids', {
          user_ids: userIds,
        });
        return fallbackResponse.data.users || [];
      } catch (fallbackError) {
        return [];
      }
    }
  },
  createStudent: async (data: any) => {
    const response = await api.post('/api/auth/coordinator/users/', {
      ...data,
      role: 'STUDENT',
    });
    return response.data;
  },
  createTeacher: async (data: any) => {
    const response = await api.post('/api/auth/coordinator/users/', {
      ...data,
      role: 'TEACHER',
    });
    return response.data;
  },
  createCoordinator: async (data: any) => {
    const response = await api.post('/api/auth/coordinator/users/', {
      ...data,
      role: 'COORDINATOR',
    });
    return response.data;
  },
  createAdmin: async (data: any) => {
    const response = await api.post('/api/auth/coordinator/users/', {
      ...data,
      role: 'ADMIN',
    });
    return response.data;
  },
  update: async (id: string | number, data: any) => {
    const response = await api.patch(`/api/auth/users/${id}/`, data);
    return response.data;
  },
  delete: async (id: string | number) => {
    await api.delete(`/api/auth/admin/users/${id}/`);
  },
  restore: async (id: string | number) => {
    await api.post(`/api/auth/admin/users/${id}/restore/`);
  },
  create: async (data: any) => {
    const response = await api.post('/api/auth/coordinator/users/', data);
    return response.data;
  },
};

// Certificate API
export const certificateAPI = {
  getAll: async (studentId?: number | string, maxPages: number = 3, organization_id?: string) => {
    try {
      let baseUrl = studentId
        ? `/api/certifications/certifications/?student_id=${studentId}`
        : '/api/certifications/certifications/';
      // 🔹 Multi-Tenancy: Add org_id filter
      if (organization_id) {
        baseUrl += (baseUrl.includes('?') ? '&' : '?') + `organization_id=${organization_id}`;
      }
      return await fetchAllPages<any>(baseUrl, { maxPages });
    } catch (error) {
      console.error('❌ Error fetching certificates:', error);
      throw error;
    }
  },
  getById: async (id: string) => {
    const response = await api.get(`/api/certifications/certifications/${id}/`);
    return response.data;
  },
  download: async (id: string) => {
    const response = await api.get(`/api/certifications/certifications/${id}/download/`, {
      responseType: 'blob',
    });
    return response.data;
  },
  verify: async (verificationCode?: string, studentId?: string | number, courseCode?: string) => {
    try {
      let url = '/api/certifications/certifications/verify/';
      if (verificationCode) {
        url = `/api/certifications/certifications/verify/${verificationCode}/`;
      } else if (studentId && courseCode) {
        url = `/api/certifications/certifications/verify/?student_id=${studentId}&course_code=${courseCode}`;
      }
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error('❌ Error verifying certificate:', error);
      throw error;
    }
  },
  generate: async (data: {
    student_id: string | number;
    course_id: string;
    enrollment_id?: string;
    grade?: number;
    percentile?: number;
  }) => {
    const response = await api.post('/api/certifications/certifications/generate/', data);
    return response.data;
  },
  update: async (id: string | number, data: any) => {
    const response = await api.patch(`/api/certifications/certifications/${id}/`, data);
    return response.data;
  },
};

// Course Enrollment API extensions
export const enrollmentAPI = {
  getByCourse: async (courseId: string, maxPages: number = 3) => {
    try {
      const url = `/api/courses/enrollments/?course_id=${courseId}`;
      return await fetchAllPages<any>(url, { maxPages });
    } catch (error) {
      console.error('Error fetching enrollments by course:', error);
      throw error;
    }
  },
  getByStudent: async (studentId: string | number, maxPages: number = 3) => {
    try {
      const url = `/api/courses/enrollments/?student_id=${studentId}`;
      return await fetchAllPages<any>(url, { maxPages });
    } catch (error) {
      console.error('❌ Error fetching student enrollments:', error);
      throw error;
    }
  },
  transferCourse: async (data: { student_id: string; old_course_id: string; new_course_id: string; new_scheduled_class_id: string }) => {
    const response = await api.post('/api/courses/enrollments/transfer/', data);
    return response.data;
  }
};

// Receipt & Deposit API
function extractItems(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data?.items) return data.items;
  if (data?.results) return data.results;
  if (data?.data) return data.data;
  return [];
}

export const receiptAPI = {
  getStats: async (organization_id?: string) => {
    const orgParam = organization_id ? `&organization_id=${organization_id}` : '';
    const [authRes, admissionRes] = await Promise.allSettled([
      api.get(`/api/auth/admin/receipt-codes/?page=1&page_size=1${orgParam}`),
      api.get(`/api/tests/lead-stats/${orgParam ? '?' + orgParam.slice(1) : ''}`)
    ]);
    const authTotal = authRes.status === 'fulfilled' ? (authRes.value.data?.total || 0) : 0;
    const authVerified = authRes.status === 'fulfilled' ? (authRes.value.data?.verified_count || 0) : 0;
    const admissionStats = admissionRes.status === 'fulfilled' ? admissionRes.value.data?.receipts : {};
    return {
      total: authTotal + (admissionStats.total || 0),
      verified: authVerified + (admissionStats.verified || 0),
      pending: (authTotal - authVerified) + ((admissionStats.total || 0) - (admissionStats.verified || 0)),
    };
  },
  getAll: async (archived: boolean = false, maxPages: number = 3, organization_id?: string) => {
    // 🔹 Multi-Tenancy: Add org_id filter
    const orgParam = organization_id ? `&organization_id=${organization_id}` : '';
    // Fetch auth-service codes with pagination
    const authCodes = await fetchAllPages<any>(
      `/api/auth/admin/receipt-codes/?archived=${archived}${orgParam}`,
      { maxPages, pageSize: 200 },
      (data) => data.results || data.items || data.data || []
    );
    
    // Fetch admission-service codes (first page only)
    const admRes = await api.get(`/api/tests/receipt-codes/?archived=${archived}${orgParam}`).catch(() => null);
    const admCodes = admRes?.data ? extractItems(admRes.data) : [];
    
    // Deduplicate by id
    const seen = new Set<string>();
    return [...authCodes, ...admCodes].filter((item: any) => {
      if (!item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  },
  getPaginated: async (archived: boolean = false, search: string = '', page: number = 1, organization_id?: string) => {
    // 🔹 Multi-Tenancy: Add org_id filter
    const orgParam = organization_id ? `&organization_id=${organization_id}` : '';
    const [authRes, admissionRes] = await Promise.allSettled([
      api.get(`/api/auth/admin/receipt-codes/?archived=${archived}&search=${encodeURIComponent(search)}&page=${page}${orgParam}`),
      api.get(`/api/tests/receipt-codes/?archived=${archived}&search=${encodeURIComponent(search)}&page=${page}${orgParam}`)
    ]);
    const authData = authRes.status === 'fulfilled' ? authRes.value.data : [];
    const authCodes = extractItems(authData);
    const admissionData = admissionRes.status === 'fulfilled' ? admissionRes.value.data : [];
    const admissionCodes = extractItems(admissionData);
    
    // Deduplicate by id
    const seen = new Set<string>();
    return [...authCodes, ...admissionCodes].filter((item: any) => {
      if (!item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  },
  update: async (codeId: string, data: any) => {
    try {
      const response = await api.patch(`/api/auth/admin/receipt-codes/${codeId}/`, data);
      return response.data;
    } catch {
      const response = await api.patch(`/api/tests/receipt-codes/${codeId}/`, data);
      return response.data;
    }
  },
  create: async (data: any) => {
    const response = await api.post('/api/auth/admin/receipt-codes/add/', data);
    return response.data;
  },
  delete: async (codeId: string) => {
    try {
      await api.delete(`/api/auth/admin/receipt-codes/${codeId}/`);
    } catch {
      await api.delete(`/api/tests/receipt-codes/${codeId}/`);
    }
  },
  restore: async (codeId: string) => {
    try {
      await api.post(`/api/auth/admin/receipt-codes/${codeId}/restore/`);
    } catch {
      await api.post(`/api/tests/receipt-codes/${codeId}/restore/`);
    }
  },
  processReturn: async (codeId: string, remarks?: string) => {
    try {
      const response = await api.patch(`/api/auth/admin/receipt-codes/${codeId}/process-return/`, { remarks });
      return response.data;
    } catch {
      const response = await api.patch(`/api/tests/receipt-codes/${codeId}/process-return/`, { remarks });
      return response.data;
    }
  },
  transferCode: async (codeId: string, data: any) => {
    const response = await api.post(`/api/auth/admin/receipt-codes/${codeId}/transfer/`, data);
    return response.data;
  },
  getTransfers: async () => {
    const response = await api.get('/api/auth/admin/transfers/');
    return response.data;
  }
};

// Admission / Test API
export const admissionAPI = {
  getLeads: async (archived: boolean = false, branch_id?: string, maxPages: number = 3, organization_id?: string) => {
    const branchParam = branch_id ? `&branch_id=${branch_id}` : '';
    // 🔹 Multi-Tenancy: Add org_id filter
    const orgParam = organization_id ? `&organization_id=${organization_id}` : '';
    const url = `/api/tests/lead-list/?archived=${archived}${branchParam}${orgParam}`;
    return await fetchAllPages<any>(url, { maxPages });
  },
  getLeadsPaginated: async (archived: boolean = false, search: string = '', page: number = 1, branch_id?: string, organization_id?: string) => {
    const branchParam = branch_id ? `&branch_id=${branch_id}` : '';
    // 🔹 Multi-Tenancy: Add org_id filter
    const orgParam = organization_id ? `&organization_id=${organization_id}` : '';
    const response = await api.get(`/api/tests/lead-list/paginated/?archived=${archived}&search=${encodeURIComponent(search)}&page=${page}${branchParam}${orgParam}`);
    return response.data;
  },
  getLeadStats: async (branch_id?: string, organization_id?: string) => {
    let url = '/api/tests/lead-stats/';
    const params = new URLSearchParams();
    if (branch_id) params.set('branch_id', branch_id);
    // 🔹 Multi-Tenancy: Add org_id filter
    if (organization_id) params.set('organization_id', organization_id);
    if (params.toString()) url += '?' + params.toString();
    const response = await api.get(url);
    return response.data;
  },
  /** Public lookup by sequential reference number (lead_auto_id) */
  lookupBySeqId: async (seqId: number | string) => {
    const response = await api.get(`/api/tests/lead/by-seq-id/?seq_id=${seqId}`);
    return response.data;
  },
  /** Public lookup by seq_id or email (primary + fallback) */
  lookup: async (data: { seq_id?: string; email?: string; cnic_number?: string }) => {
    const response = await api.post('/api/tests/lead/lookup/', data);
    return response.data;
  },
  getLeadById: async (leadId: string) => {
    const response = await api.get(`/api/tests/lead/${leadId}/status/`);
    return response.data;
  },
  updateLead: async (id: string, data: any) => {
    const response = await api.patch(`/api/tests/lead/${id}/`, data);
    return response.data;
  },
  scoreOverride: async (id: string, data: { score?: number; status?: string; reason?: string }) => {
    const response = await api.post(`/api/tests/lead/${id}/score-override/`, data);
    return response.data;
  },
  deleteLead: async (id: string) => {
    await api.delete(`/api/tests/lead/${id}/`);
  },
  restoreLead: async (id: string) => {
    await api.post(`/api/tests/lead/${id}/restore/`);
  },
  /** Admin: list all students with pagination + search + status filter */
  getStudents: async (params: { status?: string; search?: string; page?: number; page_size?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.append('status', params.status);
    if (params.search) q.append('search', params.search);
    if (params.page) q.append('page', String(params.page));
    if (params.page_size) q.append('page_size', String(params.page_size));
    const response = await api.get(`/api/auth/students/${q.toString() ? '?' + q.toString() : ''}`);
    return response.data;
  },
  /** Admin/self: full student profile */
  getStudentDetail: async (userId: string) => {
    const response = await api.get(`/api/auth/students/${userId}/`);
    return response.data;
  },
};
// Test Management API (admin)
export const testsAPI = {
  getAll: async (organization_id?: string) => {
    let url = '/api/tests/tests/';
    // 🔹 Multi-Tenancy: Add org_id filter
    if (organization_id) url += `?organization_id=${organization_id}`;
    const response = await api.get(url);
    return response.data;
  },
  get: async (id: string) => {
    const response = await api.get(`/api/tests/tests/${id}/`);
    return response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/api/tests/tests/', data);
    return response.data;
  },
  update: async (id: string, data: any) => {
    const response = await api.put(`/api/tests/tests/${id}/`, data);
    return response.data;
  },
  delete: async (id: string) => {
    await api.delete(`/api/tests/tests/${id}/`);
  },
  getQuestions: async (testId: string) => {
    const response = await api.get(`/api/tests/tests/${testId}/questions/`);
    return response.data;
  },
  addQuestion: async (testId: string, data: any) => {
    const response = await api.post(`/api/tests/tests/${testId}/questions/`, data);
    return response.data;
  },
  updateQuestion: async (questionId: string, data: any) => {
    const response = await api.put(`/api/tests/tests/questions/${questionId}/`, data);
    return response.data;
  },
  deleteQuestion: async (questionId: string) => {
    await api.delete(`/api/tests/tests/questions/${questionId}/`);
  },
  getAttempts: async (params?: { user_id?: string; test_id?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.user_id) q.append('user_id', params.user_id);
    if (params?.test_id) q.append('test_id', params.test_id);
    if (params?.status) q.append('status', params.status);
    const response = await api.get(`/api/tests/attempts/${q.toString() ? '?' + q.toString() : ''}`);
    return response.data;
  },
  reorderQuestions: async (testId: string, questionIds: string[]) => {
    const response = await api.post(`/api/tests/tests/${testId}/reorder-questions/`, { order: questionIds });
    return response.data;
  },
  uploadQuestionImage: async (questionId: string, file: File, field: string = 'image') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('field', field);
    const response = await api.post(`/api/tests/tests/questions/${questionId}/upload-image/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

// Role Permission API
export const rolePermissionAPI = {
  getAll: async () => {
    const response = await api.get('/api/auth/role-permissions/');
    return response.data;
  },
  update: async (role: string, permissions: any) => {
    const response = await api.post('/api/auth/role-permissions/update/', {
      role,
      permissions,
    });
    return response.data;
  },
};

// Coordinator Attendance API
export const coordinatorAttendanceAPI = {
  getAll: async (params?: { 
    course_id?: string | null; 
    date_from?: string; 
    date_to?: string; 
    status?: string; 
    page?: number; 
    limit?: number; 
    search?: string 
  }) => {
    const query = new URLSearchParams();
    if (params?.course_id) query.append('course_id', params.course_id);
    if (params?.date_from) query.append('date_from', params.date_from);
    if (params?.date_to) query.append('date_to', params.date_to);
    if (params?.status) query.append('status', params.status);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.search) query.append('search', params.search);
    
    const url = `/api/courses/coordinator/attendance/${query.toString() ? '?' + query.toString() : ''}`;
    const response = await api.get(url);
    return response.data;
  },
  
  getStats: async (params?: {
    course_id?: string | null;
    date_from?: string;
    date_to?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.course_id) query.append('course_id', params.course_id);
    if (params?.date_from) query.append('date_from', params.date_from);
    if (params?.date_to) query.append('date_to', params.date_to);
    
    const url = `/api/courses/coordinator/attendance/stats/${query.toString() ? '?' + query.toString() : ''}`;
    const response = await api.get(url);
    return response.data;
  },
  
  contact: async (data: {
    student_id: string;
    contact_method: 'whatsapp' | 'call' | 'sms' | 'email' | 'in_person';
    remarks?: string;
  }) => {
    const response = await api.post('/api/courses/coordinator/attendance/contact/', data);
    return response.data;
  },
  
  getDashboardStats: async () => {
    const response = await api.get('/api/courses/coordinator/dashboard/stats/');
    return response.data;
  },

  getTeacherCourseWiseAttendance: async (params?: {
    date_param?: string;
    teacher_id?: string;
    course_id?: string;
    section?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.date_param) query.append('date_param', params.date_param);
    if (params?.teacher_id) query.append('teacher_id', params.teacher_id);
    if (params?.course_id) query.append('course_id', params.course_id);
    if (params?.section) query.append('section', params.section);
    const url = `/api/courses/coordinator/teachers/course-wise-attendance/${query.toString() ? '?' + query.toString() : ''}`;
    const response = await api.get(url);
    return response.data;
  },
};

// ─── Organization & Campus API ─────────────────────────────────────
export const organizationAPI = {
  getAll: async () => {
    const response = await api.get('/api/orgs/organizations/');
    return response.data;
  },
  get: async (id: string) => {
    const response = await api.get(`/api/orgs/organizations/${id}/`);
    return response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/api/orgs/organizations/', data);
    return response.data;
  },
  update: async (id: string, data: any) => {
    const response = await api.patch(`/api/orgs/organizations/${id}/`, data);
    return response.data;
  },
  delete: async (id: string) => {
    await api.delete(`/api/orgs/organizations/${id}/`);
  },
};

export const campusAPI = {
  getAll: async (organizationId?: string) => {
    const query = organizationId ? `?organization_id=${organizationId}` : '';
    const response = await api.get(`/api/orgs/campuses/${query}`);
    return response.data;
  },
  get: async (id: string) => {
    const response = await api.get(`/api/orgs/campuses/${id}/`);
    return response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/api/orgs/campuses/', data);
    return response.data;
  },
  update: async (id: string, data: any) => {
    const response = await api.patch(`/api/orgs/campuses/${id}/`, data);
    return response.data;
  },
  delete: async (id: string) => {
    await api.delete(`/api/orgs/campuses/${id}/`);
  },
  getHierarchy: async (organizationId: string) => {
    const response = await api.get(`/api/orgs/hierarchy/?organization_id=${organizationId}`);
    return response.data;
  },
};

export const levelAPI = {
  getAll: async (params?: { campus_id?: string; organization_id?: string }) => {
    const query = new URLSearchParams();
    if (params?.campus_id) query.append('campus_id', params.campus_id);
    if (params?.organization_id) query.append('organization_id', params.organization_id);
    const url = `/api/orgs/levels/${query.toString() ? '?' + query.toString() : ''}`;
    const response = await api.get(url);
    return response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/api/orgs/levels/', data);
    return response.data;
  },
  update: async (id: string, data: any) => {
    const response = await api.patch(`/api/orgs/levels/${id}/`, data);
    return response.data;
  },
  delete: async (id: string) => {
    await api.delete(`/api/orgs/levels/${id}/`);
  },
};

export const gradeAPI = {
  getAll: async (params?: { campus_id?: string; level_id?: string; organization_id?: string }) => {
    const query = new URLSearchParams();
    if (params?.campus_id) query.append('campus_id', params.campus_id);
    if (params?.level_id) query.append('level_id', params.level_id);
    if (params?.organization_id) query.append('organization_id', params.organization_id);
    const url = `/api/orgs/grades/${query.toString() ? '?' + query.toString() : ''}`;
    const response = await api.get(url);
    return response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/api/orgs/grades/', data);
    return response.data;
  },
  update: async (id: string, data: any) => {
    const response = await api.patch(`/api/orgs/grades/${id}/`, data);
    return response.data;
  },
  delete: async (id: string) => {
    await api.delete(`/api/orgs/grades/${id}/`);
  },
};

export const classroomAPI = {
  getAll: async (params?: { campus_id?: string; grade_id?: string; organization_id?: string }) => {
    const query = new URLSearchParams();
    if (params?.campus_id) query.append('campus_id', params.campus_id);
    if (params?.grade_id) query.append('grade_id', params.grade_id);
    if (params?.organization_id) query.append('organization_id', params.organization_id);
    const url = `/api/orgs/classrooms/${query.toString() ? '?' + query.toString() : ''}`;
    const response = await api.get(url);
    return response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/api/orgs/classrooms/', data);
    return response.data;
  },
  update: async (id: string, data: any) => {
    const response = await api.patch(`/api/orgs/classrooms/${id}/`, data);
    return response.data;
  },
  delete: async (id: string) => {
    await api.delete(`/api/orgs/classrooms/${id}/`);
  },
};
