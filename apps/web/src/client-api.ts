const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api/v1'

export type Client = { id: string; type: 'person' | 'company'; fullName: string; documentNumber?: string; email?: string; phone?: string; birthDate?: string; address?: string; notes?: string; isActive: boolean; createdAt: string; updatedAt: string }
export type ClientInput = Omit<Client, 'id' | 'isActive' | 'createdAt' | 'updatedAt'>

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { ...init, credentials: 'include', headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers } })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? 'No pudimos completar la solicitud.')
  }
  if (response.status === 204) return undefined as T
  const body = await response.json() as { data: T; pagination?: unknown }
  return (body.pagination ? { data: body.data, pagination: body.pagination } : body.data) as T
}

export const clientApi = {
  me: () => api<{ user: { fullName: string }; organization: { name: string; currency?: string; timeZone?: string } }>('/auth/me'),
  login: (email: string, password: string) => api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => api<void>('/auth/logout', { method: 'POST' }),
  list: (params: URLSearchParams) => api<{ data: Client[]; pagination: { page: number; limit: number; total: number; pages: number } }>(`/clients?${params}`),
  get: (id: string) => api<Client>(`/clients/${id}`),
  create: (input: ClientInput) => api<Client>('/clients', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: ClientInput) => api<Client>(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  setStatus: (id: string, isActive: boolean) => api<Client>(`/clients/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  activity: (id: string) => api<Array<{ id: string; action: string; changedFields: string[]; status?: boolean; createdAt: string }>>(`/clients/${id}/activity`),
  policies: (id: string) => api<{ data: Array<{ id: string; policyNumber: string; line: string; endDate: string; status: string; company: { name: string } }>; pagination: { total: number } }>(`/policies?status=all&clientId=${id}&limit=100`),
  tasks: (id: string) => api<Array<{ id: string; title: string; dueAt: string; status: string }>>(`/tasks?status=open&clientId=${id}`),
}
