// Dynamically point to the backend using the current hostname, defaulting to localhost if not in browser
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== 'undefined' ? `http://${window.location.hostname}:8000/api` : 'http://localhost:8000/api');

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  // If we are in the browser, try to get the token or we can just fetch it from localStorage
  let token = '';
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('access_token') || '';
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  if (response.status === 401) {
    // Optionally trigger a logout or token refresh if 401
    // For now, clear token and redirect to login if it's an unauthenticated request to an authenticated endpoint
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      // window.location.href = '/login'; // Let AuthContext handle this instead
    }
  }

  return response;
}
