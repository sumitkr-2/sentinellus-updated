import { Link, useLocation } from 'react-router-dom';
import { Activity, LayoutDashboard, Home, BarChart3, UserCircle2, Layers3 } from 'lucide-react';

const Navbar = () => {
  const location = useLocation();

  const isActive = (path) => location.pathname === path
    ? "text-blue-400 bg-blue-500/10 border-blue-500/50"
    : "text-slate-400 hover:text-white hover:bg-white/5 border-transparent";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-lg bg-slate-900/80 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">

        {/* Logo */}
        
        <Link to="/" className="flex items-center gap-3 group">
          <div className="p-2 rounded-xl bg-blue-500/20 group-hover:bg-blue-500/30 transition-colors">
            <Activity className="text-blue-500 w-6 h-6 animate-pulse" />
          </div>
          <span className="text-xl font-bold tracking-wider text-white">
            SENTINELLUS <span className="text-xs text-blue-400 font-normal ml-1"></span>
          </span>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex gap-2 mr-4">
            <Link to="/" className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-300 font-medium ${isActive('/')}`}>
              <Home size={18} /> <span>Home</span>
            </Link>
            <Link to="/dashboard" className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-300 font-medium ${isActive('/dashboard')}`}>
              <LayoutDashboard size={18} /> <span>Cluster</span>
            </Link>
            <Link to="/analytics" className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-300 font-medium ${isActive('/analytics')}`}>
              <BarChart3 size={18} /> <span>Analytics</span>
            </Link>
            <Link to="/services" className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-300 font-medium ${isActive('/services')}`}>
              <Layers3 size={18} /> <span>Services</span>
            </Link>
          </div>

          {/* NEW CONNECT ME BUTTON */}
          <Link to="/contact" className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all duration-300 ${
            location.pathname === '/contact'
             ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)] scale-105' 
             : 'bg-white/10 text-white hover:bg-white hover:text-black hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]'
          }`}>
             <UserCircle2 size={20} />
             <span>Connect Me</span>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;