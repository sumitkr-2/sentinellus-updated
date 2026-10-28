import { useState, useEffect } from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Zap, Activity, Gauge } from 'lucide-react';

const Analytics = () => {
  const [dataHistory, setDataHistory] = useState([]);
  const [currentMetrics, setCurrentMetrics] = useState(null);
  const [stressMode, setStressMode] = useState(false);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws');
    
    ws.onmessage = (event) => {
      const response = JSON.parse(event.data); // This is the new full object
      const timestamp = new Date().toLocaleTimeString();
      
      setCurrentMetrics(response);
      setStressMode(response.stress_mode);

      setDataHistory(prev => {
        const newData = [...prev, { 
          time: timestamp, 
          load: response.total_traffic / 100, // Scale down for graph visibility
          latency: response.avg_latency,
          health: response.health_score
        }];
        return newData.slice(-20); // Keep last 20 points
      });
    };

    return () => ws.close();
  }, []);

  const toggleStress = async () => {
    await fetch(`http://localhost:8000/api/stress/${!stressMode}`, { method: 'POST' });
  };

  if (!currentMetrics) return <div className="pt-24 text-center text-white">Loading Analytics Stream...</div>;

  return (
    <div className="pt-24 px-8 max-w-7xl mx-auto space-y-8 pb-10">
      
      {/* Header with Stress Test Button */}
      <div className="flex justify-between items-end border-b border-slate-700 pb-4">
        <div>
          <h2 className="text-3xl font-bold text-white">System Analytics</h2>
          <p className="text-slate-400">Real-time telemetry and performance benchmarks</p>
        </div>
        <button 
          onClick={toggleStress}
          className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${
            stressMode 
            ? 'bg-red-500 text-white animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.6)]' 
            : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600'
          }`}
        >
          <Zap size={20} className={stressMode ? "fill-white" : ""} />
          {stressMode ? 'STOP STRESS TEST' : 'START STRESS SIMULATION'}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700 backdrop-blur-sm">
           <div className="flex justify-between mb-4">
             <h3 className="text-slate-400 font-medium">Avg Latency</h3>
             <Activity className="text-pink-400" />
           </div>
           <div className="text-4xl font-mono font-bold text-white">{currentMetrics.avg_latency} <span className="text-lg text-slate-500">ms</span></div>
        </div>
        <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700 backdrop-blur-sm">
           <div className="flex justify-between mb-4">
             <h3 className="text-slate-400 font-medium">Health Score</h3>
             <Gauge className="text-emerald-400" />
           </div>
           <div className="text-4xl font-mono font-bold text-emerald-400">{currentMetrics.health_score}%</div>
        </div>
        <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700 backdrop-blur-sm">
           <div className="flex justify-between mb-4">
             <h3 className="text-slate-400 font-medium">Traffic Load</h3>
             <Zap className="text-blue-400" />
           </div>
           <div className="text-4xl font-mono font-bold text-white">{(currentMetrics.total_traffic / 1000).toFixed(1)}k <span className="text-lg text-slate-500">req/s</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Chart 1: Latency (Area Chart) */}
        <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700 backdrop-blur-sm">
          <h3 className="text-lg font-bold text-pink-400 mb-6">Network Latency (ms)</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dataHistory}>
                <defs>
                  <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" stroke="#9CA3AF" fontSize={12} tick={{fill: '#9CA3AF'}} />
                <YAxis stroke="#9CA3AF" fontSize={12} tick={{fill: '#9CA3AF'}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
                />
                <Area type="monotone" dataKey="latency" stroke="#ec4899" fillOpacity={1} fill="url(#colorLatency)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: System Health (Line Chart) */}
        <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700 backdrop-blur-sm">
          <h3 className="text-lg font-bold text-emerald-400 mb-6">Cluster Health Stability</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dataHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" stroke="#9CA3AF" fontSize={12} tick={{fill: '#9CA3AF'}} />
                <YAxis stroke="#9CA3AF" fontSize={12} tick={{fill: '#9CA3AF'}} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
                />
                <Line type="step" dataKey="health" stroke="#10B981" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;