import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
//  IVAO Companion v3.0 — OAuth2 PKCE completo
//  ⚠️  Verificar Client ID completo en developers.ivao.aero (puede estar truncado)
// ─────────────────────────────────────────────────────────────────────────────

const CFG = {
  clientId:    "1e1a3f0b-8703-45a4-9ac4-c3d32c",  // ← verificar UUID completo
  redirectUri: "https://claude.ai",
  sso:         "https://sso.ivao.aero",
  api:         "https://api.ivao.aero/v2",
  whazzup:     "https://api.ivao.aero/v2/tracker/whazzup",
  claudeApi:   "https://api.anthropic.com/v1/messages",
  scopes:      "openid email",
  refreshMs:   30000,
};

// ─── PKCE helpers ─────────────────────────────────────────────────────────────
async function generatePKCE() {
  const arr = crypto.getRandomValues(new Uint8Array(32));
  const verifier = btoa(String.fromCharCode(...arr))
    .replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
  return { verifier, challenge };
}

function buildAuthUrl(challenge, state) {
  const p = new URLSearchParams({
    response_type:         "code",
    client_id:             CFG.clientId,
    redirect_uri:          CFG.redirectUri,
    scope:                 CFG.scopes,
    state,
    code_challenge:        challenge,
    code_challenge_method: "S256",
  });
  return `${CFG.sso}/auth?${p}`;
}

// Decode JWT payload (sin verificar firma — solo datos)
function decodeJWT(token) {
  try {
    const payload = token.split(".")[1];
    const b64 = payload.replace(/-/g,"+").replace(/_/g,"/");
    return JSON.parse(atob(b64));
  } catch { return null; }
}

// ─── Misc helpers ─────────────────────────────────────────────────────────────
const fmtCoord = (v, lat) => {
  if (v == null) return "---";
  return `${Math.abs(v).toFixed(4)}°\u00A0${lat?(v>=0?"N":"S"):(v>=0?"E":"W")}`;
};
const fmtTime = s => {
  if (!s) return "--:--";
  return `${Math.floor(s/3600)}h\u00A0${String(Math.floor((s%3600)/60)).padStart(2,"0")}m`;
};
const phaseOf = p => {
  if (!p) return null;
  if (p.onGround)       return { label:"EN TIERRA", color:"#d97706", dot:"🟡" };
  if (p.altitude < 1500)return { label:"T/O — LND",  color:"#ea580c", dot:"🟠" };
  return { label:"AIRBORNE", color:"#16a34a", dot:"🟢" };
};
const pilotRatingLabel = n =>
  (["","FS1","FS2","FS3","PP","SPP","CP","ATP","SFI","CFI"][n]||`R${n}`);

// ─── STYLES ──────────────────────────────────────────────────────────────────
const S = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=JetBrains+Mono:wght@400;500&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#f0f6ff;--bg1:#fff;--bg2:#f6f9ff;--bg3:#eef3fb;
  --blue:#0062B8;--blue2:#0078e0;--blue3:#dbeafe;--blue4:#e8f2ff;
  --amber:#f59e0b;--green:#16a34a;--red:#dc2626;
  --text:#0f172a;--text2:#475569;--text3:#94a3b8;
  --brd:#e2e8f0;--brd2:#cbd5e1;
  --sh:0 1px 3px rgba(0,0,0,.07),0 1px 2px rgba(0,0,0,.04);
  --sh-md:0 4px 16px rgba(0,98,184,.12);
}
body{background:var(--bg)}
.app{font-family:'Plus Jakarta Sans',sans-serif;background:var(--bg);min-height:100vh;
  color:var(--text);max-width:480px;margin:0 auto;position:relative}
.mono{font-family:'JetBrains Mono',monospace}

/* ── type ── */
.lbl{font-size:10px;font-weight:700;letter-spacing:1.2px;color:var(--text3);
  text-transform:uppercase;margin-bottom:3px;display:block}
.val-lg{font-size:20px;font-weight:700;color:var(--blue);line-height:1.1}
.unit{font-size:10px;font-weight:500;color:var(--text3);margin-left:2px}

/* ── cards ── */
.card{background:var(--bg1);border:1px solid var(--brd);border-radius:12px;
  padding:16px;box-shadow:var(--sh)}
