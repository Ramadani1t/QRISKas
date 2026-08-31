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
async function sessionCookie(username, secret) {
  const value = `${username}.${Math.floor(Date.now() / 1000) + 86400 * 7}`;
  return `${encodeURIComponent(value)}.${await sign(value, secret)}`;
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
    const role = await authenticated(request, env);
    if (!role) {
      if (url.pathname.startsWith("/api/")) return json({ error: "Sesi login berakhir." }, 401);
      return Response.redirect(`${url.origin}/login`, 302);
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
          return stored ? { ...(await stored.json()), recordKey: object.key } : null;
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
        const { recordKey, newAmount, newTime } = await request.json();
        if (typeof recordKey !== "string") return json({ error: "Record key tidak valid." }, 400);
        const stored = await env.RECEIPTS.get(recordKey);
        if (!stored) return json({ error: "Transaksi tidak ditemukan." }, 404);
        const record = await stored.json();
        if (newAmount) record.amount = safeAmount(newAmount);
        if (newTime) {
          const match = String(newTime).trim().match(/^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
          if (match) {
            const datePart = record.savedAt.split("T")[0];
            const hh = match[1].padStart(2, "0");
            const mm = match[2].padStart(2, "0");
            const ss = (match[3] || "00").padStart(2, "0");
            record.savedAt = `${datePart}T${hh}:${mm}:${ss}+07:00`;
          }
        }
        await env.RECEIPTS.put(recordKey, JSON.stringify(record), { httpMetadata: { contentType: "application/json" } });
        return json({ updated: true, record });
      } catch (error) {
        return json({ error: "Gagal mengedit transaksi.", detail: error.message }, 500);
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
        const base = `${targetYear}/${targetMonth}/${targetDay}/${targetHour}${targetMinute}${targetSecond}-${amount}-${id}`;
        const imageKey = `images/${base}.jpg`;
        const recordKey = `records/${base}.json`;

        await Promise.all([
          env.RECEIPTS.put(imageKey, image.stream(), {
            httpMetadata: { contentType: "image/jpeg", cacheControl: "public, max-age=31536000, immutable" },
            customMetadata: { amount: String(amount), savedAt }
          }),
          env.RECEIPTS.put(recordKey, JSON.stringify({ amount, savedAt, imageKey }), {
            httpMetadata: { contentType: "application/json" }
          })
        ]);
        const publicBase = String(env.R2_PUBLIC_URL || "").replace(/\/$/, "");
        if (!publicBase || publicBase.includes("example.com")) return json({ error: "R2_PUBLIC_URL belum diatur.", saved: true }, 500);
        return json({ amount, savedAt, imageUrl: `${publicBase}/${imageKey}` });
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
