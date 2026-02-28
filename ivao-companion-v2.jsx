import { useState, useEffect, useRef, useCallback } from "react";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
// ⚠️  Client ID visible en developers.ivao.aero - completar los últimos chars
const IVAO_CLIENT_ID = "1e1a3f0b-8703-45a4-9ac4-c3d32c";  // << completar UUID completo
// ⚠️  Registrar esta URL en "Redirect URLs" del developer portal:
const REDIRECT_URI   = "https://claude.ai";                // << o tu URL de hosting
const IVAO_SSO       = "https://sso.ivao.aero";
const CLAUDE_API     = "https://api.anthropic.com/v1/messages";
const REFRESH_MS     = 30000;

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmtCoord = (v, lat) => {
  if (v == null) return "---";
  return `${Math.abs(v).toFixed(4)}° ${lat ? (v>=0?"N":"S") : (v>=0?"E":"W")}`;
};
const fmtTime = s => {
  if (!s) return "--:--";
  return `${Math.floor(s/3600)}h ${String(Math.floor((s%3600)/60)).padStart(2,"0")}m`;
};
const phaseOf = p => {
  if (!p) return null;
  if (p.onGround) return { label:"EN TIERRA", color:"#f59e0b", dot:"🟡" };
  if (p.altitude < 1500) return { label:"T/O — LND", color:"#f97316", dot:"🟠" };
  return { label:"AIRBORNE", color:"#22c55e", dot:"🟢" };
};
const ratingLabel = r => (["","FS1","FS2","FS3","PP","SPP","CP","ATP","SFI","CFI"][r] || `R${r}`);

// OAuth2 helpers
const buildAuthUrl = () => {
  const state = Math.random().toString(36).slice(2);
  const params = new URLSearchParams({
    client_id: IVAO_CLIENT_ID,
    response_type: "token",           // implicit flow — no client_secret en frontend
    scope: "profile",
    redirect_uri: REDIRECT_URI,
    state,
  });
  return `${IVAO_SSO}/auth?${params}`;
};
const extractToken = url => {
  try {
    const hash = new URL(url).hash.replace("#", "");
    const p = new URLSearchParams(hash);
    return p.get("access_token") || null;
  } catch { return null; }
};

// ─── STYLES ──────────────────────────────────────────────────────────────────
const S = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
@import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

:root{
  --bg:#f0f6ff; --bg1:#ffffff; --bg2:#f8faff; --bg3:#edf2f9;
  --blue:#0062B8; --blue2:#0080f0; --blue3:#dbeafe; --blue4:#e8f2ff;
  --amber:#f59e0b; --green:#16a34a; --red:#dc2626; --orange:#f97316;
  --text:#0f172a; --text2:#475569; --text3:#94a3b8;
  --border:#e2e8f0; --border2:#cbd5e1;
  --shadow:0 1px 3px rgba(0,0,0,.08),0 1px 2px rgba(0,0,0,.04);
  --shadow-md:0 4px 16px rgba(0,98,184,.10);
}

body{background:var(--bg)}

.app{
  font-family:'Plus Jakarta Sans',sans-serif;
  background:var(--bg);
  min-height:100vh;
  color:var(--text);
  max-width:480px;
  margin:0 auto;
  position:relative;
}

/* ── TYPE ── */
.mono{font-family:'JetBrains Mono',monospace}
.lbl{font-size:10px;font-weight:700;letter-spacing:1.2px;color:var(--text3);text-transform:uppercase;margin-bottom:3px}
.val-xl{font-size:30px;font-weight:800;color:var(--blue);line-height:1}
.val-lg{font-size:20px;font-weight:700;color:var(--blue);line-height:1}
.val-md{font-size:14px;font-weight:600;color:var(--text)}
.unit{font-size:10px;font-weight:500;color:var(--text3);margin-left:3px}

/* ── CARD ── */
.card{
  background:var(--bg1);
  border:1px solid var(--border);
  border-radius:12px;
  padding:16px;
  box-shadow:var(--shadow);
}
.card-blue{background:var(--blue4);border-color:var(--blue3)}
.card-sm{padding:12px;border-radius:10px}

/* ── HEADER ── */
.header{
  background:var(--bg1);
  border-bottom:1px solid var(--border);
  padding:12px 16px 8px;
  position:sticky;top:0;z-index:200;
}
.header-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.logo{font-size:18px;font-weight:800;color:var(--blue);letter-spacing:-0.5px}
.logo span{color:var(--text3);font-weight:500}

/* ── TABS ── */
.tab-bar{
  display:flex;gap:2px;
  background:var(--bg3);
  border-radius:10px;
  padding:3px;
}
.tab{
  flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;
  padding:7px 4px;border-radius:8px;border:none;background:transparent;
  cursor:pointer;transition:all .15s;color:var(--text3);font-size:9px;
  font-weight:700;letter-spacing:.8px;text-transform:uppercase;
  font-family:'Plus Jakarta Sans',sans-serif;
}
.tab .icon{font-size:16px;line-height:1}
.tab.active{background:var(--bg1);color:var(--blue);box-shadow:var(--shadow)}
.tab:hover:not(.active){color:var(--text2);background:rgba(255,255,255,.5)}

/* ── BUTTONS ── */
.btn-primary{
  background:var(--blue);color:#fff;
  font-family:'Plus Jakarta Sans',sans-serif;
  font-weight:700;font-size:14px;letter-spacing:.3px;
  padding:13px 20px;border-radius:10px;border:none;
  cursor:pointer;width:100%;transition:all .15s;
  box-shadow:0 2px 8px rgba(0,98,184,.3);
}
.btn-primary:hover{background:var(--blue2);box-shadow:0 4px 16px rgba(0,98,184,.4)}
.btn-primary:disabled{opacity:.4;cursor:not-allowed}
.btn-secondary{
  background:var(--bg3);color:var(--text2);
  font-family:'Plus Jakarta Sans',sans-serif;
  font-weight:600;font-size:13px;padding:10px 16px;
  border-radius:8px;border:1px solid var(--border);cursor:pointer;transition:all .15s;
}
.btn-secondary:hover{border-color:var(--blue);color:var(--blue);background:var(--blue4)}
.btn-icon{
  background:var(--bg3);border:1px solid var(--border);border-radius:8px;
  padding:8px 12px;cursor:pointer;font-size:16px;transition:all .15s;
}
.btn-icon:hover{background:var(--blue4);border-color:var(--blue)}

