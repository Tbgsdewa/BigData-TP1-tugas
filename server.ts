import express from "express";
import { createServer as createViteServer } from "vite";
import { MongoClient, Db, ServerApiVersion } from "mongodb";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "";
const DB_NAME = process.env.MONGODB_DB_NAME || "bigdata_tp1";

app.use(express.json({ limit: "25mb" }));

// MongoDB State
let mongoClient: MongoClient | null = null;
let database: Db | null = null;
let isConnected = false;
let connectionError: string | null = null;
let lastPingMs = 0;

// In-memory fallback store when MongoDB URI is not yet configured or connecting
interface FallbackStore {
  sessions: Record<string, any>;
  evidence: Record<string, any>;
  reports: any[];
  rehearsals: any[];
  auditLogs: any[];
}

const fallbackStore: FallbackStore = {
  sessions: {},
  evidence: {},
  reports: [],
  rehearsals: [],
  auditLogs: [],
};

// Connect to MongoDB
async function connectToMongo(uri: string, dbName: string = DB_NAME): Promise<{ success: boolean; error?: string }> {
  if (!uri) {
    isConnected = false;
    connectionError = "MONGODB_URI belum dikonfigurasi di environment (.env)";
    return { success: false, error: connectionError };
  }

  try {
    if (mongoClient) {
      await mongoClient.close().catch(() => {});
    }

    const client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
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
  } catch (err: any) {
    isConnected = false;
    connectionError = err.message || "Gagal menghubungi MongoDB";
    console.warn(`[MongoDB Warning] Tidak dapat terhubung ke MongoDB: ${connectionError}`);
    return { success: false, error: connectionError || undefined };
  }
}

// Initial connection attempt if URI is present
if (MONGODB_URI) {
  connectToMongo(MONGODB_URI, DB_NAME).catch((err) => {
    console.warn("[MongoDB Initial Connect]", err.message);
  });
}

// ---------------- API ROUTES ----------------

// 1. Health & Connection Status
app.get("/api/db/status", async (req, res) => {
  let counts = {
    sessions: Object.keys(fallbackStore.sessions).length,
    evidence: Object.keys(fallbackStore.evidence).length,
    reports: fallbackStore.reports.length,
    rehearsals: fallbackStore.rehearsals.length,
  };

  if (isConnected && database) {
    try {
      const start = Date.now();
      await database.command({ ping: 1 });
      lastPingMs = Date.now() - start;

      const [sessCount, evidCount, repCount] = await Promise.all([
        database.collection("sessions").countDocuments().catch(() => 0),
        database.collection("evidence").countDocuments().catch(() => 0),
        database.collection("reports").countDocuments().catch(() => 0),
      ]);

      counts = {
        sessions: sessCount,
        evidence: evidCount,
        reports: repCount,
        rehearsals: 0,
      };
    } catch (e: any) {
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
    timestamp: new Date().toISOString(),
  });
});

// 2. Connect / Test Connection Dynamically
app.post("/api/db/connect", async (req, res) => {
  const { uri, dbName } = req.body;
  if (!uri) {
    return res.status(400).json({ success: false, error: "URI connection string diperlukan" });
  }

  const result = await connectToMongo(uri, dbName || DB_NAME);
  res.json({
    ...result,
    connected: isConnected,
    pingMs: lastPingMs,
    database: dbName || DB_NAME,
  });
});

// 3. Get Saved App State / Session
app.get("/api/db/state", async (req, res) => {
  const sessionId = (req.query.sessionId as string) || "default_tp1";

  if (isConnected && database) {
    try {
      const doc = await database.collection("sessions").findOne({ sessionId });
      if (doc) {
        const { _id, ...cleanData } = doc;
        return res.json({ success: true, data: cleanData.state, source: "mongodb", updatedAt: cleanData.updatedAt });
      }
    } catch (err: any) {
      console.error("[MongoDB Error]", err);
    }
  }

  // Fallback
  const local = fallbackStore.sessions[sessionId];
  res.json({
    success: true,
    data: local ? local.state : null,
    source: isConnected ? "mongodb_empty" : "fallback",
    updatedAt: local ? local.updatedAt : null,
  });
});

