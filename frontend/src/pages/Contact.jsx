import { Github, Linkedin, Mail, MapPin, ExternalLink, Code2, Terminal } from 'lucide-react';

const Contact = () => {
  return (
    <div className="min-h-screen pt-24 px-6 flex items-center justify-center relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-20 right-20 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-20 left-20 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center relative z-10">
        
        {/* Left Side: Profile Image */}
        <div className="relative group mx-auto md:mx-0">
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-full blur-2xl opacity-40 group-hover:opacity-60 transition-opacity duration-500"></div>
          <div className="w-64 h-64 md:w-80 md:h-80 rounded-full p-2 border-2 border-white/10 relative z-10 bg-slate-900/50 backdrop-blur-sm">
             {/* REPLACE THIS URL WITH YOUR PHOTO */}
            <img 
              src="/sumit.png" 
              alt="Profile" 
              className="w-full h-full rounded-full object-cover border-4 border-slate-800 group-hover:scale-105 transition-transform duration-500"
            />
          </div>
          {/* Floating Badge */}
          <div className="absolute bottom-4 right-4 md:right-0 bg-slate-900 border border-slate-700 px-4 py-2 rounded-xl flex items-center gap-2 shadow-xl z-20 animate-bounce">
            <Code2 size={20} className="text-blue-400" />
            <span className="text-white font-bold text-sm">Full Stack Dev</span>
          </div>
        </div>

        {/* Right Side: Info & Links */}
        <div className="space-y-8 text-center md:text-left">
          <div>
            <h1 className="text-5xl font-bold text-white mb-2">Sumit Kumar</h1>
            <p className="text-xl text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 font-medium">
              Software Engineer & System Architect
            </p>
            <p className="text-slate-400 mt-4 leading-relaxed max-w-md mx-auto md:mx-0">
              Passionate about building resilient distributed systems and interactive web experiences. This project, <strong>Sentinellus</strong>, demonstrates my ability to merge complex backend orchestration with real-time frontend visualization.
            </p>
          </div>

          <div className="flex flex-col gap-4 max-w-sm mx-auto md:mx-0">
            <a href="https://github.com/sumitkr-2" target="_blank" rel="noreferrer" 
               className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-blue-500/50 hover:scale-105 transition-all group">
              <div className="p-2 rounded-lg bg-slate-800 text-white group-hover:text-blue-400 transition-colors">
                <Github size={24} />
              </div>
              <div className="text-left">
                <h3 className="text-white font-bold text-sm">GitHub</h3>
                <p className="text-slate-500 text-xs">View my code repositories</p>
              </div>
              <ExternalLink size={16} className="ml-auto text-slate-600 group-hover:text-blue-400" />
            </a>

            <a href="https://www.linkedin.com/in/sumit-kumar2004/" target="_blank" rel="noreferrer"
               className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-blue-500/50 hover:scale-105 transition-all group">
              <div className="p-2 rounded-lg bg-slate-800 text-white group-hover:text-blue-400 transition-colors">
                <Linkedin size={24} />
              </div>
              <div className="text-left">
                <h3 className="text-white font-bold text-sm">LinkedIn</h3>
                <p className="text-slate-500 text-xs">Let's connect professionally</p>
              </div>
              <ExternalLink size={16} className="ml-auto text-slate-600 group-hover:text-blue-400" />
            </a>

            <a href="mailto:sumit.kumar120664@gmail.com"
               className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-blue-500/50 hover:scale-105 transition-all group">
              <div className="p-2 rounded-lg bg-slate-800 text-white group-hover:text-blue-400 transition-colors">
                <Mail size={24} />
              </div>
              <div className="text-left">
                <h3 className="text-white font-bold text-sm">Email Me</h3>
                <p className="text-slate-500 text-xs">sumit.kumar120664@gmail.com</p>
              </div>
              <ExternalLink size={16} className="ml-auto text-slate-600 group-hover:text-blue-400" />
            </a>
          </div>

          <div className="flex items-center justify-center md:justify-start gap-2 text-slate-500 text-sm">
            <MapPin size={16} /> New Delhi, India
          </div>
        </div>

      </div>
    </div>
  );
};

export default Contact;