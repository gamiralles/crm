import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { clientApi, type Client, type ClientInput } from './client-api'

const blank: ClientInput = { type: 'person', fullName: '' }

export default function ClientsPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [userName, setUserName] = useState('')
  const [authError, setAuthError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rows, setRows] = useState<Client[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('active')
  const [type, setType] = useState('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Client | null | 'new'>(null)
  const [detail, setDetail] = useState<Client | null>(null)
  const [activity, setActivity] = useState<Array<{ id: string; action: string; changedFields: string[]; status?: boolean; createdAt: string }>>([])
  const [relatedPolicies, setRelatedPolicies] = useState<Array<{ id:string; policyNumber:string; line:string; endDate:string; status:string; company:{name:string} }>>([])
  const [relatedTasks, setRelatedTasks] = useState<Array<{id:string;title:string;dueAt:string;status:string}>>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { clientApi.me().then((me) => { setUserName(me.user.fullName); setAuthenticated(true) }).catch(() => setAuthenticated(false)) }, [])
  const load = useCallback(async () => {
    if (!authenticated) return
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ q: query, status, type, page: String(page), limit: '20' })
      const result = await clientApi.list(params); setRows(result.data); setTotal(result.pagination.total)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos cargar los clientes.') }
    finally { setLoading(false) }
  }, [authenticated, page, query, status, type])
  useEffect(() => { const timer = window.setTimeout(() => { void load() }, 250); return () => window.clearTimeout(timer) }, [load])

  async function signIn(event: FormEvent) {
    event.preventDefault(); setAuthError('')
    try { await clientApi.login(email, password); const me = await clientApi.me(); setUserName(me.user.fullName); setAuthenticated(true) }
    catch (cause) { setAuthError(cause instanceof Error ? cause.message : 'No pudimos iniciar sesión.') }
  }
  async function signOut() { await clientApi.logout().catch(() => undefined); setAuthenticated(false); setRows([]) }
  async function openDetail(client: Client) { setDetail(client); const [events,policies,tasks]=await Promise.allSettled([clientApi.activity(client.id),clientApi.policies(client.id),clientApi.tasks(client.id)]);setActivity(events.status==='fulfilled'?events.value:[]);setRelatedPolicies(policies.status==='fulfilled'?policies.value.data:[]);setRelatedTasks(tasks.status==='fulfilled'?tasks.value:[]) }
  async function toggleStatus(client: Client) {
    const updated = await clientApi.setStatus(client.id, !client.isActive)
    if (detail?.id === client.id) setDetail(updated)
    await load()
  }
  async function saveClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return
    const data = new FormData(event.currentTarget)
    const input: ClientInput = { type: String(data.get('type')) as ClientInput['type'], fullName: String(data.get('fullName')).trim(), documentNumber: String(data.get('documentNumber') ?? '').trim() || undefined, email: String(data.get('email') ?? '').trim() || undefined, phone: String(data.get('phone') ?? '').trim() || undefined, birthDate: String(data.get('birthDate') ?? '') || undefined, address: String(data.get('address') ?? '').trim() || undefined, notes: String(data.get('notes') ?? '').trim() || undefined }
    setSaving(true); setError('')
    try { if (editing === 'new') await clientApi.create(input); else await clientApi.update(editing.id, input); setEditing(null); await load() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos guardar el cliente.') }
    finally { setSaving(false) }
  }

  if (authenticated === null) return <div className="client-auth"><p>Conectando con tu espacio…</p></div>
  if (!authenticated) return <div className="client-auth"><form className="client-login" onSubmit={signIn}><span className="section-stage">ACCESO PRIVADO</span><h1>Ingresá a tu espacio</h1><p>Usá el correo y la contraseña de tu cuenta.</p>{authError && <div className="client-error">{authError}</div>}<label>Correo electrónico<input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>Contraseña<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label><button className="client-primary" type="submit">Ingresar</button><small>El alta inicial del propietario se realiza desde el endpoint de configuración del servidor.</small></form></div>

  const maxPage = Math.max(1, Math.ceil(total / 20))
  return <div className="page-enter clients-page">
    <div className="page-heading"><div><p className="eyebrow">TU CARTERA</p><h1>Clientes</h1><p className="page-subtitle">Personas y empresas, con su información e historial.</p></div><button className="client-primary" onClick={() => setEditing('new')}>＋ Nuevo cliente</button></div>
    <div className="clients-toolbar"><label className="client-search">Buscar<input placeholder="Nombre, documento, correo o teléfono" value={query} onChange={(e) => { setPage(1); setQuery(e.target.value) }} /></label><label>Estado<select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value) }}><option value="active">Activos</option><option value="inactive">Inactivos</option><option value="all">Todos</option></select></label><label>Tipo<select value={type} onChange={(e) => { setPage(1); setType(e.target.value) }}><option value="all">Todos</option><option value="person">Personas</option><option value="company">Empresas</option></select></label><span className="client-user">{userName}<button onClick={() => void signOut()}>Cerrar sesión</button></span></div>
    {error && <div className="client-error" role="alert">{error}</div>}
    <section className="panel clients-table-panel"><div className="clients-table-head"><div><h2>Tu cartera</h2><p>{total} {total === 1 ? 'cliente' : 'clientes'}</p></div></div>{loading ? <div className="clients-empty">Cargando clientes…</div> : rows.length === 0 ? <div className="clients-empty"><span>◇</span><h3>{query ? 'No encontramos coincidencias' : 'Todavía no hay clientes'}</h3><p>{query ? 'Probá con otro nombre, documento o dato de contacto.' : 'Agregá tu primer cliente para empezar a organizar tu cartera.'}</p>{!query && <button className="client-secondary" onClick={() => setEditing('new')}>Crear primer cliente</button>}</div> : <div className="clients-table-scroll"><table><thead><tr><th>Cliente</th><th>Tipo</th><th>Documento</th><th>Contacto</th><th>Estado</th><th /></tr></thead><tbody>{rows.map((client) => <tr key={client.id}><td><button className="client-name" onClick={() => void openDetail(client)}>{client.fullName}</button></td><td>{client.type === 'person' ? 'Persona' : 'Empresa'}</td><td>{client.documentNumber || '—'}</td><td>{client.email || client.phone || '—'}</td><td><span className={`client-badge ${client.isActive ? 'active' : ''}`}>{client.isActive ? 'Activo' : 'Inactivo'}</span></td><td><button className="client-secondary small" onClick={() => setEditing(client)}>Editar</button></td></tr>)}</tbody></table></div>}
      {total > 20 && <div className="clients-pagination"><span>Página {page} de {maxPage}</span><button className="client-secondary small" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><button className="client-secondary small" disabled={page >= maxPage} onClick={() => setPage(page + 1)}>Siguiente</button></div>}
    </section>
    {editing && <div className="client-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(null) }}><form className="client-modal" onSubmit={(e) => void saveClient(e)}><div className="client-modal-heading"><div><span className="section-stage">FICHA DE CLIENTE</span><h2>{editing === 'new' ? 'Nuevo cliente' : 'Editar cliente'}</h2></div><button type="button" className="client-close" onClick={() => setEditing(null)}>×</button></div><div className="client-form-grid"><label>Tipo<select name="type" defaultValue={editing === 'new' ? blank.type : editing.type}><option value="person">Persona</option><option value="company">Empresa</option></select></label><label className="wide">Nombre completo o razón social<input name="fullName" required minLength={2} maxLength={160} defaultValue={editing === 'new' ? '' : editing.fullName} /></label><label>DNI / CUIT / CUIL<input name="documentNumber" maxLength={20} defaultValue={editing === 'new' ? '' : editing.documentNumber} /></label><label>Correo electrónico<input name="email" type="email" defaultValue={editing === 'new' ? '' : editing.email} /></label><label>Teléfono<input name="phone" maxLength={40} defaultValue={editing === 'new' ? '' : editing.phone} /></label><label>Fecha de nacimiento<input name="birthDate" type="date" defaultValue={editing === 'new' ? '' : editing.birthDate} /></label><label className="wide">Dirección<input name="address" maxLength={240} defaultValue={editing === 'new' ? '' : editing.address} /></label><label className="wide">Notas<textarea name="notes" rows={3} maxLength={3000} defaultValue={editing === 'new' ? '' : editing.notes} /></label></div><div className="client-modal-actions"><button type="button" className="client-secondary" onClick={() => setEditing(null)}>Cancelar</button><button className="client-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cliente'}</button></div></form></div>}
    {detail && <div className="client-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setDetail(null) }}><section className="client-modal client-detail"><div className="client-modal-heading"><div><span className="section-stage">FICHA DE CLIENTE</span><h2>{detail.fullName}</h2><p>{detail.type === 'person' ? 'Persona' : 'Empresa'} · {detail.isActive ? 'Activo' : 'Inactivo'}</p></div><button className="client-close" onClick={() => setDetail(null)}>×</button></div><div className="client-details-grid">{[['Documento', detail.documentNumber], ['Correo', detail.email], ['Teléfono', detail.phone], ['Nacimiento', detail.birthDate], ['Dirección', detail.address], ['Notas', detail.notes]].map(([label, value]) => <div key={label}><small>{label}</small><p>{value || '—'}</p></div>)}</div><div className="client-related"><h3>Pólizas</h3>{relatedPolicies.length?relatedPolicies.map((policy)=><p key={policy.id}><strong>{policy.policyNumber} · {policy.line}</strong><small>{policy.company.name} · Vence {policy.endDate}</small></p>):<p>Este cliente todavía no tiene pólizas registradas.</p>}</div><div className="client-related"><h3>Tareas</h3>{relatedTasks.length?relatedTasks.map((task)=><p key={task.id}><strong>{task.title}</strong><small>Vencimiento {new Intl.DateTimeFormat('es-AR',{dateStyle:'medium'}).format(new Date(task.dueAt))}</small></p>):<p>No hay tareas abiertas para este cliente.</p>}</div><div className="client-related"><h3>Actividad</h3>{activity.length ? activity.map((entry) => <p key={entry.id}><strong>{entry.action === 'created' ? 'Cliente creado' : entry.action === 'updated' ? `Datos actualizados${entry.changedFields.length ? `: ${entry.changedFields.join(', ')}` : ''}` : entry.status ? 'Cliente activado' : 'Cliente inactivado'}</strong><small>{new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.createdAt))}</small></p>) : <p>Sin actividad registrada todavía.</p>}</div><div className="client-related"><h3>Otros registros relacionados</h3><p>Cotizaciones y siniestros estarán disponibles al habilitar sus módulos.</p></div><div className="client-modal-actions"><button className="client-secondary" onClick={() => { setEditing(detail); setDetail(null) }}>Editar datos</button><button className="client-secondary" onClick={() => void toggleStatus(detail)}>{detail.isActive ? 'Inactivar cliente' : 'Activar cliente'}</button></div></section></div>}
  </div>
}