/* ── INPUT ── */
.input-wrap{position:relative;margin-bottom:4px}
.input{
  width:100%;background:var(--bg2);border:1.5px solid var(--border);
  border-radius:10px;padding:12px 16px;
  font-family:'Plus Jakarta Sans',sans-serif;font-size:16px;font-weight:600;
  color:var(--text);outline:none;transition:all .15s;
}
.input:focus{border-color:var(--blue);background:#fff;box-shadow:0 0 0 3px var(--blue3)}
.input::placeholder{color:var(--text3);font-weight:500;font-size:14px}
.input-label{font-size:11px;font-weight:700;letter-spacing:.8px;color:var(--text3);
  text-transform:uppercase;margin-bottom:5px;display:block}

/* ── BADGE ── */
.badge{
  display:inline-flex;align-items:center;gap:4px;
  font-size:10px;font-weight:700;letter-spacing:.8px;
  padding:3px 8px;border-radius:20px;text-transform:uppercase;
}
.badge-green{background:#dcfce7;color:#16a34a}
.badge-red{background:#fee2e2;color:#dc2626}
.badge-amber{background:#fef3c7;color:#d97706}
.badge-blue{background:var(--blue3);color:var(--blue)}
.badge-gray{background:var(--bg3);color:var(--text2)}

/* ── PHASE PILL ── */
.phase-pill{
  display:inline-flex;align-items:center;gap:6px;
  padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;
  letter-spacing:.8px;text-transform:uppercase;
}

/* ── COMPASS ── */
.compass{
  width:100px;height:100px;border-radius:50%;
  border:1.5px solid var(--border2);
  background:radial-gradient(circle at 35% 30%,#f8faff,var(--bg2));
  box-shadow:var(--shadow-md);
  position:relative;display:flex;align-items:center;justify-content:center;
}
.compass-n{position:absolute;top:6px;left:50%;transform:translateX(-50%);
  font-size:9px;font-weight:800;color:var(--blue);letter-spacing:1px}
.needle{
  position:absolute;width:2px;height:45%;bottom:50%;left:calc(50% - 1px);
  transform-origin:bottom center;display:flex;flex-direction:column;align-items:center;
}
.needle-body{flex:1;background:linear-gradient(to top,var(--blue),rgba(0,98,184,.2));width:2px}
.needle-tip{width:5px;height:5px;border-radius:50%;background:var(--blue);
  box-shadow:0 0 6px rgba(0,98,184,.5);margin-top:-2px}

/* ── ATC ROW ── */
.atc-row{
  display:flex;align-items:center;justify-content:space-between;
  padding:10px 12px;background:var(--bg2);border-radius:8px;
  border:1px solid var(--border);margin-bottom:6px;
  cursor:pointer;transition:all .15s;
}
.atc-row:hover{border-color:var(--blue);background:var(--blue4)}
.atc-callsign{font-size:13px;font-weight:700;color:var(--blue)}
.atc-type{font-size:10px;color:var(--text3);margin-top:1px}
.atc-freq{font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:500;
  color:var(--amber)}

/* ── MAP ── */
#ivao-map{width:100%;height:420px;border-radius:12px;border:1px solid var(--border);
  overflow:hidden;box-shadow:var(--shadow-md);position:relative;z-index:1}
.map-loader{width:100%;height:420px;border-radius:12px;background:var(--bg3);
  display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;
  font-size:13px;color:var(--text3);font-weight:500}

/* ── FLIGHT DETAIL PANEL ── */
.detail-panel{
  position:fixed;bottom:0;left:50%;transform:translateX(-50%);
  width:min(480px,100vw);background:var(--bg1);
  border-top:1px solid var(--border);border-radius:20px 20px 0 0;
  padding:16px 16px 28px;z-index:500;box-shadow:0 -8px 32px rgba(0,0,0,.12);
  animation:slideUp .2s ease;
}
@keyframes slideUp{from{transform:translate(-50%,40px);opacity:0}to{transform:translate(-50%,0);opacity:1}}
.panel-handle{width:40px;height:4px;border-radius:2px;background:var(--border2);
  margin:0 auto 14px}

/* ── FRIENDS ── */
.friend-card{
  display:flex;align-items:center;gap:12px;
  padding:12px;background:var(--bg1);border-radius:10px;
  border:1px solid var(--border);margin-bottom:8px;transition:all .15s;
}
.friend-card:hover{border-color:var(--blue);box-shadow:var(--shadow-md)}
.friend-avatar{
  width:40px;height:40px;border-radius:10px;
  background:var(--blue4);display:flex;align-items:center;justify-content:center;
  font-size:18px;font-weight:800;color:var(--blue);
  font-family:'Plus Jakarta Sans',sans-serif;flex-shrink:0;
}
.friend-info{flex:1;min-width:0}
.friend-name{font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.friend-detail{font-size:11px;color:var(--text2);margin-top:2px}

/* ── LOGIN ── */
.login-screen{
  min-height:100vh;display:flex;flex-direction:column;
  justify-content:center;align-items:center;padding:32px 20px;gap:24px;
  background:linear-gradient(160deg,#f0f6ff 0%,#e8f2ff 100%);
}
.login-hero{text-align:center}
.login-title{font-size:36px;font-weight:800;color:var(--blue);letter-spacing:-1px}
.login-sub{font-size:13px;color:var(--text2);margin-top:6px;line-height:1.6}
.login-divider{
  display:flex;align-items:center;gap:12px;color:var(--text3);font-size:12px;font-weight:600;
}
.login-divider::before,.login-divider::after{
  content:'';flex:1;height:1px;background:var(--border);
}
.login-box{width:100%;max-width:360px;display:flex;flex-direction:column;gap:10px}

/* ── ROUTE ── */
.route-row{
  display:flex;align-items:center;gap:8px;
  font-size:18px;font-weight:800;letter-spacing:1px;
}
.route-line{
  flex:1;height:2px;
  background:linear-gradient(90deg,var(--blue3),var(--blue));
  border-radius:1px;position:relative;
}
.route-line::after{
  content:'▶';position:absolute;right:-8px;top:-7px;
  font-size:10px;color:var(--blue);
}
.route-text{font-size:11px;color:var(--text2);line-height:1.7;margin-top:6px;
  max-height:56px;overflow-y:auto;font-family:'JetBrains Mono',monospace}

/* ── GRID ── */
.g2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.col{display:flex;flex-direction:column;gap:8px}

/* ── LOADING ── */
.loading-screen{min-height:100vh;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:20px;background:var(--bg)}
.spin{width:44px;height:44px;border-radius:50%;border:3px solid var(--blue3);
  border-top-color:var(--blue);animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.loading-msg{font-size:13px;color:var(--text2);font-weight:500;letter-spacing:.3px}

/* ── MISC ── */
.content{padding:12px;display:flex;flex-direction:column;gap:10px;padding-bottom:80px}
.section-hdr{font-size:11px;font-weight:800;color:var(--text3);letter-spacing:1px;
  text-transform:uppercase;margin:4px 0 6px;display:flex;align-items:center;gap:6px}
.divider{height:1px;background:var(--border);margin:12px 0}
.empty-state{text-align:center;padding:32px 20px;color:var(--text3)}
.empty-icon{font-size:36px;margin-bottom:8px}
.empty-text{font-size:13px;font-weight:500}
.fade-in{animation:fadeIn .25s ease}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

/* ── PROGRESS ── */
.refresh-bar{height:2px;background:var(--border);overflow:hidden}
.refresh-fill{height:100%;background:var(--blue);animation:drain 30s linear forwards}
@keyframes drain{from{width:100%}to{width:0%}}

/* ── OFFLINE ── */
.center-page{min-height:100vh;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:20px;padding:24px;text-align:center;
  background:var(--bg)}

/* ── OAUTH PANEL ── */
.oauth-card{
  background:linear-gradient(135deg,var(--blue),#0080f0);
  color:#fff;border-radius:12px;padding:16px;
  box-shadow:0 4px 16px rgba(0,98,184,.3);
}
.oauth-title{font-size:14px;font-weight:800;margin-bottom:4px}
.oauth-sub{font-size:11px;opacity:.85;line-height:1.5}

/* ── STAT CHIP ── */
.chip{
  display:inline-flex;align-items:center;gap:6px;
  padding:6px 12px;border-radius:8px;background:var(--bg3);
  border:1px solid var(--border);font-size:12px;font-weight:600;
}
.chip .dot{width:7px;height:7px;border-radius:50%}
.chip-green .dot{background:var(--green)}
.chip-amber .dot{background:var(--amber)}
`;

// ─── COMPONENT: Compass ───────────────────────────────────────────────────────
function Compass({ heading }) {
  return (
    <div className="compass">
      <span className="compass-n">N</span>
      {["E","S","W"].map((c,i) => (
        <span key={c} style={{
          position:"absolute",
          ...[{right:6,top:"50%",transform:"translateY(-50%)"},{bottom:6,left:"50%",transform:"translateX(-50%)"},{left:6,top:"50%",transform:"translateY(-50%)"}][i],
          fontSize:9,fontWeight:800,color:"var(--text3)"
        }}>{c}</span>
      ))}
      {[0,45,90,135,180,225,270,315].map(d=>(
        <div key={d} style={{
          position:"absolute",top:"50%",left:"50%",
          width:d%90===0?"2px":"1px",height:d%90===0?"10px":"6px",
          background:d%90===0?"rgba(0,98,184,.25)":"rgba(0,98,184,.12)",
          transformOrigin:"50% -38px",
          transform:`translateX(-50%) rotate(${d}deg)`,marginTop:"-38px",
        }}/>
      ))}
      <div className="needle" style={{transform:`rotate(${heading||0}deg)`}}>
        <div className="needle-body"/>
        <div className="needle-tip"/>
      </div>
      <div style={{fontSize:10,fontWeight:700,color:"var(--blue)",
        position:"absolute",bottom:18,fontFamily:"'JetBrains Mono',monospace"}}>
        {heading!=null?`${heading}°`:"---"}
      </div>
    </div>
  );
}

// ─── COMPONENT: DataCell ─────────────────────────────────────────────────────
function DataCell({ label, value, unit, color, mono }) {
  return (
    <div>
      <div className="lbl">{label}</div>
      <div className={`val-lg ${mono?"mono":""}`} style={color?{color}:{}}>
        {value??<span style={{color:"var(--text3)"}}>---</span>}
        {unit&&<span className="unit">{unit}</span>}
      </div>
    </div>
  );
}

// ─── SCREEN: Login ────────────────────────────────────────────────────────────
function LoginScreen({ vid, setVid, onLogin, loading }) {
  const [showOAuth, setShowOAuth] = useState(false);
  const [pastedUrl, setPastedUrl] = useState("");
  const [authWindow, setAuthWindow] = useState(null);

  const handleOAuth = () => {
    const url = buildAuthUrl();
    const w = window.open(url, "_blank", "width=520,height=640");
    setAuthWindow(w);
    setShowOAuth(true);
  };
  const handlePaste = () => {
    const token = extractToken(pastedUrl);
    if (token) { alert("Token obtenido: " + token.slice(0,20)+"… — integración completa en v1.1"); }
    else { alert("No se encontró access_token en la URL. Asegúrate de pegar la URL completa de redirección."); }
  };

  return (
    <div className="login-screen">
      <div className="login-hero">
        <div className="login-title">IVAO</div>
        <div style={{fontSize:13,fontWeight:700,color:"var(--text3)",letterSpacing:2,marginTop:2}}>
          ALTITUDE COMPANION
        </div>
        <div style={{marginTop:6,fontSize:11,fontWeight:600,color:"var(--blue)",
          background:"var(--blue4)",padding:"3px 10px",borderRadius:20,display:"inline-block"}}>
          v2.0
        </div>
        <div className="login-sub">Dashboard móvil para pilotos IVAO.<br/>Mapa de tráfico, amigos y estado de vuelo.</div>
      </div>

      <div className="login-box">
        {/* OAuth2 */}
        <div className="oauth-card">
          <div className="oauth-title">🔐 Login con IVAO SSO</div>
          <div className="oauth-sub">
            Accede con tu usuario y contraseña oficial IVAO.<br/>
            Datos de perfil + acceso a API privada.
          </div>
          <button onClick={handleOAuth} style={{
            marginTop:12,background:"rgba(255,255,255,.2)",border:"1px solid rgba(255,255,255,.4)",
            color:"#fff",padding:"9px 16px",borderRadius:8,fontWeight:700,fontSize:13,
            cursor:"pointer",width:"100%",fontFamily:"'Plus Jakarta Sans',sans-serif",
          }}>
            Abrir login IVAO →
          </button>
        </div>

        {showOAuth && (
          <div className="card" style={{background:"var(--bg2)"}}>
            <div className="lbl" style={{marginBottom:6}}>Paso 2 — Pega la URL de redirección</div>
            <div style={{fontSize:11,color:"var(--text2)",marginBottom:8,lineHeight:1.6}}>
              Tras iniciar sesión, IVAO te redirigirá a una URL.<br/>
              Copia esa URL completa y pégala aquí:
            </div>
            <textarea
              style={{
                width:"100%",background:"var(--bg1)",border:"1.5px solid var(--border)",
                borderRadius:8,padding:10,fontSize:11,color:"var(--text)",resize:"vertical",
                minHeight:60,fontFamily:"'JetBrains Mono',monospace",outline:"none",
              }}
              placeholder="https://claude.ai#access_token=..."
              value={pastedUrl}
              onChange={e=>setPastedUrl(e.target.value)}
            />
            <button onClick={handlePaste} className="btn-secondary" style={{marginTop:8,width:"100%"}}>
              Extraer token
            </button>
          </div>
        )}

        <div className="login-divider">o acceso rápido por VID</div>

        {/* VID login */}
        <div>
          <label className="input-label">Tu VID de IVAO</label>
          <input
            className="input"
            type="number"
            placeholder="Ej. 687072"
            value={vid}
            onChange={e=>setVid(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&vid&&onLogin()}
          />
        </div>
        <button className="btn-primary" onClick={onLogin} disabled={!vid.trim()}>
          Conectar →
        </button>

        {/* URL registration note */}
        <div style={{background:"var(--bg3)",border:"1px solid var(--border)",
          borderRadius:10,padding:12,fontSize:11,color:"var(--text2)",lineHeight:1.7}}>
          <div style={{fontWeight:700,color:"var(--text)",marginBottom:4}}>
            📌 Redirect URL a registrar
          </div>
          Para activar el login OAuth2, añade esta URL en tu portal de developers.ivao.aero
          en la sección <strong>Redirect URLs</strong>:
          <div style={{fontFamily:"'JetBrains Mono',monospace",
            background:"var(--bg1)",padding:"6px 10px",borderRadius:6,marginTop:6,
            color:"var(--blue)",fontWeight:500}}>
            https://claude.ai
          </div>
          <div style={{marginTop:6,color:"var(--text3)"}}>
            O la URL donde alojes la app (GitHub Pages, Netlify, etc.)
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SCREEN: Loading ─────────────────────────────────────────────────────────
function LoadingScreen({ msg }) {
  return (
    <div className="loading-screen">
      <div className="spin"/>
      <div className="loading-msg">{msg||"Conectando con IVAO…"}</div>
    </div>
  );
}

// ─── TAB: My Flight ───────────────────────────────────────────────────────────
function FlightTab({ pilot, networkStats, lastUpdate, onRefresh, refreshing }) {
  const phase = phaseOf(pilot);
  const [showMap, setShowMap] = useState(false);

  if (!pilot) {
    return (
      <div className="content">
        <div className="empty-state card">
          <div className="empty-icon">📡</div>
          <div className="empty-text">No conectado a la red IVAO</div>
          <div style={{fontSize:11,color:"var(--text3)",marginTop:4}}>
            Inicia sesión en Altitude y recarga
          </div>
          <button onClick={onRefresh} className="btn-secondary" style={{marginTop:12}} disabled={refreshing}>
            {refreshing?"Cargando…":"Reintentar"}
          </button>
        </div>
        {networkStats && <NetworkBar stats={networkStats} lastUpdate={lastUpdate}/>}
      </div>
    );
  }

  return (
    <div className="content fade-in">
      {/* Callsign card */}
      <div className="card" style={{
        background:"linear-gradient(135deg,var(--blue) 0%,#0080f0 100%)",
        color:"#fff",border:"none",
        boxShadow:"0 4px 20px rgba(0,98,184,.35)"
      }}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:1.2,opacity:.7,
              textTransform:"uppercase",marginBottom:4}}>Callsign</div>
            <div style={{fontSize:34,fontWeight:800,letterSpacing:2,lineHeight:1}}>
              {pilot.callsign||"------"}
            </div>
            <div style={{fontSize:11,opacity:.7,marginTop:5,fontFamily:"'JetBrains Mono',monospace"}}>
              {fmtCoord(pilot.latitude,true)} · {fmtCoord(pilot.longitude,false)}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
            {phase && (
              <div className="phase-pill" style={{
                background:"rgba(255,255,255,.2)",color:"#fff",border:"1px solid rgba(255,255,255,.3)"
              }}>
                <span style={{fontSize:14}}>{phase.dot}</span>
                <span style={{fontSize:10}}>{phase.label}</span>
              </div>
            )}
            <div style={{fontSize:10,opacity:.7,fontFamily:"'JetBrains Mono',monospace"}}>
              SQK {pilot.transponder||"2000"}
            </div>
            <div style={{fontSize:10,opacity:.7}}>
              {pilot.serverId||"---"}
            </div>
          </div>
        </div>
      </div>

      {/* Altitude / GS / Heading */}
      <div className="card">
        <div style={{display:"flex",gap:16,alignItems:"center"}}>
          <Compass heading={pilot.heading}/>
          <div className="col" style={{flex:1,gap:14}}>
            <DataCell label="Altitud MSL" value={pilot.altitude?.toLocaleString()} unit="ft"/>
            <DataCell
              label="Groundspeed"
              value={pilot.groundspeed}
              unit="kt"
              color={pilot.groundspeed>0?"var(--green)":"var(--text3)"}
            />
          </div>
        </div>
        <div className="divider"/>
        <div className="g2">
          <DataCell label="Heading" value={pilot.heading!=null?`${pilot.heading}°`:null}/>
          <DataCell label="Conectado" value={fmtTime(pilot.connectedSeconds)} mono/>
        </div>
      </div>

      {/* Map toggle */}
      {pilot.latitude && pilot.longitude && (
        <div className="card card-sm">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}
            onClick={()=>setShowMap(v=>!v)} style={{cursor:"pointer",
              display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:13,fontWeight:700}}>🗺 Mi posición</div>
            <span style={{fontSize:11,color:"var(--text3)"}}>
              {showMap?"▲ Ocultar":"▼ Mostrar"}
            </span>
          </div>
          {showMap && (
            <iframe
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${pilot.longitude-.5},${pilot.latitude-.5},${pilot.longitude+.5},${pilot.latitude+.5}&layer=mapnik&marker=${pilot.latitude},${pilot.longitude}`}
              style={{width:"100%",height:180,border:"none",borderRadius:8,marginTop:10}}
              title="Mi posición"
              sandbox="allow-scripts allow-same-origin"
            />
          )}
        </div>
      )}

      {/* Flight Plan */}
      {pilot.flightplan && (
        <div className="card">
          <div className="section-hdr">✈ Plan de vuelo</div>
          <div className="route-row">
            <span style={{color:"var(--blue)"}}>{pilot.flightplan.departure||"????"}</span>
            <div className="route-line"/>
            <span style={{color:"var(--green)"}}>{pilot.flightplan.arrival||"????"}</span>
          </div>
          <div className="divider"/>
          <div className="g3">
            <DataCell label="Aeronave" value={pilot.flightplan.aircraft||"---"}/>
            <DataCell label="Nivel" value={pilot.flightplan.cruisingLevel||"---"}/>
            <DataCell label="IFR/VFR" value={pilot.flightplan.flightRules||"---"}
              color={pilot.flightplan.flightRules==="I"?"var(--blue)":"var(--amber)"}/>
          </div>
          {pilot.flightplan.route && <>
            <div className="lbl" style={{marginTop:10}}>Ruta</div>
            <div className="route-text">{pilot.flightplan.route}</div>
          </>}
        </div>
      )}

      {/* Nearby ATC */}
      <div className="card">
        <div className="section-hdr">📻 ATC en área</div>
        {pilot.nearbyAtc?.length > 0 ? pilot.nearbyAtc.slice(0,6).map((a,i)=>(
          <div className="atc-row" key={i}>
            <div>
              <div className="atc-callsign">{a.callsign}</div>
              {a.position&&<div className="atc-type">{a.position}</div>}
            </div>
            <div className="atc-freq">{a.frequency?.toFixed(3)}</div>
          </div>
        )) : (
          <div style={{fontSize:12,color:"var(--text3)",padding:"8px 0"}}>
            Sin ATC activo · UNICOM 122.800
          </div>
        )}
      </div>

      {networkStats && <NetworkBar stats={networkStats} lastUpdate={lastUpdate}/>}

      {/* Option B placeholder */}
      <div className="card" style={{borderStyle:"dashed",borderColor:"var(--blue3)"}}>
        <div className="lbl" style={{color:"var(--amber)"}}>🔧 Control remoto — Próximamente</div>
        <div style={{fontSize:11,color:"var(--text2)",lineHeight:1.7,marginTop:4}}>
          <strong>Opción B · RDP/LAN</strong> — Acceso remoto a Altitude UI desde tablet.<br/>
          Radio, transponder, chat y FPL en tiempo real.<br/>
          Estado: evaluación · v1.2
        </div>
      </div>
    </div>
  );
}

// ─── TAB: Traffic Map ─────────────────────────────────────────────────────────
function MapTab({ allTraffic, myVid, onSelectFlight }) {
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const markersRef = useRef([]);
  const [mapReady, setMapReady] = useState(false);
  const [filter, setFilter] = useState("all"); // all | pilots | atc

  // Load Leaflet and init map
  useEffect(() => {
    if (leafletRef.current) return;
    const loadLeaflet = async () => {
      if (!window.L) {
        await new Promise((res,rej)=>{
          const s=document.createElement("script");
          s.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          s.onload=res; s.onerror=rej;
          document.head.appendChild(s);
        });
      }
      if (!document.querySelector("#leaflet-css")) {
        const l=document.createElement("link");
        l.id="leaflet-css";l.rel="stylesheet";
        l.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(l);
      }
      await new Promise(r=>setTimeout(r,200));

      const L = window.L;
      const map = L.map("ivao-map", {
        center:[40,0], zoom:3,
        zoomControl:true,
        attributionControl:true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
        attribution:'© <a href="https://www.openstreetmap.org">OSM</a>',
        maxZoom:18,
      }).addTo(map);

      leafletRef.current = map;
      setMapReady(true);
    };
    loadLeaflet().catch(console.error);
    return () => {
      if (leafletRef.current) { leafletRef.current.remove(); leafletRef.current=null; }
    };
  }, []);

  // Update markers when traffic changes
  useEffect(() => {
    if (!mapReady || !leafletRef.current || !allTraffic) return;
    const L = window.L;
    const map = leafletRef.current;

    // Clear old markers
    markersRef.current.forEach(m=>m.remove());
    markersRef.current = [];

    const pilots = filter !== "atc" ? (allTraffic.pilots||[]) : [];
    const atcs   = filter !== "pilots" ? (allTraffic.atcs||[]) : [];

    // Pilot markers
    pilots.forEach(p => {
      if (!p.lat || !p.lon) return;
      const isMe = String(p.userId) === String(myVid);
      const color = isMe ? "#ef4444" : "#0062B8";
      const size  = isMe ? 14 : 8;

      const icon = L.divIcon({
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:${isMe?"3":"1.5"}px solid ${isMe?"#fff":"rgba(255,255,255,.6)"};box-shadow:0 1px 4px rgba(0,0,0,.3);cursor:pointer" title="${p.callsign}"></div>`,
        className:"",iconAnchor:[size/2,size/2],
      });
      const m = L.marker([p.lat,p.lon],{icon})
        .addTo(map)
        .on("click",()=>onSelectFlight({ type:"pilot", data:p }));
      markersRef.current.push(m);
    });

    // ATC markers
    atcs.forEach(a => {
      if (!a.lat || !a.lon) return;
      const icon = L.divIcon({
        html:`<div style="width:10px;height:10px;transform:rotate(45deg);background:#f59e0b;border:1.5px solid rgba(255,255,255,.7);box-shadow:0 1px 4px rgba(0,0,0,.3);cursor:pointer" title="${a.callsign}"></div>`,
        className:"",iconAnchor:[5,5],
      });
      const m = L.marker([a.lat,a.lon],{icon})
        .addTo(map)
        .on("click",()=>onSelectFlight({ type:"atc", data:a }));
      markersRef.current.push(m);
    });
  }, [allTraffic, mapReady, filter, myVid, onSelectFlight]);

  const total = (allTraffic?.pilots?.length||0) + (allTraffic?.atcs?.length||0);

  return (
    <div className="content">
      {/* Stats + filter */}
      <div style={{display:"flex",gap:8,alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",gap:6}}>
          <div className="chip chip-green">
            <div className="dot"/>
            <span>{allTraffic?.pilots?.length||0} pilotos</span>
          </div>
          <div className="chip chip-amber">
            <div className="dot"/>
            <span>{allTraffic?.atcs?.length||0} ATC</span>
          </div>
        </div>
        <select
          value={filter}
          onChange={e=>setFilter(e.target.value)}
          style={{fontSize:12,padding:"5px 8px",borderRadius:7,border:"1px solid var(--border)",
            background:"var(--bg1)",color:"var(--text)",fontFamily:"'Plus Jakarta Sans',sans-serif",
            fontWeight:600,outline:"none"}}
        >
          <option value="all">Todos</option>
          <option value="pilots">Solo pilotos</option>
          <option value="atc">Solo ATC</option>
        </select>
      </div>

      {/* Map */}
      {!mapReady ? (
        <div className="map-loader card">
          <div className="spin"/>
          <span>Cargando mapa…</span>
        </div>
      ) : null}
      <div id="ivao-map" style={{display:mapReady?"block":"none"}}/>

      {!allTraffic && (
        <div className="card empty-state">
          <div className="empty-icon">🌍</div>
          <div className="empty-text">
            Cargando datos de tráfico IVAO…<br/>
            El mapa mostrará todos los vuelos activos.
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="card card-sm">
        <div style={{display:"flex",gap:16,fontSize:11,color:"var(--text2)"}}>
          <span>
            <span style={{display:"inline-block",width:9,height:9,borderRadius:"50%",background:"#0062B8",marginRight:5}}/>
            Piloto
          </span>
          <span>
            <span style={{display:"inline-block",width:9,height:9,borderRadius:"50%",background:"#ef4444",marginRight:5}}/>
            Tu vuelo
          </span>
          <span>
            <span style={{display:"inline-block",width:9,height:9,transform:"rotate(45deg)",background:"#f59e0b",marginRight:8}}/>
            ATC
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── TAB: Friends ─────────────────────────────────────────────────────────────
function FriendsTab({ allTraffic, friends, setFriends, onSelectFlight }) {
  const [newVid, setNewVid] = useState("");
  const [newName, setNewName] = useState("");

  const addFriend = () => {
    if (!newVid.trim()) return;
    setFriends(f => [...f, { vid: newVid.trim(), name: newName.trim()||`VID ${newVid.trim()}` }]);
    setNewVid(""); setNewName("");
  };

  const removeFriend = vid => setFriends(f => f.filter(x=>x.vid!==vid));

  const getFriendStatus = vid => {
    const pilot = allTraffic?.pilots?.find(p=>String(p.userId)===String(vid));
    if (pilot) return { online:true, pilot };
    const atc = allTraffic?.atcs?.find(a=>String(a.userId)===String(vid));
    if (atc) return { online:true, atc };
    return { online:false };
  };

  return (
    <div className="content">
      {/* Add friend */}
      <div className="card">
        <div className="section-hdr">➕ Añadir amigo</div>
        <div className="g2" style={{marginBottom:8}}>
          <div>
            <label className="input-label">VID IVAO</label>
            <input className="input" type="number" placeholder="687072"
              value={newVid} onChange={e=>setNewVid(e.target.value)}/>
          </div>
          <div>
            <label className="input-label">Nombre (opcional)</label>
            <input className="input" type="text" placeholder="Alias"
              value={newName} onChange={e=>setNewName(e.target.value)}/>
          </div>
        </div>
        <button className="btn-primary" onClick={addFriend} disabled={!newVid.trim()}>
          Añadir
        </button>
      </div>

      {/* Friends list */}
      {friends.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">👥</div>
          <div className="empty-text">Sin amigos añadidos aún</div>
          <div style={{fontSize:11,color:"var(--text3)",marginTop:4}}>
            Añade VIDs de IVAO para rastrearlos en tiempo real
          </div>
        </div>
      ) : (
        <div>
          <div className="section-hdr">Tus amigos · {friends.length}</div>
          {friends.map(f => {
            const status = getFriendStatus(f.vid);
            const p = status.pilot;
            const a = status.atc;
            return (
              <div className="friend-card" key={f.vid}
                onClick={()=>{ if(p) onSelectFlight({type:"pilot",data:p}); if(a) onSelectFlight({type:"atc",data:a}); }}
                style={{cursor:status.online?"pointer":"default"}}>
                <div className="friend-avatar">
                  {f.name.charAt(0).toUpperCase()}
                </div>
                <div className="friend-info">
                  <div className="friend-name">{f.name}</div>
                  <div className="friend-detail">VID {f.vid}</div>
                  {status.online && p && (
                    <div style={{marginTop:4,display:"flex",gap:6",flexWrap:"wrap"}}>
                      <span className="badge badge-green">● ONLINE</span>
                      <span className="badge badge-blue">{p.callsign}</span>
                      {p.flightplan?.departure && (
                        <span className="badge badge-gray">
                          {p.flightplan.departure}→{p.flightplan.arrival||"???"}
                        </span>
                      )}
                    </div>
                  )}
                  {status.online && a && (
                    <div style={{marginTop:4,display:"flex",gap:6}}>
                      <span className="badge badge-green">● ATC ONLINE</span>
                      <span className="badge badge-amber">{a.callsign}</span>
                    </div>
                  )}
                  {!status.online && (
                    <span className="badge badge-gray" style={{marginTop:4}}>OFFLINE</span>
                  )}
                </div>
                <button onClick={e=>{e.stopPropagation();removeFriend(f.vid)}}
                  style={{background:"none",border:"none",color:"var(--text3)",
                    cursor:"pointer",fontSize:18,padding:"4px",lineHeight:1}}>×</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Network Stats Bar ────────────────────────────────────────────────────────
function NetworkBar({ stats, lastUpdate }) {
  return (
    <div className="card card-sm" style={{background:"var(--bg2)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",gap:12}}>
          <div><div className="lbl">Pilotos</div>
            <div style={{fontSize:16,fontWeight:800,color:"var(--green)"}}>{stats.totalPilots?.toLocaleString()}</div>
          </div>
          <div><div className="lbl">ATC</div>
            <div style={{fontSize:16,fontWeight:800,color:"var(--amber)"}}>{stats.totalAtc?.toLocaleString()}</div>
          </div>
        </div>
        {lastUpdate && (
          <div style={{fontSize:10,color:"var(--text3)",textAlign:"right"}}>
            {lastUpdate.toLocaleTimeString("es-ES")}<br/>
            <span style={{fontSize:9}}>actualizado</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Flight Detail Panel ──────────────────────────────────────────────────────
function DetailPanel({ selected, onClose }) {
  if (!selected) return null;
  const { type, data } = selected;

  return (
    <div className="detail-panel">
      <div className="panel-handle"/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
        <div>
          <div style={{fontSize:22,fontWeight:800,color:"var(--blue)"}}>{data.callsign}</div>
          <span className={`badge ${type==="pilot"?"badge-blue":"badge-amber"}`} style={{marginTop:4}}>
            {type==="pilot"?"PILOTO":"ATC"}
          </span>
        </div>
        <button onClick={onClose} style={{background:"var(--bg3)",border:"1px solid var(--border)",
          borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:13,fontWeight:700,color:"var(--text2)"}}>
          ✕
        </button>
      </div>
      {type==="pilot" && (
        <div className="g2" style={{gap:10}}>
          <DataCell label="Altitud" value={data.altitude?.toLocaleString()} unit="ft"/>
          <DataCell label="Velocidad" value={data.groundspeed} unit="kt"/>
          <DataCell label="Heading" value={data.heading!=null?`${data.heading}°`:null}/>
          <DataCell label="Posición"
            value={`${fmtCoord(data.lat,true)}`} mono/>
          {data.flightplan?.departure && <>
            <DataCell label="Salida" value={data.flightplan.departure} color="var(--blue)"/>
            <DataCell label="Destino" value={data.flightplan.arrival||"---"} color="var(--green)"/>
          </>}
          {data.flightplan?.aircraft && (
            <DataCell label="Aeronave" value={data.flightplan.aircraft}/>
          )}
          <DataCell label="Squawk" value={data.transponder||"2000"} mono/>
        </div>
      )}
      {type==="atc" && (
        <div className="g2">
          <DataCell label="Frecuencia" value={data.frequency?.toFixed(3)} unit="MHz" color="var(--amber)"/>
          <DataCell label="Posición" value={data.position||"---"}/>
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen]             = useState("login");
  const [vid, setVid]                   = useState("");
  const [tab, setTab]                   = useState("flight");
  const [pilotData, setPilotData]       = useState(null);
  const [allTraffic, setAllTraffic]     = useState(null);
  const [networkStats, setNetworkStats] = useState(null);
  const [lastUpdate, setLastUpdate]     = useState(null);
  const [refreshing, setRefreshing]     = useState(false);
  const [loadMsg, setLoadMsg]           = useState("");
  const [selected, setSelected]         = useState(null);
  const [friends, setFriends]           = useState(() => {
    try { return JSON.parse(localStorage.getItem("ivao_friends")||"[]"); } catch { return []; }
  });

  // Persist friends
  useEffect(()=>{
    try { localStorage.setItem("ivao_friends", JSON.stringify(friends)); } catch {}
  },[friends]);

  const intervalRef = useRef(null);

  const fetchAll = useCallback(async (targetVid, silent=false) => {
    if (!silent) { setScreen("loading"); setLoadMsg("Descargando tráfico IVAO…"); }
    else setRefreshing(true);

    try {
      const prompt = `Fetch https://api.ivao.aero/v2/tracker/whazzup (IVAO Whazzup v2 JSON).

Return ONLY raw JSON, no markdown, no backticks:
{
  "myPilot": {
    "found": true,
    "callsign": "", "altitude": 0, "groundspeed": 0, "heading": 0,
    "latitude": 0.0, "longitude": 0.0, "onGround": false,
    "transponder": "", "connectedSeconds": 0, "serverId": "",
    "flightplan": { "departure":"","arrival":"","aircraft":"","cruisingLevel":"","route":"","flightRules":"","remarks":"" },
    "nearbyAtc": [{"callsign":"","frequency":0.0,"position":""}]
  },
  "allTraffic": {
    "pilots": [
      {"userId":0,"callsign":"","lat":0.0,"lon":0.0,"altitude":0,"groundspeed":0,"heading":0,
       "transponder":"","onGround":false,
       "flightplan":{"departure":"","arrival":"","aircraft":""}}
    ],
    "atcs": [
      {"userId":0,"callsign":"","lat":0.0,"lon":0.0,"frequency":0.0,"position":""}
    ]
  },
  "networkStats": {"totalPilots":0,"totalAtc":0}
}

For myPilot: find userId == ${targetVid}. If not found set found:false and null fields.
For allTraffic.pilots: include ALL pilots from the whazzup pilots array (full list).
For allTraffic.atcs: include ALL ATC from the whazzup atcs array.
lat/lon should be lastTrack.latitude and lastTrack.longitude.
Return ONLY the JSON object.`;

      const res = await fetch(CLAUDE_API, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          tools:[{type:"web_search_20250305",name:"web_search"}],
          messages:[{role:"user",content:prompt}],
        }),
      });
      const data = await res.json();
      const text = (data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("");
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Sin respuesta JSON válida");
      const parsed = JSON.parse(match[0]);

      if (parsed.networkStats) setNetworkStats(parsed.networkStats);
      if (parsed.allTraffic)   setAllTraffic(parsed.allTraffic);
      setLastUpdate(new Date());

      if (parsed.myPilot?.found) {
        setPilotData({ ...parsed.myPilot, nearbyAtc: parsed.myPilot.nearbyAtc||[] });
      } else {
        setPilotData(null);
      }
      setScreen("main");
    } catch(err) {
      console.error(err);
      setPilotData(null);
      setScreen("main");
    } finally {
      setRefreshing(false);
    }
  },[]);

  const handleLogin = useCallback(()=>{
    if (!vid.trim()) return;
    fetchAll(vid.trim());
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(()=>fetchAll(vid.trim(),true), REFRESH_MS);
  },[vid,fetchAll]);

  const handleLogout = useCallback(()=>{
    clearInterval(intervalRef.current);
    setPilotData(null); setAllTraffic(null); setVid("");
    setScreen("login");
  },[]);

  useEffect(()=>()=>clearInterval(intervalRef.current),[]);

  const TABS = [
    {id:"flight", icon:"✈️", label:"Mi vuelo"},
    {id:"map",    icon:"🌍", label:"Tráfico"},
    {id:"friends",icon:"👥", label:"Amigos"},
  ];

  return (
    <>
      <style>{S}</style>
      <div className="app">
        {screen==="login" && (
          <LoginScreen vid={vid} setVid={setVid} onLogin={handleLogin}/>
        )}
        {screen==="loading" && <LoadingScreen msg={loadMsg}/>}
        {screen==="main" && (
          <>
            {/* Header */}
            <div className="header">
              <div className="header-top">
                <div>
                  <div className="logo">IVAO <span>Companion</span></div>
                  <div style={{fontSize:10,color:"var(--text3)"}}>
                    {vid && `VID ${vid}`} · {pilotData?"En vuelo":"No conectado"}
                  </div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <button className="btn-icon" onClick={()=>fetchAll(vid,true)} disabled={refreshing}
                    style={{fontSize:refreshing?"14px":"16px"}}>
                    {refreshing?"⟳":"↺"}
                  </button>
                  <button className="btn-icon" onClick={handleLogout} style={{fontSize:14}}>⏻</button>
                </div>
              </div>
              <div className="tab-bar">
                {TABS.map(t=>(
                  <button key={t.id} className={`tab${tab===t.id?" active":""}`}
                    onClick={()=>setTab(t.id)}>
                    <span className="icon">{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="refresh-bar"><div className="refresh-fill" key={lastUpdate?.getTime()}/></div>

            {/* Tab content */}
            {tab==="flight" && (
              <FlightTab
                pilot={pilotData}
                networkStats={networkStats}
                lastUpdate={lastUpdate}
                onRefresh={()=>fetchAll(vid,true)}
                refreshing={refreshing}
              />
            )}
            {tab==="map" && (
              <MapTab
                allTraffic={allTraffic}
                myVid={vid}
                onSelectFlight={setSelected}
              />
            )}
            {tab==="friends" && (
              <FriendsTab
                allTraffic={allTraffic}
                friends={friends}
                setFriends={setFriends}
                onSelectFlight={setSelected}
              />
            )}

            {/* Flight detail panel */}
            {selected && (
              <DetailPanel selected={selected} onClose={()=>setSelected(null)}/>
            )}
          </>
        )}
      </div>
    </>
  );
}
