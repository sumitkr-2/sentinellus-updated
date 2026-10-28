import { useMemo, useState } from 'react'
import {
  Activity, ArrowDownRight, ArrowUpRight, BellRing, Boxes, CheckCircle2,
  ChevronRight, CircleDollarSign, Clock3, Code2, CreditCard, Database,
  Fingerprint, Gauge, Layers3, PackageCheck, Radio, RefreshCw, Search,
  Server, ShoppingCart, ShieldCheck, ShoppingBag, Zap
} from 'lucide-react'

const serviceCatalog = [
  { id: 'payments', name: 'Payment Processing', description: 'Authorize, capture and reconcile payment requests.', icon: CreditCard, color: 'violet', tier: 'Critical', route: '/payments', delay: 450, tags: ['PCI boundary', 'Idempotency'] },
  { id: 'checkout', name: 'Checkout API', description: 'Cart validation and order submission workflow.', icon: ShoppingCart, color: 'blue', tier: 'Critical', route: '/checkout', delay: 300, tags: ['Customer-facing', 'Low latency'] },
  { id: 'identity', name: 'Identity & Auth', description: 'Login, token validation and session management.', icon: Fingerprint, color: 'cyan', tier: 'Critical', route: '/identity', delay: 180, tags: ['JWT', 'Rate limited'] },
  { id: 'orders', name: 'Order Management', description: 'Order lifecycle, status updates and fulfilment events.', icon: PackageCheck, color: 'emerald', tier: 'High', route: '/orders', delay: 320, tags: ['Event-driven', 'Retryable'] },
  { id: 'inventory', name: 'Inventory Service', description: 'Stock availability and reservation checks.', icon: Boxes, color: 'amber', tier: 'High', route: '/inventory', delay: 250, tags: ['Consistency', 'Cacheable'] },
  { id: 'notifications', name: 'Notifications', description: 'Email, SMS and in-app delivery jobs.', icon: BellRing, color: 'pink', tier: 'Normal', route: '/notifications', delay: 380, tags: ['Async workload', 'Burst tolerant'] },
  { id: 'search', name: 'Product Search', description: 'Catalog search and filtering requests.', icon: Search, color: 'indigo', tier: 'High', route: '/search', delay: 220, tags: ['Read-heavy', 'Cacheable'] },
  { id: 'analytics', name: 'Analytics Ingest', description: 'Collect events for dashboards and reporting.', icon: Database, color: 'teal', tier: 'Normal', route: '/analytics/events', delay: 500, tags: ['Batchable', 'High volume'] },
]

const colorStyles = {
  violet: 'text-violet-300 bg-violet-400/10 border-violet-400/20',
  blue: 'text-blue-300 bg-blue-400/10 border-blue-400/20',
  cyan: 'text-cyan-300 bg-cyan-400/10 border-cyan-400/20',
  emerald: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20',
  amber: 'text-amber-300 bg-amber-400/10 border-amber-400/20',
  pink: 'text-pink-300 bg-pink-400/10 border-pink-400/20',
  indigo: 'text-indigo-300 bg-indigo-400/10 border-indigo-400/20',
  teal: 'text-teal-300 bg-teal-400/10 border-teal-400/20',
}

