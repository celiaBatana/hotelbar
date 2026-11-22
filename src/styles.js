const CSS = `
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
.no-arrows::-webkit-outer-spin-button,.no-arrows::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.no-arrows{-moz-appearance:textfield}
.sm-btn{cursor:pointer;border:1px solid #2d2d45;background:#1e1e35;color:#e2e8f0;border-radius:6px;width:26px;height:26px;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0}
.sm-btn:hover{background:#2d2d45}
      
.only-m{display:none!important}
.login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:radial-gradient(1200px 600px at 20% -10%,#241f5c55,transparent),radial-gradient(900px 500px at 100% 110%,#4c1d9533,transparent),#0f0f17}
.lbl{font-size:11px;color:#475569;display:block;margin-bottom:6px;font-weight:700;letter-spacing:.8px}
.role-pill{display:inline-block;padding:2px 9px;border-radius:20px;font-size:10px;font-weight:800;letter-spacing:.6px}
.sb-user{padding:10px 8px;border-top:1px solid #1e1e35}
@media(max-width:860px){
  .app-shell{flex-direction:column}
  .sidebar{position:fixed!important;top:auto!important;bottom:0;left:0;right:0;width:100%!important;height:auto!important;flex-direction:row!important;align-items:center;padding:6px 8px!important;z-index:60;border-right:none!important;border-top:1px solid #1e1e35;overflow-x:auto;gap:2px!important}
  .sidebar .sb-hide-m{display:none!important}
  .sidebar .only-m{display:flex!important}
  .sb-btn{flex-direction:column;gap:2px;font-size:10px;padding:7px 10px;width:auto;text-align:center;white-space:nowrap;flex-shrink:0}
  .sb-btn .sb-ic{font-size:18px!important}
  .main-area{padding:18px 14px 96px!important}
  .kpi-grid{grid-template-columns:repeat(2,1fr)!important;gap:12px!important}
  .two-col{grid-template-columns:1fr!important}
  .three-col{grid-template-columns:1fr!important}
  .toast{left:12px;right:12px;bottom:84px;max-width:none}
  .card.modal-card{padding:22px!important}
}

/* ── Raffinements visuels ── */
body{font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased}
.main-area>div{max-width:1280px;margin-left:auto;margin-right:auto}
.card{box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 14px 34px -22px rgba(0,0,0,.8);background:linear-gradient(180deg,#181830,#15152a)}
.stat{position:relative;overflow:hidden;background:linear-gradient(180deg,#181830,#14142a)}
.stat::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:var(--c,#312e81)}
.stat::after{content:"";position:absolute;right:-40px;top:-40px;width:120px;height:120px;border-radius:50%;background:var(--c,#312e81);opacity:.08;filter:blur(6px);pointer-events:none}
.stat:hover{transform:translateY(-2px);transition:all .2s}
.prod-card{background:linear-gradient(180deg,#181830,#14142a)}
.prod-card::before{content:"";position:absolute;left:0;top:18px;bottom:18px;width:3px;border-radius:0 3px 3px 0;background:var(--c,#312e81)}
.sb-btn{position:relative}
.sb-btn.active::before{content:"";position:absolute;left:-12px;top:10px;bottom:10px;width:3px;border-radius:0 3px 3px 0;background:#a5b4fc}
.sb-btn.only-m,.sb-btn.active{white-space:nowrap}
.tbl-wrap thead tr{position:sticky;top:0;z-index:2;background:#0f0f1a}
.tbl-wrap tbody tr{transition:background .15s}.tbl-wrap tbody tr:hover{background:rgba(129,140,248,.06)!important}
button:focus-visible,.input:focus-visible,.tbl-in:focus-visible{outline:2px solid #818cf8;outline-offset:2px}
.input::placeholder,.tbl-in::placeholder{color:#3b4258}
.tab:hover{filter:brightness(1.2)}
.modal-bg{background:rgba(5,5,12,.72)}
.modal-bg>.card{box-shadow:0 30px 80px -20px rgba(0,0,0,.9),0 0 0 1px rgba(129,140,248,.12)}
.main-area h1{background:linear-gradient(90deg,#fff,#a5b4fc);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
@media(max-width:860px){.sb-btn.active::before{left:50%;right:auto;top:auto;bottom:-6px;height:3px;width:20px;transform:translateX(-50%)}}
`;
export default CSS;
