import { Link } from 'react-router-dom';
import { Server, ShieldCheck, Activity, ArrowRight } from 'lucide-react';

const Home = () => {
  return (
    <div className="min-h-screen pt-20 px-6 flex flex-col items-center justify-center relative overflow-hidden">
      
      {/* Abstract Background Graphic */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-5xl mx-auto text-center relative z-10 space-y-8">
        
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium tracking-wide">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          ORCHESTRATOR ONLINE
        </div>

        <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white leading-tight">
          Resilient Infrastructure <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Visualization System</span>
        </h1>

        <p className="text-xl text-slate-400 max-w-2xl mx-auto">
          An advanced distributed system simulator demonstrating <strong>Load Balancing</strong>, <strong>Fault Tolerance</strong>, and <strong>Automated Self-Healing</strong> in a containerized environment.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 text-left">
           <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
             <Activity className="text-blue-400 mb-4" size={32} />
             <h3 className="text-lg font-bold text-white">Traffic Simulation</h3>
             <p className="text-sm text-slate-400 mt-2">Dynamic Request-Per-Second (RPS) generation and distribution across active nodes.</p>
           </div>
           <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
             <ShieldCheck className="text-emerald-400 mb-4" size={32} />
             <h3 className="text-lg font-bold text-white">Auto-Healing</h3>
             <p className="text-sm text-slate-400 mt-2">Watchdog service detects SIGKILL events and restores node integrity within 2000ms.</p>
           </div>
           <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
             <Server className="text-purple-400 mb-4" size={32} />
             <h3 className="text-lg font-bold text-white">Container Ops</h3>
             <p className="text-sm text-slate-400 mt-2">Direct integration with Docker Socket for real-time container lifecycle management.</p>
           </div>
        </div>

        <div className="pt-8">
          <Link to="/dashboard" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg shadow-lg shadow-blue-500/25 transition-all hover:scale-105">
            Initialize Dashboard <ArrowRight size={20} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;