const Services = () => {
  const [selected, setSelected] = useState('payments')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('All services')
  const [history, setHistory] = useState([])
  const chosen = serviceCatalog.find(service => service.id === selected) || serviceCatalog[0]
  const SelectedIcon = chosen.icon
  const visibleServices = useMemo(() => serviceCatalog.filter(service => filter === 'All services' || service.tier === filter), [filter])

  const sendRequest = async () => {
    setBusy(true)
    setError('')
    try {
      // This project currently exposes a shared worker-pool proxy, not separate service backends.
      // The selected service profile is a demonstrator scenario routed through that real proxy.
      const response = await fetch(`http://localhost:8000/api/proxy?delay_ms=${chosen.delay}`)
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.detail || 'The gateway could not route this request')
      const record = { id: `${Date.now()}-${Math.random()}`, service: chosen.name, route: chosen.route, worker: payload.routed_to || payload.worker || 'Worker selected', latency: payload.latency_ms ?? chosen.delay, time: new Date().toLocaleTimeString() }
      setResult(record)
      setHistory(previous => [record, ...previous].slice(0, 6))
    } catch (err) {
      setError(`${err.message}. Make sure the API is running at localhost:8000.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="relative z-10 mx-auto w-full max-w-[1500px] px-4 pb-12 pt-28 sm:px-6 lg:px-8">
      <section className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/[0.07] px-3 py-1.5 text-xs font-semibold tracking-wide text-cyan-200">
            <Radio size={14} className="animate-pulse" /> SERVICE MESH CONTROL PLANE
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Service Operations</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">Explore the service landscape, choose a workload profile and watch the gateway route a request into the worker pool.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50"/><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"/></span>
            Gateway profile <span className="font-semibold text-white">Connected on request</span>
          </div>
          <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"><Code2 size={16}/> API docs <ChevronRight size={15}/></a>
        </div>
      </section>

      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/[0.08] bg-slate-900/65 p-5 shadow-lg shadow-black/10">
          <div className="flex items-center justify-between text-sm text-slate-400"><span>Service profiles</span><Layers3 size={17} className="text-cyan-300"/></div>
          <div className="mt-3 text-3xl font-semibold text-white">08</div><div className="mt-2 text-xs text-slate-500">Catalogued workload types</div>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-slate-900/65 p-5 shadow-lg shadow-black/10">
          <div className="flex items-center justify-between text-sm text-slate-400"><span>Routing strategy</span><Activity size={17} className="text-violet-300"/></div>
          <div className="mt-3 text-2xl font-semibold text-white">Least-loaded</div><div className="mt-2 text-xs text-slate-500">Provided by the shared gateway</div>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-slate-900/65 p-5 shadow-lg shadow-black/10">
          <div className="flex items-center justify-between text-sm text-slate-400"><span>Request history</span><Clock3 size={17} className="text-amber-300"/></div>
          <div className="mt-3 text-3xl font-semibold text-white">{history.length.toString().padStart(2, '0')}</div><div className="mt-2 text-xs text-slate-500">Successful tests in this session</div>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-slate-900/65 p-5 shadow-lg shadow-black/10">
          <div className="flex items-center justify-between text-sm text-slate-400"><span>Protection</span><ShieldCheck size={17} className="text-emerald-300"/></div>
          <div className="mt-3 text-2xl font-semibold text-white">Rate limiting</div><div className="mt-2 text-xs text-slate-500">Gateway middleware configured</div>
        </div>
      </section>

      <section className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div><h2 className="text-lg font-semibold text-white">Service catalog</h2><p className="mt-1 text-xs text-slate-500">Profiles illustrate common production workloads.</p></div>
            <div className="flex flex-wrap gap-2">{['All services', 'Critical', 'High', 'Normal'].map(option => <button key={option} onClick={() => setFilter(option)} className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${filter === option ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200' : 'border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/[0.06] hover:text-white'}`}>{option}</button>)}</div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {visibleServices.map(service => {
              const Icon = service.icon
              const isSelected = selected === service.id
              return <button key={service.id} onClick={() => { setSelected(service.id); setResult(null); setError('') }} className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition-all duration-200 ${isSelected ? 'border-cyan-400/50 bg-cyan-400/[0.07] shadow-lg shadow-cyan-950/30 ring-1 ring-cyan-400/10' : 'border-white/[0.08] bg-slate-900/55 hover:-translate-y-0.5 hover:border-white/20 hover:bg-slate-900/90'}`}>
                <div className="flex items-start justify-between gap-3"><div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${colorStyles[service.color]}`}><Icon size={20}/></div><span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${service.tier === 'Critical' ? 'border-rose-400/20 bg-rose-400/10 text-rose-300' : service.tier === 'High' ? 'border-amber-400/20 bg-amber-400/10 text-amber-200' : 'border-slate-500/30 bg-slate-500/10 text-slate-300'}`}>{service.tier} tier</span></div>
                <h3 className="mt-4 text-base font-semibold text-white">{service.name}</h3><p className="mt-2 min-h-[42px] text-sm leading-5 text-slate-400">{service.description}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">{service.tags.map(tag => <span key={tag} className="rounded-md border border-white/[0.07] bg-black/20 px-2 py-1 text-[10px] text-slate-400">{tag}</span>)}</div>
                <div className="mt-5 flex items-center justify-between border-t border-white/[0.07] pt-3 text-xs"><span className="font-mono text-slate-500">{service.route}</span><span className={`inline-flex items-center gap-1 font-semibold ${isSelected ? 'text-cyan-200' : 'text-slate-500 group-hover:text-white'}`}>{isSelected ? 'Selected' : 'Inspect profile'} <ChevronRight size={14}/></span></div>
              </button>
            })}
          </div>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-28">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 shadow-2xl shadow-black/20">
            <div className="border-b border-white/[0.08] bg-gradient-to-r from-cyan-400/[0.09] to-violet-400/[0.05] p-5">
              <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Selected workload</span><span className="rounded-md border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-[10px] font-semibold text-amber-200">DEMO PROFILE</span></div>
              <div className="mt-4 flex items-center gap-3"><div className={`flex h-12 w-12 items-center justify-center rounded-xl border ${colorStyles[chosen.color]}`}><SelectedIcon size={22}/></div><div><h3 className="font-semibold text-white">{chosen.name}</h3><p className="mt-1 text-xs text-slate-400">{chosen.route}</p></div></div>
              <p className="mt-4 text-sm leading-6 text-slate-400">{chosen.description} Use this profile to exercise the shared gateway with a representative response delay.</p>
            </div>
            <div className="space-y-4 p-5">
              <div className="flex items-center justify-between text-sm"><span className="text-slate-400">Scenario response delay</span><span className="font-mono text-white">{chosen.delay} ms</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400" style={{ width: `${Math.min(100, chosen.delay / 6)}%` }}/></div>
              <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-3 text-xs leading-5 text-amber-100/80"><strong className="font-semibold text-amber-200">Architecture note:</strong> these are service profiles, not separate deployed microservices yet. Test traffic goes through the existing shared proxy and worker pool.</div>
              <button onClick={sendRequest} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60">{busy ? <RefreshCw size={17} className="animate-spin"/> : <Zap size={17}/>} {busy ? 'Routing request…' : 'Send test request'} <ArrowUpRight size={16}/></button>
              {error && <div role="alert" className="rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-xs leading-5 text-rose-200">{error}</div>}
              {result && <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] p-4"><div className="flex items-center gap-2 text-sm font-semibold text-emerald-200"><CheckCircle2 size={17}/> Gateway request succeeded</div><div className="mt-3 space-y-2 text-xs"><div className="flex justify-between gap-4"><span className="text-slate-500">Scenario</span><span className="text-right text-slate-200">{result.service}</span></div><div className="flex justify-between gap-4"><span className="text-slate-500">Routed worker</span><span className="font-mono text-right text-white">{result.worker}</span></div><div className="flex justify-between gap-4"><span className="text-slate-500">Measured latency</span><span className="font-mono text-white">{result.latency} ms</span></div></div></div>}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-slate-900/60 p-5">
            <div className="mb-4 flex items-center justify-between"><h3 className="text-sm font-semibold text-white">Recent gateway tests</h3><Gauge size={16} className="text-slate-500"/></div>
            {history.length === 0 ? <div className="py-6 text-center"><div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] text-slate-500"><Activity size={18}/></div><p className="mt-3 text-xs text-slate-500">No requests yet. Select a profile and send a test.</p></div> : <div className="space-y-3">{history.map(item => <div key={item.id} className="flex items-center gap-3 border-b border-white/[0.06] pb-3 last:border-0 last:pb-0"><div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300"><CheckCircle2 size={15}/></div><div className="min-w-0 flex-1"><div className="truncate text-xs font-medium text-slate-200">{item.service}</div><div className="mt-1 truncate font-mono text-[10px] text-slate-500">{item.worker} · {item.time}</div></div><div className="font-mono text-xs text-slate-300">{item.latency}ms</div></div>)}</div>}
          </div>
        </aside>
      </section>

      <section className="mt-8 rounded-2xl border border-white/[0.08] bg-slate-900/45 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-white">Request lifecycle</h2><p className="mt-1 text-xs text-slate-500">How the current shared gateway handles a test request</p></div><span className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-400"><Server size={13}/> Existing infrastructure</span></div>
        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-4">{[{ n:'01', title:'Select profile', detail:'Choose a payment, checkout or other workload scenario.', icon:ShoppingBag },{ n:'02', title:'Send to gateway', detail:'Request reaches the FastAPI proxy endpoint.', icon:Radio },{ n:'03', title:'Choose worker', detail:'The configured balancer selects an eligible worker.', icon:Activity },{ n:'04', title:'Measure result', detail:'Show the worker and observed request latency.', icon:Gauge }].map((step, index) => { const Icon = step.icon; return <div key={step.n} className="relative rounded-xl border border-white/[0.07] bg-black/20 p-4"><div className="flex items-center justify-between"><span className="font-mono text-xs text-cyan-300">{step.n}</span><Icon size={17} className="text-slate-500"/></div><h3 className="mt-4 text-sm font-semibold text-white">{step.title}</h3><p className="mt-2 text-xs leading-5 text-slate-500">{step.detail}</p>{index < 3 && <ArrowDownRight className="absolute -right-3 top-1/2 z-10 hidden text-slate-600 md:block" size={18}/>}</div>})}</div>
      </section>
    </main>
  )
}

export default Services
