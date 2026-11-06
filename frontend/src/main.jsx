import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter, Routes, Route, Navigate, NavLink, Link, useNavigate,
  useLocation, useParams
} from "react-router-dom";
import {
  Activity, ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronRight,
  CircleHelp, Clock3, Database, FileImage, Fingerprint, Gauge, History,
  ImagePlus, LayoutDashboard, LoaderCircle, LogOut, Menu, ScanSearch,
  ShieldCheck, Sparkles, Trash2, UploadCloud, UserRound, X, Zap
} from "lucide-react";
import { api } from "./api";
import "./style.css";

const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    api("/api/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);
  const value = useMemo(() => ({ user, setUser, checking }), [user, checking]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function Toast({ message, type = "error", onClose }) {
  if (!message) return null;
  return <div className={`toast ${type}`} role="status">
    {type === "success" ? <Check size={16}/> : <CircleHelp size={16}/>}
    <span>{message}</span><button onClick={onClose} aria-label="Dismiss"><X size={15}/></button>
  </div>;
}

function Brand({ compact = false, to = "/dashboard" }) {
  return <Link className={`brand ${compact ? "compact" : ""}`} to={to}>
    <span className="brand-mark">D<span>.</span></span>
    <span className="brand-word">DEEPSIGHT<small>AI IMAGE INTELLIGENCE</small></span>
  </Link>;
}

function Shell({ children }) {
  const { user, setUser } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  async function signOut() {
    try { await api("/api/auth/logout", { method: "POST" }); }
    finally { setUser(null); navigate("/login"); }
  }
  const links = [
    { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { to: "/history", label: "Analysis history", icon: History },
  ];
  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
      <Brand/>
      <div className="side-label">WORKSPACE</div>
      <nav className="side-nav">
        {links.map(({to,label,icon:Icon}) => <NavLink key={to} to={to} end onClick={() => setMobileOpen(false)} className={({isActive})=>`side-link ${isActive?"active":""}`}>
          <Icon size={17}/><span>{label}</span>
        </NavLink>)}
        <NavLink to="/dashboard#analyze" onClick={() => setMobileOpen(false)} className="side-link">
          <ScanSearch size={17}/><span>New analysis</span>
        </NavLink>
      </nav>
      <div className="sidebar-bottom">
        <div className="user-mini"><div className="avatar">{user?.name?.slice(0,1)?.toUpperCase() || "U"}</div><div className="user-mini-copy"><b>{user?.name}</b><small>{user?.email}</small></div></div>
        <button className="signout" onClick={signOut}><LogOut size={15}/> Sign out</button>
      </div>
    </aside>
    {mobileOpen && <button className="mobile-scrim" onClick={()=>setMobileOpen(false)} aria-label="Close menu"/>}
    <main className="main-area">
      <header className="mobile-topbar">
        <button className="icon-button" onClick={()=>setMobileOpen(true)} aria-label="Open menu"><Menu/></button>
        <Brand compact/>
        <div className="avatar small-avatar">{user?.name?.slice(0,1)?.toUpperCase()}</div>
      </header>
      {children}
    </main>
  </div>;
}

function Protected({ children }) {
  const { user, checking } = useAuth();
  const location = useLocation();
  if (checking) return <div className="loading-screen"><LoaderCircle className="spin" size={26}/><span>Opening your workspace…</span></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }}/>;
  return <Shell>{children}</Shell>;
}

function AuthPage({ mode }) {
  const isSignup = mode === "signup";
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (user) return <Navigate to="/dashboard" replace/>;
  function update(e) { setForm({...form, [e.target.name]: e.target.value}); }
  async function submit(e) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const data = await api(`/api/auth/${isSignup ? "signup" : "login"}`, {
        method: "POST", body: JSON.stringify(form)
      });
      setUser(data.user); navigate("/dashboard");
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <div className="auth-layout">
    <div className="auth-visual">
      <Brand to="/"/>
      <div className="auth-visual-content">
        <div className="eyebrow"><Sparkles size={13}/> RESPONSIBLE AI IMAGE SCREENING</div>
        <h1>See beyond<br/><em>what looks real.</em></h1>
        <p>A focused workspace for image authenticity screening, transparent model scores and private analysis history.</p>
        <div className="visual-points"><span><ShieldCheck size={15}/> Private workspace</span><span><Activity size={15}/> Model-assisted screening</span><span><History size={15}/> Your analysis archive</span></div>
      </div>
      <div className="visual-footer">DEEPSIGHT · AI IMAGE INTELLIGENCE</div>
    </div>
    <div className="auth-panel">
      <div className="auth-card">
        <div className="eyebrow">{isSignup ? "GET STARTED" : "WELCOME BACK"}</div>
        <h2>{isSignup ? "Create your account." : "Sign in to DeepSight."}</h2>
        <p>{isSignup ? "Set up your private image analysis workspace." : "Your workspace and previous reports are waiting."}</p>
        {error && <div className="inline-error">{error}</div>}
        <form onSubmit={submit}>
          {isSignup && <label>Full name<input name="name" value={form.name} onChange={update} placeholder="Your name" autoComplete="name" minLength={2} required/></label>}
          <label>Email address<input type="email" name="email" value={form.email} onChange={update} placeholder="you@example.com" autoComplete="email" required/></label>
          <label>Password<input type="password" name="password" value={form.password} onChange={update} placeholder="At least 10 characters" autoComplete={isSignup?"new-password":"current-password"} minLength={isSignup?10:1} required/></label>
          <button className="button primary full" disabled={busy}>{busy?<><LoaderCircle className="spin" size={16}/> Please wait…</>:<>{isSignup?"Create account":"Sign in"} <ArrowUpRight size={16}/></>}</button>
        </form>
        <div className="auth-switch">{isSignup?"Already have an account?":"New to DeepSight?"} <Link to={isSignup?"/login":"/signup"}>{isSignup?"Sign in":"Create an account"}</Link></div>
        <div className="auth-privacy"><ShieldCheck size={14}/> Passwords are securely hashed. Your history is private to your account.</div>
      </div>
    </div>
  </div>;
}

function PageHeading({ eyebrow, title, subtitle, action }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}

function StatCard({ icon: Icon, label, value, hint, tone }) {
  return <article className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={17}/></div><div className="stat-label">{label}</div><strong>{value}</strong><small>{hint}</small></article>;
}

function PredictionResult({ item }) {
  return <div className="result-panel">
    <div className="result-header"><div><div className="eyebrow">MODEL ASSESSMENT</div><h3 className={item.prediction.toLowerCase()}>{item.prediction === "REAL" ? "Likely authentic" : "Potential manipulation"}</h3></div><span className={`status-pill ${item.prediction.toLowerCase()}`}>{item.prediction}</span></div>
    <div className="confidence-row"><strong>{Number(item.confidence).toFixed(2)}%</strong><span>top-class score</span></div>
    <div className="prob-row"><div><span>REAL probability</span><b>{Number(item.probability_real).toFixed(2)}%</b></div><div className="progress"><i className="real-progress" style={{width:`${item.probability_real}%`}}/></div></div>
    <div className="prob-row"><div><span>FAKE probability</span><b>{Number(item.probability_fake).toFixed(2)}%</b></div><div className="progress"><i className="fake-progress" style={{width:`${item.probability_fake}%`}}/></div></div>
    <p className="disclaimer">{item.disclaimer} The displayed score is not forensic certainty.</p>
    <Link className="button secondary full" to={`/history/${item.id}`}>Open saved report <ArrowRight size={15}/></Link>
  </div>;
}

function UploadPanel({ onComplete }) {
  const [file,setFile] = useState(null);
  const [preview,setPreview] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [result,setResult] = useState(null);
  const [drag,setDrag] = useState(false);
  function selectFile(next) {
    setError(""); setResult(null);
    if (!next) return;
    if (!["image/jpeg","image/png","image/webp"].includes(next.type)) { setError("Choose a JPG, PNG or WEBP image."); return; }
    if (next.size > 12*1024*1024) { setError("Image must be smaller than 12 MB."); return; }
    setFile(next);
    setPreview(URL.createObjectURL(next));
  }
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview]);
  async function analyze() {
    if(!file)return;
    setBusy(true);setError("");setResult(null);
    const body=new FormData();body.append("image",file);
    try {
      const data=await api("/api/predict",{method:"POST",body});
      setResult(data.item);onComplete?.(data.item);
    } catch(err){setError(err.message);}
    finally{setBusy(false);}
  }
  return <section className="panel upload-panel" id="analyze">
    <div className="panel-heading"><div><div className="eyebrow">NEW INVESTIGATION</div><h2>Analyze an image</h2></div><span className="subtle-tag">MAX 12 MB</span></div>
    <label className={`drop-area ${drag?"drag":""}`} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);selectFile(e.dataTransfer.files?.[0])}}>
      <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e=>selectFile(e.target.files?.[0])}/>
      {preview?<img className="upload-preview" src={preview} alt="Selected preview"/>:<><span className="upload-icon"><UploadCloud size={23}/></span><b>Drop your image here</b><span>or <u>browse files</u></span><small>JPG · PNG · WEBP</small></>}
    </label>
    {file && <div className="selected-file"><FileImage size={15}/><span>{file.name}</span><small>{(file.size/1048576).toFixed(2)} MB</small><button onClick={()=>{setFile(null);setPreview("");setResult(null)}} aria-label="Remove image"><X size={15}/></button></div>}
    {error && <div className="inline-error">{error}</div>}
    <button className="button primary full" onClick={analyze} disabled={!file||busy}>{busy?<><LoaderCircle className="spin" size={16}/> Analyzing image…</>:<>Run AI analysis <ArrowUpRight size={16}/></>}</button>
    {result && <PredictionResult item={result}/>}
  </section>;
}

