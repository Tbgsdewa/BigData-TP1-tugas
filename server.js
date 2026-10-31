import express from "express";
import { createServer as createViteServer } from "vite";
import { MongoClient, ServerApiVersion } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
dotenv.config();
const app = express();
const PORT = Number(process.env.PORT) || 3e3;
const MONGODB_URI = process.env.MONGODB_URI || "";
const DB_NAME = process.env.MONGODB_DB_NAME || "bigdata_tp1";
const APP_ACCESS_PASSWORD = process.env.APP_ACCESS_PASSWORD || "";
const SESSION_COOKIE = "tp1_access";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const APP_ACCESS_CONFIGURED = APP_ACCESS_PASSWORD.length >= 32;
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1e3;
const MAX_LOGIN_ATTEMPTS = 5;
const MAX_TRACKED_LOGIN_IPS = 5e3;
app.use(express.json({ limit: "25mb" }));
let mongoClient = null;
let database = null;
let isConnected = false;
let connectionError = null;
let lastPingMs = 0;
const fallbackStore = {
  sessions: {},
  evidence: {},
  reports: [],
  rehearsals: [],
  auditLogs: []
};
const loginAttempts = /* @__PURE__ */ new Map();
function getSessionToken(req) {
  const cookie = req.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return cookie?.slice(SESSION_COOKIE.length + 1);
}
function isAuthenticated(req) {
  if (!APP_ACCESS_CONFIGURED) return false;
  const token = getSessionToken(req);
  if (!token) return false;
  const [expiresText, nonce, signature, ...rest] = token.split(".");
  const expiresAt = Number(expiresText);
  if (rest.length > 0 || !Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1e3) || !/^[a-f0-9]{32}$/.test(nonce || "") || !/^[a-f0-9]{64}$/.test(signature || "")) {
    return false;
  }
  const payload = `${expiresText}.${nonce}`;
  const expected = createHmac("sha256", APP_ACCESS_PASSWORD).update(payload).digest();
  const actual = Buffer.from(signature, "hex");
  return timingSafeEqual(expected, actual);
}
function hasSameOrigin(req) {
  const origin = req.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === req.get("host");
  } catch {
    return false;
  }
}
function requireDatabaseAccess(req, res, next) {
  if (!APP_ACCESS_CONFIGURED) {
    res.status(503).json({
      success: false,
      error: "APP_ACCESS_PASSWORD belum dikonfigurasi (minimal 32 karakter)."
    });
    return;
  }
  if (!isAuthenticated(req)) {
    res.status(401).json({ success: false, error: "Akses database terkunci. Masuk dengan kata sandi tim." });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET" && req.method !== "HEAD") {
    if (!hasSameOrigin(req)) {
      res.status(403).json({ success: false, error: "Permintaan lintas origin ditolak." });
      return;
    }
  }
  next();
}
app.get("/api/auth/status", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    configured: APP_ACCESS_CONFIGURED,
    authenticated: isAuthenticated(req)
  });
});
app.post("/api/auth/login", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!hasSameOrigin(req)) {
    return res.status(403).json({ success: false, error: "Permintaan lintas origin ditolak." });
  }
  if (!APP_ACCESS_CONFIGURED) {
    return res.status(503).json({
      success: false,
      error: "Atur APP_ACCESS_PASSWORD minimal 32 karakter di environment server."
    });
  }
  const now = Date.now();
  const ip = req.ip || "unknown";
  const attempts = loginAttempts.get(ip);
  if (attempts && attempts.resetAt <= now) loginAttempts.delete(ip);
  const currentAttempts = loginAttempts.get(ip);
  if (currentAttempts && currentAttempts.count >= MAX_LOGIN_ATTEMPTS) {
    return res.status(429).json({ success: false, error: "Terlalu banyak percobaan. Coba lagi dalam 15 menit." });
  }
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!password || password.length > 256) {
    return res.status(401).json({ success: false, error: "Kata sandi tim tidak cocok." });
  }
  const submittedHash = createHash("sha256").update(password).digest();
  const configuredHash = createHash("sha256").update(APP_ACCESS_PASSWORD).digest();
  if (!timingSafeEqual(submittedHash, configuredHash)) {
    if (!currentAttempts && loginAttempts.size >= MAX_TRACKED_LOGIN_IPS) {
      for (const [trackedIp, value] of loginAttempts) {
        if (value.resetAt <= now) loginAttempts.delete(trackedIp);
      }
    }
    if (loginAttempts.size < MAX_TRACKED_LOGIN_IPS) {
      const current = loginAttempts.get(ip);
      loginAttempts.set(ip, {
        count: (current?.count || 0) + 1,
        resetAt: current?.resetAt || now + LOGIN_ATTEMPT_WINDOW_MS
      });
    }
    return res.status(401).json({ success: false, error: "Kata sandi tim tidak cocok." });
  }
  loginAttempts.delete(ip);
  const expiresAt = Math.floor(Date.now() / 1e3) + SESSION_TTL_SECONDS;
  const nonce = randomBytes(16).toString("hex");
  const payload = `${expiresAt}.${nonce}`;
  const signature = createHmac("sha256", APP_ACCESS_PASSWORD).update(payload).digest("hex");
  const secure = process.env.NODE_ENV === "production" || process.env.VERCEL === "1" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${payload}.${signature}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}${secure}`
  );
  return res.json({ success: true, expiresAt: new Date(expiresAt * 1e3).toISOString() });
});
app.post("/api/auth/logout", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!hasSameOrigin(req)) {
    return res.status(403).json({ success: false, error: "Permintaan lintas origin ditolak." });
  }
  const secure = process.env.NODE_ENV === "production" || process.env.VERCEL === "1" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
  return res.json({ success: true });
});
if (process.env.VERCEL === "1") {
  app.set("trust proxy", 1);
}
async function connectToMongo(uri, dbName = DB_NAME) {
  if (!uri) {
    isConnected = false;
    connectionError = "MONGODB_URI belum dikonfigurasi di environment (.env)";
    return { success: false, error: connectionError };
  }
  try {
    if (mongoClient) {
      await mongoClient.close().catch(() => {
      });
    }
    const client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true
      },
      connectTimeoutMS: 1e4,
      serverSelectionTimeoutMS: 1e4
    });
    const start = Date.now();
    await client.connect();
    const db = client.db(dbName);
    await db.command({ ping: 1 });
    lastPingMs = Date.now() - start;
    mongoClient = client;
    database = db;
    isConnected = true;
    connectionError = null;
    console.log(`[MongoDB] Berhasil terhubung ke MongoDB database: "${dbName}" (${lastPingMs}ms)`);
    return { success: true };
  } catch (err) {
    isConnected = false;
    connectionError = err.message || "Gagal menghubungi MongoDB";
    console.warn(`[MongoDB Warning] Tidak dapat terhubung ke MongoDB: ${connectionError}`);
    return { success: false, error: connectionError || void 0 };
  }
}
if (MONGODB_URI) {
  connectToMongo(MONGODB_URI, DB_NAME).catch((err) => {
    console.warn("[MongoDB Initial Connect]", err.message);
  });
}
app.use("/api/db", requireDatabaseAccess);
app.post("/api/db/connect", (_req, res) => {
  res.status(410).json({
    success: false,
    error: "URI MongoDB hanya dapat diatur sebagai MONGODB_URI pada environment server."
  });
});
app.get("/api/db/status", async (req, res) => {
  let counts = {
    sessions: Object.keys(fallbackStore.sessions).length,
    evidence: Object.keys(fallbackStore.evidence).length,
    reports: fallbackStore.reports.length,
    rehearsals: fallbackStore.rehearsals.length
  };
  if (isConnected && database) {
    try {
      const start = Date.now();
      await database.command({ ping: 1 });
      lastPingMs = Date.now() - start;
      const [sessCount, evidCount, repCount] = await Promise.all([
        database.collection("sessions").countDocuments().catch(() => 0),
        database.collection("evidence").countDocuments().catch(() => 0),
        database.collection("reports").countDocuments().catch(() => 0)
      ]);
      counts = {
        sessions: sessCount,
        evidence: evidCount,
        reports: repCount,
        rehearsals: 0
      };
    } catch (e) {
      isConnected = false;
      connectionError = e.message;
    }
  }
  res.json({
    connected: isConnected,
    mode: isConnected ? "mongodb" : "in_memory_fallback",
    database: DB_NAME,
    uriConfigured: Boolean(MONGODB_URI),
    pingMs: lastPingMs,
    error: connectionError,
    counts,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/api/db/state", async (req, res) => {
  const sessionId = req.query.sessionId || "default_tp1";
  if (isConnected && database) {
    try {
      const doc = await database.collection("sessions").findOne({ sessionId });
      if (doc) {
        const { _id, ...cleanData } = doc;
        return res.json({ success: true, data: cleanData.state, source: "mongodb", updatedAt: cleanData.updatedAt });
      }
    } catch (err) {
      console.error("[MongoDB Error]", err);
    }
  }
  const local = fallbackStore.sessions[sessionId];
  res.json({
    success: true,
    data: local ? local.state : null,
    source: isConnected ? "mongodb_empty" : "fallback",
    updatedAt: local ? local.updatedAt : null
  });
});
app.post("/api/db/state", async (req, res) => {
  const { sessionId = "default_tp1", state, metadata } = req.body;
  if (!state) {
    return res.status(400).json({ success: false, error: "State payload diperlukan" });
  }
  const payload = {
    sessionId,
    state,
    metadata: metadata || {},
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (isConnected && database) {
    try {
      await database.collection("sessions").updateOne(
        { sessionId },
        { $set: payload },
        { upsert: true }
      );
      await database.collection("auditLogs").insertOne({
        action: "UPDATE_STATE",
        sessionId,
        stepCount: Object.values(state.steps || {}).filter((s) => s.completed).length,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }).catch(() => {
      });
      return res.json({ success: true, savedTo: "mongodb", timestamp: payload.updatedAt });
    } catch (err) {
      console.error("[MongoDB Save Error]", err);
    }
  }
  fallbackStore.sessions[sessionId] = payload;
  res.json({ success: true, savedTo: "in_memory_fallback", timestamp: payload.updatedAt });
});
app.get("/api/db/evidence", async (req, res) => {
  if (isConnected && database) {
    try {
      const items = await database.collection("evidence").find({}).toArray();
      const cleanItems = items.map((doc) => {
        const { _id, ...rest } = doc;
        return rest;
      });
      return res.json({ success: true, evidence: cleanItems, source: "mongodb" });
    } catch (err) {
      console.error("[MongoDB Evidence Error]", err);
    }
  }
  res.json({
    success: true,
    evidence: Object.values(fallbackStore.evidence),
    source: "fallback"
  });
});
app.post("/api/db/evidence", async (req, res) => {
  const { item, items } = req.body;
  const listToSave = items || (item ? [item] : []);
  if (listToSave.length === 0) {
    return res.status(400).json({ success: false, error: "Tidak ada data evidence yang dikirim" });
  }
  if (isConnected && database) {
    try {
      const bulkOps = listToSave.map((ev) => ({
        updateOne: {
          filter: { id: ev.id },
          update: { $set: { ...ev, updatedAt: (/* @__PURE__ */ new Date()).toISOString() } },
          upsert: true
        }
      }));
      await database.collection("evidence").bulkWrite(bulkOps);
      return res.json({ success: true, savedCount: listToSave.length, target: "mongodb" });
    } catch (err) {
      console.error("[MongoDB Evidence Bulk Error]", err);
    }
  }
  listToSave.forEach((ev) => {
    fallbackStore.evidence[ev.id] = { ...ev, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  });
  res.json({ success: true, savedCount: listToSave.length, target: "fallback" });
});
app.get("/api/db/reports", async (req, res) => {
  if (isConnected && database) {
    try {
      const reports = await database.collection("reports").find({}).sort({ createdAt: -1 }).limit(20).toArray();
      const cleanReports = reports.map((doc) => {
        const { _id, ...rest } = doc;
        return rest;
      });
      return res.json({ success: true, reports: cleanReports, source: "mongodb" });
    } catch (err) {
      console.error("[MongoDB Report Error]", err);
    }
  }
  res.json({
    success: true,
    reports: fallbackStore.reports,
    source: "fallback"
  });
});
app.post("/api/db/reports", async (req, res) => {
  const { title, content, author, parityStatus, metrics } = req.body;
  const reportDoc = {
    id: `rep_${Date.now()}`,
    title: title || "Laporan Praktikum Big Data TP1",
    content: content || "",
    author: author || "Mahasiswa STMIK Pelita Nusantara",
    parityStatus: parityStatus || "UNKNOWN",
    metrics: metrics || {},
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (isConnected && database) {
    try {
      await database.collection("reports").insertOne(reportDoc);
      return res.json({ success: true, report: reportDoc, target: "mongodb" });
    } catch (err) {
      console.error("[MongoDB Insert Report Error]", err);
    }
  }
  fallbackStore.reports.unshift(reportDoc);
  res.json({ success: true, report: reportDoc, target: "fallback" });
});
async function startServer() {
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0", port: PORT },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve("dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  if (process.env.VERCEL !== "1") {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[BigData TP1 Workstation] Server running on port ${PORT} (NODE_ENV=${process.env.NODE_ENV || "development"})`);
      console.log(`[MongoDB Status] ${isConnected ? "Connected to " + DB_NAME : "Waiting for connection (Fallback Active)"}`);
    });
  }
}
if (process.env.VERCEL !== "1") {
  startServer().catch((err) => {
    console.error("Gagal menyalakan server:", err);
  });
}
var server_default = app;
export {
  server_default as default
};