.card-sm{padding:12px;border-radius:10px}
.card-dash{background:var(--bg1);border:1px dashed var(--blue3);border-radius:12px;padding:16px}
.card-hero{background:linear-gradient(135deg,#0062B8 0%,#0080f0 100%);color:#fff;
  border:none;box-shadow:0 4px 20px rgba(0,98,184,.32)}

/* ── header ── */
.hdr{background:var(--bg1);border-bottom:1px solid var(--brd);
  padding:12px 14px 8px;position:sticky;top:0;z-index:200}
.hdr-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.logo{font-size:17px;font-weight:800;color:var(--blue);letter-spacing:-.3px}
.logo-sub{font-size:10px;color:var(--text3);margin-top:1px}

/* ── tabs ── */
.tab-bar{display:flex;gap:2px;background:var(--bg3);border-radius:10px;padding:3px}
.tab{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:7px 4px;
  border-radius:8px;border:none;background:transparent;cursor:pointer;transition:all .15s;
  color:var(--text3);font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;
  font-family:'Plus Jakarta Sans',sans-serif}
.tab .icon{font-size:16px;line-height:1}
.tab.active{background:var(--bg1);color:var(--blue);box-shadow:var(--sh)}

/* ── buttons ── */
.btn{font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;border:none;cursor:pointer;
  border-radius:10px;transition:all .15s;display:flex;align-items:center;
  justify-content:center;gap:8px}
.btn-primary{background:var(--blue);color:#fff;font-size:14px;padding:13px 20px;width:100%;
  box-shadow:0 2px 8px rgba(0,98,184,.28)}
.btn-primary:hover{background:var(--blue2)}
.btn-primary:disabled{opacity:.4;cursor:not-allowed}
.btn-sec{background:var(--bg3);color:var(--text2);font-size:13px;padding:9px 16px;
  border:1px solid var(--brd)}
.btn-sec:hover{border-color:var(--blue);color:var(--blue);background:var(--blue4)}
.btn-icon{background:var(--bg3);border:1px solid var(--brd);border-radius:8px;
  padding:7px 11px;font-size:15px;cursor:pointer;transition:all .15s;
  font-family:'Plus Jakarta Sans',sans-serif}
.btn-icon:hover{background:var(--blue4);border-color:var(--blue)}

/* ── inputs ── */
.input-lbl{font-size:10px;font-weight:700;letter-spacing:.8px;color:var(--text3);
  text-transform:uppercase;margin-bottom:5px;display:block}
.input{width:100%;background:var(--bg2);border:1.5px solid var(--brd);border-radius:10px;
  padding:11px 14px;font-family:'Plus Jakarta Sans',sans-serif;font-size:15px;font-weight:600;
  color:var(--text);outline:none;transition:all .15s}
.input:focus{border-color:var(--blue);background:#fff;box-shadow:0 0 0 3px var(--blue3)}
.input::placeholder{color:var(--text3);font-weight:500;font-size:13px}

/* ── badge ── */
.badge{display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:700;
  letter-spacing:.7px;padding:3px 8px;border-radius:20px;text-transform:uppercase}
.bg-green{background:#dcfce7;color:#16a34a}
.bg-amber{background:#fef3c7;color:#d97706}
.bg-blue{background:var(--blue3);color:var(--blue)}
.bg-gray{background:var(--bg3);color:var(--text2)}
.bg-red{background:#fee2e2;color:#dc2626}

/* ── compass ── */
.compass{width:96px;height:96px;border-radius:50%;border:1.5px solid var(--brd2);
  background:radial-gradient(circle at 35% 30%,#f6f9ff,var(--bg3));
  box-shadow:var(--sh-md);position:relative;display:flex;align-items:center;
  justify-content:center;flex-shrink:0}
.needle{position:absolute;width:2px;height:44%;bottom:50%;left:calc(50% - 1px);
  transform-origin:bottom center;display:flex;flex-direction:column;align-items:center}
.needle-body{flex:1;background:linear-gradient(to top,var(--blue),rgba(0,98,184,.15));width:2px}
.needle-tip{width:5px;height:5px;border-radius:50%;background:var(--blue);
  box-shadow:0 0 5px rgba(0,98,184,.4);margin-top:-2px}

/* ── ATC row ── */
.atc-row{display:flex;align-items:center;justify-content:space-between;padding:9px 12px;
  background:var(--bg2);border-radius:8px;border:1px solid var(--brd);margin-bottom:6px;
  cursor:pointer;transition:all .15s}
.atc-row:hover{border-color:var(--blue);background:var(--blue4)}

/* ── map ── */
#ivao-map{width:100%;height:420px;border-radius:12px;border:1px solid var(--brd);
  overflow:hidden;box-shadow:var(--sh-md)}
.map-loader{width:100%;height:420px;border-radius:12px;background:var(--bg3);
  display:flex;align-items:center;justify-content:center;flex-direction:column;
  gap:12px;font-size:13px;color:var(--text3);font-weight:500}

/* ── detail panel ── */
.detail-panel{position:fixed;bottom:0;left:50%;transform:translateX(-50%);
  width:min(480px,100vw);background:var(--bg1);border-top:1px solid var(--brd);
  border-radius:20px 20px 0 0;padding:16px 16px 32px;z-index:500;
  box-shadow:0 -8px 32px rgba(0,0,0,.1);animation:slideUp .2s ease}
@keyframes slideUp{from{transform:translate(-50%,40px);opacity:0}to{transform:translate(-50%,0);opacity:1}}
.handle{width:40px;height:4px;border-radius:2px;background:var(--brd2);margin:0 auto 14px}

/* ── friend card ── */
.fc{display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg1);
  border-radius:10px;border:1px solid var(--brd);margin-bottom:8px;transition:all .15s}
.fc.click{cursor:pointer}
.fc.click:hover{border-color:var(--blue);box-shadow:var(--sh-md)}
.favatar{width:40px;height:40px;border-radius:10px;background:var(--blue4);display:flex;
  align-items:center;justify-content:center;font-size:17px;font-weight:800;
  color:var(--blue);flex-shrink:0}

/* ── login ── */
.login-wrap{min-height:100vh;display:flex;flex-direction:column;justify-content:center;
  align-items:center;padding:32px 20px;gap:24px;
  background:linear-gradient(155deg,#f0f6ff 0%,#e2edff 100%)}
.login-box{width:100%;max-width:360px;display:flex;flex-direction:column;gap:10px}
.divider-or{display:flex;align-items:center;gap:10px;color:var(--text3);font-size:11px;font-weight:600}
.divider-or::before,.divider-or::after{content:'';flex:1;height:1px;background:var(--brd)}

/* ── OAuth card ── */
.oauth-wrap{background:linear-gradient(135deg,#0062B8,#0080f0);color:#fff;
  border-radius:14px;padding:18px;box-shadow:0 4px 20px rgba(0,98,184,.3)}
.oauth-title{font-size:15px;font-weight:800;margin-bottom:4px}
.oauth-sub{font-size:11px;opacity:.85;line-height:1.6}
.oauth-btn{margin-top:12px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.4);
  color:#fff;padding:10px 16px;border-radius:9px;font-weight:700;font-size:13px;cursor:pointer;
  width:100%;font-family:'Plus Jakarta Sans',sans-serif;transition:all .15s;
  display:flex;align-items:center;justify-content:center;gap:8px}
.oauth-btn:hover{background:rgba(255,255,255,.28)}
.oauth-btn:disabled{opacity:.5;cursor:not-allowed}

/* ── user profile chip ── */
.profile-chip{display:flex;align-items:center;gap:10px;padding:10px 14px;
  background:var(--blue4);border:1px solid var(--blue3);border-radius:10px}
.avatar{width:38px;height:38px;border-radius:9px;background:var(--blue);display:flex;
  align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:16px;flex-shrink:0}

/* ── status steps ── */
.step{display:flex;align-items:center;gap:10px;padding:9px 0;
  border-bottom:1px solid var(--brd);font-size:13px}
.step:last-child{border-bottom:none}
.step-icon{font-size:16px;width:24px;text-align:center;flex-shrink:0}
.step-done{color:var(--green);font-weight:600}
.step-active{color:var(--blue);font-weight:600}
.step-wait{color:var(--text3)}

/* ── misc ── */
.content{padding:12px;display:flex;flex-direction:column;gap:10px;padding-bottom:80px}
.sec-hdr{font-size:10px;font-weight:800;color:var(--text3);letter-spacing:1px;
  text-transform:uppercase;margin:4px 0 8px;display:flex;align-items:center;gap:6px}
.hr{height:1px;background:var(--brd);margin:12px 0}
.empty{text-align:center;padding:28px 16px;color:var(--text3)}
.empty-ico{font-size:34px;margin-bottom:8px}
.fade-in{animation:fadeIn .25s ease}
@keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
.refresh-bar{height:2px;background:var(--brd);overflow:hidden}
.refresh-fill{height:100%;background:var(--blue);animation:drain 30s linear forwards}
@keyframes drain{from{width:100%}to{width:0%}}
.chip{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:8px;
  background:var(--bg3);border:1px solid var(--brd);font-size:11px;font-weight:600}
.chip .dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.dg{background:var(--green)}.da{background:var(--amber)}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.route-row{display:flex;align-items:center;gap:8px;font-size:18px;font-weight:800;letter-spacing:1px}
.route-line{flex:1;height:2px;background:linear-gradient(90deg,var(--blue3),var(--blue));
  border-radius:1px;position:relative}
.route-line::after{content:'▶';position:absolute;right:-8px;top:-7px;font-size:10px;color:var(--blue)}
.route-text{font-size:11px;color:var(--text2);line-height:1.7;margin-top:6px;
  max-height:56px;overflow-y:auto;font-family:'JetBrains Mono',monospace}
.spin{border-radius:50%;border:3px solid var(--blue3);border-top-color:var(--blue);
  animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.center{min-height:100vh;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:18px;background:var(--bg)}
.phase-pill{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;
  border-radius:20px;font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase}
code{background:var(--bg3);padding:2px 6px;border-radius:4px;font-size:11px;
  font-family:'JetBrains Mono',monospace;color:var(--blue)}
`;

// ─── Small components ─────────────────────────────────────────────────────────
function Spin({ size=40 }) {
  return <div className="spin" style={{width:size,height:size}}/>;
}

function Compass({ heading }) {
  const dirs = [
    {l:"N",s:{top:5,left:"50%",transform:"translateX(-50%)"},c:"var(--blue)"},
    {l:"E",s:{right:5,top:"50%",transform:"translateY(-50%)"},c:"var(--text3)"},
    {l:"S",s:{bottom:5,left:"50%",transform:"translateX(-50%)"},c:"var(--text3)"},
    {l:"W",s:{left:5,top:"50%",transform:"translateY(-50%)"},c:"var(--text3)"},
  ];
  return (
    <div className="compass">
      {dirs.map(d=>(
        <span key={d.l} style={{position:"absolute",...d.s,fontSize:9,fontWeight:800,color:d.c}}>{d.l}</span>
      ))}
      {[0,45,90,135,180,225,270,315].map(deg=>(
        <div key={deg} style={{
          position:"absolute",top:"50%",left:"50%",
          width:deg%90===0?"2px":"1px",height:deg%90===0?"10px":"6px",
          background:deg%90===0?"rgba(0,98,184,.2)":"rgba(0,98,184,.1)",
          transformOrigin:"50% -36px",
          transform:`translateX(-50%) rotate(${deg}deg)`,marginTop:"-36px",
        }}/>
      ))}
      <div className="needle" style={{transform:`rotate(${heading||0}deg)`}}>
        <div className="needle-body"/><div className="needle-tip"/>
      </div>
      <div style={{fontSize:10,fontWeight:700,color:"var(--blue)",
        fontFamily:"'JetBrains Mono',monospace",position:"absolute",bottom:14}}>
        {heading!=null?`${heading}°`:"---"}
      </div>
    </div>
  );
}

function DataCell({ label, value, unit, color, mono }) {
  return (
    <div>
      <span className="lbl">{label}</span>
      <div className={`val-lg${mono?" mono":""}`} style={color?{color}:{}}>
        {value ?? <span style={{color:"var(--text3)"}}>---</span>}
        {unit && <span className="unit">{unit}</span>}
      </div>
    </div>
  );
}

function NetworkBar({ stats, lastUpdate }) {
  return (
    <div className="card card-sm" style={{background:"var(--bg2)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",gap:16}}>
          <div><span className="lbl">Pilotos</span>
            <div style={{fontSize:17,fontWeight:800,color:"var(--green)"}}>{stats?.totalPilots?.toLocaleString()||"—"}</div>
          </div>
          <div><span className="lbl">ATC</span>
            <div style={{fontSize:17,fontWeight:800,color:"var(--amber)"}}>{stats?.totalAtc?.toLocaleString()||"—"}</div>
          </div>
        </div>
        {lastUpdate && (
          <div style={{fontSize:10,color:"var(--text3)",textAlign:"right",lineHeight:1.5}}>
            {lastUpdate.toLocaleTimeString("es-ES")}<br/><span style={{fontSize:9}}>actualizado</span>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailPanel({ selected, onClose }) {
  if (!selected) return null;
  const { type, data } = selected;
  return (
    <div className="detail-panel">
      <div className="handle"/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
        <div>
          <div style={{fontSize:22,fontWeight:800,color:"var(--blue)"}}>{data.callsign}</div>
          <span className={`badge ${type==="pilot"?"bg-blue":"bg-amber"}`} style={{marginTop:4}}>
            {type==="pilot"?"✈ PILOTO":"📻 ATC"}
          </span>
        </div>
        <button onClick={onClose} className="btn-icon" style={{fontSize:13,fontWeight:700}}>✕</button>
      </div>
      {type==="pilot" && (
        <div className="g2">
          <DataCell label="Altitud"    value={data.altitude?.toLocaleString()} unit="ft"/>
          <DataCell label="Velocidad"  value={data.groundspeed} unit="kt"/>
          <DataCell label="Heading"    value={data.heading!=null?`${data.heading}°`:null}/>
          <DataCell label="Transponder" value={data.transponder||"2000"} mono/>
          {data.flightplan?.departure && <>
            <DataCell label="Salida"  value={data.flightplan.departure} color="var(--blue)"/>
            <DataCell label="Destino" value={data.flightplan.arrival||"---"} color="var(--green)"/>
          </>}
          {data.flightplan?.aircraft && <DataCell label="Aeronave" value={data.flightplan.aircraft}/>}
          {data.userId && <DataCell label="VID" value={data.userId} mono/>}
        </div>
      )}
      {type==="atc" && (
        <div className="g2">
          <DataCell label="Frecuencia" value={data.frequency?.toFixed(3)} unit="MHz" color="var(--amber)"/>
          <DataCell label="Posición"   value={data.position||"---"}/>
          {data.userId && <DataCell label="VID" value={data.userId} mono/>}
        </div>
      )}
    </div>
  );
}

// ─── OAuth2 PKCE Flow ─────────────────────────────────────────────────────────
function LoginScreen({ onAuthComplete }) {
  const [step, setStep]       = useState("idle"); // idle|waiting|exchanging|fetching|done|error
  const [errMsg, setErrMsg]   = useState("");
  const [vid, setVid]         = useState("");
  const pkceRef               = useRef(null);
  const stateRef              = useRef(null);
  const popupRef              = useRef(null);
  const pollRef               = useRef(null);

  const cleanup = () => {
    clearInterval(pollRef.current);
    try { popupRef.current?.close(); } catch {}
  };

  const fail = msg => { cleanup(); setErrMsg(msg); setStep("error"); };

  // Exchange auth code for token
  const exchangeCode = async (code) => {
    setStep("exchanging");
    try {
      const body = new URLSearchParams({
        grant_type:    "authorization_code",
        code,
        redirect_uri:  CFG.redirectUri,
        client_id:     CFG.clientId,
        code_verifier: pkceRef.current.verifier,
      });

      // Direct fetch to IVAO token endpoint (CORS allowed for browser apps)
      const res = await fetch(`${CFG.sso}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      if (!res.ok) {
        const err = await res.json().catch(()=>({}));
        throw new Error(err.error_description || `Token exchange failed: ${res.status}`);
      }

      const tokens = await res.json();
      const accessToken = tokens.access_token;
      if (!accessToken) throw new Error("No access_token en respuesta");

      // Decode JWT to get VID (sub field = VID in IVAO SSO)
      const payload = decodeJWT(accessToken);
      const userVid = payload?.sub || payload?.vid || null;

      setStep("fetching");

      // Fetch user profile
      const profile = await fetchUserProfile(accessToken, userVid);

      onAuthComplete({ accessToken, vid: userVid, profile });
    } catch(e) {
      console.error("Token exchange error:", e);
      fail(`Error al intercambiar token: ${e.message}`);
    }
  };

  // Fetch user profile from IVAO API
  const fetchUserProfile = async (token, vid) => {
    try {
      // Try direct fetch first
      const res = await fetch(`${CFG.api}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) return await res.json();
    } catch {}

    // Fallback: use Claude API proxy
    try {
      const r = await fetch(CFG.claudeApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{
            role: "user",
            content: `Fetch https://api.ivao.aero/v2/users/me with Authorization: Bearer ${token}
Return ONLY this JSON (no markdown):
{"id":0,"firstName":"","lastName":"","pilotRating":{"id":0},"atcRating":{"id":0},"division":{"id":""}}`
          }]
        })
      });
      const d = await r.json();
      const text = (d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("");
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch {}
    return null;
  };

  // Start OAuth2 PKCE flow
  const startOAuth = async () => {
    try {
      pkceRef.current = await generatePKCE();
      stateRef.current = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36);
      const url = buildAuthUrl(pkceRef.current.challenge, stateRef.current);

      const popup = window.open(url, "ivao_auth",
        "width=520,height=660,resizable=yes,scrollbars=yes");
      popupRef.current = popup;

      if (!popup) {
        fail("El navegador bloqueó el popup. Permite popups para claude.ai e inténtalo de nuevo.");
        return;
      }

      setStep("waiting");

      // Poll popup location — cross-origin throws until redirect back to claude.ai (same origin)
      pollRef.current = setInterval(() => {
        try {
          if (!popup || popup.closed) {
            cleanup();
            setStep("idle");
            return;
          }

          const href = popup.location.href;

          // Popup is back on our origin
          if (href && href.startsWith(CFG.redirectUri)) {
            cleanup();
            const url = new URL(href);

            // Error from provider
            const error = url.searchParams.get("error");
            if (error) {
              fail(`IVAO devolvió error: ${error} — ${url.searchParams.get("error_description")||""}`);
              return;
            }

            // Authorization code
            const code = url.searchParams.get("code");
            const retState = url.searchParams.get("state");
            if (!code) { fail("No se recibió código de autorización."); return; }
            if (retState && retState !== stateRef.current) { fail("State mismatch — posible CSRF."); return; }

            popup.close();
            exchangeCode(code);
          }
        } catch {
          // Still on IVAO domain (cross-origin) — keep polling
        }
      }, 500);
    } catch(e) {
      fail(`Error iniciando OAuth2: ${e.message}`);
    }
  };

  // Quick VID login (no OAuth)
  const handleVidLogin = () => {
    if (!vid.trim()) return;
    onAuthComplete({ accessToken: null, vid: vid.trim(), profile: null });
  };

  const steps = [
    { key:"waiting",    label:"Esperando login en ventana IVAO…" },
    { key:"exchanging", label:"Intercambiando código por token…" },
    { key:"fetching",   label:"Obteniendo perfil de usuario…" },
  ];
  const activeStepIdx = steps.findIndex(s=>s.key===step);

  return (
    <div className="login-wrap">
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:38,fontWeight:800,color:"var(--blue)",letterSpacing:-1}}>IVAO Companion</div>
        <div style={{marginTop:6}}>
          <span style={{fontSize:11,fontWeight:700,color:"var(--blue)",background:"var(--blue4)",
            padding:"2px 10px",borderRadius:20}}>v3.0</span>
        </div>
        <div style={{fontSize:13,color:"var(--text2)",marginTop:8,lineHeight:1.6}}>
          Dashboard móvil · Mapa de tráfico · Amigos
        </div>
      </div>

      <div className="login-box">

        {/* OAuth card */}
        {(step==="idle"||step==="error") && (
          <div className="oauth-wrap">
            <div className="oauth-title">🔐 Login con IVAO SSO</div>
            <div className="oauth-sub">
              Accede con tu usuario y contraseña de IVAO.<br/>
              Flujo OAuth2 PKCE · Sin contraseña en la app.
            </div>
            <button className="oauth-btn" onClick={startOAuth}>
              <span>Abrir login IVAO</span>
              <span>→</span>
            </button>
            {step==="error" && (
              <div style={{marginTop:10,background:"rgba(255,255,255,.15)",
                borderRadius:8,padding:"8px 12px",fontSize:11,lineHeight:1.5}}>
                ⚠️ {errMsg}
              </div>
            )}
          </div>
        )}

        {/* Progress steps */}
        {(step==="waiting"||step==="exchanging"||step==="fetching") && (
          <div className="card">
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <Spin size={22}/>
              <div style={{fontSize:13,fontWeight:700,color:"var(--blue)"}}>Autenticando con IVAO…</div>
            </div>
            {steps.map((s,i)=>(
              <div key={s.key} className="step">
                <span className="step-icon">
                  {i < activeStepIdx?"✅" : i===activeStepIdx ? "⏳" : "⬜"}
                </span>
                <span className={
                  i < activeStepIdx?"step-done" :
                  i===activeStepIdx?"step-active":"step-wait"
                }>{s.label}</span>
              </div>
            ))}
            <button onClick={()=>{cleanup();setStep("idle");}}
              className="btn-sec" style={{marginTop:14,width:"100%"}}>
              Cancelar
            </button>
          </div>
        )}

        <div className="divider-or">o acceso directo por VID</div>

        <div>
          <label className="input-lbl">Tu VID de IVAO</label>
          <input className="input" type="number" placeholder="Ej. 687072"
            value={vid} onChange={e=>setVid(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&vid&&handleVidLogin()}/>
        </div>
        <button className="btn btn-sec" onClick={handleVidLogin} disabled={!vid.trim()}>
          Conectar solo con VID
        </button>

        <div style={{background:"var(--bg3)",border:"1px solid var(--brd)",borderRadius:10,
          padding:12,fontSize:11,color:"var(--text2)",lineHeight:1.7}}>
          <strong style={{color:"var(--text)"}}>ℹ️ Sobre el login OAuth2</strong>
          <div style={{marginTop:4}}>
            Se abrirá la web oficial de IVAO para que inicies sesión.<br/>
            Redirige a <code>claude.ai</code> y la app captura el token automáticamente.<br/>
            <span style={{color:"var(--text3)"}}>
              Client ID: <code>{CFG.clientId.slice(0,16)}…</code>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── FlightTab ────────────────────────────────────────────────────────────────
function FlightTab({ pilot, user, networkStats, lastUpdate, onRefresh, refreshing }) {
  const phase = phaseOf(pilot);
  const [showMap, setShowMap] = useState(false);

  if (!pilot) {
    return (
      <div className="content">
        {user && (
          <div className="profile-chip">
            <div className="avatar">{user.firstName?.charAt(0)||"?"}</div>
            <div>
              <div style={{fontSize:13,fontWeight:700}}>{user.firstName} {user.lastName}</div>
              <div style={{fontSize:11,color:"var(--text2)"}}>
                VID {user.id} · {pilotRatingLabel(user.pilotRating?.id)} · {user.division?.id||"---"}
              </div>
              <span className="badge bg-gray" style={{marginTop:3}}>No conectado en red</span>
            </div>
          </div>
        )}
        <div className="card empty">
          <div className="empty-ico">📡</div>
          <div style={{fontSize:13,fontWeight:500}}>No conectado a la red IVAO</div>
          <div style={{fontSize:11,color:"var(--text3)",marginTop:4}}>Inicia Altitude y recarga</div>
          <button onClick={onRefresh} className="btn btn-sec"
            style={{marginTop:12,width:"auto",padding:"8px 20px"}} disabled={refreshing}>
            {refreshing?"Cargando…":"↺ Reintentar"}
          </button>
        </div>
        {networkStats && <NetworkBar stats={networkStats} lastUpdate={lastUpdate}/>}
      </div>
    );
  }

  return (
    <div className="content fade-in">
      {/* Callsign hero */}
      <div className="card card-hero">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            {user && (
              <div style={{fontSize:11,opacity:.7,marginBottom:4}}>
                {user.firstName} {user.lastName} · VID {user.id}
              </div>
            )}
            <div style={{fontSize:10,fontWeight:700,letterSpacing:1.2,opacity:.65,
              textTransform:"uppercase",marginBottom:3}}>Callsign</div>
            <div style={{fontSize:34,fontWeight:800,letterSpacing:2,lineHeight:1}}>
              {pilot.callsign||"------"}
            </div>
            <div style={{fontSize:11,opacity:.65,marginTop:5,fontFamily:"'JetBrains Mono',monospace"}}>
              {fmtCoord(pilot.latitude,true)} · {fmtCoord(pilot.longitude,false)}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
            {phase && (
              <div className="phase-pill" style={{background:"rgba(255,255,255,.2)",
                color:"#fff",border:"1px solid rgba(255,255,255,.25)"}}>
                <span style={{fontSize:13}}>{phase.dot}</span>
                <span style={{fontSize:9}}>{phase.label}</span>
              </div>
            )}
            <div style={{fontSize:10,opacity:.65,fontFamily:"'JetBrains Mono',monospace"}}>
              SQK {pilot.transponder||"2000"}
            </div>
            <div style={{fontSize:10,opacity:.65}}>{pilot.serverId||"---"}</div>
          </div>
        </div>
      </div>

      {/* Instruments */}
      <div className="card">
        <div style={{display:"flex",gap:16,alignItems:"center"}}>
          <Compass heading={pilot.heading}/>
          <div style={{flex:1,display:"flex",flexDirection:"column",gap:14}}>
            <DataCell label="Altitud MSL" value={pilot.altitude?.toLocaleString()} unit="ft"/>
            <DataCell label="Groundspeed" value={pilot.groundspeed} unit="kt"
              color={pilot.groundspeed>0?"var(--green)":"var(--text3)"}/>
          </div>
        </div>
        <div className="hr"/>
        <div className="g2">
          <DataCell label="Heading"    value={pilot.heading!=null?`${pilot.heading}°`:null}/>
          <DataCell label="Conectado"  value={fmtTime(pilot.connectedSeconds)} mono/>
        </div>
      </div>

      {/* Position map */}
      {pilot.latitude && pilot.longitude && (
        <div className="card card-sm">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}
            onClick={()=>setShowMap(v=>!v)}>
            <div style={{fontSize:13,fontWeight:700}}>🗺 Mi posición</div>
            <span style={{fontSize:11,color:"var(--text3)"}}>{showMap?"▲ Ocultar":"▼ Mostrar"}</span>
          </div>
          {showMap && (
            <iframe
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${pilot.longitude-.5},${pilot.latitude-.5},${pilot.longitude+.5},${pilot.latitude+.5}&layer=mapnik&marker=${pilot.latitude},${pilot.longitude}`}
              style={{width:"100%",height:180,border:"none",borderRadius:8,marginTop:10}}
              title="Posición" sandbox="allow-scripts allow-same-origin"
            />
          )}
        </div>
      )}

      {/* FPL */}
      {pilot.flightplan && (
        <div className="card">
          <div className="sec-hdr">✈ Plan de vuelo</div>
          <div className="route-row">
            <span style={{color:"var(--blue)"}}>{pilot.flightplan.departure||"????"}</span>
            <div className="route-line"/>
            <span style={{color:"var(--green)"}}>{pilot.flightplan.arrival||"????"}</span>
          </div>
          <div className="hr"/>
          <div className="g3">
            <DataCell label="Aeronave"   value={pilot.flightplan.aircraft||"---"}/>
            <DataCell label="Nivel"      value={pilot.flightplan.cruisingLevel||"---"}/>
            <DataCell label="Reglas"     value={pilot.flightplan.flightRules||"---"}
              color={pilot.flightplan.flightRules==="I"?"var(--blue)":"var(--amber)"}/>
          </div>
          {pilot.flightplan.route && <>
            <span className="lbl" style={{marginTop:10}}>Ruta</span>
            <div className="route-text">{pilot.flightplan.route}</div>
          </>}
        </div>
      )}

      {/* ATC */}
      <div className="card">
        <div className="sec-hdr">📻 ATC en área</div>
        {pilot.nearbyAtc?.length > 0
          ? pilot.nearbyAtc.slice(0,6).map((a,i)=>(
            <div className="atc-row" key={i}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:"var(--blue)"}}>{a.callsign}</div>
                {a.position && <div style={{fontSize:10,color:"var(--text3)",marginTop:1}}>{a.position}</div>}
              </div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:14,
                fontWeight:500,color:"var(--amber)"}}>{a.frequency?.toFixed(3)}</div>
            </div>
          ))
          : <div style={{fontSize:12,color:"var(--text3)",padding:"4px 0"}}>Sin ATC activo · UNICOM 122.800</div>
        }
      </div>

      {networkStats && <NetworkBar stats={networkStats} lastUpdate={lastUpdate}/>}

      <div className="card-dash">
        <span className="lbl" style={{color:"var(--amber)"}}>🔧 Control remoto · v1.2</span>
        <div style={{fontSize:11,color:"var(--text2)",lineHeight:1.7,marginTop:4}}>
          <strong>Opción B · RDP/LAN</strong> — acceso remoto a Altitude UI desde tablet.<br/>
          Radio, transponder, chat y FPL en tiempo real.
        </div>
      </div>
    </div>
  );
}