function PredictionRow({ item }) {
  const date = item.created_at ? new Date(item.created_at).toLocaleString() : "—";
  return <Link className="prediction-row" to={`/history/${item.id}`}>
    <span className="file-thumb"><FileImage size={17}/></span>
    <span className="prediction-meta"><b>{item.filename}</b><small>{date}</small></span>
    <span className={`status-pill ${item.prediction.toLowerCase()}`}>{item.prediction}</span>
    <span className="row-score">{Number(item.confidence).toFixed(1)}%</span>
    <ChevronRight size={16} className="row-chevron"/>
  </Link>;
}

function Dashboard() {
  const {user}=useAuth();
  const [data,setData]=useState(null);
  const [error,setError]=useState("");
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{api("/api/dashboard").then(setData).catch(e=>setError(e.message));},[refresh]);
  return <div className="page-wrap">
    <PageHeading eyebrow="WORKSPACE / OVERVIEW" title={`Good to see you, ${user?.name?.split(" ")[0] || "there"}.`} subtitle="Your image intelligence workspace at a glance." action={<a className="button primary" href="#analyze"><ImagePlus size={16}/> New analysis</a>}/>
    {error&&<div className="inline-error">{error}</div>}
    <div className="stats-grid">
      <StatCard icon={ScanSearch} label="TOTAL ANALYSES" value={data?.stats.total ?? "—"} hint="All-time activity" tone="mint"/>
      <StatCard icon={Fingerprint} label="FLAGGED AS FAKE" value={data?.stats.fake ?? "—"} hint="Model predictions" tone="red"/>
      <StatCard icon={ShieldCheck} label="CLASSIFIED AS REAL" value={data?.stats.real ?? "—"} hint="Model predictions" tone="blue"/>
    </div>
    <div className="dashboard-grid">
      <UploadPanel onComplete={()=>setRefresh(x=>x+1)}/>
      <section className="panel recent-panel"><div className="panel-heading"><div><div className="eyebrow">YOUR ACTIVITY</div><h2>Recent analyses</h2></div><Link className="text-action" to="/history">View all <ArrowRight size={14}/></Link></div>
        {data?.recent?.length ? <div className="prediction-list">{data.recent.map(item=><PredictionRow key={item.id} item={item}/>)}</div> : <div className="empty-state"><Clock3 size={27}/><b>No analyses yet</b><p>Your saved results will appear here after your first scan.</p></div>}
      </section>
    </div>
    <div className="page-foot">DEEPSIGHT · AI-ASSISTED IMAGE SCREENING · RESULTS MAY BE WRONG</div>
  </div>;
}