// 4. Save App State / Session
app.post("/api/db/state", async (req, res) => {
  const { sessionId = "default_tp1", state, metadata } = req.body;
  if (!state) {
    return res.status(400).json({ success: false, error: "State payload diperlukan" });
  }

  const payload = {
    sessionId,
    state,
    metadata: metadata || {},
    updatedAt: new Date().toISOString(),
  };

  if (isConnected && database) {
    try {
      await database.collection("sessions").updateOne(
        { sessionId },
        { $set: payload },
        { upsert: true }
      );

      // Also track audit log
      await database.collection("auditLogs").insertOne({
        action: "UPDATE_STATE",
        sessionId,
        stepCount: Object.values(state.steps || {}).filter((s: any) => s.completed).length,
        timestamp: new Date().toISOString(),
      }).catch(() => {});

      return res.json({ success: true, savedTo: "mongodb", timestamp: payload.updatedAt });
    } catch (err: any) {
      console.error("[MongoDB Save Error]", err);
    }
  }

  // Fallback store
  fallbackStore.sessions[sessionId] = payload;
  res.json({ success: true, savedTo: "in_memory_fallback", timestamp: payload.updatedAt });
});

// 5. Get Evidence List
app.get("/api/db/evidence", async (req, res) => {
  if (isConnected && database) {
    try {
      const items = await database.collection("evidence").find({}).toArray();
      const cleanItems = items.map((doc: any) => {
        const { _id, ...rest } = doc;
        return rest;
      });
      return res.json({ success: true, evidence: cleanItems, source: "mongodb" });
    } catch (err: any) {
      console.error("[MongoDB Evidence Error]", err);
    }
  }

  res.json({
    success: true,
    evidence: Object.values(fallbackStore.evidence),
    source: "fallback",
  });
});

// 6. Save Single or Bulk Evidence
app.post("/api/db/evidence", async (req, res) => {
  const { item, items } = req.body;
  const listToSave = items || (item ? [item] : []);

  if (listToSave.length === 0) {
    return res.status(400).json({ success: false, error: "Tidak ada data evidence yang dikirim" });
  }

  if (isConnected && database) {
    try {
      const bulkOps = listToSave.map((ev: any) => ({
        updateOne: {
          filter: { id: ev.id },
          update: { $set: { ...ev, updatedAt: new Date().toISOString() } },
          upsert: true,
        },
      }));
      await database.collection("evidence").bulkWrite(bulkOps);
      return res.json({ success: true, savedCount: listToSave.length, target: "mongodb" });
    } catch (err: any) {
      console.error("[MongoDB Evidence Bulk Error]", err);
    }
  }

  listToSave.forEach((ev: any) => {
    fallbackStore.evidence[ev.id] = { ...ev, updatedAt: new Date().toISOString() };
  });
  res.json({ success: true, savedCount: listToSave.length, target: "fallback" });
});

// 7. Reports List & Save
app.get("/api/db/reports", async (req, res) => {
  if (isConnected && database) {
    try {
      const reports = await database.collection("reports").find({}).sort({ createdAt: -1 }).limit(20).toArray();
      const cleanReports = reports.map((doc: any) => {
        const { _id, ...rest } = doc;
        return rest;
      });
      return res.json({ success: true, reports: cleanReports, source: "mongodb" });
    } catch (err: any) {
      console.error("[MongoDB Report Error]", err);
    }
  }

  res.json({
    success: true,
    reports: fallbackStore.reports,
    source: "fallback",
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
    createdAt: new Date().toISOString(),
  };

  if (isConnected && database) {
    try {
      await database.collection("reports").insertOne(reportDoc);
      return res.json({ success: true, report: reportDoc, target: "mongodb" });
    } catch (err: any) {
      console.error("[MongoDB Insert Report Error]", err);
    }
  }

  fallbackStore.reports.unshift(reportDoc);
  res.json({ success: true, report: reportDoc, target: "fallback" });
});

// ---------------- VITE & STATIC HANDLING ----------------
async function startServer() {
  const isProd = process.env.NODE_ENV === "production";

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0", port: PORT },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve("dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[BigData TP1 Workstation] Server running on port ${PORT} (NODE_ENV=${process.env.NODE_ENV || "development"})`);
    console.log(`[MongoDB Status] ${isConnected ? "Connected to " + DB_NAME : "Waiting for connection (Fallback Active)"}`);
  });
}

startServer().catch((err) => {
  console.error("Gagal menyalakan server:", err);
});
