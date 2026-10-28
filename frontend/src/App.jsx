import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Contact from './pages/Contact';
import Services from './pages/Services';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#0f172a] text-white font-sans selection:bg-blue-500 selection:text-white flex flex-col overflow-x-hidden">
        {/* Fixed Background Gradients */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] mix-blend-screen"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] mix-blend-screen"></div>
        </div>

        <Navbar />

        <div className="relative z-10 flex-grow flex flex-col">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/services" element={<Services />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/contact" element={<Contact />} /> {/* NEW ROUTE */}
          </Routes>
        </div>

        {/* <Footer /> */}
      </div>
    </BrowserRouter>
  )
}

export default App