function HistoryPage() {
  const [data,setData]=useState(null);
  const [error,setError]=useState("");
  const [page,setPage]=useState(1);
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{api(`/api/history?page=${page}&limit=12`).then(setData).catch(e=>setError(e.message));},[page,refresh]);
  return <div className="page-wrap">
    <PageHeading eyebrow="WORKSPACE / ARCHIVE" title="Analysis history" subtitle="Review and manage your previous image assessments."/>
    <section className="panel history-panel"><div className="panel-heading"><div><div className="eyebrow">PRIVATE ARCHIVE</div><h2>{data?.total ?? "—"} saved records</h2></div></div>
      {error&&<div className="inline-error">{error}</div>}
      {data?.items?.length ? <><div className="history-table-head"><span>FILE</span><span>RESULT</span><span>SCORE</span><span>DATE</span><span></span></div><div className="prediction-list">{data.items.map(item=><PredictionRow key={item.id} item={item}/>)}</div><div className="pagination"><button className="button secondary small" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {data.page} of {data.pages}</span><button className="button secondary small" disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)}>Next</button></div></> : data && <div className="empty-state"><History size={27}/><b>Your archive is empty</b><p>Run your first image analysis to start building history.</p><Link className="button primary" to="/dashboard#analyze">Analyze an image</Link></div>}
    </section>
  </div>;
}

