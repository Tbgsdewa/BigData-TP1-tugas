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
  /**
   * Cek status koneksi MongoDB dan statistik koleksi
   */
  async getStatus(): Promise<MongoStatus> {
    try {
      const res = await fetch("/api/db/status", {
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
   * Tes koneksi atau hubungkan ke MongoDB secara dinamis
   */
  async testOrConnect(uri: string, dbName?: string): Promise<{ success: boolean; error?: string; pingMs?: number }> {
    try {
      const res = await fetch("/api/db/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uri, dbName }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message || "Koneksi jaringan gagal" };
    }
  },

  /**
   * Simpan seluruh AppState ke koleksi MongoDB 'sessions'
   */
  async saveState(state: AppState, sessionId: string = "default_tp1"): Promise<{ success: boolean; savedTo?: string; error?: string }> {
    try {
      const res = await fetch("/api/db/state", {
        method: "POST",
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
  async loadState(sessionId: string = "default_tp1"): Promise<{ success: boolean; data?: AppState | null; source?: string }> {
    try {
      const res = await fetch(`/api/db/state?sessionId=${encodeURIComponent(sessionId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err: any) {
      return { success: false, data: null };
    }
  },

  /**
   * Sync bukti (evidence) ke koleksi 'evidence'
   */
  async syncEvidence(evidenceItems: EvidenceItem[]): Promise<{ success: boolean; savedCount?: number }> {
    try {
      const res = await fetch("/api/db/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: evidenceItems }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err: any) {
      return { success: false };
    }
  },

  /**
   * Simpan laporan praktikum Markdown ke MongoDB
   */
  async saveReport(report: { title: string; content: string; author: string; parityStatus: string; metrics?: any }): Promise<{ success: boolean; report?: MongoReportDoc }> {
    try {
      const res = await fetch("/api/db/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err: any) {
      return { success: false };
    }
  },

  /**
   * Ambil riwayat laporan tersimpan dari MongoDB
   */
  async fetchReports(): Promise<MongoReportDoc[]> {
    try {
      const res = await fetch("/api/db/reports");
      if (!res.ok) return [];
      const data = await res.json();
      return data.reports || [];
    } catch {
      return [];
    }
  },
};