// ─── MapTab ───────────────────────────────────────────────────────────────────
function MapTab({ allTraffic, myVid, onSelectFlight }) {
  const leafletRef = useRef(null);
  const markersRef = useRef([]);
  const [mapReady, setMapReady] = useState(false);
  const [filter, setFilter]     = useState("all");

  useEffect(()=>{
    if (leafletRef.current) return;
    let cancelled=false;
    const init=async()=>{
      if (!window.L){
        await new Promise((res,rej)=>{
          const s=document.createElement("script");
          s.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          s.onload=res;s.onerror=rej;document.head.appendChild(s);
        });
      }
      if (!document.getElementById("leaflet-css")){
        const l=document.createElement("link");
        l.id="leaflet-css";l.rel="stylesheet";
        l.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(l);
      }
      await new Promise(r=>setTimeout(r,300));
      if(cancelled)return;
      const el=document.getElementById("ivao-map");
      if(!el)return;
      const map=window.L.map(el,{center:[40,0],zoom:3});
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
        attribution:'© <a href="https://openstreetmap.org">OSM</a>',maxZoom:18,
      }).addTo(map);
      leafletRef.current=map;
      setMapReady(true);
    };
    init().catch(console.error);
    return()=>{cancelled=true;if(leafletRef.current){leafletRef.current.remove();leafletRef.current=null;}};
  },[]);

  useEffect(()=>{
    if(!mapReady||!leafletRef.current||!allTraffic)return;
    const L=window.L,map=leafletRef.current;
    markersRef.current.forEach(m=>m.remove());
    markersRef.current=[];
    const pilots=filter!=="atc"?(allTraffic.pilots||[]):[];
    const atcs=filter!=="pilots"?(allTraffic.atcs||[]):[];
    pilots.forEach(p=>{
      if(p.lat==null||p.lon==null)return;
      const isMe=String(p.userId)===String(myVid);
      const color=isMe?"#ef4444":"#0062B8",size=isMe?14:8;
      const icon=L.divIcon({
        html:`<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:${isMe?3:1.5}px solid rgba(255,255,255,.75);box-shadow:0 1px 4px rgba(0,0,0,.25)"></div>`,
        className:"",iconAnchor:[size/2,size/2],
      });
      const m=L.marker([p.lat,p.lon],{icon}).addTo(map).on("click",()=>onSelectFlight({type:"pilot",data:p}));
      markersRef.current.push(m);
    });
    atcs.forEach(a=>{
      if(a.lat==null||a.lon==null)return;
      const icon=L.divIcon({
        html:`<div style="width:10px;height:10px;transform:rotate(45deg);background:#f59e0b;border:1.5px solid rgba(255,255,255,.7);box-shadow:0 1px 4px rgba(0,0,0,.25)"></div>`,
        className:"",iconAnchor:[5,5],
      });
      const m=L.marker([a.lat,a.lon],{icon}).addTo(map).on("click",()=>onSelectFlight({type:"atc",data:a}));
      markersRef.current.push(m);
    });
  },[allTraffic,mapReady,filter,myVid,onSelectFlight]);

  return (
    <div className="content">
      <div style={{display:"flex",gap:8,alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",gap:6}}>
          <div className="chip"><div className="dot dg"/><span>{allTraffic?.pilots?.length||0} pilotos</span></div>
          <div className="chip"><div className="dot da"/><span>{allTraffic?.atcs?.length||0} ATC</span></div>
        </div>
        <select value={filter} onChange={e=>setFilter(e.target.value)}
          style={{fontSize:12,padding:"5px 8px",borderRadius:7,border:"1px solid var(--brd)",
            background:"var(--bg1)",color:"var(--text)",fontFamily:"'Plus Jakarta Sans',sans-serif",
            fontWeight:600,outline:"none"}}>
          <option value="all">Todos</option>
          <option value="pilots">Solo pilotos</option>
          <option value="atc">Solo ATC</option>
        </select>
      </div>
      {!mapReady && <div className="map-loader"><Spin/><span>Cargando mapa…</span></div>}
      <div id="ivao-map" style={{display:mapReady?"block":"none"}}/>
      <div className="card card-sm">
        <div style={{display:"flex",gap:14,fontSize:11,color:"var(--text2)",alignItems:"center",flexWrap:"wrap"}}>
          {[["#0062B8","Piloto"],["#ef4444","Mi vuelo"],["#f59e0b","ATC"]].map(([c,l])=>(
            <span key={l} style={{display:"flex",alignItems:"center",gap:5}}>
              <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:c}}/>
              {l}
            </span>
          ))}
          <span style={{marginLeft:"auto",fontSize:10,color:"var(--text3)"}}>Tap = detalles</span>
        </div>
      </div>
    </div>
  );
}