function DetailPage() {
  const {id}=useParams();
  const navigate=useNavigate();
  const [item,setItem]=useState(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  useEffect(()=>{api(`/api/predictions/${id}`).then(d=>setItem(d.item)).catch(e=>setError(e.message));},[id]);
  async function remove() {
    if(!window.confirm("Delete this report and its stored image?"))return;
    setBusy(true);
    try{await api(`/api/predictions/${id}`,{method:"DELETE"});navigate("/history");}
    catch(e){setError(e.message);setBusy(false);}
  }
  if(error)return <div className="page-wrap"><div className="inline-error">{error}</div><Link to="/history" className="button secondary"><ArrowLeft size={15}/> Back to history</Link></div>;
  if(!item)return <div className="loading-screen"><LoaderCircle className="spin"/>Loading report…</div>;
  return <div className="page-wrap">
    <PageHeading eyebrow="WORKSPACE / REPORT" title="Analysis report" subtitle={`${item.filename} · ${new Date(item.created_at).toLocaleString()}`} action={<Link to="/history" className="button secondary"><ArrowLeft size={15}/> Back to history</Link>}/>
    <div className="detail-grid">
      <section className="panel detail-image-panel"><img src={item.image_url} alt="Analyzed upload"/><p className="disclaimer">Private image preview. Only your authenticated account can access this image.</p></section>
      <section className="panel detail-report-panel"><div className="eyebrow">MODEL ASSESSMENT</div><h2 className={`detail-verdict ${item.prediction.toLowerCase()}`}>{item.prediction==="REAL"?"Likely authentic":"Potential manipulation"}</h2><div className="confidence-row"><strong>{Number(item.confidence).toFixed(2)}%</strong><span>top-class score</span></div>
        <div className="prob-row"><div><span>REAL probability</span><b>{Number(item.probability_real).toFixed(2)}%</b></div><div className="progress"><i className="real-progress" style={{width:`${item.probability_real}%`}}/></div></div>
        <div className="prob-row"><div><span>FAKE probability</span><b>{Number(item.probability_fake).toFixed(2)}%</b></div><div className="progress"><i className="fake-progress" style={{width:`${item.probability_fake}%`}}/></div></div>
        <div className="metadata-list"><div><span>Model version</span><b>{item.model_version}</b></div><div><span>Decision threshold</span><b>{Number(item.decision_threshold).toFixed(3)}</b></div><div><span>File size</span><b>{(item.image_bytes/1024).toFixed(1)} KB</b></div></div>
        <p className="disclaimer">{item.disclaimer} The score is not calibrated forensic certainty.</p>
        <button className="button danger full" onClick={remove} disabled={busy}><Trash2 size={15}/>{busy?"Deleting…":"Delete this report"}</button>
      </section>
    </div>
  </div>;
}

function Landing() {
  const {user}=useAuth();
  if(user)return <Navigate to="/dashboard" replace/>;
  return <div className="landing">
    <nav className="landing-nav"><Brand to="/"/><div><Link to="/login" className="nav-signin">Sign in</Link><Link to="/signup" className="button primary">Create account <ArrowUpRight size={15}/></Link></div></nav>
    <section className="landing-hero"><div className="eyebrow"><Sparkles size={13}/> RESPONSIBLE AI IMAGE SCREENING</div><h1>See beyond<br/><em>what looks real.</em></h1><p>Explore image authenticity with deep-learning analysis, transparent probability scores and a private workspace for every investigation.</p><div className="landing-actions"><Link to="/signup" className="button primary">Start analyzing <ArrowUpRight size={16}/></Link><Link to="/login" className="button secondary">I already have an account</Link></div><div className="hero-foot"><span><ShieldCheck size={14}/> PRIVATE WORKSPACE</span><span><Zap size={14}/> MODEL-ASSISTED SCREENING</span><span><History size={14}/> REPORT HISTORY</span></div></section>
    <section className="landing-features"><article><ScanSearch/><small>01 / ANALYZE</small><h3>One image. A clearer signal.</h3><p>Upload an image and receive a model-generated REAL/FAKE estimate.</p></article><article><Gauge/><small>02 / UNDERSTAND</small><h3>See the probability split.</h3><p>Review class scores and the model version behind each result.</p></article><article><Database/><small>03 / ORGANIZE</small><h3>Your work, remembered.</h3><p>Revisit previous analyses and manage your private history.</p></article></section>
    <footer className="landing-footer">DEEPSIGHT · AN AI SCREENING TOOL, NOT A FORENSIC VERDICT</footer>
  </div>;
}

function AppRoutes() {
  const {checking}=useAuth();
  if(checking)return <div className="loading-screen"><LoaderCircle className="spin"/>Connecting to your workspace…</div>;
  return <Routes>
    <Route path="/" element={<Landing/>}/>
    <Route path="/login" element={<AuthPage mode="login"/>}/>
    <Route path="/signup" element={<AuthPage mode="signup"/>}/>
    <Route path="/dashboard" element={<Protected><Dashboard/></Protected>}/>
    <Route path="/history" element={<Protected><HistoryPage/></Protected>}/>
    <Route path="/history/:id" element={<Protected><DetailPage/></Protected>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>;
}

function App() {
  return <BrowserRouter><AuthProvider><AppRoutes/></AuthProvider></BrowserRouter>;
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App/></React.StrictMode>);
