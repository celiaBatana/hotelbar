import { useState, useEffect, useRef } from "react";
import { dbGet, dbSet, dbListen } from "./firebase";

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
  const [reappros,   setReappros]   = useState([]);
  const [loaded,     setLoaded]     = useState(false);

  const [view,        setView]       = useState("dashboard");
  const [dashMonth,   setDashMonth]  = useState(() => { const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`; });
  const [histMonth,   setHistMonth]  = useState(() => { const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`; });
  const [histTab,     setHistTab]    = useState("ventes"); // "ventes" | "reappros"
  const [openDays,    setOpenDays]   = useState({});       // {date: true} pour accordéon
  const [filterCat,   setFilterCat]  = useState("all");
  const [search,      setSearch]     = useState("");
  const [tableEdits,  setTableEdits] = useState({});
  const [tableSaving, setTableSaving]= useState(false);

  const [sellModal,    setSellModal]   = useState(null);
  const [sellQty,      setSellQty]     = useState(1);
  const [addModal,     setAddModal]    = useState(false);
  const [editModal,    setEditModal]   = useState(null);
  const [restockModal, setRestockModal]= useState(null);
  const [restockQty,   setRestockQty]  = useState(0);
  const [catModal,     setCatModal]    = useState(false);
  const [newCatName,   setNewCatName]  = useState("");
  const [newCatIcon,   setNewCatIcon]  = useState("🥤");
  const [newCatColor,  setNewCatColor] = useState("#38bdf8");
  const [newP, setNewP] = useState({ name:"", categoryId:"soft", price:"", stock:"", minStock:"", unit:"bouteille" });
  const [toast, setToast] = useState(null);
  const myId = useRef(`u_${uid()}`);

  const toast$ = (msg, type="ok") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  useEffect(() => {
    const init = async () => {
      const [cp,cs,cc,cr] = await Promise.all([dbGet("products"),dbGet("sales"),dbGet("categories"),dbGet("reappros")]);
      if (cp) setProducts(cp); if (cs) setSales(cs); if (cc) setCategories(cc); if (cr) setReappros(cr);
      setLoaded(true);
    };
    init();
    const u1=dbListen("products", v=>setProducts(v));
    const u2=dbListen("sales",    v=>setSales(v));
    const u3=dbListen("categories",v=>setCategories(v));
    const u4=dbListen("reappros", v=>setReappros(v));
    return ()=>{ u1(); u2(); u3(); u4(); };
  }, []);

  const saveP = async (v) => { setProducts(v);   await dbSet("products",v); };
  const saveS = async (v) => { setSales(v);      await dbSet("sales",v); };
  const saveC = async (v) => { setCategories(v); await dbSet("categories",v); };

  const handleSell = async () => {
    if (!sellModal||sellQty<1) return;
    const latest = await dbGet("products")||products;
    const p = latest.find(x=>x.id===sellModal.id);
    if (!p||p.stock<sellQty) { toast$("Stock insuffisant !","err"); return; }
    const upP = latest.map(x=>x.id===p.id?{...x,stock:x.stock-sellQty,sold:x.sold+sellQty}:x);
    const latS = await dbGet("sales")||sales;
    const ns = {id:Date.now(),productId:p.id,productName:p.name,qty:sellQty,amount:p.price*sellQty,date:new Date().toISOString(),by:myId.current};
    await Promise.all([saveP(upP),saveS([...latS,ns])]);
    const rem=p.stock-sellQty;
    if (rem<=p.minStock) toast$(`⚠️ Stock bas : ${p.name} (${rem} restants)`,"warn");
    else toast$(`✓ ${sellQty}× ${p.name}`);
    setSellModal(null); setSellQty(1);
  };

  const handleAdd = async () => {
    if (!newP.name||!newP.price||!newP.stock) { toast$("Champs manquants","err"); return; }
    const prod={...newP,id:Date.now(),price:+newP.price,stock:+newP.stock,minStock:+newP.minStock||10,sold:0};
    const latest=await dbGet("products")||products;
    await saveP([...latest,prod]);
    setNewP({name:"",categoryId:categories[0]?.id||"soft",price:"",stock:"",minStock:"",unit:"bouteille"});
    setAddModal(false); toast$(`${prod.name} ajouté !`);
  };

  const handleEdit = async () => {
    if (!editModal.name||!editModal.price||editModal.stock==="") { toast$("Champs manquants","err"); return; }
    const latest=await dbGet("products")||products;
    await saveP(latest.map(p=>p.id===editModal.id?{...editModal,price:+editModal.price,stock:+editModal.stock,minStock:+editModal.minStock}:p));
    setEditModal(null); toast$("Article mis à jour !");
  };

  const handleRestock = async () => {
    const latest=await dbGet("products")||products;
    await saveP(latest.map(p=>p.id===restockModal.id?{...p,stock:p.stock+ +restockQty}:p));
    toast$("Stock réapprovisionné !"); setRestockModal(null); setRestockQty(0);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cet article ?")) return;
    const latest=await dbGet("products")||products;
    await saveP(latest.filter(p=>p.id!==id)); toast$("Supprimé","warn");
  };

  const handleAddCat = async () => {
    if (!newCatName.trim()) { toast$("Nom requis","err"); return; }
    const id=newCatName.toLowerCase().replace(/\s+/g,"_").replace(/[^a-z0-9_]/g,"")+"_"+Date.now();
    await saveC([...categories,{id,name:newCatName.trim(),color:newCatColor,icon:newCatIcon}]);
    setNewCatName(""); toast$(`Catégorie "${newCatName.trim()}" créée !`);
  };

  const handleDeleteCat = async (id) => {
    if (products.some(p=>p.categoryId===id)) { toast$("Des articles utilisent cette catégorie !","err"); return; }
    if (!window.confirm("Supprimer cette catégorie ?")) return;
    await saveC(categories.filter(c=>c.id!==id)); toast$("Catégorie supprimée","warn");
  };

  const handleTableValidate = async () => {
    const hasChanges=Object.values(tableEdits).some(e=>(parseInt(e.sell)||0)>0||(parseInt(e.restock)||0)>0);
    if (!hasChanges) { toast$("Aucune modification à enregistrer","err"); return; }
    setTableSaving(true);
    const latest=await dbGet("products")||products;
    const latestSales=await dbGet("sales")||sales;
    const latestReappros=await dbGet("reappros")||[];
    const newSales=[];
    const newReappros=[];
    const updatedProds=latest.map(p=>{
      const edits=tableEdits[p.id]||{};
      const sellQ=parseInt(edits.sell)||0;
      const restQ=parseInt(edits.restock)||0;
      if (sellQ>p.stock) return p;
      if (sellQ>0) newSales.push({id:Date.now()+p.id,productId:p.id,productName:p.name,qty:sellQ,amount:p.price*sellQ,date:new Date().toISOString(),by:myId.current});
      if (restQ>0) newReappros.push({id:Date.now()+p.id+1,productId:p.id,productName:p.name,qty:restQ,date:new Date().toISOString(),by:myId.current});
      return {...p,stock:p.stock-sellQ+restQ,sold:p.sold+sellQ};
    });
    await Promise.all([saveP(updatedProds),saveS([...latestSales,...newSales]),dbSet("reappros",[...latestReappros,...newReappros])]);
    setTableEdits({}); setTableSaving(false);
    toast$(`✓ ${newSales.length} vente(s) et ${newReappros.length} réappro(s) enregistrés !`);
  };

  const lowStock   = products.filter(p=>p.stock<=p.minStock);
  const totalCA    = sales.reduce((s,x)=>s+x.amount,0);
  const todaySales = sales.filter(s=>new Date(s.date).toDateString()===today());
  const todayCA    = todaySales.reduce((s,x)=>s+x.amount,0);
  const stockVal   = products.reduce((s,p)=>s+p.price*p.stock,0);
  const filtered   = products.filter(p=>(filterCat==="all"||p.categoryId===filterCat)&&p.name.toLowerCase().includes(search.toLowerCase()));
  const topSellers = [...products].sort((a,b)=>b.sold-a.sold);
  const pct        = (p)=>Math.min(100,Math.round((p.stock/(p.minStock*4||1))*100));
  const getCat     = (id)=>categories.find(c=>c.id===id)||{name:"?",color:"#888",icon:"❓"};

  // ── Dashboard mensuel ──────────────────────────────────────────────────────
  const MOIS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  // Tous les mois disponibles dans les ventes
  const availableMonths = [...new Set(sales.map(s=>s.date.slice(0,7)))].sort().reverse();
  const currentYear = new Date().getFullYear();
  // Générer tous les mois de l'année courante pour le sélecteur
  const allMonths = Array.from({length:12},(_,i)=>{
    const m = String(i+1).padStart(2,"0");
    return `${currentYear}-${m}`;
  }).reverse();
  // Ventes du mois sélectionné
  const monthSales   = sales.filter(s=>s.date.startsWith(dashMonth));
  const monthCA      = monthSales.reduce((s,x)=>s+x.amount,0);
  const monthLabel   = (()=>{ const [y,m]=dashMonth.split("-"); return `${MOIS[+m-1]} ${y}`; })();
  // Mois précédent pour comparaison
  const prevMonth    = (()=>{ const [y,m]=dashMonth.split("-"); const d=new Date(+y,+m-2,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; })();
  const prevMonthCA  = sales.filter(s=>s.date.startsWith(prevMonth)).reduce((s,x)=>s+x.amount,0);
  const caEvol       = prevMonthCA>0?Math.round(((monthCA-prevMonthCA)/prevMonthCA)*100):null;
  // Top ventes du mois (basé sur les ventes enregistrées)
  const monthTopMap  = {};
  monthSales.forEach(s=>{ if(!monthTopMap[s.productId]) monthTopMap[s.productId]={name:s.productName,qty:0,ca:0,productId:s.productId}; monthTopMap[s.productId].qty+=s.qty; monthTopMap[s.productId].ca+=s.amount; });
  const monthTop     = Object.values(monthTopMap).sort((a,b)=>b.ca-a.ca).slice(0,5);
  // CA par jour du mois pour mini graphique
  const daysInMonth  = new Date(...dashMonth.split("-").map((v,i)=>i===1?+v:+v), 0).getDate() || 31;
  const caByDay      = Array.from({length:daysInMonth},(_,i)=>{
    const day = String(i+1).padStart(2,"0");
    return monthSales.filter(s=>s.date.slice(8,10)===day).reduce((s,x)=>s+x.amount,0);
  });
  const maxDay = Math.max(...caByDay,1);

  if (!loaded) return (
    <div style={{background:"#0f0f17",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Plus Jakarta Sans',sans-serif",color:"#fff"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{width:52,height:52,borderRadius:"50%",border:"3px solid #1e1e30",borderTopColor:"#818cf8",animation:"spin 0.9s linear infinite",marginBottom:20}}/>
      <div style={{fontWeight:700,fontSize:17,color:"#818cf8"}}>Connexion Firebase…</div>
    </div>
  );

  return (
    <div style={{background:"#0f0f17",minHeight:"100vh",fontFamily:"'Plus Jakarta Sans',sans-serif",color:"#e2e8f0"}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#0f0f17}::-webkit-scrollbar-thumb{background:#2d2d45;border-radius:4px}
        .btn{cursor:pointer;border:none;font-family:inherit;font-weight:600;border-radius:10px;transition:all .18s;display:inline-flex;align-items:center;justify-content:center;gap:6px}
        .btn:hover{filter:brightness(1.12);transform:translateY(-1px)}.btn:active{transform:translateY(0);filter:brightness(.95)}
        .input{background:#1a1a2e;border:1.5px solid #2d2d45;border-radius:10px;color:#e2e8f0;font-family:inherit;padding:11px 14px;width:100%;outline:none;font-size:14px;transition:border .15s}
        .input:focus{border-color:#818cf8}select.input option{background:#1a1a2e}
        .card{background:#16162a;border:1px solid #1e1e35;border-radius:16px}
        .pill{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.4px}
        .sb-btn{cursor:pointer;background:none;border:none;font-family:inherit;width:100%;text-align:left;padding:11px 16px;border-radius:12px;font-size:14px;font-weight:600;color:#64748b;transition:all .15s;display:flex;align-items:center;gap:10px}
        .sb-btn:hover{background:#1e1e35;color:#e2e8f0}.sb-btn.active{background:linear-gradient(135deg,#312e81,#4c1d95);color:#fff;box-shadow:0 4px 20px rgba(99,102,241,.25)}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}.fade-up{animation:fadeUp .3s ease}
        @keyframes mIn{from{opacity:0;transform:scale(.95) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}.m-in{animation:mIn .22s ease}
        .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(8px);z-index:100;display:flex;align-items:center;justify-content:center;padding:16px}
        @keyframes tIn{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:translateX(0)}}
        .toast{animation:tIn .25s ease;position:fixed;bottom:28px;right:28px;z-index:999;padding:13px 20px;border-radius:12px;font-weight:600;font-size:14px;max-width:300px;box-shadow:0 8px 32px rgba(0,0,0,.5);display:flex;align-items:center;gap:8px}
        .prog-track{height:5px;border-radius:3px;background:#1e1e35;overflow:hidden}.prog-fill{height:100%;border-radius:3px;transition:width .5s ease}
        .prod-card{background:#16162a;border:1.5px solid #1e1e35;border-radius:16px;padding:20px;transition:all .2s;position:relative;overflow:hidden}
        .prod-card:hover{border-color:#312e81;transform:translateY(-2px);box-shadow:0 8px 32px rgba(0,0,0,.4)}
        .tab{cursor:pointer;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;border:none;font-family:inherit;transition:all .15s}
        .stat{background:#16162a;border:1px solid #1e1e35;border-radius:18px;padding:22px;transition:border-color .2s}.stat:hover{border-color:#312e81}
        .icon-btn{cursor:pointer;border:none;background:none;font-size:15px;padding:6px 8px;border-radius:8px;transition:background .15s;color:#64748b}.icon-btn:hover{background:#1e1e35;color:#e2e8f0}
        .tbl-in{background:#1a1a2e;border:1.5px solid #2d2d45;border-radius:8px;color:#e2e8f0;font-family:inherit;padding:6px 4px;text-align:center;font-size:14px;outline:none;width:58px;transition:border .15s}
        .tbl-in:focus{border-color:#818cf8}
        .sm-btn{cursor:pointer;border:1px solid #2d2d45;background:#1e1e35;color:#e2e8f0;border-radius:6px;width:26px;height:26px;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0}
        .sm-btn:hover{background:#2d2d45}
      `}</style>

      {toast&&<div className="toast" style={{background:toast.type==="err"?"#ef4444":toast.type==="warn"?"#f59e0b":"#22c55e",color:"#fff"}}><span>{toast.type==="err"?"✕":toast.type==="warn"?"⚠":"✓"}</span>{toast.msg}</div>}

      <div style={{display:"flex",minHeight:"100vh"}}>
        {/* ── Sidebar ── */}
        <aside style={{width:224,background:"#0d0d1a",borderRight:"1px solid #1e1e35",padding:"24px 12px",display:"flex",flexDirection:"column",gap:4,position:"sticky",top:0,height:"100vh",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:12,padding:"4px 8px 24px"}}>
            <div style={{width:38,height:38,borderRadius:12,background:"linear-gradient(135deg,#4f46e5,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🏨</div>
            <div><div style={{fontWeight:800,fontSize:15,letterSpacing:"-.3px"}}>HôtelBar</div><div style={{fontSize:10,color:"#334155",letterSpacing:1}}>PRO</div></div>
          </div>
          {[["dashboard","📊","Dashboard"],["stock","📦","Stocks"],["tableau","📋","Tableau"],["ventes","📜","Historique"],["top","🏆","Classement"]].map(([v,ic,lb])=>(
            <button key={v} className={`sb-btn${view===v?" active":""}`} onClick={()=>setView(v)}>
              <span style={{fontSize:16}}>{ic}</span>{lb}
              {v==="stock"&&lowStock.length>0&&<span style={{marginLeft:"auto",background:"#ef4444",color:"#fff",borderRadius:20,padding:"1px 8px",fontSize:11,fontWeight:800}}>{lowStock.length}</span>}
              {v==="tableau"&&Object.values(tableEdits).some(e=>(parseInt(e.sell)||0)>0||(parseInt(e.restock)||0)>0)&&<span style={{marginLeft:"auto",background:"#818cf8",color:"#fff",borderRadius:20,padding:"1px 8px",fontSize:11,fontWeight:800}}>●</span>}
            </button>
          ))}
          <div style={{height:1,background:"#1e1e35",margin:"12px 8px"}}/>
          <button className="sb-btn" onClick={()=>setCatModal(true)}><span style={{fontSize:16}}>🏷️</span>Catégories</button>
          <div style={{flex:1}}/>
          <div style={{padding:"10px 8px",borderTop:"1px solid #1e1e35"}}>
            <div style={{fontSize:11,color:"#334155",marginBottom:4}}>🔥 Firebase · Temps réel</div>
            <div style={{fontSize:11,color:"#475569"}}>{new Date().toLocaleDateString("fr-FR")}</div>
          </div>
        </aside>

        <main style={{flex:1,padding:"32px 36px",overflowY:"auto",minWidth:0}}>

          {/* ══ DASHBOARD ══ */}
          {view==="dashboard"&&(
            <div className="fade-up">
              {/* Header + sélecteur de mois */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
                <div>
                  <h1 style={{fontSize:26,fontWeight:800,letterSpacing:"-.5px",marginBottom:4}}>Dashboard</h1>
                  <p style={{color:"#475569",fontSize:14}}>{new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</p>
                </div>
                {/* Sélecteur mois */}
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <button className="btn" style={{background:"#1e1e35",color:"#94a3b8",border:"1px solid #2d2d45",width:34,height:34,fontSize:16,padding:0}}
                    onClick={()=>{ const [y,m]=dashMonth.split("-");const d=new Date(+y,+m-2,1);setDashMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); }}>‹</button>
                  <div style={{background:"#16162a",border:"1px solid #2d2d45",borderRadius:10,padding:"8px 18px",fontWeight:700,fontSize:15,minWidth:160,textAlign:"center",color:"#e2e8f0"}}>
                    {monthLabel}
                  </div>
                  <button className="btn" style={{background:"#1e1e35",color:"#94a3b8",border:"1px solid #2d2d45",width:34,height:34,fontSize:16,padding:0}}
                    onClick={()=>{ const [y,m]=dashMonth.split("-");const d=new Date(+y,+m,1);const next=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;if(next<=new Date().toISOString().slice(0,7))setDashMonth(next); }}>›</button>
                  <button className="btn" style={{background:"#1e1e35",color:"#818cf8",border:"1px solid #2d2d45",padding:"8px 14px",fontSize:12,marginLeft:4}}
                    onClick={()=>{ const n=new Date();setDashMonth(`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`); }}>Aujourd'hui</button>
                </div>
              </div>

              {/* KPIs du mois */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:18,marginBottom:26}}>
                {[
                  {label:"CA du mois",   val:fmtEur(monthCA),     sub: caEvol!==null?`${caEvol>=0?"▲":"▼"} ${Math.abs(caEvol)}% vs mois préc.`:`${monthSales.length} ventes`,  color:"#4ade80", icon:"💰"},
                  {label:"Nb ventes",    val:monthSales.length,   sub:`${[...new Set(monthSales.map(s=>s.date.slice(0,10)))].length} jours actifs`,                             color:"#818cf8", icon:"🧾"},
                  {label:"Valeur stock", val:fmtEur(stockVal),    sub:`${products.length} références`,                                                                           color:"#38bdf8", icon:"📦"},
                  {label:"Alertes",      val:lowStock.length,     sub:lowStock.length?"articles critiques":"Tout OK ✓",                                                          color:lowStock.length?"#ef4444":"#4ade80", icon:"⚠️"},
                ].map((k,i)=>(
                  <div key={i} className="stat">
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                      <span style={{fontSize:22}}>{k.icon}</span>
                      <span style={{fontSize:10,color:"#334155",fontWeight:700,letterSpacing:1}}>{k.label.toUpperCase()}</span>
                    </div>
                    <div style={{fontSize:25,fontWeight:800,color:k.color,letterSpacing:"-.5px",marginBottom:4}}>{k.val}</div>
                    <div style={{fontSize:12,color:caEvol!==null&&i===0?(caEvol>=0?"#4ade80":"#ef4444"):"#475569"}}>{k.sub}</div>
                  </div>
                ))}
              </div>

              {/* Mini graphique CA par jour */}
              {monthSales.length>0&&(
                <div className="card" style={{padding:20,marginBottom:22}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                    <h2 style={{fontWeight:700,fontSize:14}}>📈 CA par jour — {monthLabel}</h2>
                    <span style={{fontSize:12,color:"#475569"}}>Total : {fmtEur(monthCA)}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"flex-end",gap:3,height:64}}>
                    {caByDay.map((v,i)=>{
                      const h=Math.max(4,Math.round((v/maxDay)*60));
                      const isToday=new Date().toISOString().slice(0,10)===`${dashMonth}-${String(i+1).padStart(2,"0")}`;
                      return(
                        <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}} title={`${i+1} : ${fmtEur(v)}`}>
                          <div style={{width:"100%",height:h,borderRadius:"3px 3px 0 0",background:isToday?"#818cf8":v>0?"#4f46e5":"#1e1e35",transition:"height .3s"}}/>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:10,color:"#334155"}}>
                    <span>1</span><span>{Math.ceil(daysInMonth/2)}</span><span>{daysInMonth}</span>
                  </div>
                </div>
              )}

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:22}}>
                {/* Top ventes du mois */}
                <div className="card" style={{padding:20}}>
                  <h2 style={{fontWeight:700,fontSize:14,marginBottom:16}}>🏆 Top ventes — {monthLabel}</h2>
                  {monthTop.length===0
                    ?<p style={{color:"#334155",fontSize:13,textAlign:"center",padding:"16px 0"}}>Aucune vente ce mois</p>
                    :monthTop.map((p,i)=>{
                      const prod=products.find(x=>x.id===p.productId);
                      const cat=prod?getCat(prod.categoryId):{icon:"📦",color:"#818cf8"};
                      const mx=monthTop[0].ca||1;
                      return(
                        <div key={p.productId} style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                          <div style={{width:24,height:24,borderRadius:6,background:i<3?`${["#fbbf24","#94a3b8","#d97706"][i]}20`:"#1e1e35",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>
                            {i<3?["🥇","🥈","🥉"][i]:<span style={{fontWeight:700,color:"#475569"}}>#{i+1}</span>}
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                              <span style={{fontWeight:600,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cat.icon} {p.name}</span>
                              <span style={{fontSize:12,fontWeight:700,color:"#4ade80",flexShrink:0,marginLeft:6}}>{fmtEur(p.ca)}</span>
                            </div>
                            <div className="prog-track"><div className="prog-fill" style={{width:`${(p.ca/mx)*100}%`,background:cat.color}}/></div>
                            <div style={{fontSize:10,color:"#334155",marginTop:2}}>{p.qty} vendus</div>
                          </div>
                        </div>
                      );
                    })
                  }
                </div>

                {/* Historique des mois */}
                <div className="card" style={{padding:20}}>
                  <h2 style={{fontWeight:700,fontSize:14,marginBottom:16}}>📅 Historique mensuel</h2>
                  {allMonths.filter(m=>sales.some(s=>s.date.startsWith(m))||m===dashMonth).slice(0,8).length===0
                    ?<p style={{color:"#334155",fontSize:13,textAlign:"center",padding:"16px 0"}}>Pas encore de données</p>
                    :allMonths.map(m=>{
                      const mSales=sales.filter(s=>s.date.startsWith(m));
                      const mCA=mSales.reduce((s,x)=>s+x.amount,0);
                      if (mCA===0&&m!==dashMonth) return null;
                      const [y,mo]=m.split("-");
                      const isSelected=m===dashMonth;
                      const maxCA=Math.max(...allMonths.map(mm=>sales.filter(s=>s.date.startsWith(mm)).reduce((s,x)=>s+x.amount,0)),1);
                      return(
                        <div key={m} onClick={()=>setDashMonth(m)} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,cursor:"pointer",padding:"8px 10px",borderRadius:10,background:isSelected?"#1e1e35":"transparent",border:`1px solid ${isSelected?"#312e81":"transparent"}`,transition:"all .15s"}}>
                          <div style={{width:38,fontSize:12,color:isSelected?"#818cf8":"#475569",fontWeight:isSelected?700:400,flexShrink:0}}>{MOIS[+mo-1].slice(0,3)} {y}</div>
                          <div style={{flex:1}}>
                            <div className="prog-track"><div className="prog-fill" style={{width:`${(mCA/maxCA)*100}%`,background:isSelected?"#818cf8":"#334155"}}/></div>
                          </div>
                          <div style={{fontSize:12,fontWeight:700,color:isSelected?"#4ade80":"#475569",minWidth:80,textAlign:"right"}}>{fmtEur(mCA)}</div>
                          <div style={{fontSize:11,color:"#334155",minWidth:30,textAlign:"right"}}>{mSales.length}v</div>
                        </div>
                      );
                    })
                  }
                </div>
              </div>

              {/* Alertes stock */}
              {lowStock.length>0&&(
                <div style={{background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.25)",borderRadius:16,padding:20}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                    <span>🔴</span><span style={{fontWeight:700,color:"#ef4444",fontSize:14}}>Ruptures imminentes</span>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
                    {lowStock.map(p=>{const cat=getCat(p.categoryId);return(
                      <div key={p.id} style={{background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.25)",borderRadius:12,padding:"10px 16px",display:"flex",alignItems:"center",gap:12}}>
                        <span style={{fontSize:20}}>{cat.icon}</span>
                        <div><div style={{fontWeight:700,fontSize:14}}>{p.name}</div><div style={{fontSize:12,color:"#ef4444"}}>{p.stock} / min {p.minStock}</div></div>
                        <button className="btn" style={{background:"#ef4444",color:"#fff",padding:"6px 14px",fontSize:12}}
                          onClick={()=>{setRestockModal(p);setRestockQty(p.minStock*2);setView("stock")}}>Réappro</button>
                      </div>
                    );})}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ STOCKS ══ */}
          {view==="stock"&&(
            <div className="fade-up">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:26}}>
                <div>
                  <h1 style={{fontSize:26,fontWeight:800,letterSpacing:"-.5px",marginBottom:4}}>Stocks</h1>
                  <p style={{color:"#475569",fontSize:14}}>{products.length} articles · {lowStock.length} alerte(s)</p>
                </div>
                <button className="btn" style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",padding:"11px 22px",fontSize:14,boxShadow:"0 4px 20px rgba(99,102,241,.3)"}} onClick={()=>setAddModal(true)}>+ Nouvel article</button>
              </div>
              <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
                <div style={{position:"relative",flexShrink:0}}>
                  <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#475569",fontSize:14,pointerEvents:"none"}}>🔍</span>
                  <input className="input" placeholder="Rechercher…" value={search} onChange={e=>setSearch(e.target.value)} style={{paddingLeft:36,width:190}}/>
                </div>
                <button className="tab" onClick={()=>setFilterCat("all")} style={{background:filterCat==="all"?"linear-gradient(135deg,#4f46e5,#7c3aed)":"#16162a",color:filterCat==="all"?"#fff":"#475569",border:`1px solid ${filterCat==="all"?"transparent":"#1e1e35"}`}}>Tous ({products.length})</button>
                {categories.map(c=>{const cnt=products.filter(p=>p.categoryId===c.id).length;return(
                  <button key={c.id} className="tab" onClick={()=>setFilterCat(c.id)} style={{background:filterCat===c.id?c.color+"25":"#16162a",color:filterCat===c.id?c.color:"#475569",border:`1px solid ${filterCat===c.id?c.color+"50":"#1e1e35"}`}}>
                    {c.icon} {c.name} {cnt>0&&<span style={{opacity:.6}}>({cnt})</span>}
                  </button>
                );})}
              </div>
              {filtered.length===0&&<div style={{textAlign:"center",padding:"60px 0",color:"#334155"}}>Aucun article trouvé</div>}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:18}}>
                {filtered.map(p=>{
                  const cat=getCat(p.categoryId);const isLow=p.stock<=p.minStock;const pp=pct(p);
                  return(
                    <div key={p.id} className="prod-card" style={{borderColor:isLow?"rgba(239,68,68,.8)":"#1e1e35",boxShadow:isLow?"0 0 20px rgba(239,68,68,.2)":""}}>
                      {isLow&&<div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,#ef4444,#dc2626)"}}/>}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{width:40,height:40,borderRadius:12,background:`${cat.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{cat.icon}</div>
                          <div>
                            <div style={{fontWeight:700,fontSize:15,marginBottom:2}}>{p.name}</div>
                            <span className="pill" style={{background:`${cat.color}18`,color:cat.color}}>{cat.name}</span>
                          </div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontWeight:800,fontSize:26,color:isLow?"#ef4444":"#e2e8f0",lineHeight:1}}>{p.stock}</div>
                          <div style={{fontSize:11,color:"#475569"}}>{p.unit}s</div>
                        </div>
                      </div>
                      <div style={{fontSize:16,fontWeight:700,color:"#818cf8",marginBottom:14}}>{fmtEur(p.price)} <span style={{fontSize:12,fontWeight:400,color:"#475569"}}>/ {p.unit}</span></div>
                      <div style={{marginBottom:16}}>
                        <div className="prog-track"><div className="prog-fill" style={{width:`${pp}%`,background:isLow?"linear-gradient(90deg,#ef4444,#dc2626)":pp>50?cat.color:"#38bdf8"}}/></div>
                        <div style={{display:"flex",justifyContent:"space-between",marginTop:5,fontSize:11,color:"#334155"}}>
                          <span>Min {p.minStock} {p.unit}s</span>
                          {isLow?<span style={{color:"#ef4444",fontWeight:700}}>⚠ Stock bas</span>:<span>{pp}%</span>}
                        </div>
                      </div>
                      <div style={{display:"flex",gap:6}}>
                        <button className="btn" style={{flex:1,background:`${cat.color}18`,color:cat.color,border:`1px solid ${cat.color}30`,padding:"9px 0",fontSize:13}} onClick={()=>{setSellModal(p);setSellQty(1)}}>💳 Vendre</button>
                        <button className="btn" style={{background:"#1e1e35",color:"#94a3b8",border:"1px solid #2d2d45",padding:"9px 12px",fontSize:13}} title="Réapprovisionner" onClick={()=>{setRestockModal(p);setRestockQty(p.minStock*2)}}>📦</button>
                        <button className="btn" style={{background:"#1e1e35",color:"#818cf8",border:"1px solid #2d2d45",padding:"9px 12px",fontSize:13}} title="Modifier" onClick={()=>setEditModal({...p,price:p.price.toString(),stock:p.stock.toString(),minStock:p.minStock.toString()})}>✏️</button>
                        <button className="btn" style={{background:"rgba(239,68,68,.08)",color:"#ef4444",border:"1px solid rgba(239,68,68,.2)",padding:"9px 12px",fontSize:13}} title="Supprimer" onClick={()=>handleDelete(p.id)}>🗑</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══ TABLEAU ══ */}
          {view==="tableau"&&(
            <div className="fade-up">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:26}}>
                <div>
                  <h1 style={{fontSize:26,fontWeight:800,letterSpacing:"-.5px",marginBottom:4}}>Tableau de gestion</h1>
                  <p style={{color:"#475569",fontSize:14}}>Saisie rapide — ventes et réappros en une seule fois</p>
                </div>
                <div style={{display:"flex",gap:10}}>
                  {Object.values(tableEdits).some(e=>(parseInt(e.sell)||0)>0||(parseInt(e.restock)||0)>0)&&(
                    <button className="btn" style={{background:"rgba(239,68,68,.08)",color:"#ef4444",border:"1px solid rgba(239,68,68,.2)",padding:"10px 18px",fontSize:13}} onClick={()=>setTableEdits({})}>↺ Vider</button>
                  )}
                  <button className="btn" style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",padding:"11px 24px",fontSize:14,boxShadow:"0 4px 20px rgba(99,102,241,.3)",opacity:tableSaving?.6:1}} onClick={handleTableValidate} disabled={tableSaving}>
                    {tableSaving?"⏳ Enregistrement…":"✓ Tout valider"}
                  </button>
                </div>
              </div>
              <div className="card" style={{overflow:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",minWidth:820}}>
                  <thead>
                    <tr style={{borderBottom:"2px solid #1e1e35",background:"#0f0f1a"}}>
                      {["Article","Catégorie","Prix / u","Stock","Min","Ventes","Réappro","Nouveau stock"].map(h=>(
                        <th key={h} style={{padding:"13px 14px",textAlign:"left",fontSize:11,color:"#475569",fontWeight:700,letterSpacing:.6,whiteSpace:"nowrap"}}>{h.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p,i)=>{
                      const cat=getCat(p.categoryId);
                      const isLow=p.stock<=p.minStock;
                      const edits=tableEdits[p.id]||{};
                      const sellQ=parseInt(edits.sell)||0;
                      const restQ=parseInt(edits.restock)||0;
                      const newSt=p.stock-sellQ+restQ;
                      const newLow=newSt<=p.minStock;
                      const setE=(field,val)=>setTableEdits(e=>({...e,[p.id]:{...(e[p.id]||{}),[field]:val}}));
                      return(
                        <tr key={p.id} style={{borderBottom:"1px solid #1e1e3530",background:isLow?"rgba(239,68,68,.04)":i%2?"rgba(255,255,255,.01)":"transparent"}}>
                          <td style={{padding:"11px 14px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <div style={{width:32,height:32,borderRadius:8,background:`${cat.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{cat.icon}</div>
                              <span style={{fontWeight:600,fontSize:14}}>{p.name}</span>
                              {isLow&&<span style={{fontSize:10,background:"rgba(239,68,68,.15)",color:"#ef4444",borderRadius:4,padding:"2px 6px",fontWeight:700}}>ALERTE</span>}
                            </div>
                          </td>
                          <td style={{padding:"11px 14px"}}><span className="pill" style={{background:`${cat.color}18`,color:cat.color}}>{cat.name}</span></td>
                          <td style={{padding:"11px 14px",fontWeight:600,color:"#818cf8",whiteSpace:"nowrap"}}>{fmtEur(p.price)}</td>
                          <td style={{padding:"11px 14px"}}>
                            <span style={{fontWeight:800,fontSize:18,color:isLow?"#ef4444":"#e2e8f0"}}>{p.stock}</span>
                            <span style={{fontSize:11,color:"#475569",marginLeft:4}}>{p.unit}s</span>
                          </td>
                          <td style={{padding:"11px 14px",fontSize:13,color:"#475569"}}>{p.minStock}</td>
                          {/* Ventes */}
                          <td style={{padding:"8px 14px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:4}}>
                              <button className="sm-btn" onClick={()=>setE("sell",Math.max(0,sellQ-1))}>−</button>
                              <input className="tbl-in" type="number" min="0" max={p.stock} value={edits.sell||""} placeholder="0"
                                style={{borderColor:sellQ>0?"#818cf8":"#2d2d45",color:sellQ>0?"#818cf8":"#e2e8f0",fontWeight:sellQ>0?700:400}}
                                onChange={ev=>setE("sell",ev.target.value)}/>
                              <button className="sm-btn" onClick={()=>setE("sell",Math.min(p.stock,sellQ+1))}>+</button>
                              {sellQ>0&&<span style={{fontSize:11,color:"#818cf8",fontWeight:700,whiteSpace:"nowrap",marginLeft:2}}>{fmtEur(p.price*sellQ)}</span>}
                            </div>
                          </td>
                          {/* Réappro */}
                          <td style={{padding:"8px 14px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:4}}>
                              <button className="sm-btn" onClick={()=>setE("restock",Math.max(0,restQ-1))}>−</button>
                              <input className="tbl-in" type="number" min="0" value={edits.restock||""} placeholder="0"
                                style={{borderColor:restQ>0?"#4ade80":"#2d2d45",color:restQ>0?"#4ade80":"#e2e8f0",fontWeight:restQ>0?700:400}}
                                onChange={ev=>setE("restock",ev.target.value)}/>
                              <button className="sm-btn" onClick={()=>setE("restock",restQ+1)}>+</button>
                              {restQ>0&&<span style={{fontSize:11,color:"#4ade80",fontWeight:700,marginLeft:2}}>+{restQ}</span>}
                            </div>
                          </td>
                          {/* Nouveau stock */}
                          <td style={{padding:"11px 14px"}}>
                            <span style={{fontWeight:800,fontSize:16,color:newLow?"#ef4444":(sellQ>0||restQ>0)?"#4ade80":"#334155"}}>{newSt}</span>
                            {(sellQ>0||restQ>0)&&<span style={{fontSize:11,color:"#475569",marginLeft:4}}>{p.unit}s</span>}
                            {newLow&&(sellQ>0||restQ>0)&&<span style={{fontSize:10,color:"#ef4444",marginLeft:6,fontWeight:700}}>⚠</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {Object.values(tableEdits).some(e=>(parseInt(e.sell)||0)>0||(parseInt(e.restock)||0)>0)&&(
                  <div style={{padding:"14px 20px",borderTop:"1px solid #1e1e35",background:"#0f0f1a",display:"flex",gap:24,flexWrap:"wrap"}}>
                    <span style={{color:"#818cf8",fontWeight:700,fontSize:13}}>
                      💳 {Object.values(tableEdits).reduce((s,e)=>s+(parseInt(e.sell)||0),0)} vendus · CA : {fmtEur(products.reduce((s,p)=>s+(parseInt(tableEdits[p.id]?.sell)||0)*p.price,0))}
                    </span>
                    <span style={{color:"#4ade80",fontWeight:700,fontSize:13}}>
                      📦 {Object.values(tableEdits).reduce((s,e)=>s+(parseInt(e.restock)||0),0)} unités réapprovisionnées
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ HISTORIQUE ══ */}
          {view==="ventes"&&(
            <div className="fade-up">
              {/* Header */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
                <div>
                  <h1 style={{fontSize:26,fontWeight:800,letterSpacing:"-.5px",marginBottom:4}}>Historique</h1>
                  <p style={{color:"#475569",fontSize:14}}>{sales.length} vente(s) · {reappros.length} réappro(s)</p>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  {/* Sélecteur mois */}
                  <button className="btn" style={{background:"#1e1e35",color:"#94a3b8",border:"1px solid #2d2d45",width:32,height:32,fontSize:16,padding:0}}
                    onClick={()=>{ const [y,m]=histMonth.split("-");const d=new Date(+y,+m-2,1);setHistMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); }}>‹</button>
                  <div style={{background:"#16162a",border:"1px solid #2d2d45",borderRadius:10,padding:"7px 16px",fontWeight:700,fontSize:14,minWidth:140,textAlign:"center"}}>
                    {MOIS[(+histMonth.split("-")[1])-1]} {histMonth.split("-")[0]}
                  </div>
                  <button className="btn" style={{background:"#1e1e35",color:"#94a3b8",border:"1px solid #2d2d45",width:32,height:32,fontSize:16,padding:0}}
                    onClick={()=>{ const [y,m]=histMonth.split("-");const d=new Date(+y,+m,1);const next=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;if(next<=new Date().toISOString().slice(0,7))setHistMonth(next); }}>›</button>
                  {/* Onglets */}
                  <div style={{display:"flex",background:"#16162a",border:"1px solid #1e1e35",borderRadius:10,padding:3,marginLeft:8}}>
                    {[["ventes","💳 Ventes"],["reappros","📦 Réappros"]].map(([t,lb])=>(
                      <button key={t} className="btn" onClick={()=>setHistTab(t)}
                        style={{padding:"7px 16px",fontSize:13,background:histTab===t?"linear-gradient(135deg,#4f46e5,#7c3aed)":"transparent",color:histTab===t?"#fff":"#475569",borderRadius:8}}>
                        {lb}
                      </button>
                    ))}
                  </div>
                  {/* Effacer */}
                  {(histTab==="ventes"?sales:reappros).length>0&&(
                    <button className="btn" style={{background:"rgba(239,68,68,.08)",color:"#ef4444",border:"1px solid rgba(239,68,68,.2)",padding:"8px 14px",fontSize:12,marginLeft:4}}
                      onClick={async()=>{
                        if (!window.confirm(`Effacer tout l'historique des ${histTab==="ventes"?"ventes":"réappros"} ?`)) return;
                        if (histTab==="ventes") await saveS([]);
                        else { setReappros([]); await dbSet("reappros",[]); }
                      }}>🗑 Tout effacer</button>
                  )}
                </div>
              </div>

              {/* Contenu selon onglet */}
              {(()=>{
                const data = histTab==="ventes" ? sales : reappros;
                const monthData = data.filter(s=>s.date.startsWith(histMonth));

                if (data.length===0) return (
                  <div className="card" style={{padding:56,textAlign:"center"}}>
                    <div style={{fontSize:48,marginBottom:12}}>{histTab==="ventes"?"💳":"📦"}</div>
                    <p style={{color:"#334155",marginBottom:16}}>Aucun historique enregistré</p>
                    <button className="btn" style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",padding:"10px 22px",fontSize:14}} onClick={()=>setView("tableau")}>Aller au tableau →</button>
                  </div>
                );

                if (monthData.length===0) return (
                  <div>
                    {/* Récap mois disponibles */}
                    <div className="card" style={{padding:20,marginBottom:16}}>
                      <p style={{color:"#475569",fontSize:13,marginBottom:14}}>Aucune donnée pour ce mois. Mois disponibles :</p>
                      <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                        {[...new Set(data.map(s=>s.date.slice(0,7)))].sort().reverse().map(m=>(
                          <button key={m} className="btn" onClick={()=>setHistMonth(m)}
                            style={{background:"#1e1e35",color:"#818cf8",border:"1px solid #2d2d45",padding:"6px 14px",fontSize:13}}>
                            {MOIS[(+m.split("-")[1])-1]} {m.split("-")[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );

                // Grouper par jour
                const byDay = {};
                monthData.forEach(s=>{
                  const day=s.date.slice(0,10);
                  if (!byDay[day]) byDay[day]=[];
                  byDay[day].push(s);
                });
                const days=Object.keys(byDay).sort().reverse();

                // Totaux du mois
                const monthTotal = histTab==="ventes"
                  ? monthData.reduce((s,x)=>s+x.amount,0)
                  : monthData.reduce((s,x)=>s+x.qty,0);

                return (
                  <div>
                    {/* Récap mensuel */}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
                      {histTab==="ventes"?[
                        {label:"CA du mois",  val:fmtEur(monthTotal),           color:"#4ade80"},
                        {label:"Nb ventes",   val:monthData.length,             color:"#818cf8"},
                        {label:"Jours actifs",val:days.length,                  color:"#38bdf8"},
                      ]:[
                        {label:"Total réappros", val:`${monthTotal} unités`,    color:"#4ade80"},
                        {label:"Nb opérations",  val:monthData.length,          color:"#818cf8"},
                        {label:"Jours actifs",   val:days.length,               color:"#38bdf8"},
                      ].map((k,i)=>(
                        <div key={i} className="stat" style={{padding:16}}>
                          <div style={{fontSize:10,color:"#334155",fontWeight:700,letterSpacing:1,marginBottom:8}}>{k.label.toUpperCase()}</div>
                          <div style={{fontSize:22,fontWeight:800,color:k.color}}>{k.val}</div>
                        </div>
                      ))}
                    </div>

                    {/* Accordéon par jour */}
                    <div style={{display:"grid",gap:10}}>
                      {days.map(day=>{
                        const items=byDay[day];
                        const isOpen=openDays[day]!==false; // ouvert par défaut
                        const dayTotal=histTab==="ventes"
                          ? items.reduce((s,x)=>s+x.amount,0)
                          : items.reduce((s,x)=>s+x.qty,0);
                        const dateLabel=new Date(day).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});

                        return(
                          <div key={day} className="card" style={{overflow:"hidden"}}>
                            {/* Header jour */}
                            <div onClick={()=>setOpenDays(d=>({...d,[day]:!isOpen}))}
                              style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",cursor:"pointer",background:"#111120",userSelect:"none"}}>
                              <div style={{display:"flex",alignItems:"center",gap:12}}>
                                <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#312e81,#4c1d95)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#fff",flexShrink:0}}>
                                  {new Date(day).getDate()}
                                </div>
                                <div>
                                  <div style={{fontWeight:700,fontSize:14,textTransform:"capitalize"}}>{dateLabel}</div>
                                  <div style={{fontSize:12,color:"#475569"}}>{items.length} opération{items.length>1?"s":""}</div>
                                </div>
                              </div>
                              <div style={{display:"flex",alignItems:"center",gap:16}}>
                                <span style={{fontWeight:800,fontSize:15,color:histTab==="ventes"?"#4ade80":"#38bdf8"}}>
                                  {histTab==="ventes"?fmtEur(dayTotal):`+${dayTotal} unités`}
                                </span>
                                <span style={{color:"#475569",fontSize:18,transition:"transform .2s",transform:isOpen?"rotate(90deg)":"rotate(0deg)"}}>›</span>
                              </div>
                            </div>

                            {/* Détail du jour */}
                            {isOpen&&(
                              <table style={{width:"100%",borderCollapse:"collapse"}}>
                                <thead>
                                  <tr style={{borderBottom:"1px solid #1e1e35",background:"#0d0d1a"}}>
                                    {histTab==="ventes"
                                      ?["Heure","Article","Qté","Montant","Opérateur"].map(h=><th key={h} style={{padding:"10px 18px",textAlign:"left",fontSize:10,color:"#334155",fontWeight:700,letterSpacing:.8}}>{h.toUpperCase()}</th>)
                                      :["Heure","Article","Qté ajoutée","Opérateur"].map(h=><th key={h} style={{padding:"10px 18px",textAlign:"left",fontSize:10,color:"#334155",fontWeight:700,letterSpacing:.8}}>{h.toUpperCase()}</th>)
                                    }
                                  </tr>
                                </thead>
                                <tbody>
                                  {[...items].sort((a,b)=>b.date.localeCompare(a.date)).map((s,i)=>(
                                    <tr key={s.id} style={{borderBottom:"1px solid #1e1e3520",background:i%2?"rgba(255,255,255,.01)":"transparent"}}>
                                      <td style={{padding:"11px 18px",fontSize:12,color:"#475569",whiteSpace:"nowrap"}}>{new Date(s.date).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</td>
                                      <td style={{padding:"11px 18px",fontWeight:600,fontSize:13}}>{s.productName}</td>
                                      <td style={{padding:"11px 18px",color:"#38bdf8",fontWeight:600}}>×{s.qty}</td>
                                      {histTab==="ventes"&&<td style={{padding:"11px 18px",color:"#4ade80",fontWeight:700}}>{fmtEur(s.amount)}</td>}
                                      <td style={{padding:"11px 18px"}}><span style={{background:"#1e1e35",borderRadius:6,padding:"2px 8px",fontSize:11,color:"#818cf8",fontWeight:600}}>{s.by||"—"}</span></td>
                                    </tr>
                                  ))}
                                </tbody>
                                {items.length>1&&histTab==="ventes"&&(
                                  <tfoot>
                                    <tr style={{borderTop:"1px solid #1e1e35",background:"#0d0d1a"}}>
                                      <td colSpan={3} style={{padding:"10px 18px",fontSize:12,color:"#475569",fontWeight:600}}>Total du jour</td>
                                      <td style={{padding:"10px 18px",color:"#4ade80",fontWeight:800,fontSize:14}}>{fmtEur(dayTotal)}</td>
                                      <td/>
                                    </tr>
                                  </tfoot>
                                )}
                              </table>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ══ CLASSEMENT ══ */}
          {view==="top"&&(
            <div className="fade-up">
              <div style={{marginBottom:26}}>
                <h1 style={{fontSize:26,fontWeight:800,letterSpacing:"-.5px",marginBottom:4}}>Classement</h1>
                <p style={{color:"#475569",fontSize:14}}>Temps réel · Firebase</p>
              </div>
              <div style={{display:"grid",gap:12}}>
                {topSellers.map((p,i)=>{
                  const cat=getCat(p.categoryId);const mx=Math.max(...products.map(x=>x.sold),1);
                  return(
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
      {sellModal&&(
        <div className="modal-bg" onClick={()=>setSellModal(null)}>
          <div className="card m-in" style={{padding:32,width:380,maxWidth:"100%"}} onClick={e=>e.stopPropagation()}>
            {(()=>{const cat=getCat(sellModal.categoryId);return(<>
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
      {addModal&&(
        <div className="modal-bg" onClick={()=>setAddModal(false)}>
          <div className="card m-in" style={{padding:32,width:440,maxWidth:"100%"}} onClick={e=>e.stopPropagation()}>
            <h2 style={{fontWeight:800,fontSize:20,marginBottom:24}}>Nouvel article</h2>
            <div style={{display:"grid",gap:14}}>
              {[["Nom","text","name","Ex: Perrier…"],["Prix (FCFA)","number","price","500"],["Stock initial","number","stock","24"],["Seuil alerte","number","minStock","6"],["Unité","text","unit","bouteille…"]].map(([l,t,k,ph])=>(
                <div key={k}><label style={{fontSize:11,color:"#475569",display:"block",marginBottom:6,fontWeight:700,letterSpacing:.8}}>{l.toUpperCase()}</label>
                <input className="input" type={t} placeholder={ph} value={newP[k]} onChange={e=>setNewP(x=>({...x,[k]:e.target.value}))}/></div>
              ))}
              <div><label style={{fontSize:11,color:"#475569",display:"block",marginBottom:6,fontWeight:700,letterSpacing:.8}}>CATÉGORIE</label>
              <select className="input" value={newP.categoryId} onChange={e=>setNewP(x=>({...x,categoryId:e.target.value}))}>
                {categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select></div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:24}}>
              <button className="btn" style={{flex:1,background:"#1e1e35",color:"#64748b",padding:13,border:"1px solid #2d2d45"}} onClick={()=>setAddModal(false)}>Annuler</button>
              <button className="btn" style={{flex:2,background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",padding:13,fontSize:15}} onClick={handleAdd}>+ Ajouter</button>
            </div>
          </div>
        </div>
      )}
      {editModal&&(
        <div className="modal-bg" onClick={()=>setEditModal(null)}>
          <div className="card m-in" style={{padding:32,width:440,maxWidth:"100%"}} onClick={e=>e.stopPropagation()}>
            <h2 style={{fontWeight:800,fontSize:20,marginBottom:24}}>Modifier l'article</h2>
            <div style={{display:"grid",gap:14}}>
              {[["Nom","text","name"],["Prix (FCFA)","number","price"],["Stock actuel","number","stock"],["Seuil alerte","number","minStock"],["Unité","text","unit"]].map(([l,t,k])=>(
                <div key={k}><label style={{fontSize:11,color:"#475569",display:"block",marginBottom:6,fontWeight:700,letterSpacing:.8}}>{l.toUpperCase()}</label>
                <input className="input" type={t} value={editModal[k]} onChange={e=>setEditModal(x=>({...x,[k]:e.target.value}))}/></div>
              ))}
              <div><label style={{fontSize:11,color:"#475569",display:"block",marginBottom:6,fontWeight:700,letterSpacing:.8}}>CATÉGORIE</label>
              <select className="input" value={editModal.categoryId} onChange={e=>setEditModal(x=>({...x,categoryId:e.target.value}))}>
                {categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select></div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:24}}>
              <button className="btn" style={{flex:1,background:"#1e1e35",color:"#64748b",padding:13,border:"1px solid #2d2d45"}} onClick={()=>setEditModal(null)}>Annuler</button>
              <button className="btn" style={{flex:2,background:"linear-gradient(135deg,#38bdf8,#818cf8)",color:"#fff",padding:13,fontSize:15}} onClick={handleEdit}>✓ Enregistrer</button>
            </div>
          </div>
        </div>
      )}
      {restockModal&&(
        <div className="modal-bg" onClick={()=>setRestockModal(null)}>
          <div className="card m-in" style={{padding:32,width:380,maxWidth:"100%"}} onClick={e=>e.stopPropagation()}>
            {(()=>{const cat=getCat(restockModal.categoryId);return(<>
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
      {catModal&&(
        <div className="modal-bg" onClick={()=>setCatModal(false)}>
          <div className="card m-in" style={{padding:32,width:500,maxWidth:"100%",maxHeight:"85vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <h2 style={{fontWeight:800,fontSize:20,marginBottom:6}}>🏷️ Catégories</h2>
            <p style={{color:"#475569",fontSize:13,marginBottom:24}}>Gérez vos catégories d'articles</p>
            <div style={{display:"grid",gap:8,marginBottom:28}}>
              {categories.map(c=>{const used=products.filter(p=>p.categoryId===c.id).length;return(
                <div key={c.id} style={{background:"#1a1a2e",border:"1px solid #1e1e35",borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:38,height:38,borderRadius:10,background:`${c.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{c.icon}</div>
                  <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14}}>{c.name}</div><div style={{fontSize:12,color:"#475569"}}>{used} article{used!==1?"s":""}</div></div>
                  <div style={{width:10,height:10,borderRadius:"50%",background:c.color,flexShrink:0}}/>
                  <button className="icon-btn" style={{color:"#ef4444"}} onClick={()=>handleDeleteCat(c.id)}>🗑</button>
                </div>
              );})}
            </div>
            <div style={{background:"#1a1a2e",border:"1px solid #2d2d45",borderRadius:14,padding:20}}>
              <h3 style={{fontWeight:700,fontSize:14,marginBottom:16,color:"#818cf8"}}>+ Nouvelle catégorie</h3>
              <div style={{display:"grid",gap:12}}>
                <div><label style={{fontSize:11,color:"#475569",display:"block",marginBottom:6,fontWeight:700,letterSpacing:.8}}>NOM</label>
                <input className="input" placeholder="Ex: Cocktail, Snack…" value={newCatName} onChange={e=>setNewCatName(e.target.value)}/></div>
                <div><label style={{fontSize:11,color:"#475569",display:"block",marginBottom:8,fontWeight:700,letterSpacing:.8}}>ICÔNE</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {ICON_LIST.map(ic=>(<button key={ic} className="btn" onClick={()=>setNewCatIcon(ic)} style={{width:36,height:36,fontSize:18,background:newCatIcon===ic?"#2d2d55":"#16162a",border:`1.5px solid ${newCatIcon===ic?"#818cf8":"#1e1e35"}`}}>{ic}</button>))}
                </div></div>
                <div><label style={{fontSize:11,color:"#475569",display:"block",marginBottom:8,fontWeight:700,letterSpacing:.8}}>COULEUR</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {COLOR_PALETTE.map(col=>(<button key={col} className="btn" onClick={()=>setNewCatColor(col)} style={{width:28,height:28,borderRadius:"50%",background:col,border:newCatColor===col?"3px solid #fff":"3px solid transparent",padding:0}}/>))}
                </div></div>
                {newCatName&&(
                  <div style={{display:"flex",alignItems:"center",gap:10,background:"#16162a",border:"1px solid #2d2d45",borderRadius:10,padding:"10px 14px"}}>
                    <div style={{width:34,height:34,borderRadius:10,background:`${newCatColor}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{newCatIcon}</div>
                    <span className="pill" style={{background:`${newCatColor}20`,color:newCatColor}}>{newCatName}</span>
                    <span style={{fontSize:12,color:"#334155"}}>← Aperçu</span>
                  </div>
                )}
              </div>
              <button className="btn" style={{width:"100%",background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",padding:"12px 0",fontSize:14,marginTop:16}} onClick={handleAddCat}>+ Créer la catégorie</button>
            </div>
            <button className="btn" style={{width:"100%",background:"#1e1e35",color:"#64748b",padding:12,marginTop:14,border:"1px solid #2d2d45"}} onClick={()=>setCatModal(false)}>Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}
