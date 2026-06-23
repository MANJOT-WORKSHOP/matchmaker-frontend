import React, { useState, useEffect, useRef } from 'react';
import { Search, PlusCircle, AlertCircle, Home, CheckCircle2, MapPin, Camera, Loader2, Tag, Image as ImageIcon, LayoutGrid, Check, User, LogIn, LogOut, MessageSquareCode, X, Sparkles, Send, ScanLine } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState('home');
  const [formType, setFormType] = useState(''); 
  
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemLocation, setItemLocation] = useState('');
  const [imageFile, setImageFile] = useState(null); 
  
  const [aiMatches, setAiMatches] = useState([]);
  const [browseItems, setBrowseItems] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Auth States
  const [currentUser, setCurrentUser] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authEmail, setAuthEmail] = useState('');

  // Chat Assistant States
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: 'model', text: 'Hi! Tell me what you lost or found and I will draft your report!' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [extractedData, setExtractedData] = useState({ name: '', description: '', location: '', type: 'unknown' });
  const [chatLoading, setChatLoading] = useState(false);

  // Live Camera Scanner States
  const [isLiveScanning, setIsLiveScanning] = useState(false);
  const [liveTags, setLiveTags] = useState([]);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const scanIntervalRef = useRef(null);

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null });
  const chatEndRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  useEffect(() => {
    const savedUser = localStorage.getItem('matchmaker_user');
    if (savedUser) setCurrentUser(JSON.parse(savedUser));
  }, []);

  const triggerToast = (msg, type = 'success') => {
    setToast({ show: true, message: msg, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };

  const goToHome = () => {
    setCurrentView('home');
    setItemName(''); setItemDescription(''); setItemLocation(''); setImageFile(null); 
    stopLiveScan(); // Stop camera if going home
  };

  // --- LIVE CAMERA LOGIC ---
  const startLiveScan = async () => {
    setCurrentView('live-scanner');
    setIsLiveScanning(true);
    setLiveTags(['Warming up AI...']);
    
    try {
      // Access the back camera on mobile, or webcam on PC
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      // Capture a frame every 2 seconds
      scanIntervalRef.current = setInterval(captureAndAnalyze, 2000);
    } catch (err) {
      triggerToast("Camera access denied or unavailable", "error");
      goToHome();
    }
  };

  const stopLiveScan = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    clearInterval(scanIntervalRef.current);
    setIsLiveScanning(false);
    setLiveTags([]);
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');
      
      try {
         const res = await fetch('https://ai-matchmaker-api-kjky.onrender.com', { method: 'POST', body: formData });
         const data = await res.json();
         if (data.tags && data.tags.length > 0) {
           setLiveTags(data.tags);
         } else {
           setLiveTags(["Scanning..."]);
         }
      } catch(e) { 
         console.error("Frame drop"); 
      }
    }, 'image/jpeg');
  };
  // -------------------------

  const loadBrowseFeed = async () => {
    setCurrentView('browse'); setIsProcessing(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/items');
      const data = await res.json();
      setBrowseItems(data.items);
    } catch (err) { triggerToast("Backend offline.", "error"); }
    setIsProcessing(false);
  };

  const triggerClaimConfirm = (itemId) => {
    setConfirmModal({
      show: true, title: "Claim Item", message: "Are you sure this belongs to you?",
      onConfirm: () => executeClaim(itemId)
    });
  };

  const executeClaim = async (itemId) => {
    setConfirmModal({ show: false });
    try {
      const headers = currentUser ? { 'Authorization': `Bearer ${currentUser.token}` } : {};
      const res = await fetch(`http://127.0.0.1:8000/claim/${itemId}`, { method: 'POST', headers });
      if (res.ok) {
        triggerToast("Claimed! Message sent to finder.");
        setAiMatches(prev => prev.filter(m => m.item.id !== itemId));
        setBrowseItems(prev => prev.filter(i => i.id !== itemId));
      }
    } catch (err) { triggerToast("Network error", "error"); }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setIsProcessing(true);
    const formData = new FormData();
    formData.append("name", itemName); formData.append("description", itemDescription);
    formData.append("location", itemLocation); formData.append("type", formType);
    if (imageFile) formData.append("file", imageFile);

    const headers = currentUser ? { 'Authorization': `Bearer ${currentUser.token}` } : {};

    try {
      if (formType === 'found') {
        const res = await fetch('http://127.0.0.1:8000/add-item', { method: 'POST', headers, body: formData });
        if (res.ok) { triggerToast("Item registered!"); goToHome(); }
      } else {
        const response = await fetch('http://127.0.0.1:8000/scan-matches', { method: 'POST', headers, body: formData });
        const data = await response.json();
        setAiMatches(data.results); setCurrentView('dashboard');
      }
    } catch (error) { triggerToast("Backend error", "error"); }
    setIsProcessing(false);
  };

  // Auth Submit
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    try {
      if (authMode === 'register') {
        const res = await fetch('http://127.0.0.1:8000/register', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: authUsername, password: authPassword, email: authEmail || `${authUsername}@example.com` })
        });
        if (res.ok) { triggerToast("Registration complete!"); setAuthMode('login'); }
      } else {
        const res = await fetch('http://127.0.0.1:8000/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: authUsername, password: authPassword })
        });
        const data = await res.json();
        if (res.ok) {
          setCurrentUser({ username: data.username, token: data.token });
          localStorage.setItem('matchmaker_user', JSON.stringify({ username: data.username, token: data.token }));
          triggerToast(`Welcome back, ${data.username}!`);
          setAuthModalOpen(false);
        }
      }
    } catch (err) { triggerToast("Auth server offline", "error"); }
  };

  const handleLogout = async () => {
    try { if (currentUser) await fetch('http://127.0.0.1:8000/logout', { method: 'POST', headers: { 'Authorization': `Bearer ${currentUser.token}` } }); } catch (e) {}
    setCurrentUser(null); localStorage.removeItem('matchmaker_user'); triggerToast("Logged out.");
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-12 transition-all relative">
      {toast.show && (
        <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce text-white ${toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'}`}>
          <span className="font-bold">{toast.message}</span>
        </div>
      )}

      {confirmModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-2xl font-black mb-3">{confirmModal.title}</h3>
            <p className="text-gray-600 mb-6">{confirmModal.message}</p>
            <div className="flex gap-4">
              <button onClick={() => setConfirmModal({ show: false })} className="flex-1 py-3 bg-gray-100 font-bold rounded-xl">Cancel</button>
              <button onClick={confirmModal.onConfirm} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl">Confirm</button>
            </div>
          </div>
        </div>
      )}

      <nav className="bg-indigo-600 text-white p-4 shadow-md flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={goToHome}>
          <Search className="h-6 w-6" /> <span className="text-xl font-bold tracking-wider">AI MatchMaker</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadBrowseFeed} className="flex items-center space-x-1 bg-indigo-700/50 px-4 py-2 rounded-lg">
            <LayoutGrid className="h-5 w-5" /><span className="hidden sm:inline">Browse</span>
          </button>
          {currentUser ? (
            <div className="flex items-center gap-2 bg-indigo-800/80 px-4 py-2 rounded-xl">
              <User className="h-4 w-4 text-emerald-300" /> <span className="text-sm font-bold">{currentUser.username}</span>
              <button onClick={handleLogout} className="hover:text-rose-300 ml-2"><LogOut className="h-4 w-4" /></button>
            </div>
          ) : (
            <button onClick={() => { setAuthMode('login'); setAuthModalOpen(true); }} className="bg-emerald-500 px-4 py-2 rounded-xl font-bold">Log In</button>
          )}
        </div>
      </nav>

      <main>
        {currentView === 'home' && (
          <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 text-center">
            <h1 className="text-4xl md:text-6xl font-black text-gray-900 mb-6 tracking-tight">Lost it? <span className="text-indigo-600">Let AI find it.</span></h1>
            <div className="flex flex-col sm:flex-row gap-6 w-full max-w-4xl">
              <button onClick={() => { setFormType('lost'); setCurrentView('report-lost'); }} className="flex-1 p-10 bg-white border-2 border-gray-100 rounded-3xl hover:border-red-400 cursor-pointer shadow-sm hover:shadow-xl">
                <AlertCircle className="h-20 w-20 text-red-500 mx-auto mb-4" /> <span className="text-2xl font-bold">Lost an Item</span>
              </button>
              
              {/* NEW LIVE CAMERA BUTTON */}
              <button onClick={startLiveScan} className="flex-1 p-10 bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-2 border-indigo-400 rounded-3xl cursor-pointer shadow-lg hover:shadow-2xl hover:scale-105 transition-all relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 bg-red-500 text-white text-xs font-bold rounded-bl-xl animate-pulse">LIVE</div>
                <ScanLine className="h-20 w-20 text-white mx-auto mb-4" /> 
                <span className="text-2xl font-bold">Live AI Lens</span>
              </button>

              <button onClick={() => { setFormType('found'); setCurrentView('report-found'); }} className="flex-1 p-10 bg-white border-2 border-gray-100 rounded-3xl hover:border-green-400 cursor-pointer shadow-sm hover:shadow-xl">
                <PlusCircle className="h-20 w-20 text-green-500 mx-auto mb-4" /> <span className="text-2xl font-bold">Found an Item</span>
              </button>
            </div>
          </div>
        )}

        {/* LIVE SCANNER VIEW */}
        {currentView === 'live-scanner' && (
          <div className="max-w-4xl mx-auto p-6 mt-8 animate-in slide-in-from-bottom-4">
             <div className="bg-black rounded-3xl overflow-hidden relative shadow-2xl border-4 border-indigo-500">
               <div className="absolute top-4 left-4 z-10 flex gap-2">
                 <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2 animate-pulse">
                   <div className="h-2 w-2 bg-white rounded-full"></div> LIVE
                 </div>
               </div>
               
               <button onClick={goToHome} className="absolute top-4 right-4 z-10 bg-white/20 hover:bg-white/40 backdrop-blur p-2 rounded-full text-white">
                 <X className="h-6 w-6" />
               </button>

               {/* Video Element */}
               <video ref={videoRef} autoPlay playsInline className="w-full h-[60vh] object-cover" />
               <canvas ref={canvasRef} className="hidden" />

               {/* AI Overlay Results */}
               <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-8">
                 <h3 className="text-indigo-400 font-bold text-sm tracking-widest uppercase mb-2">AI Real-Time Detection</h3>
                 <div className="flex flex-wrap gap-3">
                   {liveTags.map((tag, i) => (
                     <span key={i} className="bg-white/20 backdrop-blur-md border border-white/40 text-white text-xl font-black px-4 py-2 rounded-xl">
                       {tag}
                     </span>
                   ))}
                 </div>
               </div>
             </div>
             <p className="text-center mt-6 text-gray-500 font-bold">Point your camera at objects. The AI analyzes 1 frame every 2 seconds.</p>
          </div>
        )}

        {/* MANUAL FORMS & DASHBOARDS */}
        {(currentView === 'report-lost' || currentView === 'report-found') && (
           <div className="max-w-xl mx-auto p-8 mt-12 bg-white rounded-3xl shadow-xl border border-gray-100">
             <h2 className="text-3xl font-black mb-8 text-center">{formType === 'lost' ? 'Report Lost' : 'Report Found'}</h2>
             <form onSubmit={handleSubmit} className="space-y-6">
                <input type="text" required value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Item Name" className="w-full p-4 border rounded-xl bg-gray-50" />
                <input type="text" required value={itemLocation} onChange={(e) => setItemLocation(e.target.value)} placeholder="Location" className="w-full p-4 border rounded-xl bg-gray-50" />
                <label className="border-2 border-dashed border-indigo-200 bg-indigo-50 rounded-2xl p-8 flex flex-col items-center cursor-pointer">
                  <span className="text-indigo-700 font-bold">{imageFile ? imageFile.name : "Upload a photo"}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setImageFile(e.target.files[0])} />
                </label>
                <button type="submit" disabled={isProcessing} className="w-full bg-indigo-600 text-white font-bold p-5 rounded-2xl">{isProcessing ? 'Processing...' : 'Submit'}</button>
             </form>
           </div>
        )}

        {(currentView === 'dashboard' || currentView === 'browse') && (
          <div className="max-w-6xl mx-auto p-6 mt-8">
            <h2 className="text-4xl font-black mb-8">{currentView === 'dashboard' ? 'AI Matches' : 'Live Public Feed'}</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {(currentView === 'dashboard' ? aiMatches : browseItems).map((data, idx) => {
                const item = currentView === 'dashboard' ? data.item : data;
                return (
                  <div key={idx} className="bg-white border rounded-3xl shadow-sm overflow-hidden flex flex-col">
                    {item.image_url && <img src={item.image_url} alt={item.name} className="h-48 w-full object-cover" />}
                    <div className="p-6">
                      <h4 className="text-xl font-black mb-2">{item.name}</h4>
                      <p className="text-gray-600 text-sm mb-4">{item.location}</p>
                      <button onClick={() => triggerClaimConfirm(item.id)} className="w-full py-2 bg-green-50 text-green-700 font-bold rounded-xl border border-green-200">Claim Item</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* SECURE REGISTER/LOGIN DIALOGUE MODAL */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
            <button onClick={() => setAuthModalOpen(false)} className="absolute top-4 right-4"><X className="h-6 w-6" /></button>
            <div className="flex border-b mb-6">
              <button onClick={() => setAuthMode('login')} className={`flex-1 pb-3 font-black ${authMode === 'login' ? 'text-indigo-600 border-b-2' : 'text-gray-400'}`}>Log In</button>
              <button onClick={() => setAuthMode('register')} className={`flex-1 pb-3 font-black ${authMode === 'register' ? 'text-indigo-600 border-b-2' : 'text-gray-400'}`}>Sign Up</button>
            </div>
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <input type="text" required value={authUsername} onChange={(e) => setAuthUsername(e.target.value)} placeholder="Username" className="w-full p-3 border rounded-xl" />
              <input type="password" required value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="Password" className="w-full p-3 border rounded-xl" />
              <button type="submit" className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl mt-4">Submit</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}