import axios from "axios";

const API_URL = "/api";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const url: string = error.config?.url || "";
    const isAuthEndpoint = url.includes("/auth/login") || url.includes("/auth/refresh");
    if (error.response?.status === 401 && typeof window !== "undefined" && !isAuthEndpoint) {
      const refresh = localStorage.getItem("refresh_token");
      if (refresh) {
        try {
          const { data } = await axios.post(`/api/auth/refresh/`, { refresh });
          // Handle both Simple JWT (`access`) and auth-service (`access_token`) format
          const newToken = data.access_token || data.access;
          localStorage.setItem("access_token", newToken);
          error.config.headers.Authorization = `Bearer ${newToken}`;
          return api.request(error.config);
        } catch {
          localStorage.clear();
          window.location.href = "/login";
        }
      } else {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export const login = async (username: string, password: string) => {
  const { data } = await api.post("/auth/login/", {
    employee_code: username,
    username,   // kept for local fallback compatibility
    password,
  });
  // Auth-service returns `access_token`; local Simple JWT returns `access`
  const accessToken = data.access_token || data.access;
  const refreshToken = data.refresh_token || data.refresh;
  localStorage.setItem("access_token", accessToken);
  localStorage.setItem("refresh_token", refreshToken);
  if (data.auth_source) localStorage.setItem("auth_source", data.auth_source);
  return data; // caller can check data.warning to show a toast
};

export const logout = () => {
  localStorage.clear();
  window.location.href = "/login";
};

export const getDashboardStats = () => api.get("/dashboard/stats/").then((r) => r.data);

export const getVisits = (params?: Record<string, string>) =>
  api.get("/visits/", { params }).then((r) => r.data);

export const approveVisit = (id: string, data?: { employee_host_id?: string; expected_checkout_at?: string }) =>
  api.post(`/visits/approve/${id}/`, data || {}).then((r) => r.data);

export const rejectVisit = (id: string, reason: string) =>
  api.post(`/visits/reject/${id}/`, { reason }).then((r) => r.data);

export const checkoutVisit = (id: string) =>
  api.post(`/visits/checkout/${id}/`).then((r) => r.data);

export const updateVisitHost = (id: string, data: { employee_host_id?: string; host_id?: string }) =>
  api.patch(`/visits/${id}/update-host/`, data).then((r) => r.data);

// Issue #11: overwrite any visit field
export const overwriteVisit = (id: string, data: Record<string, unknown>) =>
  api.patch(`/visits/${id}/overwrite/`, data).then((r) => r.data);

export const receptionistEntry = (data: Record<string, unknown>) =>
  api.post("/visits/receptionist-entry/", data).then((r) => r.data);

export const scheduleVisit = (data: Record<string, unknown>) =>
  api.post("/visits/schedule/", data).then((r) => r.data);

export const scheduledEntry = (visiting_id: string) =>
  api.post("/visits/scheduled-entry/", { visiting_id }).then((r) => r.data);

export const getVisitDetail = (id: string) =>
  api.get(`/visits/${id}/`).then((r) => r.data);

export const getVisitStatus = (id: string) =>
  api.get(`/visits/status/${id}/`).then((r) => r.data);

// Issue #4: fetch hosts — public endpoint, no auth needed for QR page
export const getHostsPublic = async (): Promise<import("./types").Host[]> => {
  try {
    const r = await fetch("/api/hosts/");
    return r.ok ? r.json() : [];
  } catch { return []; }
};

export const getHosts = (q?: string) =>
  api.get("/hosts/", { params: q ? { q } : {} }).then((r) => r.data);

// Issue #5: create host from employee only
export const createHostFromEmployee = (employee_id: string) =>
  api.post("/hosts/from-employee/", { employee_id }).then((r) => r.data);

export const getEmployees = (q?: string) =>
  api.get("/employees/", { params: q ? { q } : {} }).then((r) => r.data);

export const searchVisitor = (q: string) =>
  api.get("/visitors/search/", { params: { q } }).then((r) => r.data);

export const getVisitorHistory = (id: string) =>
  api.get(`/visitors/${id}/history/`).then((r) => r.data);

export const getVisitorList = (params?: Record<string, string>) =>
  api.get("/visitors/", { params }).then((r) => r.data);

export const blacklistVisitor = (id: string, reason: string) =>
  api.post(`/visitors/${id}/blacklist/`, { reason }).then((r) => r.data);

export const unblacklistVisitor = (id: string) =>
  api.post(`/visitors/${id}/unblacklist/`).then((r) => r.data);

export const getBlacklistedVisitors = () =>
  api.get("/visitors/blacklisted/").then((r) => r.data);

export const checkDuplicate = (data: { cnic?: string; phone?: string; email?: string; exclude_visitor_id?: string }) =>
  api.post("/visitors/check-duplicate/", data).then((r) => r.data);

// Issue #6: companies report
export const getCompanies = () =>
  api.get("/companies/").then((r) => r.data);

export const sendCardEmail = (visitId: string, email?: string) =>
  api.post(`/visits/${visitId}/send-card-email/`, email ? { email } : {}).then((r) => r.data);

export const getCompanyDetail = (companyName: string) =>
  api.get(`/companies/${encodeURIComponent(companyName)}/`).then((r) => r.data);

export const sendCardByEmail = (visitId: string, email: string) =>
  api.post(`/visits/${visitId}/send-card-email/`, { email }).then((r) => r.data);

export const getWhatsAppLink = (visitId: string) =>
  api.get(`/visits/${visitId}/whatsapp-link/`).then((r) => r.data);
