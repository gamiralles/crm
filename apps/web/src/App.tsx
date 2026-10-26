import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import ClientsPage from './ClientsPage'
import { NotificationsPage, PoliciesPage, RenewalsPage, TasksPage } from './OperationsPages'
import { clientApi } from './client-api'
import { opsApi, type Policy, type TaskItem } from './operations-api'
import { BusinessPage, InsuranceCompaniesPage } from './BusinessPages'

type IconName = 'home' | 'users' | 'shield' | 'refresh' | 'check' | 'file' | 'calendar' | 'alert' | 'wallet' | 'building' | 'chart' | 'bell' | 'settings' | 'search' | 'menu' | 'arrow' | 'spark' | 'clock' | 'close'

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const }
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 11.55-2.6L20 12M4 12l2.85 5.6A7 7 0 0 0 18.4 15"/></>,
    check: <><path d="M9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h8"/></>,
    calendar: <><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
    alert: <><path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18M16 15h2M7 5V3h11"/></>,
    building: <><path d="M3 21h18M5 21V7l7-4 7 4v14M9 10h.01M15 10h.01M9 14h.01M15 14h.01M10 21v-4h4v4"/></>,
    chart: <><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-5 5"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.8 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.8-1l-1.7.7-1.4-2.4L7.1 15a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.8-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.8 1l1.7-.7 1.4 2.4-1.4 1.1a8 8 0 0 1-.1 2Z"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z"/><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    close: <><path d="m18 6-12 12M6 6l12 12"/></>,
  }
  return <svg {...common}>{paths[name]}</svg>
}

const navItems: { label: string; path: string; icon: IconName; group: 'general' | 'gestión' | 'control' }[] = [
  { label: 'Inicio', path: '/', icon: 'home', group: 'general' },
  { label: 'Clientes', path: '/clientes', icon: 'users', group: 'gestión' },
  { label: 'Pólizas', path: '/polizas', icon: 'shield', group: 'gestión' },
  { label: 'Renovaciones', path: '/renovaciones', icon: 'refresh', group: 'gestión' },
  { label: 'Tareas', path: '/tareas', icon: 'check', group: 'gestión' },
  { label: 'Cotizaciones', path: '/cotizaciones', icon: 'file', group: 'gestión' },
  { label: 'Calendario', path: '/calendario', icon: 'calendar', group: 'gestión' },
  { label: 'Siniestros', path: '/siniestros', icon: 'alert', group: 'gestión' },
  { label: 'Caja y comisiones', path: '/caja', icon: 'wallet', group: 'control' },
  { label: 'Comisiones', path: '/comisiones', icon: 'wallet', group: 'control' },
  { label: 'Aseguradoras', path: '/aseguradoras', icon: 'building', group: 'control' },
  { label: 'Comisiones', path: '/comisiones', icon: 'wallet', group: 'control' },
  { label: 'Informes', path: '/informes', icon: 'chart', group: 'control' },
  { label: 'Notificaciones', path: '/notificaciones', icon: 'bell', group: 'control' },
]

const metadata: Record<string, { title: string; description: string; icon: IconName }> = {
  '/clientes': { title: 'Clientes', description: 'Tu cartera, organizada en un solo lugar.', icon: 'users' },
  '/polizas': { title: 'Pólizas', description: 'Vigencias y datos clave de cada cobertura.', icon: 'shield' },
  '/renovaciones': { title: 'Renovaciones', description: 'Seguimiento para llegar a tiempo a cada vencimiento.', icon: 'refresh' },
  '/tareas': { title: 'Tareas', description: 'Próximos pasos y seguimientos pendientes.', icon: 'check' },
  '/cotizaciones': { title: 'Cotizaciones', description: 'Oportunidades en preparación y seguimiento.', icon: 'file' },
  '/calendario': { title: 'Calendario', description: 'Fechas importantes y próximos eventos.', icon: 'calendar' },
  '/siniestros': { title: 'Siniestros', description: 'Casos y novedades vinculados a tus clientes.', icon: 'alert' },
  '/caja': { title: 'Caja y comisiones', description: 'Ingresos, gastos y comisiones por cobrar.', icon: 'wallet' },
  '/comisiones': { title: 'Comisiones', description: 'Seguimiento de facturación y cobros.', icon: 'wallet' },
  '/aseguradoras': { title: 'Aseguradoras', description: 'Compañías con las que trabajás.', icon: 'building' },
  '/informes': { title: 'Informes', description: 'Una vista clara de la actividad de tu cartera.', icon: 'chart' },
  '/notificaciones': { title: 'Notificaciones', description: 'Avisos y resultados de seguimiento.', icon: 'bell' },
  '/configuracion': { title: 'Configuración', description: 'Preferencias de tu espacio de trabajo.', icon: 'settings' },
}

