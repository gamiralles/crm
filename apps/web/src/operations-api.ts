const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api/v1'

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base}${path}`, { ...init, credentials: 'include', headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers } })
  if (!response.ok) { const body = await response.json().catch(() => null) as { error?: { message?: string } } | null; throw new Error(body?.error?.message ?? 'No pudimos completar la solicitud.') }
  if (response.status === 204) return undefined as T
  const body = await response.json() as { data: T; pagination?: unknown; unread?: number }
  if (body.pagination) return { data: body.data, pagination: body.pagination, unread: body.unread } as T
  return body.data
}

export const opsApi = {
  call,
  policies: (query = 'status=all&limit=100') => call<{ data: Policy[]; pagination: { page:number;limit:number;total:number;pages:number } }>(`/policies?${query}`),
  companies: () => call<Array<{ id: string; name: string }>>('/policies/companies'),
  addCompany: (name: string) => call<{ id: string; name: string }>('/policies/companies', { method: 'POST', body: JSON.stringify({ name }) }),
  clients: () => call<{ data: Array<{ id: string; fullName: string }>; pagination: { total: number } }>('/clients?status=active&limit=100'),
  policySave: (input: Record<string, unknown>, id?: string) => call<Policy>(id ? `/policies/${id}` : '/policies', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(input) }),
  policyStatus: (id: string, status: string) => call<Policy>(`/policies/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  renewals: () => call<Renewal[]>('/renewals'),
  contact: (id: string, input: Record<string, unknown>) => call(`/renewals/${id}/contact`, { method: 'POST', body: JSON.stringify(input) }),
  renewalStatus: (id: string, status: string) => call(`/renewals/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  completeRenewal: (id: string, input: Record<string, unknown>) => call(`/renewals/${id}/complete`, { method: 'POST', body: JSON.stringify(input) }),
  tasks: (status = 'open') => call<TaskItem[]>(`/tasks?status=${status}`),
  task: (id:string) => call<TaskItem & {createdAt:string;completedAt?:string}>(`/tasks/${id}`),
  createTask: (input: Record<string, unknown>) => call('/tasks', { method: 'POST', body: JSON.stringify(input) }),
  taskStatus: (id: string, status: string) => call(`/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  notifications: (read = '') => call<{ data: Notice[]; unread: number; pagination: { total: number } }>(`/notifications?limit=50${read ? `&read=${read}` : ''}`),
  notificationRead: (id: string, isRead: boolean) => call(`/notifications/${id}/read`, { method: 'PATCH', body: JSON.stringify({ isRead }) }),
  preferences: () => call<Preferences>('/notifications/preferences'),
  savePreferences: (input: { channels?: Partial<Preferences['channels']>; types?: Partial<Preferences['types']>; telegramChatId?: string }) => call<Preferences>('/notifications/preferences', { method: 'PATCH', body: JSON.stringify(input) }),
  linkTelegram: () => call<{ url: string; expiresAt: string }>('/notifications/telegram/link', { method: 'POST' }),
  renewalAlertDays: () => call<{ days: number[] }>('/notifications/settings/renewal-alerts'),
  saveRenewalAlertDays: (days: number[]) => call<{ days: number[] }>('/notifications/settings/renewal-alerts', { method:'PATCH', body:JSON.stringify({days}) }),
  pushKey: () => call<{ publicKey: string | null; available: boolean }>('/notifications/push/public-key'),
  savePush: (input: PushSubscriptionJSON) => call<void>('/notifications/push-subscription', { method: 'PUT', body: JSON.stringify(input) }),
  removePush: (endpoint: string) => call<void>('/notifications/push-subscription', { method: 'DELETE', body:JSON.stringify({endpoint}) }),
}

export type Policy = { id: string; client: { id: string; name: string }; company: { id: string; name: string }; policyNumber: string; line: string; startDate: string; endDate: string; daysRemaining: number; status: string; renewalStatus: string; notes?: string; terms: Array<{ version: number; policyNumber: string; startDate: string; endDate: string; recordedAt: string }> }
export type Renewal = { id: string; status: string; dueDate: string; client: { id: string; name: string }; policy: { id: string; number: string }; nextAction?: string; nextFollowUpAt?: string; contacts: Array<{ contactedAt: string; medium: string; result: string; notes?: string }> }
export type TaskItem = { id: string; title: string; description?: string; dueAt: string; priority: string; status: string; client?: { name: string }; policy?: { number: string } }
export type Notice = { id: string; type: string; title: string; message: string; isRead: boolean; relatedType?: string; relatedId?: string; createdAt: string; deliveries?: Array<{channel:string;status:string;attemptCount:number;sentAt?:string;lastError?:string}> }
export type Preferences = { channels: { webPush: boolean; email: boolean; telegram: boolean }; types: { renewal: boolean; task_due: boolean; task_overdue: boolean; system: boolean }; telegramLinked: boolean }
