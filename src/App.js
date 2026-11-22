import { useState, useEffect, useRef } from "react";
import { dbGet, dbSet, dbListen, watchAuth, getProfile, logout, waitPending } from "./firebase";
import CSS from "./styles";
import { LoginScreen, UsersModal } from "./Auth";

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

function Main({ me }) {
  const isAdmin = me.role === "admin";
  const [usersModal, setUsersModal] = useState(false);
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
  const [topMonth,    setTopMonth]   = useState(() => { const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`; });
  const [topMode,     setTopMode]    = useState("mois"); // "mois" | "global"
  const [filterCat,   setFilterCat]  = useState("all");
  const [search,      setSearch]     = useState("");
  const [tableEdits,  setTableEdits] = useState({});
  const [tableSaving, setTableSaving]= useState(false);

  const [sellModal,    setSellModal]   = useState(null);
  const [sellQty,      setSellQty]     = useState(1);
  const [sellDate,     setSellDate]    = useState("");
  const [sellPromo,    setSellPromo]   = useState(""); // prix promo modal vente
  const [tableDate,    setTableDate]   = useState(""); // date custom pour tableau
  const [editSaleModal,setEditSaleModal]=useState(null); // édition d'une vente existante
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
  const toastTimer = useRef(null);
  const quickBusy  = useRef(false);
  const [journal, setJournal] = useState([]);
  const [journalSearch, setJournalSearch] = useState("");

  const toast$ = (msg, type="ok", undo=null) => {
    setToast({msg,type,undo});
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(()=>setToast(null), undo?6000:3000);
  };

  // Journal des modifications (admin uniquement : les vendeurs n'ont pas le droit d'écrire ce document)
  const logAction = async (action, detail) => {
    if (!isAdmin) return;
    try {
      const j = await dbGet("journal") || [];
      const entry = {id:`${Date.now()}_${Math.random().toString(36).slice(2,5)}`,date:new Date().toISOString(),by:me.name||me.email,action,detail};
      const nj = [...j, entry].slice(-500);
      setJournal(nj); await dbSet("journal", nj);
    } catch (e) { console.error("journal", e); }
  };

  useEffect(() => {
    const init = async () => {
      const [cp,cs,cc,cr] = await Promise.all([dbGet("products"),dbGet("sales"),dbGet("categories"),dbGet("reappros")]);
      if (cp) setProducts(cp); if (cs) setSales(cs); if (cc) setCategories(cc); if (cr) setReappros(cr);
      if (isAdmin) { const cj = await dbGet("journal"); if (cj) setJournal(cj); }
      setLoaded(true);
    };
    init();
    const u1=dbListen("products", v=>setProducts(v));
    const u2=dbListen("sales",    v=>setSales(v));
    const u3=dbListen("categories",v=>setCategories(v));
    const u4=dbListen("reappros", v=>setReappros(v));
    const u5=isAdmin?dbListen("journal",v=>setJournal(v)):()=>{};
    return ()=>{ u1(); u2(); u3(); u4(); u5(); };
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
    const saleDate = sellDate ? new Date(sellDate).toISOString() : new Date().toISOString();
    const promoPrice = sellPromo&&+sellPromo>0&&+sellPromo<p.price ? +sellPromo : null;
    const unitPrice = promoPrice || p.price;
    const ns = {id:Date.now(),productId:p.id,productName:p.name,qty:sellQty,amount:unitPrice*sellQty,promo:promoPrice,date:saleDate,by:me.name||me.email};
    await Promise.all([saveP(upP),saveS([...latS,ns])]);
    const rem=p.stock-sellQty;
    if (rem<=p.minStock) toast$(`⚠️ Stock bas : ${p.name} (${rem} restants)`,"warn");
    else toast$(`✓ ${sellQty}× ${p.name}${promoPrice?` — promo ${fmtEur(promoPrice)}`:"" }`);
    setSellModal(null); setSellQty(1); setSellDate(""); setSellPromo("");
  };

  // Export CSV (séparateur ; et BOM pour une ouverture directe dans Excel FR)
  const exportCsv = (monthOnly) => {
    const isV = histTab==="ventes";
    const data = (isV?sales:reappros).filter(x=>!monthOnly||x.date.startsWith(histMonth)).sort((a,b)=>a.date.localeCompare(b.date));
    if (!data.length) { toast$("Rien à exporter","err"); return; }
    const esc = (v)=>`"${String(v??"").replace(/"/g,'""')}"`;
    const num = (n)=>String(Math.round(n*100)/100).replace(".",",");
    const head = isV ? ["Date","Heure","Article","Quantité","Prix unitaire","Montant","Promo","Vendeur"] : ["Date","Heure","Article","Quantité ajoutée","Opérateur"];
    const rows = data.map(x=>{
      const d=new Date(x.date);
      const base=[d.toLocaleDateString("fr-FR"),d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}),x.productName,x.qty];
      return isV ? [...base,num(x.amount/x.qty),num(x.amount),x.promo?"oui":"non",x.by||""] : [...base,x.by||""];
    });
    const csv = "\uFEFF"+[head,...rows].map(r=>r.map(esc).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    const a = document.createElement("a");
    a.href=url; a.download=`hotelbar_${isV?"ventes":"reappros"}_${monthOnly?histMonth:"tout"}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast$(`✓ ${data.length} ligne(s) exportée(s)`);
  };

  const undoSale = async (sale) => {
    const latest = await dbGet("products")||products;
    const latS   = await dbGet("sales")||sales;
    if (!latS.some(x=>x.id===sale.id)) return;
    await Promise.all([
      saveP(latest.map(x=>x.id===sale.productId?{...x,stock:x.stock+sale.qty,sold:Math.max(0,x.sold-sale.qty)}:x)),
      saveS(latS.filter(x=>x.id!==sale.id)),
    ]);
    toast$("Vente annulée","warn");
  };

  const handleQuickSell = async (p0) => {
    if (quickBusy.current) return;
    quickBusy.current = true;
    try {
      const latest = await dbGet("products")||products;
      const p = latest.find(x=>x.id===p0.id);
      if (!p||p.stock<1) { toast$("Stock épuisé !","err"); return; }
      const latS = await dbGet("sales")||sales;
      const sale = {id:Date.now(),productId:p.id,productName:p.name,qty:1,amount:p.price,promo:null,date:new Date().toISOString(),by:me.name||me.email};
      await Promise.all([saveP(latest.map(x=>x.id===p.id?{...x,stock:x.stock-1,sold:x.sold+1}:x)),saveS([...latS,sale])]);
      const rem = p.stock-1;
      toast$(rem<=p.minStock?`⚠️ ${p.name} vendu — stock bas (${rem})`:`✓ 1× ${p.name} — ${fmtEur(p.price)}`, rem<=p.minStock?"warn":"ok", ()=>undoSale(sale));
    } finally { quickBusy.current = false; }
  };

  const handleAdd = async () => {
    if (!isAdmin) return;
    if (!newP.name||!newP.price||!newP.stock) { toast$("Champs manquants","err"); return; }
    const prod={...newP,id:Date.now(),price:+newP.price,stock:+newP.stock,minStock:+newP.minStock||10,sold:0};
    const latest=await dbGet("products")||products;
    await saveP([...latest,prod]);
    logAction("Article ajouté",`${prod.name} — ${fmtEur(prod.price)}, stock ${prod.stock}`);
    setNewP({name:"",categoryId:categories[0]?.id||"soft",price:"",stock:"",minStock:"",unit:"bouteille"});
    setAddModal(false); toast$(`${prod.name} ajouté !`);
  };

  const handleEdit = async () => {
    if (!isAdmin) return;
    if (!editModal.name||!editModal.price||editModal.stock==="") { toast$("Champs manquants","err"); return; }
    const latest=await dbGet("products")||products;
    const old=latest.find(p=>p.id===editModal.id)||{};
    const upd={...old,...editModal,price:+editModal.price,stock:+editModal.stock,minStock:+editModal.minStock,sold:old.sold||0};
    await saveP(latest.map(p=>p.id===editModal.id?upd:p));
    const changes=[["name","nom"],["categoryId","catégorie"],["price","prix"],["stock","stock"],["minStock","seuil"],["unit","unité"]]
      .filter(([k])=>String(old[k])!==String(upd[k])).map(([k,l])=>`${l} : ${old[k]} → ${upd[k]}`);
    if (changes.length) logAction("Article modifié",`${upd.name} — ${changes.join(", ")}`);
    setEditModal(null); toast$("Article mis à jour !");
  };

  const handleRestock = async () => {
    if (!isAdmin) return;
    const latest=await dbGet("products")||products;
    const p=latest.find(x=>x.id===restockModal.id);
    await saveP(latest.map(x=>x.id===restockModal.id?{...x,stock:x.stock+ +restockQty}:x));
    // Sauvegarder dans l'historique réappros
    const latestReappros=await dbGet("reappros")||reappros;
    const nr={id:Date.now(),productId:restockModal.id,productName:restockModal.name,qty:+restockQty,date:new Date().toISOString(),by:me.name||me.email};
    setReappros([...latestReappros,nr]);
    await dbSet("reappros",[...latestReappros,nr]);
    logAction("Réapprovisionnement",`${restockModal.name} +${+restockQty}`);
    toast$("Stock réapprovisionné !"); setRestockModal(null); setRestockQty(0);
  };

  const handleDelete = async (id) => {
    if (!isAdmin) return;
    if (!window.confirm("Supprimer cet article ?")) return;
    const latest=await dbGet("products")||products;
    const gone=latest.find(p=>p.id===id);
    await saveP(latest.filter(p=>p.id!==id)); toast$("Supprimé","warn");
    logAction("Article supprimé",gone?`${gone.name} (stock ${gone.stock})`:String(id));
  };

  const handleAddCat = async () => {
    if (!isAdmin) return;
    if (!newCatName.trim()) { toast$("Nom requis","err"); return; }
    const id=newCatName.toLowerCase().replace(/\s+/g,"_").replace(/[^a-z0-9_]/g,"")+"_"+Date.now();
    await saveC([...categories,{id,name:newCatName.trim(),color:newCatColor,icon:newCatIcon}]);
    logAction("Catégorie créée",newCatName.trim());
    setNewCatName(""); toast$(`Catégorie "${newCatName.trim()}" créée !`);
  };

  const handleDeleteCat = async (id) => {
    if (!isAdmin) return;
    if (products.some(p=>p.categoryId===id)) { toast$("Des articles utilisent cette catégorie !","err"); return; }
    if (!window.confirm("Supprimer cette catégorie ?")) return;
    const cname=categories.find(c=>c.id===id)?.name||id;
    await saveC(categories.filter(c=>c.id!==id)); toast$("Catégorie supprimée","warn");
    logAction("Catégorie supprimée",cname);
  };

  const handleEditSale = async () => {
    if (!isAdmin) return;
    if (!editSaleModal) return;
    const latS = await dbGet("sales")||sales;
    const updated = latS.map(s=>s.id===editSaleModal.id
      ? {...s, qty:+editSaleModal.qty, amount:+editSaleModal.qty*(editSaleModal.price||s.amount/s.qty), date:editSaleModal.date?new Date(editSaleModal.date).toISOString():s.date}
      : s);
    await saveS(updated);
    const os=latS.find(x=>x.id===editSaleModal.id);
    if (os) logAction("Vente modifiée",`${os.productName} — qté ${os.qty} → ${+editSaleModal.qty}, date ${os.date.slice(0,10)} → ${editSaleModal.date||os.date.slice(0,10)}`);
    setEditSaleModal(null); toast$("Vente modifiée !");
  };

  const handleTableValidate = async () => {
    const hasChanges=Object.values(tableEdits).some(e=>(parseInt(e.sell)||0)>0||(isAdmin&&(parseInt(e.restock)||0)>0));
    if (!hasChanges) { toast$("Aucune modification à enregistrer","err"); return; }
    setTableSaving(true);
    const latest=await dbGet("products")||products;
    const latestSales=await dbGet("sales")||sales;
    const latestReappros=await dbGet("reappros")||[];
    const newSales=[];
    const newReappros=[];
    const useDate = tableDate ? new Date(tableDate).toISOString() : new Date().toISOString();
    const updatedProds=latest.map(p=>{
      const edits=tableEdits[p.id]||{};
      const sellQ=parseInt(edits.sell)||0;
      const restQ=isAdmin?(parseInt(edits.restock)||0):0;
      if (sellQ>p.stock) return p;
      if (sellQ>0) newSales.push({id:Date.now()+p.id,productId:p.id,productName:p.name,qty:sellQ,
        amount:(parseFloat(edits.promo)>0?parseFloat(edits.promo):p.price)*sellQ,
        promo:parseFloat(edits.promo)>0?parseFloat(edits.promo):null,
        date:useDate,by:me.name||me.email});
      if (restQ>0) newReappros.push({id:Date.now()+p.id+1,productId:p.id,productName:p.name,qty:restQ,date:useDate,by:me.name||me.email});
      return {...p,stock:p.stock-sellQ+restQ,sold:p.sold+sellQ};
    });
    await Promise.all([saveP(updatedProds),saveS([...latestSales,...newSales]),...(newReappros.length?[dbSet("reappros",[...latestReappros,...newReappros])]:[])]);
    if (isAdmin&&(newSales.length||newReappros.length)) logAction("Tableau validé",`${newSales.length} vente(s), ${newReappros.length} réappro(s) — ${tableDate||"aujourd'hui"}`);
    setTableEdits({}); setTableSaving(false);
    toast$(`✓ ${newSales.length} vente(s) et ${newReappros.length} réappro(s) — ${tableDate?new Date(tableDate).toLocaleDateString("fr-FR"):"aujourd'hui"}`);
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
      <style>{CSS}</style>

      {toast&&<div className="toast" style={{background:toast.type==="err"?"#ef4444":toast.type==="warn"?"#f59e0b":"#22c55e",color:"#fff"}}><span>{toast.type==="err"?"✕":toast.type==="warn"?"⚠":"✓"}</span>{toast.msg}{toast.undo&&<button className="btn" onClick={()=>{toast.undo();setToast(null);}} style={{marginLeft:8,background:"rgba(0,0,0,.28)",color:"#fff",padding:"5px 12px",fontSize:12}}>↶ Annuler</button>}</div>}

      <div className="app-shell" style={{display:"flex",minHeight:"100vh"}}>
        {/* ── Sidebar ── */}
        <aside className="sidebar" style={{width:224,background:"#0d0d1a",borderRight:"1px solid #1e1e35",padding:"24px 12px",display:"flex",flexDirection:"column",gap:4,position:"sticky",top:0,height:"100vh",flexShrink:0}}>
          <div className="sb-hide-m" style={{display:"flex",alignItems:"center",gap:12,padding:"4px 8px 24px"}}>
            <div style={{width:38,height:38,borderRadius:12,background:"linear-gradient(135deg,#4f46e5,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🏨</div>
            <div><div style={{fontWeight:800,fontSize:15,letterSpacing:"-.3px"}}>HôtelBar</div><div style={{fontSize:10,color:"#334155",letterSpacing:1}}>PRO</div></div>
          </div>
          {[["dashboard","📊","Dashboard"],["stock","📦",isAdmin?"Stocks":"Vendre"],["tableau","📋","Tableau"],["ventes","📜","Historique"],["top","🏆","Classement"],...(isAdmin?[["journal","🗒️","Journal"]]:[])].map(([v,ic,lb])=>(
            <button key={v} className={`sb-btn${view===v?" active":""}`} onClick={()=>setView(v)}>
              <span className="sb-ic" style={{fontSize:16}}>{ic}</span>{lb}
              {v==="stock"&&isAdmin&&lowStock.length>0&&<span style={{marginLeft:"auto",background:"#ef4444",color:"#fff",borderRadius:20,padding:"1px 8px",fontSize:11,fontWeight:800}}>{lowStock.length}</span>}
              {v==="tableau"&&Object.values(tableEdits).some(e=>(parseInt(e.sell)||0)>0||(parseInt(e.restock)||0)>0)&&<span style={{marginLeft:"auto",background:"#818cf8",color:"#fff",borderRadius:20,padding:"1px 8px",fontSize:11,fontWeight:800}}>●</span>}
            </button>
          ))}
          {isAdmin&&<>
            <div className="sb-hide-m" style={{height:1,background:"#1e1e35",margin:"12px 8px"}}/>
            <button className="sb-btn" onClick={()=>setCatModal(true)}><span className="sb-ic" style={{fontSize:16}}>🏷️</span>Catégories</button>
            <button className="sb-btn" onClick={()=>setUsersModal(true)}><span className="sb-ic" style={{fontSize:16}}>👥</span>Équipe</button>
          </>}
          <div className="sb-hide-m" style={{flex:1}}/>
          <div className="sb-user sb-hide-m">
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <div style={{width:30,height:30,borderRadius:10,background:"#1e1e35",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:13,color:"#818cf8",flexShrink:0}}>{(me.name||me.email||"?").charAt(0).toUpperCase()}</div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{me.name||me.email}</div>
                <span className="role-pill" style={{background:isAdmin?"rgba(129,140,248,.15)":"rgba(251,191,36,.15)",color:isAdmin?"#818cf8":"#fbbf24"}}>{isAdmin?"ADMIN":"VENDEUR"}</span>
              </div>
            </div>
            <button className="btn" onClick={logout} style={{width:"100%",background:"#1e1e35",color:"#94a3b8",border:"1px solid #2d2d45",padding:"8px 0",fontSize:12}}>↩ Déconnexion</button>
          </div>
          <button className="sb-btn only-m" onClick={logout}><span className="sb-ic" style={{fontSize:16}}>↩</span>Sortir</button>
        </aside>

        <main className="main-area" style={{flex:1,padding:"32px 36px",overflowY:"auto",minWidth:0}}>

          {/* ══ DASHBOARD ══ */}
          {view==="dashboard"&&(
            <div className="fade-up">
              {/* Header + sélecteur de mois */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",gap:12}}>
                <div>
                  <h1 style={{fontSize:26,fontWeight:800,letterSpacing:"-.5px",marginBottom:4}}>Bonjour {(me.name||"").split(" ")[0]||""} 👋</h1>
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
              <div className="kpi-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:18,marginBottom:26}}>
                {[
                  {label:"CA du mois",   val:fmtEur(monthCA),     sub: caEvol!==null?`${caEvol>=0?"▲":"▼"} ${Math.abs(caEvol)}% vs mois préc.`:`${monthSales.length} ventes`,  color:"#4ade80", icon:"💰"},
                  {label:"Nb ventes",    val:monthSales.length,   sub:`${[...new Set(monthSales.map(s=>s.date.slice(0,10)))].length} jours actifs`,                             color:"#818cf8", icon:"🧾"},
                  {label:"Valeur stock", val:fmtEur(stockVal),    sub:`${products.length} références`,                                                                           color:"#38bdf8", icon:"📦"},
                  {label:"Alertes",      val:lowStock.length,     sub:lowStock.length?"articles critiques":"Tout OK ✓",                                                          color:lowStock.length?"#ef4444":"#4ade80", icon:"⚠️"},
                ].map((k,i)=>(
                  <div key={i} className="stat" style={{"--c":k.color}}>
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

              <div className="two-col" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:22}}>
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
                        {isAdmin&&<button className="btn" style={{background:"#ef4444",color:"#fff",padding:"6px 14px",fontSize:12}}
                          onClick={()=>{setRestockModal(p);setRestockQty(p.minStock*2);setView("stock")}}>Réappro</button>}
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
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:26,flexWrap:"wrap",gap:12}}>
                <div>
                  <h1 style={{fontSize:26,fontWeight:800,letterSpacing:"-.5px",marginBottom:4}}>{isAdmin?"Stocks":"Vendre"}</h1>
                  <p style={{color:"#475569",fontSize:14}}>{products.length} articles · {lowStock.length} alerte(s)</p>
                </div>
                {isAdmin&&<button className="btn" style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",padding:"11px 22px",fontSize:14,boxShadow:"0 4px 20px rgba(99,102,241,.3)"}} onClick={()=>setAddModal(true)}>+ Nouvel article</button>}
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
                    <div key={p.id} className="prod-card" style={{"--c":cat.color,borderColor:isLow?"rgba(239,68,68,.8)":"#1e1e35",boxShadow:isLow?"0 0 20px rgba(239,68,68,.2)":""}}>
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
                        <button className="btn" style={{flex:1,background:`linear-gradient(135deg,${cat.color},${cat.color}aa)`,color:"#0f0f17",padding:"11px 0",fontSize:14,fontWeight:800,boxShadow:`0 6px 18px -6px ${cat.color}90`}} onClick={()=>{setSellModal(p);setSellQty(1)}}>💳 Vendre</button>
                        <button className="btn" disabled={p.stock<1} title="Vendre 1 au prix normal (annulable)" style={{background:`${cat.color}22`,color:cat.color,border:`1.5px solid ${cat.color}60`,padding:"11px 16px",fontSize:15,fontWeight:800,opacity:p.stock<1?.4:1}} onClick={()=>handleQuickSell(p)}>+1</button>
                        {isAdmin&&<><button className="btn" style={{background:"#1e1e35",color:"#94a3b8",border:"1px solid #2d2d45",padding:"9px 12px",fontSize:13}} title="Réapprovisionner" onClick={()=>{setRestockModal(p);setRestockQty(p.minStock*2)}}>📦</button>
                        <button className="btn" style={{background:"#1e1e35",color:"#818cf8",border:"1px solid #2d2d45",padding:"9px 12px",fontSize:13}} title="Modifier" onClick={()=>setEditModal({...p,price:p.price.toString(),stock:p.stock.toString(),minStock:p.minStock.toString()})}>✏️</button>
                        <button className="btn" style={{background:"rgba(239,68,68,.08)",color:"#ef4444",border:"1px solid rgba(239,68,68,.2)",padding:"9px 12px",fontSize:13}} title="Supprimer" onClick={()=>handleDelete(p.id)}>🗑</button></>}
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
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:26,flexWrap:"wrap",gap:12}}>
                <div>
                  <h1 style={{fontSize:26,fontWeight:800,letterSpacing:"-.5px",marginBottom:4}}>Tableau de gestion</h1>
                  <p style={{color:"#475569",fontSize:14}}>{isAdmin?"Saisie rapide — ventes et réappros en une seule fois":"Saisie rapide — enregistre toutes les ventes en une seule fois"}</p>
                </div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                  {/* Sélecteur de date pour le tableau */}
                  <div style={{display:"flex",alignItems:"center",gap:8,background:"#16162a",border:"1px solid #2d2d45",borderRadius:10,padding:"8px 14px"}}>
                    <span style={{fontSize:13,color:"#475569",whiteSpace:"nowrap"}}>📅 Date :</span>
                    <input type="date" value={tableDate} onChange={e=>setTableDate(e.target.value)}
                      style={{background:"transparent",border:"none",color:tableDate?"#e2e8f0":"#475569",fontFamily:"inherit",fontSize:13,outline:"none",cursor:"pointer"}}/>
                    {tableDate&&<button onClick={()=>setTableDate("")} style={{background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:14,padding:0}}>✕</button>}
                  </div>
                  {Object.values(tableEdits).some(e=>(parseInt(e.sell)||0)>0||(parseInt(e.restock)||0)>0)&&(
                    <button className="btn" style={{background:"rgba(239,68,68,.08)",color:"#ef4444",border:"1px solid rgba(239,68,68,.2)",padding:"10px 18px",fontSize:13}} onClick={()=>setTableEdits({})}>↺ Vider</button>
                  )}
                  <button className="btn" style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",padding:"11px 24px",fontSize:14,boxShadow:"0 4px 20px rgba(99,102,241,.3)",opacity:tableSaving?.6:1}} onClick={handleTableValidate} disabled={tableSaving}>
                    {tableSaving?"⏳ Enregistrement…":"✓ Tout valider"}
                  </button>
                </div>
              </div>
              <div className="card tbl-wrap" style={{overflow:"auto",maxHeight:"calc(100vh - 170px)"}}>
                <table style={{width:"100%",borderCollapse:"collapse",minWidth:820}}>
                  <thead>
                    <tr style={{borderBottom:"2px solid #1e1e35",background:"#0f0f1a"}}>
                      {["Article","Catégorie","Prix / u","Stock","Min","Ventes","Prix promo",...(isAdmin?["Réappro"]:[]),"Nouveau stock"].map(h=>(
                        <th key={h} style={{padding:"13px 14px",textAlign:"left",fontSize:11,color:h==="Prix promo"?"#f59e0b":"#475569",fontWeight:700,letterSpacing:.6,whiteSpace:"nowrap"}}>{h.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p,i)=>{
                      const cat=getCat(p.categoryId);
                      const isLow=p.stock<=p.minStock;
                      const edits=tableEdits[p.id]||{};
                      const sellQ=parseInt(edits.sell)||0;
                      const restQ=isAdmin?(parseInt(edits.restock)||0):0;
                      const promoVal=parseFloat(edits.promo)||0;
                      const effectivePrice = promoVal>0 ? promoVal : p.price; // prix promo si renseigné, sinon prix de base
                      const isPromo = promoVal>0 && promoVal<p.price;
                      const newSt=p.stock-sellQ+restQ;
                      const newLow=newSt<=p.minStock;
                      const setE=(field,val)=>setTableEdits(e=>({...e,[p.id]:{...(e[p.id]||{}),[field]:val}}));
                      return(
                        <tr key={p.id} style={{borderBottom:"1px solid #1e1e3530",background:isLow?"rgba(239,68,68,.04)":isPromo?"rgba(245,158,11,.03)":i%2?"rgba(255,255,255,.01)":"transparent"}}>
                          <td style={{padding:"11px 14px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <div style={{width:32,height:32,borderRadius:8,background:`${cat.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{cat.icon}</div>
                              <span style={{fontWeight:600,fontSize:14}}>{p.name}</span>
                              {isLow&&<span style={{fontSize:10,background:"rgba(239,68,68,.15)",color:"#ef4444",borderRadius:4,padding:"2px 6px",fontWeight:700}}>ALERTE</span>}
                              {isPromo&&<span style={{fontSize:10,background:"rgba(245,158,11,.15)",color:"#f59e0b",borderRadius:4,padding:"2px 6px",fontWeight:700}}>PROMO</span>}
                            </div>
                          </td>
                          <td style={{padding:"11px 14px"}}><span className="pill" style={{background:`${cat.color}18`,color:cat.color}}>{cat.name}</span></td>
                          <td style={{padding:"11px 14px",whiteSpace:"nowrap"}}>
                            <span style={{fontWeight:600,color:isPromo?"#475569":"#818cf8",textDecoration:isPromo?"line-through":"none",fontSize:isPromo?12:14}}>{fmtEur(p.price)}</span>
                            {isPromo&&<span style={{fontWeight:700,color:"#f59e0b",fontSize:14,marginLeft:6}}>{fmtEur(effectivePrice)}</span>}
                          </td>
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
                              {sellQ>0&&<span style={{fontSize:11,color:isPromo?"#f59e0b":"#818cf8",fontWeight:700,whiteSpace:"nowrap"}}>{fmtEur(effectivePrice*sellQ)}</span>}
                            </div>
                          </td>
                          {/* Prix promo */}
                          <td style={{padding:"8px 14px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:4}}>
                              <input className="tbl-in no-arrows" type="number" min="0" step="0.01" value={edits.promo||""} placeholder="—"
                                style={{width:70,borderColor:isPromo?"#f59e0b":"#2d2d45",color:isPromo?"#f59e0b":"#475569",fontWeight:isPromo?700:400}}
                                onChange={ev=>setE("promo",ev.target.value)}/>
                              {isPromo&&<button onClick={()=>setE("promo","")} style={{background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:13,padding:"0 2px"}}>✕</button>}
                            </div>
                            {isPromo&&<div style={{fontSize:10,color:"#f59e0b",marginTop:3}}>−{Math.round((1-promoVal/p.price)*100)}%</div>}
                          </td>
                          {/* Réappro */}
                          {isAdmin&&<td style={{padding:"8px 14px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:4}}>
                              <button className="sm-btn" onClick={()=>setE("restock",Math.max(0,restQ-1))}>−</button>
                              <input className="tbl-in" type="number" min="0" value={edits.restock||""} placeholder="0"
                                style={{borderColor:restQ>0?"#4ade80":"#2d2d45",color:restQ>0?"#4ade80":"#e2e8f0",fontWeight:restQ>0?700:400}}
                                onChange={ev=>setE("restock",ev.target.value)}/>
                              <button className="sm-btn" onClick={()=>setE("restock",restQ+1)}>+</button>
                              {restQ>0&&<span style={{fontSize:11,color:"#4ade80",fontWeight:700,marginLeft:2}}>+{restQ}</span>}
                            </div>
                          </td>}
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
                      💳 {Object.values(tableEdits).reduce((s,e)=>s+(parseInt(e.sell)||0),0)} vendus · CA : {fmtEur(products.reduce((s,p)=>{
                        const e=tableEdits[p.id]||{};
                        const q=parseInt(e.sell)||0;
                        const promo=parseFloat(e.promo)||0;
                        return s+q*(promo>0?promo:p.price);
                      },0))}
                    </span>
                    {products.some(p=>{const e=tableEdits[p.id]||{};return (parseFloat(e.promo)||0)>0&&(parseInt(e.sell)||0)>0;})&&(
                      <span style={{color:"#f59e0b",fontWeight:700,fontSize:13}}>🏷️ Promos appliquées</span>
                    )}
                    {isAdmin&&<span style={{color:"#4ade80",fontWeight:700,fontSize:13}}>
                      📦 {Object.values(tableEdits).reduce((s,e)=>s+(parseInt(e.restock)||0),0)} unités réapprovisionnées
                    </span>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ HISTORIQUE ══ */}
          {view==="ventes"&&(
            <div className="fade-up">
              {/* Header */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",gap:12}}>
                <div>
                  <h1 style={{fontSize:26,fontWeight:800,letterSpacing:"-.5px",marginBottom:4}}>Historique</h1>
                  <p style={{color:"#475569",fontSize:14}}>{sales.length} vente(s) · {reappros.length} réappro(s)</p>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
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
                  {isAdmin&&(histTab==="ventes"?sales:reappros).length>0&&<>
                    <button className="btn" style={{background:"#1e1e35",color:"#4ade80",border:"1px solid #2d2d45",padding:"8px 14px",fontSize:12}} onClick={()=>exportCsv(true)}>⬇ CSV du mois</button>
                    <button className="btn" style={{background:"#1e1e35",color:"#4ade80",border:"1px solid #2d2d45",padding:"8px 14px",fontSize:12}} onClick={()=>exportCsv(false)}>⬇ CSV tout</button>
                  </>}
                  {isAdmin&&(histTab==="ventes"?sales:reappros).length>0&&(
                    <button className="btn" style={{background:"rgba(239,68,68,.08)",color:"#ef4444",border:"1px solid rgba(239,68,68,.2)",padding:"8px 14px",fontSize:12,marginLeft:4}}
                      onClick={async()=>{
                        const what=histTab==="ventes"?"ventes":"réappros";
                        const typed=window.prompt(`⚠️ Action définitive : tout l'historique des ${what} (tous les mois) sera effacé.\n\nTape SUPPRIMER pour confirmer :`);
                        if (typed===null||typed.trim().toUpperCase()!=="SUPPRIMER") { if (typed!==null) toast$("Annulé — rien n'a été effacé","warn"); return; }
                        if (histTab==="ventes") {
                          await saveS([]);
                          const lp=await dbGet("products")||products;
                          await saveP(lp.map(x=>({...x,sold:0})));
                        } else { setReappros([]); await dbSet("reappros",[]); }
                        logAction("Historique effacé",`Tout l'historique des ${what}`);
                        toast$("Historique effacé","warn");
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
                    <div className="three-col" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
                      {(histTab==="ventes"?[
                        {label:"CA du mois",  val:fmtEur(monthTotal),        color:"#4ade80"},
                        {label:"Nb ventes",   val:monthData.length,          color:"#818cf8"},
                        {label:"Jours actifs",val:days.length,               color:"#38bdf8"},
                      ]:[
                        {label:"Total réappros",val:`${monthTotal} unités`,  color:"#4ade80"},
                        {label:"Nb opérations", val:monthData.length,        color:"#818cf8"},
                        {label:"Jours actifs",  val:days.length,             color:"#38bdf8"},
                      ]).map((k,i)=>(
                        <div key={i} className="stat" style={{padding:16,"--c":k.color}}>
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
                                      ?["Heure","Article","Qté","Montant","Opérateur",...(isAdmin?[""]:[])].map(h=><th key={h} style={{padding:"10px 18px",textAlign:"left",fontSize:10,color:"#334155",fontWeight:700,letterSpacing:.8}}>{h.toUpperCase()}</th>)
                                      :["Heure","Article","Qté ajoutée","Opérateur"].map(h=><th key={h} style={{padding:"10px 18px",textAlign:"left",fontSize:10,color:"#334155",fontWeight:700,letterSpacing:.8}}>{h.toUpperCase()}</th>)
                                    }
                                  </tr>
                                </thead>
                                <tbody>
                                  {[...items].sort((a,b)=>b.date.localeCompare(a.date)).map((s,i)=>(
                                    <tr key={s.id} style={{borderBottom:"1px solid #1e1e3520",background:i%2?"rgba(255,255,255,.01)":"transparent"}}>
                                      <td style={{padding:"11px 18px",fontSize:12,color:"#475569",whiteSpace:"nowrap"}}>{new Date(s.date).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</td>
                                      <td style={{padding:"11px 18px",fontWeight:600,fontSize:13}}>
                                        {s.productName}
                                        {s.promo&&<span style={{marginLeft:6,fontSize:10,background:"rgba(245,158,11,.15)",color:"#f59e0b",borderRadius:4,padding:"1px 5px",fontWeight:700}}>PROMO</span>}
                                      </td>
                                      <td style={{padding:"11px 18px",color:"#38bdf8",fontWeight:600}}>×{s.qty}</td>
                                      {histTab==="ventes"&&<td style={{padding:"11px 18px",color:"#4ade80",fontWeight:700}}>{fmtEur(s.amount)}</td>}
                                      <td style={{padding:"11px 18px"}}><span style={{background:"#1e1e35",borderRadius:6,padding:"2px 8px",fontSize:11,color:"#818cf8",fontWeight:600}}>{s.by||"—"}</span></td>
                                      {histTab==="ventes"&&isAdmin&&<td style={{padding:"8px 18px"}}>
                                        <button className="btn" style={{background:"#1e1e35",color:"#818cf8",border:"1px solid #2d2d45",padding:"4px 10px",fontSize:11}}
                                          onClick={()=>setEditSaleModal({...s,date:s.date.slice(0,10),price:+(s.amount/s.qty).toFixed(2)})}>✏️ Modifier</button>
                                      </td>}
                                    </tr>
                                  ))}
                                </tbody>
                                {items.length>1&&histTab==="ventes"&&(
                                  <tfoot>
                                    <tr style={{borderTop:"1px solid #1e1e35",background:"#0d0d1a"}}>
                                      <td colSpan={3} style={{padding:"10px 18px",fontSize:12,color:"#475569",fontWeight:600}}>Total du jour</td>
                                      <td style={{padding:"10px 18px",color:"#4ade80",fontWeight:800,fontSize:14}}>{fmtEur(dayTotal)}</td>
                                      <td/>{isAdmin&&<td/>}
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

          {/* ══ JOURNAL ══ */}
          {view==="journal"&&isAdmin&&(
            <div className="fade-up">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",gap:12}}>
                <div>
                  <h1 style={{fontSize:26,fontWeight:800,letterSpacing:"-.5px",marginBottom:4}}>Journal</h1>
                  <p style={{color:"#475569",fontSize:14}}>Qui a modifié quoi · {journal.length} action(s) (500 dernières conservées)</p>
                </div>
                <input className="input" placeholder="🔍 Rechercher (nom, article, action…)" value={journalSearch} onChange={e=>setJournalSearch(e.target.value)} style={{width:280,maxWidth:"100%"}}/>
              </div>
              {(()=>{
                const q=journalSearch.trim().toLowerCase();
                const rows=[...journal].reverse().filter(e=>!q||`${e.by} ${e.action} ${e.detail}`.toLowerCase().includes(q));
                if (rows.length===0) return <div className="card" style={{padding:48,textAlign:"center",color:"#334155"}}>{journal.length?"Aucun résultat":"Aucune modification enregistrée pour l'instant"}</div>;
                const col=(a)=>/supprim|effac/i.test(a)?["rgba(239,68,68,.15)","#ef4444"]:/ajout|créé|Réappro/i.test(a)?["rgba(74,222,128,.13)","#4ade80"]:["rgba(129,140,248,.15)","#818cf8"];
                return (
                  <div className="card" style={{overflow:"hidden"}}>
                    {rows.map((e,i)=>{const [bg,fg]=col(e.action);return(
                      <div key={e.id} style={{display:"flex",gap:14,alignItems:"flex-start",padding:"13px 18px",borderTop:i?"1px solid #1e1e3540":"none",flexWrap:"wrap"}}>
                        <div style={{width:112,flexShrink:0,fontSize:12,color:"#475569"}}>
                          <div style={{fontWeight:700,color:"#64748b"}}>{new Date(e.date).toLocaleDateString("fr-FR",{day:"2-digit",month:"short"})}</div>
                          <div>{new Date(e.date).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</div>
                        </div>
                        <span className="pill" style={{background:bg,color:fg,flexShrink:0}}>{e.action}</span>
                        <div style={{flex:1,minWidth:200,fontSize:13}}>{e.detail}</div>
                        <span style={{background:"#1e1e35",borderRadius:6,padding:"2px 8px",fontSize:11,color:"#818cf8",fontWeight:600}}>{e.by}</span>
                      </div>
                    );})}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ══ CLASSEMENT ══ */}
          {view==="top"&&(
            <div className="fade-up">
              {/* Header */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",gap:12}}>
                <div>
                  <h1 style={{fontSize:26,fontWeight:800,letterSpacing:"-.5px",marginBottom:4}}>Classement</h1>
                  <p style={{color:"#475569",fontSize:14}}>
                    {topMode==="mois"?`${MOIS[(+topMonth.split("-")[1])-1]} ${topMonth.split("-")[0]}`:"Tous les temps"}
                  </p>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  {/* Toggle global/mois */}
                  <div style={{display:"flex",background:"#16162a",border:"1px solid #1e1e35",borderRadius:10,padding:3}}>
                    {[["mois","📅 Par mois"],["global","🌍 Global"]].map(([m,lb])=>(
                      <button key={m} className="btn" onClick={()=>setTopMode(m)}
                        style={{padding:"7px 16px",fontSize:13,background:topMode===m?"linear-gradient(135deg,#4f46e5,#7c3aed)":"transparent",color:topMode===m?"#fff":"#475569",borderRadius:8}}>
                        {lb}
                      </button>
                    ))}
                  </div>
                  {/* Sélecteur mois (visible seulement en mode mois) */}
                  {topMode==="mois"&&<>
                    <button className="btn" style={{background:"#1e1e35",color:"#94a3b8",border:"1px solid #2d2d45",width:32,height:32,fontSize:16,padding:0}}
                      onClick={()=>{ const [y,m]=topMonth.split("-");const d=new Date(+y,+m-2,1);setTopMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); }}>‹</button>
                    <div style={{background:"#16162a",border:"1px solid #2d2d45",borderRadius:10,padding:"7px 16px",fontWeight:700,fontSize:14,minWidth:140,textAlign:"center"}}>
                      {MOIS[(+topMonth.split("-")[1])-1]} {topMonth.split("-")[0]}
                    </div>
                    <button className="btn" style={{background:"#1e1e35",color:"#94a3b8",border:"1px solid #2d2d45",width:32,height:32,fontSize:16,padding:0}}
                      onClick={()=>{ const [y,m]=topMonth.split("-");const d=new Date(+y,+m,1);const next=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;if(next<=new Date().toISOString().slice(0,7))setTopMonth(next); }}>›</button>
                  </>}
                </div>
              </div>

              {(()=>{
                // Calcul du classement selon le mode
                const src = topMode==="global" ? sales : sales.filter(s=>s.date.startsWith(topMonth));
                const map={};
                src.forEach(s=>{
                  if (!map[s.productId]) {
                    const prod=products.find(p=>p.id===s.productId);
                    map[s.productId]={productId:s.productId,name:s.productName,categoryId:prod?.categoryId,qty:0,ca:0};
                  }
                  map[s.productId].qty+=s.qty;
                  map[s.productId].ca+=s.amount;
                });
                const ranked=Object.values(map).sort((a,b)=>b.ca-a.ca);

                const maxCA=Math.max(...ranked.map(r=>r.ca),1);
                const totalMonthCA=ranked.reduce((s,r)=>s+r.ca,0);
                const totalMonthQty=ranked.reduce((s,r)=>s+r.qty,0);

                if (ranked.length===0) return (
                  <div className="card" style={{padding:48,textAlign:"center"}}>
                    <div style={{fontSize:48,marginBottom:12}}>🏆</div>
                    <p style={{color:"#334155"}}>Aucune vente {topMode==="mois"?"ce mois":"enregistrée"}</p>
                  </div>
                );

                return(
                  <div>
                    {/* Récap */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:20}}>
                      <div className="stat" style={{padding:16,"--c":"#4ade80"}}>
                        <div style={{fontSize:10,color:"#334155",fontWeight:700,letterSpacing:1,marginBottom:8}}>CA {topMode==="mois"?"DU MOIS":"TOTAL"}</div>
                        <div style={{fontSize:22,fontWeight:800,color:"#4ade80"}}>{fmtEur(totalMonthCA)}</div>
                      </div>
                      <div className="stat" style={{padding:16,"--c":"#818cf8"}}>
                        <div style={{fontSize:10,color:"#334155",fontWeight:700,letterSpacing:1,marginBottom:8}}>ARTICLES VENDUS</div>
                        <div style={{fontSize:22,fontWeight:800,color:"#818cf8"}}>{totalMonthQty}</div>
                      </div>
                    </div>

                    {/* Classement */}
                    <div style={{display:"grid",gap:10}}>
                      {ranked.map((r,i)=>{
                        const cat=getCat(r.categoryId);
                        const share=totalMonthCA>0?Math.round((r.ca/totalMonthCA)*100):0;
                        return(
                          <div key={r.productId||i} className="card" style={{padding:"16px 20px",display:"flex",alignItems:"center",gap:16,transition:"border-color .2s"}}>
                            {/* Médaille */}
                            <div style={{width:44,height:44,borderRadius:12,background:i<3?`${["#fbbf24","#94a3b8","#d97706"][i]}18`:"#1e1e35",display:"flex",alignItems:"center",justifyContent:"center",fontSize:i<3?22:13,fontWeight:800,color:i<3?["#fbbf24","#94a3b8","#d97706"][i]:"#334155",flexShrink:0}}>
                              {i<3?["🥇","🥈","🥉"][i]:`#${i+1}`}
                            </div>
                            {/* Info */}
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                                <span style={{fontWeight:700,fontSize:15}}>{cat.icon} {r.name}</span>
                                <span className="pill" style={{background:`${cat.color}18`,color:cat.color}}>{cat.name}</span>
                                <span style={{marginLeft:"auto",fontSize:11,color:"#475569",fontWeight:600}}>{share}%</span>
                              </div>
                              <div className="prog-track" style={{maxWidth:340}}>
                                <div className="prog-fill" style={{width:`${(r.ca/maxCA)*100}%`,background:i===0?"linear-gradient(90deg,#4f46e5,#818cf8)":cat.color}}/>
                              </div>
                              <div style={{fontSize:11,color:"#334155",marginTop:4}}>{r.qty} unités vendues</div>
                            </div>
                            {/* CA */}
                            <div style={{textAlign:"right",flexShrink:0}}>
                              <div style={{fontSize:20,fontWeight:800,color:"#4ade80"}}>{fmtEur(r.ca)}</div>
                              <div style={{fontSize:12,color:"#475569"}}>{fmtEur(r.ca/Math.max(r.qty,1))} / u</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </main>
      </div>

      {/* ════ MODALS ════ */}
      {sellModal&&(
        <div className="modal-bg" onClick={()=>{setSellModal(null);setSellDate("");setSellPromo("");}}>
          <div className="card m-in" style={{padding:32,width:400,maxWidth:"100%"}} onClick={e=>e.stopPropagation()}>
            {(()=>{const cat=getCat(sellModal.categoryId);return(<>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
                <div style={{width:46,height:46,borderRadius:14,background:`${cat.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{cat.icon}</div>
                <div><div style={{fontWeight:800,fontSize:18}}>{sellModal.name}</div><div style={{fontSize:13,color:"#475569"}}>{fmtEur(sellModal.price)} / {sellModal.unit}</div></div>
              </div>
              <label style={{fontSize:11,color:"#475569",display:"block",marginBottom:8,fontWeight:700,letterSpacing:.8}}>QUANTITÉ</label>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
                <button className="btn" style={{background:"#1e1e35",color:"#e2e8f0",width:44,height:44,fontSize:22,border:"1px solid #2d2d45"}} onClick={()=>setSellQty(q=>Math.max(1,q-1))}>−</button>
                <input className="input" type="number" min="1" max={sellModal.stock} value={sellQty} onChange={e=>setSellQty(+e.target.value)} style={{textAlign:"center",fontSize:22,fontWeight:800}}/>
                <button className="btn" style={{background:"#1e1e35",color:"#e2e8f0",width:44,height:44,fontSize:22,border:"1px solid #2d2d45"}} onClick={()=>setSellQty(q=>Math.min(sellModal.stock,q+1))}>+</button>
              </div>
              {/* Prix promo */}
              <div style={{marginBottom:16}}>
                <label style={{fontSize:11,color:"#475569",display:"block",marginBottom:6,fontWeight:700,letterSpacing:.8}}>
                  PRIX PROMO <span style={{color:"#334155",fontWeight:400}}>(optionnel — prix de base si vide)</span>
                </label>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <input className="input no-arrows" type="number" min="0" step="0.01" placeholder={`${sellModal.price} FCFA (prix de base)`}
                    value={sellPromo} onChange={e=>setSellPromo(e.target.value)}
                    style={{color:sellPromo&&+sellPromo>0&&+sellPromo<sellModal.price?"#f59e0b":"#e2e8f0",borderColor:sellPromo&&+sellPromo>0&&+sellPromo<sellModal.price?"#f59e0b":"#2d2d45"}}/>
                  {sellPromo&&+sellPromo>0&&<button onClick={()=>setSellPromo("")} style={{background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:16,flexShrink:0}}>✕</button>}
                </div>
                {sellPromo&&+sellPromo>0&&+sellPromo<sellModal.price&&(
                  <div style={{fontSize:12,color:"#f59e0b",marginTop:4}}>🏷️ Réduction de {Math.round((1-+sellPromo/sellModal.price)*100)}%</div>
                )}
              </div>
              {/* Date */}
              <div style={{marginBottom:16}}>
                <label style={{fontSize:11,color:"#475569",display:"block",marginBottom:6,fontWeight:700,letterSpacing:.8}}>DATE (optionnel — aujourd'hui par défaut)</label>
                <input className="input" type="date" value={sellDate} onChange={e=>setSellDate(e.target.value)}
                  style={{color:sellDate?"#e2e8f0":"#475569"}}/>
              </div>
              <div style={{background:"rgba(129,140,248,.08)",border:`1px solid ${sellPromo&&+sellPromo>0&&+sellPromo<sellModal.price?"rgba(245,158,11,.3)":"rgba(129,140,248,.2)"}`,borderRadius:12,padding:"14px 18px",marginBottom:22,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{color:"#64748b"}}>{sellDate?new Date(sellDate).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"}):"Aujourd'hui"}</span>
                <span style={{fontWeight:800,fontSize:24,color:sellPromo&&+sellPromo>0&&+sellPromo<sellModal.price?"#f59e0b":"#818cf8"}}>
                  {fmtEur((sellPromo&&+sellPromo>0&&+sellPromo<sellModal.price?+sellPromo:sellModal.price)*sellQty)}
                </span>
              </div>
              <div style={{display:"flex",gap:10}}>
                <button className="btn" style={{flex:1,background:"#1e1e35",color:"#64748b",padding:13,border:"1px solid #2d2d45"}} onClick={()=>{setSellModal(null);setSellDate("");setSellPromo("");}}>Annuler</button>
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

      {usersModal&&isAdmin&&<UsersModal me={me} onClose={()=>setUsersModal(false)} toast={toast$}/>}

      {/* Modal édition vente */}
      {editSaleModal&&(
        <div className="modal-bg" onClick={()=>setEditSaleModal(null)}>
          <div className="card m-in" style={{padding:32,width:400,maxWidth:"100%"}} onClick={e=>e.stopPropagation()}>
            <h2 style={{fontWeight:800,fontSize:18,marginBottom:6}}>✏️ Modifier la vente</h2>
            <p style={{color:"#475569",fontSize:13,marginBottom:20}}>{editSaleModal.productName}</p>
            <div style={{display:"grid",gap:14}}>
              <div>
                <label style={{fontSize:11,color:"#475569",display:"block",marginBottom:6,fontWeight:700,letterSpacing:.8}}>DATE</label>
                <input className="input" type="date" value={editSaleModal.date}
                  onChange={e=>setEditSaleModal(x=>({...x,date:e.target.value}))}/>
              </div>
              <div>
                <label style={{fontSize:11,color:"#475569",display:"block",marginBottom:6,fontWeight:700,letterSpacing:.8}}>QUANTITÉ</label>
                <input className="input" type="number" min="1" value={editSaleModal.qty}
                  onChange={e=>setEditSaleModal(x=>({...x,qty:e.target.value}))}/>
              </div>
            </div>
            <div style={{background:"rgba(74,222,128,.07)",border:"1px solid rgba(74,222,128,.2)",borderRadius:10,padding:12,marginTop:16,marginBottom:20,display:"flex",justifyContent:"space-between"}}>
              <span style={{color:"#64748b",fontSize:13}}>Nouveau montant</span>
              <span style={{fontWeight:700,color:"#4ade80"}}>{fmtEur(+editSaleModal.qty*editSaleModal.price)}</span>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button className="btn" style={{flex:1,background:"#1e1e35",color:"#64748b",padding:13,border:"1px solid #2d2d45"}} onClick={()=>setEditSaleModal(null)}>Annuler</button>
              <button className="btn" style={{flex:2,background:"linear-gradient(135deg,#38bdf8,#818cf8)",color:"#fff",padding:13,fontSize:15}} onClick={handleEditSale}>✓ Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────── Authentification : choisit l'écran selon l'utilisateur ───────────── */
export default function App() {
  const [state, setState] = useState({ status: "loading" }); // loading | out | in
  const [notice, setNotice] = useState("");

  useEffect(() => watchAuth(async (u) => {
    if (!u) { setState({ status: "out" }); return; }
    await waitPending();
    const profile = await getProfile(u.uid);
    if (!profile) {
      setNotice("Ton compte n'a pas (ou plus) d'accès. Contacte l'administrateur.");
      await logout();
      return;
    }
    setNotice("");
    setState({ status: "in", me: { uid: u.uid, email: u.email, name: profile.name, role: profile.role === "admin" ? "admin" : "seller" } });
  }), []);

  if (state.status === "loading") return (
    <div style={{background:"#0f0f17",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:"#818cf8",fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{width:44,height:44,borderRadius:"50%",border:"3px solid #1e1e30",borderTopColor:"#818cf8",animation:"spin .9s linear infinite"}}/>
    </div>
  );
  if (state.status === "out") return <LoginScreen notice={notice}/>;
  return <Main key={state.me.uid} me={state.me}/>;
}