// ─── FriendsTab ───────────────────────────────────────────────────────────────
function FriendsTab({ allTraffic, friends, setFriends, onSelectFlight }) {
  const [newVid, setNewVid]   = useState("");
  const [newName, setNewName] = useState("");

  const add = () => {
    if (!newVid.trim()) return;
    const v = newVid.trim();
    if (friends.some(f=>f.vid===v)) { setNewVid(""); return; }
    setFriends(f=>[...f,{vid:v,name:newName.trim()||`VID ${v}`}]);
    setNewVid(""); setNewName("");
  };
  const remove = vid => setFriends(f=>f.filter(x=>x.vid!==vid));

  const status = vid => {
    const pilot=allTraffic?.pilots?.find(p=>String(p.userId)===String(vid));
    if(pilot)return{online:true,pilot};
    const atc=allTraffic?.atcs?.find(a=>String(a.userId)===String(vid));
    if(atc)return{online:true,atc};
    return{online:false};
  };

  const online  = friends.filter(f=>status(f.vid).online);
  const offline = friends.filter(f=>!status(f.vid).online);

  return (
    <div className="content">
      <div className="card">
        <div className="sec-hdr">➕ Añadir amigo</div>
        <div className="g2" style={{marginBottom:8}}>
          <div>
            <label className="input-lbl">VID IVAO</label>
            <input className="input" type="number" placeholder="687072"
              value={newVid} onChange={e=>setNewVid(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&add()}/>
          </div>
          <div>
            <label className="input-lbl">Alias</label>
            <input className="input" type="text" placeholder="Nombre"
              value={newName} onChange={e=>setNewName(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&add()}/>
          </div>
        </div>
        <button className="btn btn-primary" onClick={add} disabled={!newVid.trim()}>Añadir</button>
      </div>

      {friends.length===0 ? (
        <div className="card empty">
          <div className="empty-ico">👥</div>
          <div style={{fontSize:13,fontWeight:500}}>Sin amigos añadidos</div>
          <div style={{fontSize:11,color:"var(--text3)",marginTop:4}}>Añade VIDs para rastrearlos en tiempo real</div>
        </div>
      ) : (<>
        {online.length>0 && <>
          <div className="sec-hdr"><span className="badge bg-green">● {online.length} online</span></div>
          {online.map(f=>{
            const {pilot,atc}=status(f.vid);
            return(
              <div className="fc click" key={f.vid}
                onClick={()=>{if(pilot)onSelectFlight({type:"pilot",data:pilot});if(atc)onSelectFlight({type:"atc",data:atc});}}>
                <div className="favatar">{f.name.charAt(0).toUpperCase()}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{f.name}</div>
                  <div style={{fontSize:11,color:"var(--text2)"}}>VID {f.vid}</div>
                  <div style={{marginTop:4,display:"flex",gap:5,flexWrap:"wrap"}}>
                    {pilot&&<><span className="badge bg-green">● FLYING</span><span className="badge bg-blue">{pilot.callsign}</span>{pilot.flightplan?.departure&&<span className="badge bg-gray">{pilot.flightplan.departure}→{pilot.flightplan.arrival||"???"}</span>}</>}
                    {atc&&<><span className="badge bg-green">● ATC</span><span className="badge bg-amber">{atc.callsign}</span></>}
                  </div>
                </div>
                <button onClick={e=>{e.stopPropagation();remove(f.vid);}}
                  style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:19,padding:"4px",lineHeight:1}}>×</button>
              </div>
            );
          })}
        </>}
        {offline.length>0 && <>
          <div className="sec-hdr" style={{marginTop:4}}><span style={{color:"var(--text3)"}}>● {offline.length} offline</span></div>
          {offline.map(f=>(
            <div className="fc" key={f.vid}>
              <div className="favatar" style={{opacity:.35}}>{f.name.charAt(0).toUpperCase()}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,opacity:.5}}>{f.name}</div>
                <div style={{fontSize:11,color:"var(--text2)"}}>VID {f.vid}</div>
                <span className="badge bg-gray" style={{marginTop:3}}>OFFLINE</span>
              </div>
              <button onClick={()=>remove(f.vid)}
                style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:19,padding:"4px",lineHeight:1}}>×</button>
            </div>
          ))}
        </>}
      </>)}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen]             = useState("login");
  const [auth, setAuth]                 = useState(null);   // {accessToken, vid, profile}
  const [tab, setTab]                   = useState("flight");
  const [pilotData, setPilotData]       = useState(null);
  const [allTraffic, setAllTraffic]     = useState(null);
  const [networkStats, setNetworkStats] = useState(null);
  const [lastUpdate, setLastUpdate]     = useState(null);
  const [refreshing, setRefreshing]     = useState(false);
  const [selected, setSelected]         = useState(null);
  const [friends, setFriends]           = useState([]);

  const intervalRef = useRef(null);

  // ── Fetch whazzup via Claude proxy ──────────────────────────────────────────
  const fetchWhazzup = useCallback(async (vid, silent=false) => {
    if (!silent) setRefreshing(true);

    try {
      const prompt = `Fetch https://api.ivao.aero/v2/tracker/whazzup
Return ONLY raw JSON (no markdown, no backticks, no explanation):
{
  "myPilot":{"found":false,"callsign":"","altitude":0,"groundspeed":0,"heading":0,"latitude":null,"longitude":null,"onGround":false,"transponder":"","connectedSeconds":0,"serverId":"","flightplan":{"departure":"","arrival":"","aircraft":"","cruisingLevel":"","route":"","flightRules":"","remarks":""},"nearbyAtc":[{"callsign":"","frequency":0.0,"position":""}]},
  "allTraffic":{"pilots":[{"userId":0,"callsign":"","lat":null,"lon":null,"altitude":0,"groundspeed":0,"heading":0,"transponder":"","onGround":false,"flightplan":{"departure":"","arrival":"","aircraft":""}}],"atcs":[{"userId":0,"callsign":"","lat":null,"lon":null,"frequency":0.0,"position":""}]},
  "networkStats":{"totalPilots":0,"totalAtc":0}
}
Rules: myPilot = pilot where userId==${vid}; set found:true. lat/lon from lastTrack. Return ONLY JSON.`;

      const res = await fetch(CFG.claudeApi, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          tools:[{type:"web_search_20250305",name:"web_search"}],
          messages:[{role:"user",content:prompt}],
        }),
      });
      if(!res.ok) throw new Error(`Claude API ${res.status}`);
      const data = await res.json();
      const text = (data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("");
      const match = text.match(/\{[\s\S]*\}/);
      if(!match) throw new Error("No JSON");
      const parsed = JSON.parse(match[0]);

      if(parsed.networkStats) setNetworkStats(parsed.networkStats);
      if(parsed.allTraffic)   setAllTraffic(parsed.allTraffic);
      setLastUpdate(new Date());
      setPilotData(parsed.myPilot?.found ? parsed.myPilot : null);
    } catch(e) {
      console.error("fetchWhazzup:", e);
    } finally {
      setRefreshing(false);
    }
  },[]);

  // ── Auth complete callback ─────────────────────────────────────────────────
  const handleAuthComplete = useCallback((authData) => {
    setAuth(authData);
    setScreen("main");
    fetchWhazzup(authData.vid);
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(()=>fetchWhazzup(authData.vid,true), CFG.refreshMs);
  },[fetchWhazzup]);

  const handleLogout = useCallback(()=>{
    clearInterval(intervalRef.current);
    setAuth(null); setPilotData(null); setAllTraffic(null);
    setSelected(null); setScreen("login"); setTab("flight");
  },[]);

  useEffect(()=>()=>clearInterval(intervalRef.current),[]);

  const TABS = [
    {id:"flight",  icon:"✈️",  label:"Mi vuelo"},
    {id:"map",     icon:"🌍",  label:"Tráfico"},
    {id:"friends", icon:"👥",  label:"Amigos"},
  ];

  const user = auth?.profile;

  return (
    <>
      <style>{S}</style>
      <div className="app">
        {screen==="login" && <LoginScreen onAuthComplete={handleAuthComplete}/>}

        {screen==="main" && (
          <>
            {/* Header */}
            <div className="hdr">
              <div className="hdr-top">
                <div>
                  <div className="logo">IVAO Companion</div>
                  <div className="logo-sub">
                    {user ? `${user.firstName} ${user.lastName} · VID ${auth.vid}` : `VID ${auth?.vid}`}
                    {" · "}{pilotData?"En vuelo":"No conectado"}
                  </div>
                </div>
                <div style={{display:"flex",gap:7,alignItems:"center"}}>
                  <button className="btn-icon" onClick={()=>fetchWhazzup(auth?.vid,true)}
                    disabled={refreshing} title="Refrescar">
                    {refreshing?"⟳":"↺"}
                  </button>
                  <button className="btn-icon" onClick={handleLogout} title="Salir">⏻</button>
                </div>
              </div>
              <div className="tab-bar">
                {TABS.map(t=>(
                  <button key={t.id} className={`tab${tab===t.id?" active":""}`}
                    onClick={()=>{setTab(t.id);setSelected(null);}}>
                    <span className="icon">{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="refresh-bar">
              <div className="refresh-fill" key={lastUpdate?.getTime()}/>
            </div>

            {tab==="flight" && (
              <FlightTab pilot={pilotData} user={user}
                networkStats={networkStats} lastUpdate={lastUpdate}
                onRefresh={()=>fetchWhazzup(auth?.vid,true)} refreshing={refreshing}/>
            )}
            {tab==="map" && (
              <MapTab allTraffic={allTraffic} myVid={auth?.vid} onSelectFlight={setSelected}/>
            )}
            {tab==="friends" && (
              <FriendsTab allTraffic={allTraffic} friends={friends}
                setFriends={setFriends} onSelectFlight={setSelected}/>
            )}
            {selected && <DetailPanel selected={selected} onClose={()=>setSelected(null)}/>}
          </>
        )}
      </div>
    </>
  );
}
