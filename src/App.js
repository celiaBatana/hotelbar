import { useState, useEffect, useRef } from "react";
import { dbGet, dbSet, dbListen } from "./firebase";

// ─── Données initiales ────────────────────────────────────────────────────────
const INITIAL_CATEGORIES = [
  { id: "soft",   name: "Soft",   color: "#38bdf8", icon: "🥤" },
  { id: "biere",  name: "Bière",  color: "#fbbf24", icon: "🍺" },
  { id: "alcool", name: "Alcool", color: "#a78bfa", icon: "🥃" },
  { id: "chaud",  name: "Chaud",  color: "#fb923c", icon: "☕" },
  { id: "vin",    name: "Vin",    color: "#f472b6", icon: "🍷" },
];
const INITIAL_PRODUCTS = [
  { id: 1, name: "Coca-Cola",    categoryId: "soft",   price: 3.5,  stock: 48,  minStock: 12, unit: "bouteille", sold: 0 },
  { id: 2, name: "Heineken",     categoryId: "biere",  price: 4.5,  stock: 60,  minStock: 24, unit: "bouteille", sold: 0 },
  { id: 3, name: "Eau minérale", categoryId: "soft",   price: 2.5,  stock: 72,  minStock: 24, unit: "bouteille", sold: 0 },
  { id: 4, name: "Champagne",    categoryId: "alcool", price: 18,   stock: 10,  minStock: 6,  unit: "bouteille", sold: 0 },
  { id: 5, name: "Café",         categoryId: "chaud",  price: 2.0,  stock: 200, minStock: 50, unit: "dose",      sold: 0 },
];

const COLOR_PALETTE = ["#38bdf8","#fbbf24","#a78bfa","#fb923c","#f472b6","#34d399","#f87171","#60a5fa","#e879f9","#a3e635","#2dd4bf","#facc15"];
const ICON_LIST     = ["🥤","🍺","🥃","☕","🍷","🧃","🍾","🍹","🧋","🍫","🫖","🍵","🥛","🧊","🫗"];

const fmtEur = (n) => Number(n).toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2}) + " FCFA";
const today  = () => new Date().toDateString();
const uid    = () => Math.random().toString(36).slice(2,6);

