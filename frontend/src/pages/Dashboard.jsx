import { useState, useEffect } from 'react'
import { AlertTriangle, Cpu, HardDrive, Activity, Terminal, Globe, Plus, Minus, Server } from 'lucide-react';

const Dashboard = () => {
  const [data, setData] = useState({ nodes: [], events: [], total_traffic: 0 })
  const [lastRoute, setLastRoute] = useState(null)
  const [routeError, setRouteError] = useState('')

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws')
    ws.onmessage = (event) => {
      setData(JSON.parse(event.data))
    }
    return () => ws.close()
  }, [])

  const manualKill = async (id) => {
    await fetch(`http://localhost:8000/api/kill/${id}`, { method: 'POST' })
  }

  const spawnNode = async () => {
    await fetch('http://localhost:8000/api/spawn', { method: 'POST' })
  }

  const removeNode = async () => {
    await fetch('http://localhost:8000/api/remove', { method: 'POST' })
  }

  const sendTestRequest = async () => {
    setRouteError('')
    try {
      const response = await fetch('http://localhost:8000/api/proxy?delay_ms=250')
      const result = await response.json()
      if (!response.ok) throw new Error(result.detail || 'Request failed')
      setLastRoute(result)
    } catch (error) {
      setRouteError(error.message || 'Could not reach the load balancer')
    }
  }

  const getStatusColor = (status) => {
    switch(status) {
      case 'CRITICAL': return 'border-red-500/50 bg-red-900/20 shadow-[0_0_30px_rgba(239,68,68,0.2)]';
      case 'OVERLOADED': return 'border-orange-500/50 bg-orange-900/10';
      case 'WARNING': return 'border-yellow-500/50 bg-yellow-900/10';
      default: return 'border-emerald-500/30 bg-emerald-900/10';
    }
  }

  const getStatusBadge = (status) => {
    switch(status) {
      case 'CRITICAL': return 'text-red-400 border-red-500/30 bg-red-500/20 animate-pulse';
      case 'OVERLOADED': return 'text-orange-400 border-orange-500/30 bg-orange-500/20';
      case 'WARNING': return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/20';
      default: return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/20';
    }
  }

  const activeNodes = data.nodes.filter(n => n.status !== 'CRITICAL').length
  
  return (
    <div className="pt-24 px-6 max-w-7xl mx-auto pb-10 space-y-8">
      
      {/* 1. TOP STATS BAR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-xl backdrop-blur-sm transition-all hover:bg-slate-800/80">
          <div className="flex items-center gap-3 text-slate-400 mb-2">
            <Activity size={20} className="text-blue-400" />
            <span className="font-medium text-sm uppercase tracking-wider">Live Proxy Traffic</span>
          </div>
          <div className="text-4xl font-mono font-bold text-white">{Number(data.total_traffic || 0).toLocaleString()} <span className="text-lg text-slate-500">req/s</span></div>
        </div>
        
        <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-xl backdrop-blur-sm transition-all hover:bg-slate-800/80">
           <div className="flex items-center gap-3 text-slate-400 mb-2">
            <Globe size={20} className="text-emerald-400" />
            <span className="font-medium text-sm uppercase tracking-wider">Load / Node</span>
          </div>
          <div className="text-4xl font-mono font-bold text-white">{activeNodes > 0 ? (data.total_traffic/activeNodes).toFixed(0) : 0} <span className="text-lg text-slate-500">rps</span></div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-xl backdrop-blur-sm transition-all hover:bg-slate-800/80">
           <div className="flex items-center gap-3 text-slate-400 mb-2">
            <Cpu size={20} className="text-purple-400" />
            <span className="font-medium text-sm uppercase tracking-wider">Capacity</span>
          </div>
          <div className={`text-4xl font-mono font-bold ${activeNodes === data.nodes.length ? 'text-emerald-400' : 'text-amber-400'}`}>
             {activeNodes} / {data.nodes.length} <span className="text-lg text-slate-500">Nodes</span>
          </div>
        </div>
      </div>

      {/* 2. CONTROLS HEADER */}
      <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-white/5 backdrop-blur-md">
        <h2 className="text-xl font-bold text-white flex items-center gap-3">
          <Server size={24} className="text-blue-500" /> 
          Elastic Cluster Map
          <span className="text-xs font-mono text-slate-400 border border-slate-700 px-2 py-1 rounded">AUTO-RECOVERY: ON</span>
        </h2>
        
        <div className="flex gap-3">
           <button
            onClick={sendTestRequest}
            className="inline-flex items-center gap-2 px-4 py-2.5 font-bold text-white bg-emerald-700 rounded-lg hover:bg-emerald-600"
          >
            <Activity size={18} /> Route Test Request
          </button>
           {/* DECOMMISSION BUTTON */}
           <button 
            onClick={removeNode}
            disabled={data.nodes.length <= 1}
            className="group relative inline-flex items-center justify-center gap-2 px-5 py-2.5 font-bold text-slate-300 transition-all duration-200 bg-slate-800 border border-slate-600 rounded-lg hover:bg-red-900/30 hover:text-red-400 hover:border-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Minus size={18} />
            <span>Scale Down</span>
          </button>

          {/* PROVISION BUTTON */}
          <button 
            onClick={spawnNode}
            className="group relative inline-flex items-center justify-center gap-2 px-5 py-2.5 font-bold text-white transition-all duration-200 bg-blue-600 rounded-lg hover:bg-blue-500 hover:shadow-[0_0_15px_rgba(37,99,235,0.4)]"
          >
            <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
            <span>Add Node</span>
          </button>
        </div>
      </div>

      {lastRoute && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-900/10 p-4 text-sm text-emerald-200">
          <strong>Load balancer routed successfully</strong> · {lastRoute.routed_to} · {lastRoute.latency_ms} ms
          <span className="ml-2 text-emerald-400">({lastRoute.algorithm})</span>
        </div>
      )}
      {routeError && (
        <div className="rounded-xl border border-red-500/30 bg-red-900/10 p-4 text-sm text-red-300">{routeError}</div>
      )}

      {/* 3. NODE GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.nodes.map(node => (
          <div key={node.id} className={`relative p-6 rounded-2xl border transition-all duration-500 ${getStatusColor(node.status)}`}>
            
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  {node.name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-mono text-slate-400">{node.id}</span>
                </div>
              </div>
              <div className={`px-2 py-1 rounded text-[10px] font-bold border ${getStatusBadge(node.status)}`}>
                {node.status}
              </div>
            </div>

            {/* Error Message Area */}
            {node.status === 'CRITICAL' && (
               <div className="mb-4 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs font-mono flex items-center gap-2">
                 <AlertTriangle size={12} /> {node.error}
               </div>
            )}

            {/* Metrics Bars */}
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>CPU Load</span>
                  <span className={node.cpu > 90 ? "text-red-400 font-bold" : "text-white"}>{node.cpu}%</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-500 ${
                    node.cpu > 90 ? 'bg-red-500' : 
                    node.cpu > 75 ? 'bg-yellow-500' : 
                    'bg-blue-500'
                  }`} style={{width: `${node.cpu}%`}}></div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="rounded bg-slate-950/50 p-2">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">In flight</div>
                  <div className="font-mono text-lg text-white">{node.in_flight ?? 0}</div>
                </div>
                <div className="rounded bg-slate-950/50 p-2">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">Req/s</div>
                  <div className="font-mono text-lg text-white">{Number(node.requests_per_sec ?? 0).toFixed(2)}</div>
                </div>
                <div className="rounded bg-slate-950/50 p-2">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">Avg latency</div>
                  <div className="font-mono text-lg text-white">{Number(node.latency ?? 0).toFixed(1)}<span className="text-xs text-slate-500">ms</span></div>
                </div>
              </div>
            </div>

            {/* Action Area */}
            {node.status !== 'CRITICAL' ? (
              <button 
                onClick={() => manualKill(node.id)}
                className="w-full py-2 mt-4 bg-slate-800/50 hover:bg-red-500/20 hover:text-red-400 border border-slate-700 hover:border-red-500/50 rounded text-xs font-bold uppercase tracking-wider transition-all backdrop-blur-sm"
              >
                Terminate Process
              </button>
            ) : (
              <div className="w-full py-2 mt-4 text-center text-xs font-bold text-emerald-400 animate-pulse uppercase tracking-wider flex justify-center items-center gap-2">
                <Activity size={14} /> RECOVERING...
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 4. AUDIT LOG */}
      <div className="bg-[#0c0c0c] border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="bg-slate-900/50 px-4 py-2 border-b border-slate-800 flex items-center gap-2">
          <Terminal size={16} className="text-slate-400" />
          <span className="text-sm font-mono text-slate-400">System Event Log</span>
        </div>
        <div className="h-48 overflow-y-auto p-4 font-mono text-sm space-y-2 scrollbar-thin scrollbar-thumb-slate-700">
          {data.events.map((log, i) => (
            <div key={i} className="flex gap-4 border-b border-white/5 pb-1 last:border-0 hover:bg-white/5 transition-colors">
              <span className="text-slate-500 w-20 shrink-0">{log.time}</span>
              <span className={`w-28 shrink-0 font-bold ${
                log.source === 'Admin' ? 'text-amber-500' : 
                log.source === 'ChaosEngine' ? 'text-red-500' : 
                'text-blue-400'
              }`}>{log.source}</span>
              <span className="text-slate-300">{log.msg}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Dashboard