const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8787';

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Rankings
  getTop100: () => fetchApi<{ snapshot: unknown; items: unknown[] }>('/api/rankings/top100'),
  getRising50: () => fetchApi<{ snapshot: unknown; items: unknown[] }>('/api/rankings/rising50'),
  getNew50: () => fetchApi<{ snapshot: unknown; items: unknown[] }>('/api/rankings/new50'),

  // Films
  getFilms: (params?: { status?: string; limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    return fetchApi<{ films: unknown[] }>(`/api/films?${searchParams}`);
  },
  getFilm: (id: number) => fetchApi<{ film: unknown; metrics: unknown; aiAnalysis: unknown }>(`/api/films/${id}`),

  // Admin
  getDashboard: (token: string) => fetchApi<unknown>('/api/admin/dashboard', {
    headers: { Authorization: `Bearer ${token}` },
  }),
  getCandidates: (token: string, status?: string) => fetchApi<{ candidates: unknown[] }>(
    `/api/admin/candidates${status ? `?status=${status}` : ''}`,
    { headers: { Authorization: `Bearer ${token}` } }
  ),
  approveCandidate: (token: string, id: number) => fetchApi<unknown>(`/api/admin/candidates/${id}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }),
  rejectCandidate: (token: string, id: number) => fetchApi<unknown>(`/api/admin/candidates/${id}/reject`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }),
  getJobs: (token: string) => fetchApi<{ jobs: unknown[] }>('/api/admin/jobs', {
    headers: { Authorization: `Bearer ${token}` },
  }),
  runDiscovery: (token: string) => fetchApi<unknown>('/api/admin/run-discovery', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }),
  runRanking: (token: string) => fetchApi<unknown>('/api/admin/run-ranking', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }),
  seedMockData: (token: string) => fetchApi<unknown>('/api/admin/seed-mock-data', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }),
};