export default function App() {
  const [products,   setProducts]   = useState(INITIAL_PRODUCTS);
  const [categories, setCategories] = useState(INITIAL_CATEGORIES);
  const [sales,      setSales]      = useState([]);
  const [loaded,     setLoaded]     = useState(false);

  const [view,        setView]       = useState("dashboard");
  const [filterCat,   setFilterCat]  = useState("all");
  const [search,      setSearch]     = useState("");

  const [sellModal,     setSellModal]    = useState(null);
  const [sellQty,       setSellQty]      = useState(1);
  const [addModal,      setAddModal]     = useState(false);
  const [editModal,     setEditModal]    = useState(null);
  const [restockModal,  setRestockModal] = useState(null);
  const [restockQty,    setRestockQty]   = useState(0);
  const [catModal,      setCatModal]     = useState(false);
  const [newCatName,    setNewCatName]   = useState("");
  const [newCatIcon,    setNewCatIcon]   = useState("🥤");
  const [newCatColor,   setNewCatColor]  = useState("#38bdf8");

  const [newP, setNewP] = useState({ name:"", categoryId:"soft", price:"", stock:"", minStock:"", unit:"bouteille" });
  const [toast, setToast] = useState(null);

  const myId = useRef(`u_${uid()}`);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const toast$ = (msg, type="ok") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  // ── Chargement initial + écoute temps réel ─────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const [cp, cs, cc] = await Promise.all([dbGet("products"), dbGet("sales"), dbGet("categories")]);
      if (cp) setProducts(cp);
      if (cs) setSales(cs);
      if (cc) setCategories(cc);
      setLoaded(true);
    };
    init();

    // Écoute temps réel Firebase (push instantané)
    const u1 = dbListen("products",   v => setProducts(v));
    const u2 = dbListen("sales",      v => setSales(v));
    const u3 = dbListen("categories", v => setCategories(v));
    return () => { u1(); u2(); u3(); };
  }, []);

  // ── Sauvegarde ─────────────────────────────────────────────────────────────
  const saveP = async (v) => { setProducts(v);   await dbSet("products", v); };
  const saveS = async (v) => { setSales(v);      await dbSet("sales", v); };
  const saveC = async (v) => { setCategories(v); await dbSet("categories", v); };

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleSell = async () => {
    if (!sellModal || sellQty < 1) return;
    const latest = await dbGet("products") || products;
    const p = latest.find(x => x.id === sellModal.id);
    if (!p || p.stock < sellQty) { toast$("Stock insuffisant !", "err"); return; }
    const upP = latest.map(x => x.id === p.id ? {...x, stock: x.stock - sellQty, sold: x.sold + sellQty} : x);
    const latS = await dbGet("sales") || sales;
    const ns = { id: Date.now(), productId: p.id, productName: p.name, qty: sellQty, amount: p.price * sellQty, date: new Date().toISOString(), by: myId.current };
    await Promise.all([saveP(upP), saveS([...latS, ns])]);
    const rem = p.stock - sellQty;
    if (rem <= p.minStock) toast$(`⚠️ Stock bas : ${p.name} (${rem} restants)`, "warn");
    else toast$(`✓ ${sellQty}× ${p.name}`);
    setSellModal(null); setSellQty(1);
  };

  const handleAdd = async () => {
    if (!newP.name || !newP.price || !newP.stock) { toast$("Champs manquants", "err"); return; }
    const prod = {...newP, id: Date.now(), price: +newP.price, stock: +newP.stock, minStock: +newP.minStock || 10, sold: 0};
    const latest = await dbGet("products") || products;
    await saveP([...latest, prod]);
    setNewP({name:"", categoryId: categories[0]?.id || "soft", price:"", stock:"", minStock:"", unit:"bouteille"});
    setAddModal(false); toast$(`${prod.name} ajouté !`);
  };

  const handleEdit = async () => {
    if (!editModal.name || !editModal.price || editModal.stock === "") { toast$("Champs manquants", "err"); return; }
    const latest = await dbGet("products") || products;
    await saveP(latest.map(p => p.id === editModal.id ? {...editModal, price: +editModal.price, stock: +editModal.stock, minStock: +editModal.minStock} : p));
    setEditModal(null); toast$("Article mis à jour !");
  };

  const handleRestock = async () => {
    const latest = await dbGet("products") || products;
    await saveP(latest.map(p => p.id === restockModal.id ? {...p, stock: p.stock + +restockQty} : p));
    toast$("Stock réapprovisionné !"); setRestockModal(null); setRestockQty(0);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cet article ?")) return;
    const latest = await dbGet("products") || products;
    await saveP(latest.filter(p => p.id !== id)); toast$("Supprimé", "warn");
  };

  const handleAddCat = async () => {
    if (!newCatName.trim()) { toast$("Nom requis", "err"); return; }
    const id = newCatName.toLowerCase().replace(/\s+/g,"_").replace(/[^a-z0-9_]/g,"") + "_" + Date.now();
    await saveC([...categories, {id, name: newCatName.trim(), color: newCatColor, icon: newCatIcon}]);
    setNewCatName(""); toast$(`Catégorie "${newCatName.trim()}" créée !`);
  };

  const handleDeleteCat = async (id) => {
    if (products.some(p => p.categoryId === id)) { toast$("Des articles utilisent cette catégorie !", "err"); return; }
    if (!window.confirm("Supprimer cette catégorie ?")) return;
    await saveC(categories.filter(c => c.id !== id)); toast$("Catégorie supprimée", "warn");
  };

  // ── Computed ───────────────────────────────────────────────────────────────
  const lowStock   = products.filter(p => p.stock <= p.minStock);
  const totalCA    = sales.reduce((s,x) => s + x.amount, 0);
  const todaySales = sales.filter(s => new Date(s.date).toDateString() === today());
  const todayCA    = todaySales.reduce((s,x) => s + x.amount, 0);
  const stockVal   = products.reduce((s,p) => s + p.price * p.stock, 0);
  const filtered   = products.filter(p => (filterCat === "all" || p.categoryId === filterCat) && p.name.toLowerCase().includes(search.toLowerCase()));
  const topSellers = [...products].sort((a,b) => b.sold - a.sold);
  const pct        = (p) => Math.min(100, Math.round((p.stock / (p.minStock * 4 || 1)) * 100));
  const getCat     = (id) => categories.find(c => c.id === id) || {name:"?", color:"#888", icon:"❓"};

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!loaded) return (
    <div style={{background:"#0f0f17",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Plus Jakarta Sans',sans-serif",color:"#fff"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{width:52,height:52,borderRadius:"50%",border:"3px solid #1e1e30",borderTopColor:"#818cf8",animation:"spin 0.9s linear infinite",marginBottom:20}}/>
      <div style={{fontWeight:700,fontSize:17,color:"#818cf8"}}>Connexion Firebase…</div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{background:"#0f0f17",minHeight:"100vh",fontFamily:"'Plus Jakarta Sans',sans-serif",color:"#e2e8f0"}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-track{background:#0f0f17}
        ::-webkit-scrollbar-thumb{background:#2d2d45;border-radius:4px}
        .btn{cursor:pointer;border:none;font-family:inherit;font-weight:600;border-radius:10px;transition:all .18s;display:inline-flex;align-items:center;justify-content:center;gap:6px}
        .btn:hover{filter:brightness(1.12);transform:translateY(-1px)}
        .btn:active{transform:translateY(0);filter:brightness(.95)}
        .input{background:#1a1a2e;border:1.5px solid #2d2d45;border-radius:10px;color:#e2e8f0;font-family:inherit;padding:11px 14px;width:100%;outline:none;font-size:14px;transition:border .15s}
        .input:focus{border-color:#818cf8}
        select.input option{background:#1a1a2e}
        .card{background:#16162a;border:1px solid #1e1e35;border-radius:16px}
        .pill{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.4px}
        .sb-btn{cursor:pointer;background:none;border:none;font-family:inherit;width:100%;text-align:left;padding:11px 16px;border-radius:12px;font-size:14px;font-weight:600;color:#64748b;transition:all .15s;display:flex;align-items:center;gap:10px}
        .sb-btn:hover{background:#1e1e35;color:#e2e8f0}
        .sb-btn.active{background:linear-gradient(135deg,#312e81,#4c1d95);color:#fff;box-shadow:0 4px 20px rgba(99,102,241,.25)}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .fade-up{animation:fadeUp .3s ease}
        @keyframes mIn{from{opacity:0;transform:scale(.95) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
        .m-in{animation:mIn .22s ease}
        .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(8px);z-index:100;display:flex;align-items:center;justify-content:center;padding:16px}
        @keyframes tIn{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:translateX(0)}}
        .toast{animation:tIn .25s ease;position:fixed;bottom:28px;right:28px;z-index:999;padding:13px 20px;border-radius:12px;font-weight:600;font-size:14px;max-width:300px;box-shadow:0 8px 32px rgba(0,0,0,.5);display:flex;align-items:center;gap:8px}
        .prog-track{height:5px;border-radius:3px;background:#1e1e35;overflow:hidden}
        .prog-fill{height:100%;border-radius:3px;transition:width .5s ease}
        .prod-card{background:#16162a;border:1.5px solid #1e1e35;border-radius:16px;padding:20px;transition:all .2s;position:relative;overflow:hidden}
        .prod-card:hover{border-color:#312e81;transform:translateY(-2px);box-shadow:0 8px 32px rgba(0,0,0,.4)}
        .tab{cursor:pointer;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;border:none;font-family:inherit;transition:all .15s}
        .stat{background:#16162a;border:1px solid #1e1e35;border-radius:18px;padding:22px;transition:border-color .2s}
        .stat:hover{border-color:#312e81}
        .icon-btn{cursor:pointer;border:none;background:none;font-size:15px;padding:6px 8px;border-radius:8px;transition:background .15s;color:#64748b}
        .icon-btn:hover{background:#1e1e35;color:#e2e8f0}
      `}</style>

      {/* Toast */}
      {toast && (
        <div className="toast" style={{background: toast.type==="err"?"#ef4444": toast.type==="warn"?"#f59e0b":"#22c55e", color:"#fff"}}>
          <span>{toast.type==="err"?"✕": toast.type==="warn"?"⚠":"✓"}</span>{toast.msg}
        </div>
      )}

      <div style={{display:"flex",minHeight:"100vh"}}>

        {/* ── Sidebar ── */}
        <aside style={{width:224,background:"#0d0d1a",borderRight:"1px solid #1e1e35",padding:"24px 12px",display:"flex",flexDirection:"column",gap:4,position:"sticky",top:0,height:"100vh",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:12,padding:"4px 8px 24px"}}>
            <div style={{width:38,height:38,borderRadius:12,background:"linear-gradient(135deg,#4f46e5,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🏨</div>
            <div>
              <div style={{fontWeight:800,fontSize:15,letterSpacing:"-.3px"}}>HôtelBar</div>
              <div style={{fontSize:10,color:"#334155",letterSpacing:1}}>PRO</div>
            </div>
          </div>

          {[["dashboard","📊","Dashboard"],["stock","📦","Stocks"],["ventes","💳","Ventes"],["top","🏆","Classement"]].map(([v,ic,lb]) => (
            <button key={v} className={`sb-btn${view===v?" active":""}`} onClick={()=>setView(v)}>
              <span style={{fontSize:16}}>{ic}</span>{lb}
              {v==="stock" && lowStock.length > 0 && <span style={{marginLeft:"auto",background:"#f59e0b",color:"#000",borderRadius:20,padding:"1px 8px",fontSize:11,fontWeight:800}}>{lowStock.length}</span>}
            </button>
          ))}

          <div style={{height:1,background:"#1e1e35",margin:"12px 8px"}}/>
          <button className="sb-btn" onClick={()=>setCatModal(true)}>
            <span style={{fontSize:16}}>🏷️</span>Catégories
          </button>

          <div style={{flex:1}}/>
          <div style={{padding:"10px 8px",borderTop:"1px solid #1e1e35"}}>
            <div style={{fontSize:11,color:"#334155",marginBottom:4}}>🔥 Firebase · Temps réel</div>
            <div style={{fontSize:11,color:"#475569"}}>{new Date().toLocaleDateString("fr-FR")}</div>
          </div>
        </aside>

        {/* ── Main ── */}
        <main style={{flex:1,padding:"32px 36px",overflowY:"auto",minWidth:0}}>

          {/* ══ DASHBOARD ══ */}
          {view==="dashboard" && (
            <div className="fade-up">
              <div style={{marginBottom:28}}>
                <h1 style={{fontSize:26,fontWeight:800,letterSpacing:"-.5px",marginBottom:4}}>Bonjour 👋</h1>
                <p style={{color:"#475569",fontSize:14}}>{new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</p>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:18,marginBottom:26}}>
                {[
                  {label:"CA total",     val:fmtEur(totalCA),  sub:`${sales.length} ventes`,                  color:"#4ade80", icon:"💰"},
                  {label:"Aujourd'hui",  val:fmtEur(todayCA),  sub:`${todaySales.length} vente(s) du jour`,   color:"#818cf8", icon:"📅"},
                  {label:"Valeur stock", val:fmtEur(stockVal), sub:`${products.length} références`,            color:"#38bdf8", icon:"📦"},
                  {label:"Alertes",      val:lowStock.length,  sub:lowStock.length?"articles critiques":"Tout OK ✓", color:lowStock.length?"#fb923c":"#4ade80", icon:"⚠️"},
                ].map((k,i) => (
                  <div key={i} className="stat">
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                      <span style={{fontSize:22}}>{k.icon}</span>
                      <span style={{fontSize:10,color:"#334155",fontWeight:700,letterSpacing:1}}>{k.label.toUpperCase()}</span>
                    </div>
                    <div style={{fontSize:25,fontWeight:800,color:k.color,letterSpacing:"-.5px",marginBottom:4}}>{k.val}</div>
                    <div style={{fontSize:12,color:"#475569"}}>{k.sub}</div>
                  </div>
                ))}
              </div>

              {lowStock.length > 0 && (
                <div style={{background:"rgba(251,146,60,.06)",border:"1px solid rgba(251,146,60,.2)",borderRadius:16,padding:20,marginBottom:26}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                    <span>⚠️</span><span style={{fontWeight:700,color:"#fb923c",fontSize:14}}>Ruptures imminentes</span>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
                    {lowStock.map(p => { const cat=getCat(p.categoryId); return (
                      <div key={p.id} style={{background:"rgba(251,146,60,.08)",border:"1px solid rgba(251,146,60,.2)",borderRadius:12,padding:"10px 16px",display:"flex",alignItems:"center",gap:12}}>
                        <span style={{fontSize:20}}>{cat.icon}</span>
                        <div>
                          <div style={{fontWeight:700,fontSize:14}}>{p.name}</div>
                          <div style={{fontSize:12,color:"#fb923c"}}>{p.stock} / min {p.minStock}</div>
                        </div>
                        <button className="btn" style={{background:"#fb923c",color:"#000",padding:"6px 14px",fontSize:12}}
                          onClick={()=>{setRestockModal(p);setRestockQty(p.minStock*2);setView("stock")}}>Réappro</button>
                      </div>
                    );})}
                  </div>
                </div>
              )}

              <div className="card" style={{padding:24}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
                  <h2 style={{fontWeight:700,fontSize:16}}>🏆 Top ventes</h2>
                  <button className="btn" style={{background:"#1e1e35",color:"#94a3b8",padding:"6px 14px",fontSize:12}} onClick={()=>setView("top")}>Voir tout →</button>
                </div>
                {topSellers.filter(p=>p.sold>0).length===0
                  ? <p style={{color:"#334155",fontSize:14,textAlign:"center",padding:"16px 0"}}>Aucune vente pour l'instant</p>
                  : topSellers.filter(p=>p.sold>0).slice(0,5).map((p,i) => {
                      const cat=getCat(p.categoryId); const mx=topSellers[0].sold||1;
                      return (
                        <div key={p.id} style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
                          <div style={{width:28,height:28,borderRadius:8,background:i<3?`${["#fbbf24","#94a3b8","#d97706"][i]}20`:"#1e1e35",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>
                            {i<3?["🥇","🥈","🥉"][i]:<span style={{fontSize:11,fontWeight:700,color:"#475569"}}>#{i+1}</span>}
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                              <span style={{fontWeight:600,fontSize:14}}>{cat.icon} {p.name}</span>
                              <span style={{fontSize:13,fontWeight:700,color:"#4ade80",flexShrink:0,marginLeft:8}}>{fmtEur(p.sold*p.price)}</span>
                            </div>
                            <div className="prog-track"><div className="prog-fill" style={{width:`${(p.sold/mx)*100}%`,background:cat.color}}/></div>
                            <div style={{fontSize:11,color:"#334155",marginTop:3}}>{p.sold} vendus</div>
                          </div>
                        </div>
                      );
                    })
                }
              </div>
            </div>
          )}

          {/* ══ STOCKS ══ */}
          {view==="stock" && (
            <div className="fade-up">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:26}}>
                <div>
                  <h1 style={{fontSize:26,fontWeight:800,letterSpacing:"-.5px",marginBottom:4}}>Stocks</h1>
                  <p style={{color:"#475569",fontSize:14}}>{products.length} articles · {lowStock.length} alerte(s)</p>
                </div>
                <button className="btn" style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",padding:"11px 22px",fontSize:14,boxShadow:"0 4px 20px rgba(99,102,241,.3)"}}
                  onClick={()=>setAddModal(true)}>+ Nouvel article</button>
              </div>

              <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
                <div style={{position:"relative",flexShrink:0}}>
                  <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#475569",fontSize:14,pointerEvents:"none"}}>🔍</span>
                  <input className="input" placeholder="Rechercher…" value={search} onChange={e=>setSearch(e.target.value)} style={{paddingLeft:36,width:190}}/>
                </div>
                <button className="tab" onClick={()=>setFilterCat("all")}
                  style={{background:filterCat==="all"?"linear-gradient(135deg,#4f46e5,#7c3aed)":"#16162a",color:filterCat==="all"?"#fff":"#475569",border:`1px solid ${filterCat==="all"?"transparent":"#1e1e35"}`}}>
                  Tous ({products.length})
                </button>
                {categories.map(c => { const cnt=products.filter(p=>p.categoryId===c.id).length; return (
                  <button key={c.id} className="tab" onClick={()=>setFilterCat(c.id)}
                    style={{background:filterCat===c.id?c.color+"25":"#16162a",color:filterCat===c.id?c.color:"#475569",border:`1px solid ${filterCat===c.id?c.color+"50":"#1e1e35"}`}}>
                    {c.icon} {c.name} {cnt>0&&<span style={{opacity:.6}}>({cnt})</span>}
                  </button>
                );})}
              </div>

              {filtered.length===0 && <div style={{textAlign:"center",padding:"60px 0",color:"#334155"}}>Aucun article trouvé</div>}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:18}}>
                {filtered.map(p => {
                  const cat=getCat(p.categoryId); const isLow=p.stock<=p.minStock; const pp=pct(p);
                  return (
                    <div key={p.id} className="prod-card" style={{borderColor:isLow?"rgba(251,146,60,.35)":"#1e1e35"}}>
                      {isLow && <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,#fb923c,#f59e0b)"}}/>}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{width:40,height:40,borderRadius:12,background:`${cat.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{cat.icon}</div>
                          <div>
                            <div style={{fontWeight:700,fontSize:15,marginBottom:2}}>{p.name}</div>
                            <span className="pill" style={{background:`${cat.color}18`,color:cat.color}}>{cat.name}</span>
                          </div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontWeight:800,fontSize:26,color:isLow?"#fb923c":"#e2e8f0",lineHeight:1}}>{p.stock}</div>
                          <div style={{fontSize:11,color:"#475569"}}>{p.unit}s</div>
                        </div>
                      </div>
                      <div style={{fontSize:16,fontWeight:700,color:"#818cf8",marginBottom:14}}>{fmtEur(p.price)} <span style={{fontSize:12,fontWeight:400,color:"#475569"}}>/ {p.unit}</span></div>
                      <div style={{marginBottom:16}}>
                        <div className="prog-track"><div className="prog-fill" style={{width:`${pp}%`,background:isLow?"linear-gradient(90deg,#ef4444,#fb923c)":pp>50?cat.color:"#38bdf8"}}/></div>
                        <div style={{display:"flex",justifyContent:"space-between",marginTop:5,fontSize:11,color:"#334155"}}>
                          <span>Min {p.minStock} {p.unit}s</span>
                          {isLow?<span style={{color:"#fb923c",fontWeight:700}}>⚠ Stock bas</span>:<span>{pp}%</span>}
                        </div>
                      </div>
                      <div style={{display:"flex",gap:6}}>
                        <button className="btn" style={{flex:1,background:`${cat.color}18`,color:cat.color,border:`1px solid ${cat.color}30`,padding:"9px 0",fontSize:13}}
                          onClick={()=>{setSellModal(p);setSellQty(1)}}>💳 Vendre</button>
                        <button className="btn" style={{background:"#1e1e35",color:"#94a3b8",border:"1px solid #2d2d45",padding:"9px 12px",fontSize:13}}
                          title="Réapprovisionner" onClick={()=>{setRestockModal(p);setRestockQty(p.minStock*2)}}>📦</button>
                        <button className="btn" style={{background:"#1e1e35",color:"#818cf8",border:"1px solid #2d2d45",padding:"9px 12px",fontSize:13}}
                          title="Modifier" onClick={()=>setEditModal({...p,price:p.price.toString(),stock:p.stock.toString(),minStock:p.minStock.toString()})}>✏️</button>
                        <button className="btn" style={{background:"rgba(239,68,68,.08)",color:"#ef4444",border:"1px solid rgba(239,68,68,.2)",padding:"9px 12px",fontSize:13}}
                          title="Supprimer" onClick={()=>handleDelete(p.id)}>🗑</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══ VENTES ══ */}
          {view==="ventes" && (
            <div className="fade-up">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:26}}>
                <div>
                  <h1 style={{fontSize:26,fontWeight:800,letterSpacing:"-.5px",marginBottom:4}}>Ventes</h1>
                  <p style={{color:"#475569",fontSize:14}}>{sales.length} transaction(s) · {fmtEur(totalCA)}</p>
                </div>
                {sales.length>0 && <button className="btn" style={{background:"rgba(239,68,68,.08)",color:"#ef4444",border:"1px solid rgba(239,68,68,.2)",padding:"9px 18px",fontSize:13}}
                  onClick={async()=>{if(window.confirm("Effacer tout l'historique ?")) await saveS([]);}}>Tout effacer</button>}
              </div>
              {sales.length===0
                ? <div className="card" style={{padding:56,textAlign:"center"}}>
                    <div style={{fontSize:48,marginBottom:12}}>💳</div>
                    <p style={{color:"#334155",marginBottom:16}}>Aucune vente enregistrée</p>
                    <button className="btn" style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",padding:"10px 22px",fontSize:14}} onClick={()=>setView("stock")}>Aller aux stocks →</button>
                  </div>
                : <div className="card" style={{overflow:"hidden"}}>
                    <table style={{width:"100%",borderCollapse:"collapse"}}>
                      <thead>
                        <tr style={{borderBottom:"1px solid #1e1e35"}}>
                          {["Date","Article","Qté","Montant","Opérateur"].map(h=>(
                            <th key={h} style={{padding:"14px 18px",textAlign:"left",fontSize:11,color:"#334155",fontWeight:700,letterSpacing:.8}}>{h.toUpperCase()}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...sales].reverse().map((s,i) => (
                          <tr key={s.id} style={{borderBottom:"1px solid #1e1e3520",background:i%2?"rgba(255,255,255,.01)":"transparent"}}>
                            <td style={{padding:"13px 18px",fontSize:12,color:"#475569"}}>{new Date(s.date).toLocaleString("fr-FR")}</td>
                            <td style={{padding:"13px 18px",fontWeight:600}}>{s.productName}</td>
                            <td style={{padding:"13px 18px",color:"#38bdf8",fontWeight:600}}>×{s.qty}</td>
                            <td style={{padding:"13px 18px",color:"#4ade80",fontWeight:700}}>{fmtEur(s.amount)}</td>
                            <td style={{padding:"13px 18px"}}><span style={{background:"#1e1e35",borderRadius:6,padding:"3px 9px",fontSize:11,color:"#818cf8",fontWeight:600}}>{s.by||"—"}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              }
            </div>
          )}

          {/* ══ CLASSEMENT ══ */}
          {view==="top" && (
            <div className="fade-up">
              <div style={{marginBottom:26}}>
                <h1 style={{fontSize:26,fontWeight:800,letterSpacing:"-.5px",marginBottom:4}}>Classement</h1>
                <p style={{color:"#475569",fontSize:14}}>Temps réel · Firebase</p>
              </div>
              <div style={{display:"grid",gap:12}}>
                {topSellers.map((p,i) => {
                  const cat=getCat(p.categoryId); const mx=Math.max(...products.map(x=>x.sold),1);
                  return (
                    <div key={p.id} className="card" style={{padding:"18px 22px",display:"flex",alignItems:"center",gap:16}}>
                      <div style={{width:44,height:44,borderRadius:12,background:i<3?`${["#fbbf24","#94a3b8","#d97706"][i]}18`:"#1e1e35",display:"flex",alignItems:"center",justifyContent:"center",fontSize:i<3?22:13,fontWeight:800,color:i<3?["#fbbf24","#94a3b8","#d97706"][i]:"#334155",flexShrink:0}}>
                        {i<3?["🥇","🥈","🥉"][i]:`#${i+1}`}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                          <span style={{fontWeight:700,fontSize:15}}>{cat.icon} {p.name}</span>
                          <span className="pill" style={{background:`${cat.color}18`,color:cat.color}}>{cat.name}</span>
                        </div>
                        <div className="prog-track" style={{maxWidth:300}}><div className="prog-fill" style={{width:`${(p.sold/mx)*100}%`,background:cat.color}}/></div>
                        <div style={{fontSize:11,color:"#334155",marginTop:4}}>{p.sold} vendus</div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div style={{fontSize:20,fontWeight:800,color:"#4ade80"}}>{fmtEur(p.sold*p.price)}</div>
                        <div style={{fontSize:12,color:"#475569"}}>{fmtEur(p.price)} / u</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ════ MODALS ════ */}

      {/* Vente */}
      {sellModal && (
        <div className="modal-bg" onClick={()=>setSellModal(null)}>
          <div className="card m-in" style={{padding:32,width:380,maxWidth:"100%"}} onClick={e=>e.stopPropagation()}>
            {(()=>{ const cat=getCat(sellModal.categoryId); return (<>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
                <div style={{width:46,height:46,borderRadius:14,background:`${cat.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{cat.icon}</div>
                <div><div style={{fontWeight:800,fontSize:18}}>{sellModal.name}</div><div style={{fontSize:13,color:"#475569"}}>{fmtEur(sellModal.price)} / {sellModal.unit}</div></div>
              </div>
              <label style={{fontSize:11,color:"#475569",display:"block",marginBottom:8,fontWeight:700,letterSpacing:.8}}>QUANTITÉ</label>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
                <button className="btn" style={{background:"#1e1e35",color:"#e2e8f0",width:44,height:44,fontSize:22,border:"1px solid #2d2d45"}} onClick={()=>setSellQty(q=>Math.max(1,q-1))}>−</button>
                <input className="input" type="number" min="1" max={sellModal.stock} value={sellQty} onChange={e=>setSellQty(+e.target.value)} style={{textAlign:"center",fontSize:22,fontWeight:800}}/>
                <button className="btn" style={{background:"#1e1e35",color:"#e2e8f0",width:44,height:44,fontSize:22,border:"1px solid #2d2d45"}} onClick={()=>setSellQty(q=>Math.min(sellModal.stock,q+1))}>+</button>
              </div>
              <div style={{background:"rgba(129,140,248,.08)",border:"1px solid rgba(129,140,248,.2)",borderRadius:12,padding:"14px 18px",marginBottom:22,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{color:"#64748b"}}>Total</span>
                <span style={{fontWeight:800,fontSize:24,color:"#818cf8"}}>{fmtEur(sellModal.price*sellQty)}</span>
              </div>
              <div style={{display:"flex",gap:10}}>
                <button className="btn" style={{flex:1,background:"#1e1e35",color:"#64748b",padding:13,border:"1px solid #2d2d45"}} onClick={()=>setSellModal(null)}>Annuler</button>
                <button className="btn" style={{flex:2,background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",padding:13,fontSize:15,boxShadow:"0 4px 20px rgba(99,102,241,.3)"}} onClick={handleSell}>✓ Confirmer</button>
              </div>
            </>);})()} 
          </div>
        </div>
      )}

      {/* Ajout */}
      {addModal && (
        <div className="modal-bg" onClick={()=>setAddModal(false)}>
          <div className="card m-in" style={{padding:32,width:440,maxWidth:"100%"}} onClick={e=>e.stopPropagation()}>
            <h2 style={{fontWeight:800,fontSize:20,marginBottom:24}}>Nouvel article</h2>
            <div style={{display:"grid",gap:14}}>
              {[["Nom","text","name","Ex: Perrier…"],["Prix (FCFA)","number","price","3.50"],["Stock initial","number","stock","24"],["Seuil alerte","number","minStock","6"],["Unité","text","unit","bouteille…"]].map(([l,t,k,ph])=>(
                <div key={k}>
                  <label style={{fontSize:11,color:"#475569",display:"block",marginBottom:6,fontWeight:700,letterSpacing:.8}}>{l.toUpperCase()}</label>
                  <input className="input" type={t} placeholder={ph} value={newP[k]} onChange={e=>setNewP(x=>({...x,[k]:e.target.value}))}/>
                </div>
              ))}
              <div>
                <label style={{fontSize:11,color:"#475569",display:"block",marginBottom:6,fontWeight:700,letterSpacing:.8}}>CATÉGORIE</label>
                <select className="input" value={newP.categoryId} onChange={e=>setNewP(x=>({...x,categoryId:e.target.value}))}>
                  {categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:24}}>
              <button className="btn" style={{flex:1,background:"#1e1e35",color:"#64748b",padding:13,border:"1px solid #2d2d45"}} onClick={()=>setAddModal(false)}>Annuler</button>
              <button className="btn" style={{flex:2,background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",padding:13,fontSize:15}} onClick={handleAdd}>+ Ajouter</button>
            </div>
          </div>
        </div>
      )}

      {/* Édition */}
      {editModal && (
        <div className="modal-bg" onClick={()=>setEditModal(null)}>
          <div className="card m-in" style={{padding:32,width:440,maxWidth:"100%"}} onClick={e=>e.stopPropagation()}>
            <h2 style={{fontWeight:800,fontSize:20,marginBottom:24}}>Modifier l'article</h2>
            <div style={{display:"grid",gap:14}}>
              {[["Nom","text","name"],["Prix (FCFA)","number","price"],["Stock actuel","number","stock"],["Seuil alerte","number","minStock"],["Unité","text","unit"]].map(([l,t,k])=>(
                <div key={k}>
                  <label style={{fontSize:11,color:"#475569",display:"block",marginBottom:6,fontWeight:700,letterSpacing:.8}}>{l.toUpperCase()}</label>
                  <input className="input" type={t} value={editModal[k]} onChange={e=>setEditModal(x=>({...x,[k]:e.target.value}))}/>
                </div>
              ))}
              <div>
                <label style={{fontSize:11,color:"#475569",display:"block",marginBottom:6,fontWeight:700,letterSpacing:.8}}>CATÉGORIE</label>
                <select className="input" value={editModal.categoryId} onChange={e=>setEditModal(x=>({...x,categoryId:e.target.value}))}>
                  {categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:24}}>
              <button className="btn" style={{flex:1,background:"#1e1e35",color:"#64748b",padding:13,border:"1px solid #2d2d45"}} onClick={()=>setEditModal(null)}>Annuler</button>
              <button className="btn" style={{flex:2,background:"linear-gradient(135deg,#38bdf8,#818cf8)",color:"#fff",padding:13,fontSize:15}} onClick={handleEdit}>✓ Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* Réappro */}
      {restockModal && (
        <div className="modal-bg" onClick={()=>setRestockModal(null)}>
          <div className="card m-in" style={{padding:32,width:380,maxWidth:"100%"}} onClick={e=>e.stopPropagation()}>
            {(()=>{ const cat=getCat(restockModal.categoryId); return (<>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
                <div style={{width:46,height:46,borderRadius:14,background:`${cat.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{cat.icon}</div>
                <div><div style={{fontWeight:800,fontSize:18}}>Réappro — {restockModal.name}</div><div style={{fontSize:13,color:"#475569"}}>Stock actuel : <strong style={{color:"#e2e8f0"}}>{restockModal.stock}</strong></div></div>
              </div>
              <label style={{fontSize:11,color:"#475569",display:"block",marginBottom:8,fontWeight:700,letterSpacing:.8}}>QUANTITÉ À AJOUTER</label>
              <input className="input" type="number" min="1" value={restockQty} onChange={e=>setRestockQty(+e.target.value)} style={{textAlign:"center",fontSize:22,fontWeight:800,marginBottom:14}}/>
              <div style={{background:"rgba(74,222,128,.07)",border:"1px solid rgba(74,222,128,.2)",borderRadius:12,padding:14,marginBottom:22,textAlign:"center",fontSize:16,fontWeight:700,color:"#4ade80"}}>
                Nouveau stock : {restockModal.stock + +restockQty}
              </div>
              <div style={{display:"flex",gap:10}}>
                <button className="btn" style={{flex:1,background:"#1e1e35",color:"#64748b",padding:13,border:"1px solid #2d2d45"}} onClick={()=>setRestockModal(null)}>Annuler</button>
                <button className="btn" style={{flex:2,background:"linear-gradient(135deg,#059669,#10b981)",color:"#fff",padding:13,fontSize:15}} onClick={handleRestock}>✓ Réapprovisionner</button>
              </div>
            </>);})()} 
          </div>
        </div>
      )}

      {/* Catégories */}
      {catModal && (
        <div className="modal-bg" onClick={()=>setCatModal(false)}>
          <div className="card m-in" style={{padding:32,width:500,maxWidth:"100%",maxHeight:"85vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <h2 style={{fontWeight:800,fontSize:20,marginBottom:6}}>🏷️ Catégories</h2>
            <p style={{color:"#475569",fontSize:13,marginBottom:24}}>Gérez vos catégories d'articles</p>
            <div style={{display:"grid",gap:8,marginBottom:28}}>
              {categories.map(c => { const used=products.filter(p=>p.categoryId===c.id).length; return (
                <div key={c.id} style={{background:"#1a1a2e",border:"1px solid #1e1e35",borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:38,height:38,borderRadius:10,background:`${c.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{c.icon}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:14}}>{c.name}</div>
                    <div style={{fontSize:12,color:"#475569"}}>{used} article{used!==1?"s":""}</div>
                  </div>
                  <div style={{width:10,height:10,borderRadius:"50%",background:c.color,flexShrink:0}}/>
                  <button className="icon-btn" style={{color:"#ef4444"}} onClick={()=>handleDeleteCat(c.id)}>🗑</button>
                </div>
              );})}
            </div>
            <div style={{background:"#1a1a2e",border:"1px solid #2d2d45",borderRadius:14,padding:20}}>
              <h3 style={{fontWeight:700,fontSize:14,marginBottom:16,color:"#818cf8"}}>+ Nouvelle catégorie</h3>
              <div style={{display:"grid",gap:12}}>
                <div>
                  <label style={{fontSize:11,color:"#475569",display:"block",marginBottom:6,fontWeight:700,letterSpacing:.8}}>NOM</label>
                  <input className="input" placeholder="Ex: Cocktail, Snack…" value={newCatName} onChange={e=>setNewCatName(e.target.value)}/>
                </div>
                <div>
                  <label style={{fontSize:11,color:"#475569",display:"block",marginBottom:8,fontWeight:700,letterSpacing:.8}}>ICÔNE</label>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {ICON_LIST.map(ic=>(
                      <button key={ic} className="btn" onClick={()=>setNewCatIcon(ic)}
                        style={{width:36,height:36,fontSize:18,background:newCatIcon===ic?"#2d2d55":"#16162a",border:`1.5px solid ${newCatIcon===ic?"#818cf8":"#1e1e35"}`}}>{ic}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{fontSize:11,color:"#475569",display:"block",marginBottom:8,fontWeight:700,letterSpacing:.8}}>COULEUR</label>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {COLOR_PALETTE.map(col=>(
                      <button key={col} className="btn" onClick={()=>setNewCatColor(col)}
                        style={{width:28,height:28,borderRadius:"50%",background:col,border:newCatColor===col?"3px solid #fff":"3px solid transparent",padding:0}}/>
                    ))}
                  </div>
                </div>
                {newCatName && (
                  <div style={{display:"flex",alignItems:"center",gap:10,background:"#16162a",border:"1px solid #2d2d45",borderRadius:10,padding:"10px 14px"}}>
                    <div style={{width:34,height:34,borderRadius:10,background:`${newCatColor}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{newCatIcon}</div>
                    <span className="pill" style={{background:`${newCatColor}20`,color:newCatColor}}>{newCatName}</span>
                    <span style={{fontSize:12,color:"#334155"}}>← Aperçu</span>
                  </div>
                )}
              </div>
              <button className="btn" style={{width:"100%",background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",padding:"12px 0",fontSize:14,marginTop:16}} onClick={handleAddCat}>
                + Créer la catégorie
              </button>
            </div>
            <button className="btn" style={{width:"100%",background:"#1e1e35",color:"#64748b",padding:12,marginTop:14,border:"1px solid #2d2d45"}} onClick={()=>setCatModal(false)}>Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}
