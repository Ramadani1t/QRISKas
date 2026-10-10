const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

const encoder = new TextEncoder();
const toHex = bytes => [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
async function sign(value, secret) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}
async function generateViewToken(imageKey, expiresInSeconds = 86400 * 2, secret) {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const payload = `${imageKey}:${exp}`;
  const sig = await sign(payload, secret);
  return { exp, sig, key: imageKey };
}
async function verifyViewToken(imageKey, expStr, sig, secret) {
  const exp = Number(expStr);
  if (!exp || isNaN(exp) || exp < Date.now() / 1000) return false;
  const payload = `${imageKey}:${exp}`;
  const expectedSig = await sign(payload, secret);
  return sig === expectedSig;
}
function makeViewUrl(origin, imageKey, exp, sig) {
  return `${origin}/view?key=${encodeURIComponent(imageKey)}&exp=${exp}&sig=${sig}`;
}
function makeRawViewUrl(origin, imageKey, exp, sig) {
  return `${origin}/view/raw?key=${encodeURIComponent(imageKey)}&exp=${exp}&sig=${sig}`;
}
function formatExpTime(timestamp) {
  try {
    const d = new Date(timestamp * 1000);
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      dateStyle: "medium",
      timeStyle: "short"
    }).format(d) + " WIB";
  } catch (_) {
    return "";
  }
}
function renderWebViewerPage({ key = "", exp = 0, sig = "", obj = null, origin = "", error = null }) {
  const headers = new Headers({ "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  if (error) {
    return new Response(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0a0903"><title>Tautan Kedaluwarsa • QRIS Kas</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;background:radial-gradient(circle at 50% 0,#3a3006,#0a0903 55%);color:#fffef5;font-family:system-ui,-apple-system,sans-serif}.container{width:min(100%,440px);text-align:center}.box{background:#141208;border:1px solid #3d3312;border-radius:24px;padding:32px 24px;box-shadow:0 25px 70px rgba(0,0,0,0.85)}.badge{display:inline-flex;align-items:center;gap:6px;background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);padding:6px 14px;border-radius:999px;font-size:12px;font-weight:700;margin-bottom:16px}.icon{width:56px;height:56px;margin:0 auto 16px;background:rgba(239,68,68,0.1);border-radius:18px;display:flex;align-items:center;justify-content:center;color:#ef4444}h1{margin:0 0 10px;font-size:22px;color:#fffef5;font-weight:900}p{margin:0 0 24px;color:#a89f82;font-size:14px;line-height:1.6}.btn{display:inline-block;width:100%;padding:14px 20px;background:linear-gradient(135deg,#ffe566,#ffd000);color:#0d0b00;text-decoration:none;font-weight:900;font-size:15px;border-radius:14px;transition:transform .15s ease}.btn:active{transform:scale(0.98)}.foot{margin-top:20px;font-size:11.5px;color:#786f56}</style></head><body><div class="container"><div class="box"><div class="badge"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>Akses Dibatasi</span></div><div class="icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div><h1>Tautan Tidak Aktif / Kedaluwarsa</h1><p>${error}</p><a href="${origin}/login" class="btn">Masuk ke Aplikasi Kasir</a><div class="foot">QRIS Kas • Tahunya Krispiya &bull; Keamanan Terenkripsi</div></div></div></body></html>`, { status: 401, headers });
  }

  const meta = (obj && obj.customMetadata) || {};
  let amount = meta.amount ? Number(meta.amount) : 0;
  if (!amount && key) {
    const amtMatch = key.match(/-(\d+)-(?:regular|surplus|cashout|expense|pending)-/);
    if (amtMatch) amount = Number(amtMatch[1]);
  }
  const isSurplus = meta.isSurplus === "true" || key.includes("-surplus-");
  const isCashout = meta.isCashout === "true" || key.includes("-cashout-");
  const isRevised = meta.isRevised === "true";
  const isExpense = meta.isExpense === "true" || key.includes("-expense-");
  const isPending = meta.isPending === "true" || key.includes("-pending-");
  const note = meta.note || "";
  let savedAt = meta.savedAt || "";
  if (!savedAt && key) {
    const dateMatch = key.match(/^images\/(\d{4})\/(\d{2})\/(\d{2})\/(\d{2})(\d{2})(\d{2})/);
    if (dateMatch) {
      savedAt = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]} ${dateMatch[4]}:${dateMatch[5]}:${dateMatch[6]} WIB`;
    }
  }

  const tagLabel = isExpense ? "STRUK BELANJA CASH" : isSurplus ? "SURPLUS KAS" : isCashout ? "TUKAR KE CASH" : isRevised ? "REVISI / SUSULAN" : isPending ? "FOTO PENDING" : "BUKTI QRIS";
  const tagColor = isExpense ? "#f43f5e" : isSurplus ? "#38bdf8" : isCashout ? "#fbbf24" : isRevised ? "#c084fc" : isPending ? "#22d3ee" : "#ffd000";
  const tagBg = isExpense ? "rgba(244,63,94,0.15)" : isSurplus ? "rgba(56,189,248,0.15)" : isCashout ? "rgba(251,191,36,0.15)" : isRevised ? "rgba(192,132,252,0.18)" : isPending ? "rgba(34,211,238,0.15)" : "rgba(255,208,0,0.15)";
  const expLabel = formatExpTime(exp);
  const rawUrl = makeRawViewUrl(origin, key, exp, sig);
  const formattedAmount = amount ? new Intl.NumberFormat("id-ID").format(amount) : "0";

  return new Response(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0a0903"><title>Lihat Bukti Transaksi • QRIS Kas</title><style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:#090803;color:#fffef5;font-family:system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
.page-wrap{max-width:880px;margin:0 auto;padding:16px 14px 40px}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0 16px;border-bottom:1px solid #28210b;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:10px}
.brand-logo{width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,#ffe566,#ffd000);color:#0d0b00;display:grid;place-items:center;font-weight:900;font-size:20px;box-shadow:0 4px 14px rgba(255,208,0,0.3)}
.brand-title{font-size:16px;font-weight:900;color:#fffef5;margin:0}
.brand-sub{font-size:11px;color:#a89f82;margin:1px 0 0}
.secure-pill{display:inline-flex;align-items:center;gap:6px;background:rgba(255,208,0,0.08);border:1px solid rgba(255,208,0,0.22);color:#ffd000;padding:5px 12px;border-radius:999px;font-size:11px;font-weight:700}
.card{background:#120f06;border:1px solid #342a0e;border-radius:20px;margin-top:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.8)}
.card-header{padding:14px 18px;background:#171407;border-bottom:1px solid #2c230c;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.card-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.amount-badge{font-size:18px;font-weight:900;color:${tagColor};background:${tagBg};border:1px solid ${tagColor}40;padding:4px 12px;border-radius:10px}
.type-badge{font-size:11px;font-weight:800;color:${tagColor};border:1px solid ${tagColor}50;padding:4px 10px;border-radius:8px;text-transform:uppercase;letter-spacing:0.04em}
.time-info{font-size:12px;color:#d4caa8;display:flex;align-items:center;gap:6px}
.note-box{padding:10px 18px;background:#0d0b04;border-bottom:1px solid #241c09;font-size:12px;color:#f3ecd8;display:flex;align-items:flex-start;gap:8px}
.note-box strong{color:#ffd000;font-weight:800;flex-shrink:0}
.viewer-wrap{position:relative;background:#050402;min-height:360px;max-height:74vh;display:flex;align-items:center;justify-content:center;overflow:hidden;user-select:none;touch-action:none}
.viewer-img{max-width:100%;max-height:74vh;object-fit:contain;transition:transform .12s ease-out;transform-origin:center center;display:block}
.viewer-toolbar{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);display:flex;gap:6px;background:rgba(18,15,6,0.85);backdrop-filter:blur(10px);border:1px solid #4a3c14;border-radius:999px;padding:4px 8px;box-shadow:0 8px 30px rgba(0,0,0,0.8);z-index:10}
.tool-btn{background:transparent;border:0;color:#fffef5;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;cursor:pointer;transition:all .15s}
.tool-btn:hover{background:rgba(255,208,0,0.18);color:#ffd000}
.tool-btn:active{transform:scale(0.92)}
.zoom-level-badge{position:absolute;top:12px;right:12px;background:rgba(0,0,0,0.7);border:1px solid #342a0e;color:#ffd000;font-size:11px;font-weight:800;padding:3px 8px;border-radius:6px;pointer-events:none}
.card-footer{padding:14px 18px;background:#141107;border-top:1px solid #2c230c;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.download-btn{display:inline-flex;align-items:center;gap:6px;padding:10px 16px;background:linear-gradient(135deg,#ffe566,#ffd000);color:#0d0b00;font-weight:800;font-size:13px;border-radius:12px;text-decoration:none;transition:transform .15s}
.download-btn:active{transform:scale(0.98)}
.foot-info{font-size:11px;color:#8a8064;line-height:1.5}
.notice-box{margin-top:18px;background:#0e0b04;border:1px solid #281f08;border-radius:14px;padding:12px 16px;font-size:11.5px;color:#a89f82;line-height:1.6;display:flex;align-items:center;gap:10px}
.notice-box svg{color:#ffd000;flex-shrink:0}
.login-link{color:#ffd000;text-decoration:none;font-weight:700}
.login-link:hover{text-decoration:underline}
</style></head><body>
<div class="page-wrap">
  <header>
    <div class="brand">
      <div class="brand-logo">Q</div>
      <div>
        <h1 class="brand-title">QRIS Kas • Tahunya Krispiya</h1>
        <p class="brand-sub">Pratinjau Bukti Digital Resmi</p>
      </div>
    </div>
    <div class="secure-pill">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      <span>Tautan Sementara &bull; Exp: ${expLabel || "48 Jam"}</span>
    </div>
  </header>

  <main class="card">
    <div class="card-header">
      <div class="card-meta">
        <span class="amount-badge">Rp ${formattedAmount}</span>
        <span class="type-badge">${tagLabel}</span>
      </div>
      ${savedAt ? `<div class="time-info"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span>${savedAt}</span></div>` : ""}
    </div>

    ${note ? `<div class="note-box"><strong>Keterangan:</strong><span>${note.replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}</span></div>` : ""}

    <div class="viewer-wrap" id="viewerWrap">
      <img src="${rawUrl}" alt="Bukti Transaksi" class="viewer-img" id="viewerImg" draggable="false">
      <div class="zoom-level-badge" id="zoomBadge">100%</div>
      <div class="viewer-toolbar">
        <button type="button" class="tool-btn" id="zoomInBtn" title="Perbesar (+)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </button>
        <button type="button" class="tool-btn" id="zoomOutBtn" title="Perkecil (-)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </button>
        <button type="button" class="tool-btn" id="resetBtn" title="Reset (1:1)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        </button>
        <button type="button" class="tool-btn" id="rotateBtn" title="Putar 90 Derajat (R)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
        </button>
      </div>
    </div>

    <div class="card-footer">
      <a href="${rawUrl}" download="bukti-transaksi.jpg" class="download-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span>Unduh Foto Bukti</span>
      </a>
      <div class="foot-info">
        Pencatatan kasir terlindungi enkripsi HMAC-SHA256.<br>
        Akses khusus lembar bukti terpilih.
      </div>
    </div>
  </main>

  <aside class="notice-box">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
    <div>
      Halaman ini beroperasi dalam mode pratinjau publik bertoken terbatas. Fitur kelola kasir dan riwayat toko tetap terlindungi. Kasir toko? <a href="${origin}/login" class="login-link">Masuk ke aplikasi kasir &rarr;</a>
    </div>
  </aside>
</div>

<script>
(()=>{
  let scale = 1, rotation = 0, panX = 0, panY = 0, isDragging = false, startX = 0, startY = 0;
  const img = document.getElementById("viewerImg");
  const wrap = document.getElementById("viewerWrap");
  const badge = document.getElementById("zoomBadge");

  function update() {
    img.style.transform = "translate(" + panX + "px, " + panY + "px) scale(" + scale + ") rotate(" + rotation + "deg)";
    badge.textContent = Math.round(scale * 100) + "%";
    wrap.style.cursor = scale > 1 ? (isDragging ? "grabbing" : "grab") : "default";
  }

  document.getElementById("zoomInBtn").onclick = () => { scale = Math.min(4, scale + 0.3); update(); };
  document.getElementById("zoomOutBtn").onclick = () => { scale = Math.max(0.5, scale - 0.3); if (scale <= 1) { panX = 0; panY = 0; } update(); };
  document.getElementById("resetBtn").onclick = () => { scale = 1; rotation = 0; panX = 0; panY = 0; update(); };
  document.getElementById("rotateBtn").onclick = () => { rotation = (rotation + 90) % 360; update(); };

  wrap.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    if (ev.deltaY < 0) scale = Math.min(4, scale + 0.15);
    else scale = Math.max(0.5, scale - 0.15);
    if (scale <= 1) { panX = 0; panY = 0; }
    update();
  }, { passive: false });

  wrap.addEventListener("dblclick", () => {
    if (scale > 1.1) { scale = 1; panX = 0; panY = 0; }
    else { scale = 2; }
    update();
  });

  wrap.addEventListener("mousedown", (ev) => {
    if (scale <= 1) return;
    isDragging = true;
    startX = ev.clientX - panX;
    startY = ev.clientY - panY;
    wrap.style.cursor = "grabbing";
  });
  window.addEventListener("mousemove", (ev) => {
    if (!isDragging) return;
    panX = ev.clientX - startX;
    panY = ev.clientY - startY;
    update();
  });
  window.addEventListener("mouseup", () => {
    if (isDragging) { isDragging = false; update(); }
  });

  let touchStartDist = 0, initialScale = 1;
  wrap.addEventListener("touchstart", (ev) => {
    if (ev.touches.length === 2) {
      touchStartDist = Math.hypot(ev.touches[0].clientX - ev.touches[1].clientX, ev.touches[0].clientY - ev.touches[1].clientY);
      initialScale = scale;
    } else if (ev.touches.length === 1 && scale > 1) {
      isDragging = true;
      startX = ev.touches[0].clientX - panX;
      startY = ev.touches[0].clientY - panY;
    }
  }, { passive: true });

  wrap.addEventListener("touchmove", (ev) => {
    if (ev.touches.length === 2 && touchStartDist > 0) {
      const dist = Math.hypot(ev.touches[0].clientX - ev.touches[1].clientX, ev.touches[0].clientY - ev.touches[1].clientY);
      scale = Math.min(4, Math.max(0.5, initialScale * (dist / touchStartDist)));
      update();
    } else if (ev.touches.length === 1 && isDragging) {
      panX = ev.touches[0].clientX - startX;
      panY = ev.touches[0].clientY - startY;
      update();
    }
  }, { passive: true });

  wrap.addEventListener("touchend", () => { isDragging = false; touchStartDist = 0; });
})();
</script>
</body></html>`, { status: 200, headers });
}
async function authenticated(request, env) {
  if (env.DEV_NO_AUTH === "true") return "admin";
  if (!env.AUTH_USERNAME || !env.AUTH_SECRET) return false;
  const match = request.headers.get("cookie")?.match(/(?:^|;\s*)qris_session=([^;]+)/);
  if (!match) return false;
  const token = decodeURIComponent(match[1]), dot = token.lastIndexOf(".");
  if (dot < 0) return false;
  const value = token.slice(0, dot), signature = token.slice(dot + 1);
  const parts = value.split("."), expires = Number(parts.pop()), username = parts.join(".");
  if (expires < Date.now() / 1000 || signature !== await sign(value, env.AUTH_SECRET)) return false;
  if (username === env.AUTH_USERNAME) return "admin";
  if (username === "guest") return "guest";
  return false;
}
function loginPage(error = "", cookieSet = null) {
  const headers = new Headers({ "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  if (cookieSet) headers.append("set-cookie", cookieSet);
  return new Response(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0a0903"><title>Login QRIS Kas</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;background:radial-gradient(circle at 50% 0,#3a3006,#0a0903 50%);color:#fffef5;font-family:system-ui,sans-serif}.container{width:min(100%,390px)}.box{width:100%;padding:27px;background:#141208;border:1px solid #342c10;border-radius:24px;box-shadow:0 25px 70px #000b}.logo{width:52px;height:52px;display:grid;place-items:center;border-radius:15px;background:linear-gradient(135deg,#ffe566,#ffd000);color:#0d0b00;font-size:28px;font-weight:900;box-shadow:0 4px 20px rgba(255,208,0,0.3)}h1{margin:18px 0 5px;color:#ffd000}.sub{color:#a89f82;margin:0 0 23px}.error{color:#ff9999;background:#301d1d;padding:10px;border-radius:10px;font-size:13px}label{display:block;margin:14px 0 6px;color:#d4caa8;font-size:13px;font-weight:700}input{width:100%;padding:14px;background:#0a0903;border:1px solid #342c10;border-radius:12px;color:white;font-size:16px;outline:0}input:focus{border-color:#ffd000}button{width:100%;border:0;border-radius:13px;padding:15px;margin-top:20px;background:linear-gradient(135deg,#ffe566,#ffd000);color:#0d0b00;font-size:16px;font-weight:900;cursor:pointer}.guest-btn{background:#231e0b;color:#f7ebc1;border:1px solid #342c10;margin-top:12px;box-shadow:0 4px 10px #0004}.guest-btn:active{background:#383013}.back-link{display:inline-block;width:100%;text-align:center;margin-top:24px;color:#a89f82;text-decoration:none;font-size:14px;font-weight:600;padding:10px;border-radius:12px;transition:0.2s}.back-link:hover{background:#141208;color:#ffd000}</style></head><body><div class="container"><form class="box" method="post" action="/login"><div class="logo">Q</div><h1>QRIS Kas</h1><p class="sub">Masuk untuk mengelola transaksi</p>${error ? `<p class="error">${error}</p>` : ""}<label>Username</label><input name="username" autocomplete="username" required autofocus><label>Password</label><input name="password" type="password" autocomplete="current-password" required><button type="submit">Masuk</button></form><form method="post" action="/login-guest"><button type="submit" class="guest-btn">Lihat / Intip Riwayat Saja</button></form><a href="https://tahunyakrispiya.my.id" class="back-link">← Kembali ke Web Utama</a></div></body></html>`, { status: error ? 401 : 200, headers });
}

function safeAmount(value) {
  const amount = Number(String(value || "").replace(/\D/g, ""));
  return Number.isSafeInteger(amount) && amount > 0 && amount <= 1_000_000_000 ? amount : 0;
}

function jakartaParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

async function performCleanup(env, days) {
  if (!days || days <= 0) return { deletedRecords: 0, deletedImages: 0, message: "Auto-delete nonaktif." };
  
  const cutoffTimestamp = Date.now() - (days * 86400 * 1000);
  let truncated = true;
  let cursor = undefined;
  let deletedRecords = 0;
  let deletedImages = 0;

  while (truncated) {
    const list = await env.RECEIPTS.list({ prefix: "records/", cursor, limit: 500 });
    const keysToDelete = [];
    const imageKeysToDelete = [];

    for (const obj of list.objects) {
      const match = obj.key.match(/^records\/(\d{4})\/(\d{2})\/(\d{2})\//);
      let objTime = obj.uploaded ? obj.uploaded.getTime() : 0;
      if (match) {
        const recordDate = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`).getTime();
        if (!isNaN(recordDate)) objTime = recordDate;
      }
      if (objTime < cutoffTimestamp) {
        keysToDelete.push(obj.key);
        const imgKey = obj.key.replace(/^records\//, "images/").replace(/\.json$/, ".jpg");
        imageKeysToDelete.push(imgKey);
      }
    }

    if (keysToDelete.length > 0) {
      await env.RECEIPTS.delete(keysToDelete);
      deletedRecords += keysToDelete.length;
    }
    if (imageKeysToDelete.length > 0) {
      await env.RECEIPTS.delete(imageKeysToDelete);
      deletedImages += imageKeysToDelete.length;
    }

    truncated = list.truncated;
    cursor = list.cursor;
  }

  return { deletedRecords, deletedImages, days };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/login" && request.method === "GET") return await authenticated(request, env) ? Response.redirect(`${url.origin}/`, 302) : loginPage();
    if (url.pathname === "/login" && request.method === "POST") {
      const attemptsMatch = request.headers.get("cookie")?.match(/(?:^|;\s*)login_attempts=([^;]+)/);
      let attempts = attemptsMatch ? Number(attemptsMatch[1]) : 0;
      if (attempts >= 5) {
        return loginPage("Terlalu banyak percobaan gagal. Tunggu beberapa menit.", `login_attempts=${attempts}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=300`);
      }

      const form = await request.formData();
      if (form.get("username") !== env.AUTH_USERNAME || form.get("password") !== env.AUTH_PASSWORD) {
        attempts++;
        return loginPage("Username atau password salah.", `login_attempts=${attempts}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=300`);
      }
      const cookie = await sessionCookie(env.AUTH_USERNAME, env.AUTH_SECRET);
      const response = new Response(null, { status: 302 });
      response.headers.append("location", "/");
      response.headers.append("set-cookie", `qris_session=${cookie}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`);
      response.headers.append("set-cookie", `login_attempts=0; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
      return response;
    }
    if (url.pathname === "/login-guest" && request.method === "POST") {
      const cookie = await sessionCookie("guest", env.AUTH_SECRET);
      const response = new Response(null, { status: 302 });
      response.headers.append("location", "/");
      response.headers.append("set-cookie", `qris_session=${cookie}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`);
      return response;
    }
    if (url.pathname === "/logout" && request.method === "POST") {
      const response = new Response(null, { status: 302 });
      response.headers.append("location", "/login");
      response.headers.append("set-cookie", "qris_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
      return response;
    }
    if (url.pathname === "/sw.js" || url.pathname === "/manifest.webmanifest" || url.pathname.endsWith(".webmanifest")) {
      return env.ASSETS.fetch(request);
    }

    // === PUBLIC VIEW WITH EXPIRING TOKEN (Tanpa Perlu Login) ===
    if (url.pathname === "/view" || url.pathname === "/v" || url.pathname === "/view/raw" || url.pathname === "/v/raw") {
      let key = url.searchParams.get("key") || "";
      let exp = url.searchParams.get("exp") || "";
      let sig = url.searchParams.get("sig") || "";

      if (!key && url.searchParams.get("t")) {
        const parts = url.searchParams.get("t").split(".");
        if (parts.length >= 3) {
          sig = parts.pop();
          exp = parts.pop();
          key = decodeURIComponent(parts.join("."));
        }
      }

      const isRaw = url.pathname.endsWith("/raw");

      if (!key || !exp || !sig || !key.startsWith("images/")) {
        return isRaw
          ? new Response("Tautan tidak valid.", { status: 400 })
          : renderWebViewerPage({ error: "Tautan pratinjau tidak valid.", origin: url.origin });
      }

      const isValid = await verifyViewToken(key, exp, sig, env.AUTH_SECRET);
      if (!isValid) {
        const isExpired = Number(exp) && Number(exp) < Date.now() / 1000;
        const msg = isExpired
          ? "Tautan pratinjau ini sudah kedaluwarsa (expired). Demi keamanan privasi data transaksi toko, silakan minta tautan baru dari kasir."
          : "Tautan pratinjau tidak sah atau tanda tangan token salah.";
        return isRaw
          ? new Response(msg, { status: 401 })
          : renderWebViewerPage({ error: msg, origin: url.origin });
      }

      const obj = await env.RECEIPTS.get(key);
      if (!obj) {
        return isRaw
          ? new Response("Foto tidak ditemukan.", { status: 404 })
          : renderWebViewerPage({ error: "Foto struk tidak ditemukan atau telah dibersihkan oleh siklus retensi otomatis.", origin: url.origin });
      }

      if (isRaw) {
        return new Response(obj.body, {
          status: 200,
          headers: {
            "content-type": obj.httpMetadata?.contentType || "image/jpeg",
            "cache-control": "private, max-age=3600",
            "x-content-type-options": "nosniff"
          }
        });
      }

      return renderWebViewerPage({ key, exp, sig, obj, origin: url.origin });
    }

    const role = await authenticated(request, env);
    if (!role) {
      if (url.pathname.startsWith("/api/")) return json({ error: "Sesi login berakhir." }, 401);
      return Response.redirect(`${url.origin}/login`, 302);
    }

    if (url.pathname === "/api/share-token" && request.method === "GET") {
      const key = url.searchParams.get("key");
      if (!key || typeof key !== "string" || !key.startsWith("images/")) {
        return json({ error: "Key foto tidak valid." }, 400);
      }
      const expDays = Math.min(7, Math.max(1, Number(url.searchParams.get("days") || 2)));
      const token = await generateViewToken(key, 86400 * expDays, env.AUTH_SECRET);
      return json({
        key,
        exp: token.exp,
        expiresIn: 86400 * expDays,
        viewUrl: makeViewUrl(url.origin, key, token.exp, token.sig),
        rawViewUrl: makeRawViewUrl(url.origin, key, token.exp, token.sig)
      });
    }
    
    if (url.pathname === "/api/receipts" && request.method === "GET") {
      try {
        const now = jakartaParts();
        const requested = url.searchParams.get("date") || `${now.year}-${now.month}-${now.day}`;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(requested)) return json({ error: "Tanggal tidak valid." }, 400);
        const [year, month, day] = requested.split("-");
        const listed = await env.RECEIPTS.list({ prefix: `records/${year}/${month}/${day}/`, limit: 1000 });
        const records = (await Promise.all(listed.objects.map(async object => {
          const stored = await env.RECEIPTS.get(object.key);
          if (!stored) return null;
          const record = await stored.json();
          const token = await generateViewToken(record.imageKey, 86400 * 2, env.AUTH_SECRET);
          return {
            ...record,
            recordKey: object.key,
            viewUrl: makeViewUrl(url.origin, record.imageKey, token.exp, token.sig),
            rawViewUrl: makeRawViewUrl(url.origin, record.imageKey, token.exp, token.sig)
          };
        }))).filter(Boolean).sort((a, b) => a.savedAt.localeCompare(b.savedAt));
        const publicBase = String(env.R2_PUBLIC_URL || "").replace(/\/$/, "");
        return json({ role, date: requested, records: records.map(record => ({ ...record, imageUrl: `${publicBase}/${record.imageKey}` })) });
      } catch (error) {
        return json({ error: "Gagal mengambil riwayat.", detail: error.message }, 500);
      }
    }
    if (url.pathname === "/api/receipts" && request.method === "DELETE") {
      if (role !== "admin") return json({ error: "Akses ditolak. Anda hanya dalam mode intip." }, 403);
      try {
        const pinHeader = request.headers.get("x-delete-pin");
        const pwdHeader = request.headers.get("x-delete-password");
        
        if (!env.DELETE_PIN || pinHeader !== env.DELETE_PIN) {
          return json({ error: "[Verifikasi 1 Gagal] PIN Hapus salah." }, 401);
        }

        if (!env.AUTH_PASSWORD || pwdHeader !== env.AUTH_PASSWORD) {
          return json({ error: "[Verifikasi 2 Gagal] Password Admin salah." }, 401);
        }

        const { recordKey } = await request.json();
        if (typeof recordKey !== "string" || !/^records\/\d{4}\/\d{2}\/\d{2}\/[\w-]+\.json$/.test(recordKey)) return json({ error: "Catatan tidak valid." }, 400);
        const stored = await env.RECEIPTS.get(recordKey);
        if (!stored) return json({ error: "Transaksi tidak ditemukan." }, 404);
        const record = await stored.json();
        if (typeof record.imageKey !== "string" || !record.imageKey.startsWith("images/")) return json({ error: "Data foto tidak valid." }, 400);
        await env.RECEIPTS.delete([recordKey, record.imageKey]);
        return json({ deleted: true });
      } catch (error) {
        return json({ error: "Gagal menghapus transaksi.", detail: error.message }, 500);
      }
    }
    if (url.pathname === "/api/receipts" && request.method === "PUT") {
      if (role !== "admin") return json({ error: "Akses ditolak." }, 403);
      try {
        if (!env.DELETE_PIN || request.headers.get("x-delete-pin") !== env.DELETE_PIN) return json({ error: "PIN salah." }, 401);
        const { recordKey, newAmount, newDate, newTime, newNote, newIsSurplus, newIsCashout, newIsRevised, newIsExpense } = await request.json();
        if (typeof recordKey !== "string") return json({ error: "Record key tidak valid." }, 400);
        const stored = await env.RECEIPTS.get(recordKey);
        if (!stored) return json({ error: "Transaksi tidak ditemukan." }, 404);
        const record = await stored.json();
        if (newAmount !== undefined) {
          const sa = safeAmount(newAmount);
          if (!sa) return json({ error: "Nominal tidak valid." }, 400);
          record.amount = sa;
        }

        let datePart = record.savedAt ? record.savedAt.split("T")[0] : "";
        let timePart = record.savedAt && record.savedAt.includes("T") ? record.savedAt.split("T")[1].slice(0, 8) : "00:00:00";
        let [hh, mm, ss] = timePart.split(":");
        if (!hh) hh = "00";
        if (!mm) mm = "00";
        if (!ss) ss = "00";

        if (newDate) {
          const dMatch = String(newDate).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (dMatch) {
            datePart = `${dMatch[1]}-${dMatch[2]}-${dMatch[3]}`;
          } else {
            return json({ error: "Format tanggal tidak valid (gunakan YYYY-MM-DD)." }, 400);
          }
        }

        if (newTime) {
          const sanitized = String(newTime).trim().replace(".", ":");
          const match = sanitized.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
          if (match) {
            hh = match[1].padStart(2, "0");
            mm = match[2].padStart(2, "0");
            ss = (match[3] || ss || "00").padStart(2, "0");
          } else {
            return json({ error: "Format jam tidak valid (gunakan HH:mm)." }, 400);
          }
        }

        if (datePart) {
          record.savedAt = `${datePart}T${hh}:${mm}:${ss}+07:00`;
        }

        if (newNote !== undefined) {
          record.note = String(newNote).trim().slice(0, 250);
        }
        if (newIsSurplus !== undefined) {
          record.isSurplus = Boolean(newIsSurplus);
        }
        if (newIsCashout !== undefined) {
          record.isCashout = Boolean(newIsCashout);
        }
        if (newIsRevised !== undefined) {
          record.isRevised = Boolean(newIsRevised);
        }
        if (newIsExpense !== undefined) {
          record.isExpense = Boolean(newIsExpense);
        }

        const [targetYear, targetMonth, targetDay] = datePart.split("-");
        const expectedPrefix = `records/${targetYear}/${targetMonth}/${targetDay}/`;
        let targetRecordKey = recordKey;

        if (!recordKey.startsWith(expectedPrefix)) {
          const filename = recordKey.split("/").pop();
          targetRecordKey = `${expectedPrefix}${filename}`;
          const oldImageKey = record.imageKey;
          const newImageKey = `images/${targetYear}/${targetMonth}/${targetDay}/${filename.replace(/\.json$/, ".jpg")}`;

          if (oldImageKey && oldImageKey !== newImageKey) {
            const imgObj = await env.RECEIPTS.get(oldImageKey);
            if (imgObj) {
              await env.RECEIPTS.put(newImageKey, imgObj.body, {
                httpMetadata: imgObj.httpMetadata,
                customMetadata: imgObj.customMetadata
              });
              await env.RECEIPTS.delete(oldImageKey);
              record.imageKey = newImageKey;
            }
          }

          await env.RECEIPTS.put(targetRecordKey, JSON.stringify(record), { httpMetadata: { contentType: "application/json" } });
          await env.RECEIPTS.delete(recordKey);
        } else {
          await env.RECEIPTS.put(recordKey, JSON.stringify(record), { httpMetadata: { contentType: "application/json" } });
        }

        return json({ updated: true, record, recordKey: targetRecordKey });
      } catch (error) {
        return json({ error: "Gagal mengedit transaksi.", detail: error.message }, 500);
      }
    }
    // === PENDING RECEIPTS API (Delay Save / Foto Dulu, Nominal Nanti) ===
    if (url.pathname === "/api/pending" && request.method === "POST") {
      if (role !== "admin") return json({ error: "Akses ditolak." }, 403);
      try {
        const form = await request.formData();
        const image = form.get("image");
        if (!(image instanceof File) || !image.type.startsWith("image/")) return json({ error: "Foto tidak valid." }, 400);
        if (image.size > 2_000_000) return json({ error: "Foto maksimal 2 MB." }, 413);

        const p = jakartaParts();
        const savedAt = `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+07:00`;
        const id = crypto.randomUUID().slice(0, 8);
        const base = `${p.year}/${p.month}/${p.day}/${p.hour}${p.minute}${p.second}-pending-${id}`;
        const imageKey = `images/${base}.jpg`;
        const recordKey = `records/${base}.json`;

        const recordData = {
          amount: 0, savedAt, imageKey,
          isSurplus: false, isCashout: false, isRevised: false, isExpense: false,
          isPending: true, note: ""
        };

        await Promise.all([
          env.RECEIPTS.put(imageKey, image.stream(), {
            httpMetadata: { contentType: "image/jpeg", cacheControl: "public, max-age=31536000, immutable" },
            customMetadata: { savedAt, isPending: "true" }
          }),
          env.RECEIPTS.put(recordKey, JSON.stringify(recordData), {
            httpMetadata: { contentType: "application/json" }
          })
        ]);

        const token = await generateViewToken(imageKey, 86400 * 2, env.AUTH_SECRET);
        const viewUrl = makeViewUrl(url.origin, imageKey, token.exp, token.sig);
        const rawViewUrl = makeRawViewUrl(url.origin, imageKey, token.exp, token.sig);
        const publicBase = String(env.R2_PUBLIC_URL || "").replace(/\/$/, "");
        return json({ savedAt, recordKey, imageKey, imageUrl: `${publicBase}/${imageKey}`, viewUrl, rawViewUrl, isPending: true });
      } catch (error) {
        return json({ error: "Gagal menyimpan foto pending.", detail: error.message }, 500);
      }
    }
    if (url.pathname === "/api/pending" && request.method === "GET") {
      if (role !== "admin") return json({ error: "Akses ditolak." }, 403);
      try {
        const now = jakartaParts();
        const requested = url.searchParams.get("date") || `${now.year}-${now.month}-${now.day}`;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(requested)) return json({ error: "Tanggal tidak valid." }, 400);
        const [year, month, day] = requested.split("-");
        const listed = await env.RECEIPTS.list({ prefix: `records/${year}/${month}/${day}/`, limit: 1000 });
        const records = (await Promise.all(listed.objects.map(async object => {
          const stored = await env.RECEIPTS.get(object.key);
          if (!stored) return null;
          const data = await stored.json();
          if (!data.isPending) return null;
          const token = await generateViewToken(data.imageKey, 86400 * 2, env.AUTH_SECRET);
          return {
            ...data,
            recordKey: object.key,
            viewUrl: makeViewUrl(url.origin, data.imageKey, token.exp, token.sig),
            rawViewUrl: makeRawViewUrl(url.origin, data.imageKey, token.exp, token.sig)
          };
        }))).filter(Boolean).sort((a, b) => a.savedAt.localeCompare(b.savedAt));
        const publicBase = String(env.R2_PUBLIC_URL || "").replace(/\/$/, "");
        return json({ role, date: requested, records: records.map(r => ({ ...r, imageUrl: `${publicBase}/${r.imageKey}` })) });
      } catch (error) {
        return json({ error: "Gagal mengambil daftar pending.", detail: error.message }, 500);
      }
    }
    if (url.pathname === "/api/pending" && request.method === "PATCH") {
      if (role !== "admin") return json({ error: "Akses ditolak." }, 403);
      try {
        const body = await request.json();
        const { recordKey, amount: rawAmount, note, isSurplus, isCashout, isRevised, isExpense } = body;
        if (typeof recordKey !== "string") return json({ error: "Record key tidak valid." }, 400);
        const stored = await env.RECEIPTS.get(recordKey);
        if (!stored) return json({ error: "Transaksi pending tidak ditemukan." }, 404);
        const record = await stored.json();
        if (!record.isPending) return json({ error: "Transaksi ini sudah dikonfirmasi." }, 400);

        const confirmedAmount = safeAmount(rawAmount);
        if (!confirmedAmount) return json({ error: "Nominal tidak valid." }, 400);

        record.amount = confirmedAmount;
        record.isPending = false;
        if (note !== undefined) record.note = String(note).trim().slice(0, 250);
        if (isSurplus !== undefined) record.isSurplus = Boolean(isSurplus);
        if (isCashout !== undefined) record.isCashout = Boolean(isCashout);
        if (isRevised !== undefined) record.isRevised = Boolean(isRevised);
        if (isExpense !== undefined) record.isExpense = Boolean(isExpense);

        await env.RECEIPTS.put(recordKey, JSON.stringify(record), {
          httpMetadata: { contentType: "application/json" }
        });

        const token = await generateViewToken(record.imageKey, 86400 * 2, env.AUTH_SECRET);
        const viewUrl = makeViewUrl(url.origin, record.imageKey, token.exp, token.sig);
        const rawViewUrl = makeRawViewUrl(url.origin, record.imageKey, token.exp, token.sig);
        const publicBase = String(env.R2_PUBLIC_URL || "").replace(/\/$/, "");
        return json({ confirmed: true, record: { ...record, recordKey, imageUrl: `${publicBase}/${record.imageKey}`, viewUrl, rawViewUrl } });
      } catch (error) {
        return json({ error: "Gagal mengkonfirmasi pending.", detail: error.message }, 500);
      }
    }
    if (url.pathname === "/api/receipts" && request.method === "POST") {
      if (role !== "admin") return json({ error: "Akses ditolak. Anda hanya dalam mode intip." }, 403);
      try {
        const form = await request.formData();
        const image = form.get("image");
        const amount = safeAmount(form.get("amount"));
        const customDate = form.get("customDate");
        const customTime = form.get("customTime");
        const isSurplus = form.get("isSurplus") === "true" || form.get("type") === "surplus";
        const isCashout = form.get("isCashout") === "true" || form.get("type") === "cashout";
        const isRevised = form.get("isRevised") === "true" || form.get("isRevision") === "true";
        const isExpense = form.get("isExpense") === "true" || form.get("type") === "expense";
        const note = form.get("note") ? String(form.get("note")).trim().slice(0, 250) : "";
        
        if (!(image instanceof File) || !image.type.startsWith("image/")) return json({ error: "Foto tidak valid." }, 400);
        if (!amount) return json({ error: "Nominal tidak valid." }, 400);
        if (image.size > 2_000_000) return json({ error: "Foto maksimal 2 MB." }, 413);

        const p = jakartaParts();
        let targetYear = p.year;
        let targetMonth = p.month;
        let targetDay = p.day;
        let targetHour = p.hour;
        let targetMinute = p.minute;
        let targetSecond = p.second;

        if (customDate) {
          const dMatch = String(customDate).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (dMatch) {
            targetYear = dMatch[1];
            targetMonth = dMatch[2];
            targetDay = dMatch[3];
          }
        }

        if (customTime) {
          const tMatch = String(customTime).trim().match(/^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
          if (tMatch) {
            targetHour = tMatch[1].padStart(2, "0");
            targetMinute = tMatch[2].padStart(2, "0");
            targetSecond = (tMatch[3] || targetSecond).padStart(2, "0");
          }
        }

        const savedAt = `${targetYear}-${targetMonth}-${targetDay}T${targetHour}:${targetMinute}:${targetSecond}+07:00`;
        const id = crypto.randomUUID().slice(0, 8);
        const prefixFlag = isExpense ? "expense" : (isSurplus ? "surplus" : (isCashout ? "cashout" : "regular"));
        const base = `${targetYear}/${targetMonth}/${targetDay}/${targetHour}${targetMinute}${targetSecond}-${amount}-${prefixFlag}-${id}`;
        const imageKey = `images/${base}.jpg`;
        const recordKey = `records/${base}.json`;

        const recordData = { amount, savedAt, imageKey, isSurplus, isCashout, isRevised, isExpense, note };

        await Promise.all([
          env.RECEIPTS.put(imageKey, image.stream(), {
            httpMetadata: { contentType: "image/jpeg", cacheControl: "public, max-age=31536000, immutable" },
            customMetadata: { amount: String(amount), savedAt, isSurplus: String(isSurplus), isCashout: String(isCashout), isRevised: String(isRevised), isExpense: String(isExpense), note }
          }),
          env.RECEIPTS.put(recordKey, JSON.stringify(recordData), {
            httpMetadata: { contentType: "application/json" }
          })
        ]);
        const token = await generateViewToken(imageKey, 86400 * 2, env.AUTH_SECRET);
        const viewUrl = makeViewUrl(url.origin, imageKey, token.exp, token.sig);
        const rawViewUrl = makeRawViewUrl(url.origin, imageKey, token.exp, token.sig);
        const publicBase = String(env.R2_PUBLIC_URL || "").replace(/\/$/, "");
        if (!publicBase || publicBase.includes("example.com")) return json({ error: "R2_PUBLIC_URL belum diatur.", saved: true }, 500);
        return json({ amount, savedAt, isSurplus, isCashout, isRevised, isExpense, note, imageUrl: `${publicBase}/${imageKey}`, viewUrl, rawViewUrl });
      } catch (error) {
        return json({ error: "Gagal menyimpan bukti. Coba lagi.", detail: error.message }, 500);
      }
    }
    if (url.pathname === "/api/config/retention" && request.method === "GET") {
      if (role !== "admin") return json({ error: "Akses ditolak." }, 403);
      try {
        const confObj = await env.RECEIPTS.get("config/retention.json");
        const conf = confObj ? await confObj.json() : { retentionDays: 30 };
        return json(conf);
      } catch (err) {
        return json({ retentionDays: 30 });
      }
    }
    if (url.pathname === "/api/config/retention" && request.method === "POST") {
      if (role !== "admin") return json({ error: "Akses ditolak." }, 403);
      try {
        const body = await request.json();
        const retentionDays = Number(body.retentionDays);
        if (isNaN(retentionDays) || retentionDays < 0) return json({ error: "Nilai retensi tidak valid." }, 400);
        const conf = { retentionDays, updatedAt: new Date().toISOString() };
        await env.RECEIPTS.put("config/retention.json", JSON.stringify(conf), {
          httpMetadata: { contentType: "application/json" }
        });
        return json({ saved: true, ...conf });
      } catch (err) {
        return json({ error: "Gagal menyimpan konfigurasi retensi.", detail: err.message }, 500);
      }
    }
    if (url.pathname === "/api/cleanup" && request.method === "POST") {
      if (role !== "admin") return json({ error: "Akses ditolak." }, 403);
      try {
        let retentionDays = 30;
        try {
          const confObj = await env.RECEIPTS.get("config/retention.json");
          if (confObj) {
            const conf = await confObj.json();
            retentionDays = Number(conf.retentionDays);
          }
        } catch (_) {}

        const result = await performCleanup(env, retentionDays);
        return json({ success: true, ...result });
      } catch (err) {
        return json({ error: "Gagal membersihkan data lama.", detail: err.message }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
  async scheduled(event, env, ctx) {
    try {
      const confObj = await env.RECEIPTS.get("config/retention.json");
      let retentionDays = 30;
      if (confObj) {
        const conf = await confObj.json();
        retentionDays = Number(conf.retentionDays);
      }
      if (retentionDays > 0) {
        ctx.waitUntil(performCleanup(env, retentionDays));
      }
    } catch (err) {
      console.error("Scheduled auto-cleanup error:", err);
    }
  }
};