function AppShell({ onLogout, preview = false }: { onLogout: () => void; preview?: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState('')
  const searchInput = useRef<HTMLInputElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const matches = useMemo(() => navItems.filter((item) => item.label.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es'))), [search])
  const suggestionsOpen = search.trim().length > 0

  function chooseResult(path: string) {
    navigate(path)
    setSearch('')
    setMobileOpen(false)
  }

  return (
    <div className="app-shell">
      <div className={`sidebar-backdrop ${mobileOpen ? 'is-visible' : ''}`} onClick={() => setMobileOpen(false)} aria-hidden="true" />
      <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`} aria-label="Navegación principal">
        <Link className="brand" to="/" onClick={() => setMobileOpen(false)}>
          <span className="brand-mark"><Icon name="spark" size={21} /></span>
          <span><strong>CRM</strong><small>DE SEGUROS</small></span>
        </Link>
        <div className="workspace-switcher">
          <span className="workspace-avatar">G</span>
          <span className="workspace-label"><strong>Mi productoría</strong><small>Espacio de trabajo</small></span>
          <span className="workspace-chevron">⌄</span>
        </div>
        <nav className="main-nav">
          {(['general', 'gestión', 'control'] as const).map((group) => (
            <div className="nav-group" key={group}>
              {group !== 'general' && <p className="nav-caption">{group === 'gestión' ? 'GESTIÓN' : 'SEGUIMIENTO'}</p>}
              {navItems.filter((item) => item.group === group).map((item) => (
                <NavLink key={item.path} to={item.path} end={item.path === '/'} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Icon name={item.icon} size={17} /><span>{item.label}</span>
                  {item.path === '/renovaciones' && <span className="nav-dot" aria-label="Prioridad" />}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <NavLink to="/configuracion" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileOpen(false)}><Icon name="settings" size={17} /><span>Configuración</span></NavLink>
          <div className="sidebar-note"><span className="note-icon"><Icon name="spark" size={15} /></span><p><strong>Un día a la vez</strong><br />Tu próxima renovación merece atención.</p></div>
          <div className="account-row"><span className="account-avatar">G</span><span><strong>Productor</strong><small>{preview ? 'Vista local' : 'Espacio privado'}</small></span>{!preview && <button className="account-menu" onClick={onLogout} aria-label="Cerrar sesión">↗</button>}</div>
        </div>
      </aside>

      <main className="main-area">
        {preview && <div className="local-preview-banner" role="status"><strong>Vista local de la interfaz</strong><span>La API y MongoDB no están conectados. Los cambios no se guardan.</span></div>}
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Abrir menú" onClick={() => setMobileOpen(true)}><Icon name="menu" /></button>
          <div className="breadcrumbs"><span>Mi espacio</span><span className="crumb-slash">/</span><strong>{location.pathname === '/' ? 'Inicio' : metadata[location.pathname]?.title ?? 'Inicio'}</strong></div>
          <div className="topbar-actions">
            <div className="search-wrap" onClick={() => searchInput.current?.focus()}>
              <Icon name="search" size={17} />
              <input ref={searchInput} aria-label="Buscar una sección" placeholder="Buscar una sección..." value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && matches[0]) chooseResult(matches[0].path); if (event.key === 'Escape') setSearch('') }} />
              {search && <button className="clear-search" aria-label="Limpiar búsqueda" onClick={() => setSearch('')}><Icon name="close" size={14} /></button>}
              {suggestionsOpen && <div className="search-results" role="listbox" aria-label="Secciones">
                {matches.length ? matches.slice(0, 6).map((item) => <button key={item.path} role="option" aria-selected="false" onClick={() => chooseResult(item.path)}><Icon name={item.icon} size={16} /><span>{item.label}</span><Icon name="arrow" size={14} /></button>) : <p>No encontramos esa sección.</p>}
              </div>}
            </div>
            <span className="topbar-divider" />
            <Link className="icon-button notification-button" to="/notificaciones" aria-label="Ver notificaciones"><Icon name="bell" /></Link>
            <span className="top-avatar">G</span>
          </div>
        </header>

        <div className="content-wrap">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clientes" element={<ClientsPage />} />
            <Route path="/polizas" element={<PoliciesPage />} />
            <Route path="/renovaciones" element={<RenewalsPage />} />
            <Route path="/tareas" element={<TasksPage />} />
            <Route path="/notificaciones" element={<NotificationsPage />} />
            <Route path="/calendario" element={<BusinessPage section="calendar" />} />
            <Route path="/cotizaciones" element={<BusinessPage section="quotes" />} />
            <Route path="/siniestros" element={<BusinessPage section="claims" />} />
            <Route path="/caja" element={<BusinessPage section="cash" />} />
            <Route path="/informes" element={<BusinessPage section="reports" />} />
            <Route path="/comisiones" element={<BusinessPage section="commissions" />} />
            <Route path="/aseguradoras" element={<InsuranceCompaniesPage />} />
            {Object.entries(metadata).filter(([path]) => !['/clientes','/polizas','/renovaciones','/tareas','/notificaciones','/calendario','/cotizaciones','/siniestros','/caja','/comisiones','/aseguradoras','/informes'].includes(path)).map(([path, item]) => <Route key={path} path={path} element={<SectionPage title={item.title} description={item.description} icon={item.icon} />} />)}
            <Route path="*" element={<SectionPage title="Sección" description="Esta sección todavía no está disponible." icon="file" />} />
          </Routes>
        </div>
        <footer className="footer"><span>Brújula · CRM para productores</span><span>Un espacio pensado para acompañar cada renovación.</span></footer>
      </main>
    </div>
  )
}

function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (import.meta.env.DEV) {
      setAuthenticated(true)
      return
    }
    clientApi.me().then(() => setAuthenticated(true)).catch(() => setAuthenticated(false))
  }, [])
  async function login(event: FormEvent) {
    event.preventDefault(); setError('')
    try { await clientApi.login(email, password); setAuthenticated(true) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos iniciar sesión.') }
  }
  async function logout() { await clientApi.logout().catch(() => undefined); setAuthenticated(false) }
  if (authenticated === null) return <div className="client-auth"><p>Conectando con tu espacio…</p></div>
  if (!authenticated) return <div className="client-auth"><form className="client-login" onSubmit={(event) => void login(event)}><span className="section-stage">ACCESO PRIVADO</span><h1>Ingresá a tu espacio</h1><p>Usá el correo y la contraseña de tu cuenta.</p>{error && <div className="client-error">{error}</div>}<label>Correo electrónico<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Contraseña<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label><button className="client-primary" type="submit">Ingresar</button><small>El alta inicial del propietario se realiza desde el endpoint protegido del servidor.</small></form></div>
  return <AppShell onLogout={() => void logout()} preview={import.meta.env.DEV} />
}

function Dashboard() {
  const [upcoming, setUpcoming] = useState<Policy[]>([])
  const [todayTasks, setTodayTasks] = useState<TaskItem[]>([])
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [events, setEvents] = useState<Array<{id:string;title:string;startAt:string;source:string}>>([])
  const [commissionSummary, setCommissionSummary] = useState({count:0,amount:0})
  const [currency,setCurrency] = useState('ARS')
  useEffect(() => {
    opsApi.policies('status=active&limit=100').then((result) => setUpcoming(result.data.filter((policy) => policy.daysRemaining >= 0).sort((a, b) => a.daysRemaining - b.daysRemaining).slice(0, 4))).catch(() => undefined)
    opsApi.tasks().then((tasks) => { const date = dateInArgentina(new Date()); setTodayTasks(tasks.filter((task) => task.dueAt.slice(0, 10) <= date).slice(0, 4)) }).catch(() => undefined)
    opsApi.notifications().then((result) => setUnreadNotifications(result.unread)).catch(() => undefined)
    const from=new Date(),to=new Date();to.setDate(to.getDate()+30)
    opsApi.call<Array<{id:string;title:string;startAt:string;source:string}>>(`/business/calendar?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`).then((items)=>setEvents(items.slice(0,4))).catch(()=>undefined)
    opsApi.call<Array<{id:string;status:string;amount:number}>>('/business/commissions').then((items)=>{const pending=items.filter((item)=>item.status!=='collected');setCommissionSummary({count:pending.length,amount:pending.reduce((sum,item)=>sum+item.amount,0)})}).catch(()=>undefined)
    clientApi.me().then((me)=>setCurrency(me.organization.currency||'ARS')).catch(()=>undefined)
  }, [])
  const date = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date())
  return <div className="page-enter">
    <div className="page-heading dashboard-heading">
      <div><p className="eyebrow">{date}</p><h1>Hola, Productor <span className="wave">✳</span></h1><p className="page-subtitle">Este es el pulso de tu actividad.</p></div>
      <span className="setup-chip"><span className="setup-dot" />Espacio listo para conectar</span>
    </div>

    <section className="welcome-banner">
      <div className="welcome-copy"><span className="banner-kicker"><Icon name="spark" size={14} /> TU CARTERA, MÁS CERCA</span><h2>Lo importante, siempre<br className="desktop-break" /> a tiempo.</h2><p>Organizá tus clientes y mantené cada renovación en el radar.</p><Link className="banner-link" to="/polizas">Ir a pólizas <Icon name="arrow" size={16} /></Link></div>
      <div className="banner-art" aria-hidden="true"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-sun"/><div className="art-card"><span className="art-card-icon"><Icon name="shield" size={20}/></span><span className="art-card-lines"><i/><i/><i/></span><span className="art-card-check"><Icon name="check" size={13}/></span></div><div className="art-star">✳</div></div>
    </section>

    <div className="section-title-row"><div><h2>Tu día, en perspectiva</h2><p>Vencimientos, seguimientos y avisos de tu espacio.</p></div><div className="dashboard-day-actions"><span className="today-label"><Icon name="clock" size={15}/>{date}</span><Link className="unread-link" to="/notificaciones"><Icon name="bell" size={14}/>{unreadNotifications} sin leer</Link></div></div>
    <section className="overview-grid" aria-label="Resumen de actividad">
      <SummaryCard icon="shield" tone="sage" title="Próximos vencimientos" description="Pólizas que se acercan a su fecha de renovación." link="Ver pólizas" to="/polizas" />
      <SummaryCard icon="refresh" tone="peach" title="Renovaciones pendientes" description="Seguimientos para cuidar la continuidad de cada cliente." link="Ver renovaciones" to="/renovaciones" />
      <SummaryCard icon="check" tone="lilac" title="Tareas del día" description="Próximas acciones y compromisos de seguimiento." link="Ver tareas" to="/tareas" />
      <SummaryCard icon="wallet" tone="peach" title="Comisiones pendientes" description={`${commissionSummary.count} por completar · ${new Intl.NumberFormat('es-AR',{style:'currency',currency}).format(commissionSummary.amount)}`} link="Ver comisiones" to="/comisiones" />
    </section>

    <section className="dashboard-worklist"><div className="panel"><div className="panel-heading"><div><h2>Vencimientos próximos</h2><p>Ordenados por días restantes.</p></div><Link className="worklist-more" to="/polizas">Ver pólizas →</Link></div>{upcoming.length?upcoming.map((policy)=><Link className="worklist-row" to="/polizas" key={policy.id}><span><strong>{policy.client.name}</strong><small>{policy.company.name} · {policy.policyNumber}</small></span><b className={policy.daysRemaining<=30?'urgent':''}>{policy.daysRemaining===0?'Vence hoy':`${policy.daysRemaining} días`}</b></Link>):<p className="worklist-empty">No hay pólizas próximas cargadas.</p>}</div><div className="panel"><div className="panel-heading"><div><h2>Seguimientos para hoy</h2><p>Tareas vencidas o con fecha de hoy.</p></div><Link className="worklist-more" to="/tareas">Ver tareas →</Link></div>{todayTasks.length?todayTasks.map((task)=><Link className="worklist-row" to="/tareas" key={task.id}><span><strong>{task.title}</strong><small>{task.client?.name??'Sin cliente'}</small></span><b className="urgent">{task.dueAt.slice(0,10)<dateInArgentina(new Date())?'Atrasada':'Hoy'}</b></Link>):<p className="worklist-empty">No hay seguimientos pendientes para hoy.</p>}</div><div className="panel"><div className="panel-heading"><div><h2>Próximos eventos</h2><p>Agenda de los próximos 30 días.</p></div><Link className="worklist-more" to="/calendario">Ver calendario →</Link></div>{events.length?events.map((event)=><Link className="worklist-row" to="/calendario" key={`${event.source}-${event.id}`}><span><strong>{event.title}</strong><small>{event.source==='task'?'Tarea':event.source==='renewal'?'Renovación':event.source==='outlook'?'Outlook':'Evento'}</small></span><b>{new Intl.DateTimeFormat('es-AR',{dateStyle:'medium'}).format(new Date(event.startAt))}</b></Link>):<p className="worklist-empty">No hay eventos próximos.</p>}</div></section>

    <section className="lower-grid">
      <div className="panel recent-panel"><div className="panel-heading"><div><h2>Actividad reciente</h2><p>Un registro de lo que pasa en tu cartera.</p></div><span className="panel-icon"><Icon name="clock" size={17}/></span></div><EmptyState compact title="Tu actividad aparecerá acá" body="Cuando conectemos clientes y pólizas, vas a encontrar aquí los últimos movimientos." /></div>
      <div className="panel quick-panel"><div className="panel-heading"><div><h2>Accesos rápidos</h2><p>Entrá directo a lo que necesitás.</p></div><span className="panel-icon panel-icon-warm"><Icon name="spark" size={17}/></span></div><div className="quick-links"><QuickLink label="Clientes" detail="Tu cartera" icon="users" to="/clientes"/><QuickLink label="Pólizas" detail="Vigencias y cobertura" icon="shield" to="/polizas"/><QuickLink label="Renovaciones" detail="Seguimiento próximo" icon="refresh" to="/renovaciones"/></div></div>
    </section>
    <p className="data-note"><span className="data-note-dot"/>Este resumen se alimenta de los registros reales de tu espacio.</p>
  </div>
}

function SummaryCard({ icon, tone, title, description, link, to }: { icon: IconName; tone: string; title: string; description: string; link: string; to: string }) {
  return <article className="summary-card"><div className={`summary-icon ${tone}`}><Icon name={icon} size={19}/></div><div className="summary-card-body"><h3>{title}</h3><p>{description}</p><Link to={to}>{link}<Icon name="arrow" size={14}/></Link></div></article>
}

function QuickLink({ label, detail, icon, to }: { label: string; detail: string; icon: IconName; to: string }) {
  return <Link to={to} className="quick-link"><span className="quick-icon"><Icon name={icon} size={17}/></span><span className="quick-copy"><strong>{label}</strong><small>{detail}</small></span><Icon name="arrow" size={15}/></Link>
}

function SectionPage({ title, description, icon }: { title: string; description: string; icon: IconName }) {
  return <div className="page-enter section-page"><div className="page-heading"><div><p className="eyebrow">MI ESPACIO</p><h1>{title}</h1><p className="page-subtitle">{description}</p></div></div><div className="section-intro-card"><span className="section-hero-icon"><Icon name={icon} size={22}/></span><div><span className="section-stage">ETAPA 1 · NAVEGACIÓN</span><h2>Tu espacio de {title.toLocaleLowerCase('es')}</h2><p>La estructura visual está preparada. Esta sección se conectará a datos reales en su etapa correspondiente.</p></div></div><div className="panel section-empty"><EmptyState title="Todavía no hay información" body="No se muestran registros de ejemplo. Cuando se implemente este módulo, acá vas a ver tus datos reales." /></div><Link to="/" className="back-home"><Icon name="arrow" size={15}/>Volver al inicio</Link></div>
}

function EmptyState({ title, body, compact = false }: { title: string; body: string; compact?: boolean }) {
  return <div className={`empty-state ${compact ? 'compact' : ''}`}><span className="empty-illustration"><span><Icon name="file" size={19}/></span><i/><i/></span><div><h3>{title}</h3><p>{body}</p></div></div>
}

export default App

function dateInArgentina(date: Date) { const parts = new Intl.DateTimeFormat('en', { timeZone:'America/Argentina/Buenos_Aires', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(date); const value = Object.fromEntries(parts.map((part)=>[part.type,part.value])); return `${value.year}-${value.month}-${value.day}` }

