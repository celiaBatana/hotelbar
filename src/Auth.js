import { useState, useEffect } from "react";
import CSS from "./styles";
import {
  login, resetPassword, setupAdmin, isSetupDone,
  createUserAccount, listUsers, removeUser, setUserRole,
} from "./firebase";

const authError = (e) => {
  switch (e?.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":      return "Email ou mot de passe incorrect.";
    case "auth/email-already-in-use": return "Cet email a déjà un compte.";
    case "auth/weak-password":      return "Mot de passe trop court (6 caractères minimum).";
    case "auth/too-many-requests":  return "Trop d'essais. Réessaie dans quelques minutes.";
    case "auth/network-request-failed": return "Pas de connexion internet.";
    case "auth/operation-not-allowed": return "La connexion par email n'est pas activée dans Firebase (Authentication → Sign-in method).";
    case "permission-denied":
    case "firestore/permission-denied": return "Accès refusé par Firebase (règles Firestore non à jour ?).";
    default: return e?.message || "Erreur inconnue.";
  }
};
export { authError };

const Logo = () => (
  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:26}}>
    <div style={{width:46,height:46,borderRadius:14,background:"linear-gradient(135deg,#4f46e5,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,boxShadow:"0 6px 24px rgba(99,102,241,.35)"}}>🏨</div>
    <div><div style={{fontWeight:800,fontSize:20,letterSpacing:"-.3px"}}>HôtelBar</div><div style={{fontSize:11,color:"#475569",letterSpacing:1.5}}>PRO</div></div>
  </div>
);

/* ───────────── Écran de connexion / première configuration ───────────── */
export function LoginScreen({ notice }) {
  const [setupDone, setSetupDone] = useState(null);
  const [mode, setMode]   = useState("login"); // login | setup
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw]       = useState("");
  const [pw2, setPw2]     = useState("");
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState(notice || "");
  const [info, setInfo]   = useState("");

  useEffect(() => { isSetupDone().then(setSetupDone); }, []);
  useEffect(() => { if (notice) setErr(notice); }, [notice]);

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setInfo("");
    if (mode === "setup") {
      if (!name.trim()) return setErr("Indique ton prénom / nom.");
      if (pw !== pw2)   return setErr("Les deux mots de passe sont différents.");
    }
    setBusy(true);
    try {
      if (mode === "setup") await setupAdmin(name, email, pw);
      else await login(email, pw);
    } catch (e2) { setErr(authError(e2)); setBusy(false); }
  };

  const forgot = async () => {
    setErr(""); setInfo("");
    if (!email.trim()) return setErr("Entre ton email puis clique à nouveau.");
    try { await resetPassword(email); setInfo("Email de réinitialisation envoyé (pense à regarder les spams)."); }
    catch (e2) { setErr(authError(e2)); }
  };

  return (
    <div className="login-wrap" style={{fontFamily:"'Plus Jakarta Sans',sans-serif",color:"#e2e8f0"}}>
      <style>{CSS}</style>
      <form className="card m-in" onSubmit={submit} style={{padding:34,width:400,maxWidth:"100%"}}>
        <Logo/>
        <h1 style={{fontSize:21,fontWeight:800,marginBottom:4}}>{mode==="setup"?"Créer le compte administrateur":"Connexion"}</h1>
        <p style={{color:"#475569",fontSize:13,marginBottom:22}}>
          {mode==="setup"?"Première utilisation : ce compte pourra tout gérer et créer les accès de l'équipe.":"Connecte-toi pour accéder au bar."}
        </p>
        <div style={{display:"grid",gap:14}}>
          {mode==="setup"&&<div><label className="lbl">PRÉNOM / NOM</label>
            <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="Célia" autoComplete="name"/></div>}
          <div><label className="lbl">EMAIL</label>
            <input className="input" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@exemple.com" autoComplete="username"/></div>
          <div><label className="lbl">MOT DE PASSE</label>
            <input className="input" type="password" required value={pw} onChange={e=>setPw(e.target.value)} autoComplete={mode==="setup"?"new-password":"current-password"}/></div>
          {mode==="setup"&&<div><label className="lbl">CONFIRMER LE MOT DE PASSE</label>
            <input className="input" type="password" required value={pw2} onChange={e=>setPw2(e.target.value)} autoComplete="new-password"/></div>}
        </div>
        {err&&<div style={{marginTop:14,background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.3)",color:"#fca5a5",borderRadius:10,padding:"10px 14px",fontSize:13}}>{err}</div>}
        {info&&<div style={{marginTop:14,background:"rgba(74,222,128,.08)",border:"1px solid rgba(74,222,128,.25)",color:"#86efac",borderRadius:10,padding:"10px 14px",fontSize:13}}>{info}</div>}
        <button className="btn" type="submit" disabled={busy} style={{width:"100%",marginTop:20,background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",padding:"13px 0",fontSize:15,boxShadow:"0 4px 20px rgba(99,102,241,.3)",opacity:busy?.6:1}}>
          {busy?"⏳ Patiente…":mode==="setup"?"Créer le compte":"Se connecter"}
        </button>
        {mode==="login"&&<button type="button" onClick={forgot} style={{background:"none",border:"none",color:"#818cf8",cursor:"pointer",fontFamily:"inherit",fontSize:13,marginTop:14,width:"100%"}}>Mot de passe oublié ?</button>}
        {setupDone===false&&(
          <button type="button" onClick={()=>{setMode(mode==="setup"?"login":"setup");setErr("");setInfo("");}}
            style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",fontFamily:"inherit",fontSize:12,marginTop:10,width:"100%"}}>
            {mode==="setup"?"← Retour à la connexion":"Première utilisation ? Créer le compte administrateur"}
          </button>
        )}
      </form>
    </div>
  );
}

/* ───────────── Gestion de l'équipe (admin) ───────────── */
export function UsersModal({ me, onClose, toast }) {
  const [users, setUsers] = useState(null);
  const [f, setF] = useState({ name: "", email: "", password: "", role: "seller" });
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try { setUsers((await listUsers()).sort((a,b)=>(a.name||"").localeCompare(b.name||""))); }
    catch (e) { setUsers([]); toast(authError(e), "err"); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const create = async () => {
    if (!f.name.trim() || !f.email.trim()) return toast("Nom et email requis", "err");
    if (f.password.length < 6) return toast("Mot de passe : 6 caractères minimum", "err");
    setBusy(true);
    try {
      await createUserAccount(f);
      toast(`Accès créé pour ${f.name.trim()} !`);
      setF({ name: "", email: "", password: "", role: "seller" });
      await refresh();
    } catch (e) { toast(authError(e), "err"); }
    setBusy(false);
  };

  const del = async (u) => {
    if (u.uid === me.uid) return toast("Tu ne peux pas retirer ton propre accès", "err");
    if (!window.confirm(`Retirer l'accès de ${u.name||u.email} ?`)) return;
    try { await removeUser(u.uid); toast("Accès retiré", "warn"); refresh(); }
    catch (e) { toast(authError(e), "err"); }
  };

  const toggleRole = async (u) => {
    if (u.uid === me.uid) return toast("Tu ne peux pas changer ton propre rôle", "err");
    const role = u.role === "admin" ? "seller" : "admin";
    if (!window.confirm(`Passer ${u.name||u.email} en ${role==="admin"?"administrateur":"vendeur"} ?`)) return;
    try { const { uid, ...rest } = u; await setUserRole(uid, { ...rest, role }); refresh(); }
    catch (e) { toast(authError(e), "err"); }
  };

  const reset = async (u) => {
    try { await resetPassword(u.email); toast(`Email de réinitialisation envoyé à ${u.email}`); }
    catch (e) { toast(authError(e), "err"); }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="card m-in modal-card" style={{padding:32,width:540,maxWidth:"100%",maxHeight:"88vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <h2 style={{fontWeight:800,fontSize:20,marginBottom:6}}>👥 Équipe & accès</h2>
        <p style={{color:"#475569",fontSize:13,marginBottom:22}}>
          <b style={{color:"#fbbf24"}}>Vendeur</b> : peut seulement enregistrer des ventes. <b style={{color:"#818cf8"}}>Admin</b> : accès complet.
        </p>

        <div style={{display:"grid",gap:8,marginBottom:26}}>
          {users===null&&<div style={{color:"#475569",fontSize:13}}>Chargement…</div>}
          {users&&users.map(u=>(
            <div key={u.uid} style={{background:"#1a1a2e",border:"1px solid #1e1e35",borderRadius:12,padding:"12px 14px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:150}}>
                <div style={{fontWeight:700,fontSize:14}}>{u.name||"—"} {u.uid===me.uid&&<span style={{color:"#475569",fontWeight:400,fontSize:12}}>(toi)</span>}</div>
                <div style={{fontSize:12,color:"#475569",wordBreak:"break-all"}}>{u.email}</div>
              </div>
              <span className="role-pill" style={{background:u.role==="admin"?"rgba(129,140,248,.15)":"rgba(251,191,36,.15)",color:u.role==="admin"?"#818cf8":"#fbbf24"}}>{u.role==="admin"?"ADMIN":"VENDEUR"}</span>
              {u.uid!==me.uid&&<>
                <button className="icon-btn" title="Changer le rôle" onClick={()=>toggleRole(u)}>🔁</button>
                <button className="icon-btn" title="Envoyer un lien de nouveau mot de passe" onClick={()=>reset(u)}>🔑</button>
                <button className="icon-btn" style={{color:"#ef4444"}} title="Retirer l'accès" onClick={()=>del(u)}>🗑</button>
              </>}
            </div>
          ))}
        </div>

        <div style={{background:"#1a1a2e",border:"1px solid #2d2d45",borderRadius:14,padding:20}}>
          <h3 style={{fontWeight:700,fontSize:14,marginBottom:14,color:"#818cf8"}}>+ Ajouter une personne</h3>
          <div style={{display:"grid",gap:12}}>
            <div><label className="lbl">NOM</label><input className="input" value={f.name} onChange={e=>setF(x=>({...x,name:e.target.value}))} placeholder="Ex: Awa"/></div>
            <div><label className="lbl">EMAIL</label><input className="input" type="email" value={f.email} onChange={e=>setF(x=>({...x,email:e.target.value}))} placeholder="awa@exemple.com"/></div>
            <div><label className="lbl">MOT DE PASSE (à lui communiquer)</label><input className="input" type="text" value={f.password} onChange={e=>setF(x=>({...x,password:e.target.value}))} placeholder="6 caractères minimum" autoComplete="off"/></div>
            <div><label className="lbl">RÔLE</label>
              <select className="input" value={f.role} onChange={e=>setF(x=>({...x,role:e.target.value}))}>
                <option value="seller">Vendeur — ventes uniquement</option>
                <option value="admin">Admin — accès complet</option>
              </select></div>
          </div>
          <button className="btn" disabled={busy} onClick={create} style={{width:"100%",marginTop:16,background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",padding:"12px 0",fontSize:14,opacity:busy?.6:1}}>
            {busy?"⏳ Création…":"Créer l'accès"}
          </button>
        </div>
        <button className="btn" style={{width:"100%",background:"#1e1e35",color:"#64748b",padding:12,marginTop:14,border:"1px solid #2d2d45"}} onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}
