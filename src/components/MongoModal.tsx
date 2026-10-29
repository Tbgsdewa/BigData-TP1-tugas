import React, { useState } from "react";
import {
  Database,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  ExternalLink,
  Copy,
  Check,
  X,
  Server,
  Layers,
  ShieldCheck,
  Activity,
  KeyRound,
} from "lucide-react";
import { MongoStatus, mongoService } from "../services/mongoService";
import { AppState } from "../types";

interface MongoModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: MongoStatus | null;
  onRefreshStatus: () => Promise<void>;
  currentState: AppState;
  onStateRestored: (newState: AppState) => void;
  autoSync: boolean;
  onToggleAutoSync: (enabled: boolean) => void;
}

export function MongoModal({
  isOpen,
  onClose,
  status,
  onRefreshStatus,
  currentState,
  onStateRestored,
  autoSync,
  onToggleAutoSync,
}: MongoModalProps) {
  const [customUri, setCustomUri] = useState("");
  const [dbName, setDbName] = useState("bigdata_tp1");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  if (!isOpen) return null;

  const handleTestConnect = async () => {
    if (!customUri.trim()) {
      setSyncFeedback({ type: "error", message: "Masukkan connection string MongoDB terlebih dahulu." });
      return;
    }
    setIsConnecting(true);
    setSyncFeedback(null);
    try {
      const res = await mongoService.testOrConnect(customUri.trim(), dbName.trim() || "bigdata_tp1");
      if (res.success) {
        setSyncFeedback({ type: "success", message: `Berhasil terhubung ke MongoDB! Ping: ${res.pingMs}ms` });
        await onRefreshStatus();
      } else {
        setSyncFeedback({ type: "error", message: res.error || "Gagal menghubungi MongoDB." });
      }
    } catch (err: any) {
      setSyncFeedback({ type: "error", message: err.message || "Terjadi kesalahan koneksi." });
    } finally {
      setIsConnecting(false);
    }
  };

  const handlePushToCloud = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const stateRes = await mongoService.saveState(currentState, "default_tp1");
      const evidenceList = Object.values(currentState.evidence || {});
      if (evidenceList.length > 0) {
        await mongoService.syncEvidence(evidenceList);
      }
      await onRefreshStatus();
      setSyncFeedback({
        type: "success",
        message: `Sinkronisasi sukses ke ${stateRes.savedTo === "mongodb" ? "MongoDB Atlas" : "Penyimpanan Server"}.`,
      });
    } catch (err: any) {
      setSyncFeedback({ type: "error", message: err.message || "Gagal sinkronisasi data." });
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullFromCloud = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await mongoService.loadState("default_tp1");
      if (res.success && res.data) {
        onStateRestored(res.data);
        setSyncFeedback({
          type: "success",
          message: "Data berhasil dimuat dari MongoDB ke Workstation!",
        });
      } else {
        setSyncFeedback({
          type: "error",
          message: "Belum ada sesi tersimpan di MongoDB untuk ID ini.",
        });
      }
    } catch (err: any) {
      setSyncFeedback({ type: "error", message: err.message || "Gagal memuat dari MongoDB." });
    } finally {
      setIsSyncing(false);
    }
  };

  const sampleConnectionString = "mongodb+srv://<username>:<password>@cluster0.mongodb.net/bigdata_tp1?retryWrites=true&w=majority";

  const handleCopySample = () => {
    navigator.clipboard.writeText(sampleConnectionString);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${status?.connected ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border border-amber-500/30"}`}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-white flex items-center gap-2">
                MongoDB Integrator & Sinkronisasi
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  status?.connected
                    ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                    : "bg-amber-950 text-amber-400 border border-amber-800"
                }`}>
                  {status?.connected ? "Atlas Connected" : "Local Standby"}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Penyimpanan persisten tugas praktikum, artefak bukti E01-E16, dan log audit klaster.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Status Banner */}
          <div className={`p-4 rounded-lg border ${
            status?.connected
              ? "bg-emerald-950/30 border-emerald-800/60 text-emerald-300"
              : "bg-slate-800/60 border-slate-700 text-slate-300"
          }`}>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  {status?.connected ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                  )}
                  <span>
                    {status?.connected
                      ? `Terhubung ke Database MongoDB: ${status.database}`
                      : "Mode Standby Lokal (Menunggu MONGODB_URI)"}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {status?.connected
                    ? `Latensi ping klaster: ${status.pingMs}ms. Semua data langsung terinkorporasi ke cloud.`
                    : "Aplikasi berjalan normal dengan penyimpanan memori server & browser. Hubungkan ke MongoDB Atlas untuk persistensi jangka panjang."}
                </p>
              </div>
              <button
                onClick={onRefreshStatus}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-600 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Cek Ping
              </button>
            </div>

            {/* Collection Counters */}
            <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-700/60 text-center font-mono">
              <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
                <div className="text-xs text-slate-400">sessions</div>
                <div className="text-lg font-bold text-white tabular-nums">{status?.counts.sessions || 0}</div>
              </div>
              <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
                <div className="text-xs text-slate-400">evidence</div>
                <div className="text-lg font-bold text-white tabular-nums">{status?.counts.evidence || 0}</div>
              </div>
              <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
                <div className="text-xs text-slate-400">reports</div>
                <div className="text-lg font-bold text-white tabular-nums">{status?.counts.reports || 0}</div>
              </div>
              <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
                <div className="text-xs text-slate-400">ping</div>
                <div className="text-lg font-bold text-emerald-400 tabular-nums">
                  {status?.connected ? `${status.pingMs}ms` : "-"}
                </div>
              </div>
            </div>
          </div>

          {/* Sync Actions */}
          <div className="bg-slate-800/40 p-4 rounded-lg border border-slate-700 space-y-3">
            <h4 className="font-semibold text-slate-200 text-xs uppercase tracking-wider flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-cyan-400" />
              Aksi Sinkronisasi Data
            </h4>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handlePushToCloud}
                disabled={isSyncing}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg shadow-sm transition-colors"
              >
                <UploadCloud className="w-4 h-4" />
                {isSyncing ? "Menyinkronkan..." : "Simpan / Push ke MongoDB"}
              </button>
              <button
                onClick={handlePullFromCloud}
                disabled={isSyncing}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 text-xs font-medium rounded-lg border border-slate-600 transition-colors"
              >
                <DownloadCloud className="w-4 h-4" />
                Tarik / Pull dari MongoDB
              </button>
              <label className="flex items-center gap-2 text-xs text-slate-300 ml-auto cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={(e) => onToggleAutoSync(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-600 text-cyan-600 focus:ring-0"
                />
                Auto-sync setiap ada perubahan
              </label>
            </div>
          </div>

          {/* Feedback Message */}
          {syncFeedback && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                syncFeedback.type === "success"
                  ? "bg-emerald-950/50 border border-emerald-800 text-emerald-300"
                  : "bg-rose-950/50 border border-rose-800 text-rose-300"
              }`}
            >
              {syncFeedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{syncFeedback.message}</span>
            </div>
          )}

          {/* Connect Live via UI */}
          <div className="bg-slate-800/40 p-4 rounded-lg border border-slate-700 space-y-3">
            <h4 className="font-semibold text-slate-200 text-xs uppercase tracking-wider flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-400" />
              Uji Sambungan MongoDB Atlas Baru
            </h4>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="mongodb+srv://username:password@cluster.mongodb.net/..."
                value={customUri}
                onChange={(e) => setCustomUri(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs font-mono text-slate-200 focus:outline-hidden focus:border-cyan-500"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nama Database (default: bigdata_tp1)"
                  value={dbName}
                  onChange={(e) => setDbName(e.target.value)}
                  className="w-1/2 bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-hidden focus:border-cyan-500"
                />
                <button
                  onClick={handleTestConnect}
                  disabled={isConnecting}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium rounded transition-colors"
                >
                  <Activity className="w-3.5 h-3.5" />
                  {isConnecting ? "Menghubungkan..." : "Tes & Hubungkan"}
                </button>
              </div>
            </div>
          </div>

          {/* Deployment Configuration Info */}
          <div className="border border-slate-800 bg-slate-950/50 p-4 rounded-lg space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300">Format Environment Variable (.env & Vercel):</span>
              <button
                onClick={handleCopySample}
                className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey ? "Tersalin" : "Salin Contoh"}
              </button>
            </div>
            <pre className="p-2.5 bg-slate-900 border border-slate-800 rounded font-mono text-[11px] text-slate-300 overflow-x-auto">
{`MONGODB_URI="${sampleConnectionString}"
MONGODB_DB_NAME="bigdata_tp1"`}
            </pre>
            <p className="text-[11px] text-slate-400">
              Di Vercel: Masuk ke <strong>Settings &rarr; Environment Variables</strong>, tambahkan <code>MONGODB_URI</code> dengan URI dari MongoDB Atlas Anda.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
