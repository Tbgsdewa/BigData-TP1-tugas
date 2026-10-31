import { AppState, EvidenceItem } from "../types";

export interface MongoStatus {
  connected: boolean;
  mode: "mongodb" | "in_memory_fallback";
  database: string;
  uriConfigured: boolean;
  pingMs: number;
  error: string | null;
  counts: {
    sessions: number;
    evidence: number;
    reports: number;
    rehearsals: number;
  };
  timestamp: string;
}

export interface DatabaseAuthStatus {
  configured: boolean;
  authenticated: boolean;
}

async function getResponseError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  return body && typeof body.error === "string" ? body.error : `HTTP ${response.status}`;
}

export interface MongoReportDoc {
  id: string;
  title: string;
  content: string;
  author: string;
  parityStatus: string;
  metrics?: Record<string, any>;
  createdAt: string;
}

export const mongoService = {
  async getAuthStatus(): Promise<DatabaseAuthStatus> {
    const res = await fetch("/api/auth/status", { credentials: "same-origin" });
    if (!res.ok) throw new Error(await getResponseError(res));
    return await res.json();
  },

  async login(password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await res.json();
      if (!res.ok) return { success: false, error: result.error || `HTTP ${res.status}` };
      return result;
    } catch (err: any) {
      return { success: false, error: err.message || "Koneksi jaringan gagal" };
    }
  },

  async logout(): Promise<void> {
    const res = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    if (!res.ok) throw new Error(await getResponseError(res));
  },

  /**
   * Cek status koneksi MongoDB dan statistik koleksi
   */
  async getStatus(): Promise<MongoStatus> {
    try {
      const res = await fetch("/api/db/status", {
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err: any) {
      return {
        connected: false,
        mode: "in_memory_fallback",
        database: "bigdata_tp1",
        uriConfigured: false,
        pingMs: 0,
        error: err.message || "Gagal menghubungi backend API",
        counts: { sessions: 0, evidence: 0, reports: 0, rehearsals: 0 },
        timestamp: new Date().toISOString(),
      };
    }
  },

  /**
   * Simpan seluruh AppState ke koleksi MongoDB 'sessions'
   */
  async saveState(state: AppState, sessionId: string = "default_tp1"): Promise<{ success: boolean; savedTo?: string; error?: string }> {
    try {
      const res = await fetch("/api/db/state", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          state,
          metadata: {
            memberCount: state.members.length,
            completedSteps: Object.values(state.steps).filter((s) => s.completed).length,
            lastUpdatedBy: state.members[0]?.nama || "Anonymous Student",
          },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Ambil AppState tersimpan dari MongoDB
   */
  async loadState(sessionId: string = "default_tp1"): Promise<{ success: boolean; data?: AppState | null; source?: string; error?: string }> {
    try {
      const res = await fetch(`/api/db/state?sessionId=${encodeURIComponent(sessionId)}`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(await getResponseError(res));
      return await res.json();
    } catch (err: any) {
      return { success: false, data: null, error: err.message };
    }
  },

  /**
   * Sync bukti (evidence) ke koleksi 'evidence'
   */
  async syncEvidence(evidenceItems: EvidenceItem[]): Promise<{ success: boolean; savedCount?: number; error?: string }> {
    try {
      const res = await fetch("/api/db/evidence", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: evidenceItems }),
      });
      if (!res.ok) throw new Error(await getResponseError(res));
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Simpan laporan praktikum Markdown ke MongoDB
   */
  async saveReport(report: { title: string; content: string; author: string; parityStatus: string; metrics?: any }): Promise<{ success: boolean; report?: MongoReportDoc; error?: string }> {
    try {
      const res = await fetch("/api/db/reports", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      });
      if (!res.ok) throw new Error(await getResponseError(res));
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Ambil riwayat laporan tersimpan dari MongoDB
   */
  async fetchReports(): Promise<MongoReportDoc[]> {
    try {
      const res = await fetch("/api/db/reports", { credentials: "same-origin" });
      if (!res.ok) return [];
      const data = await res.json();
      return data.reports || [];
    } catch {
      return [];
    }
  },
};
