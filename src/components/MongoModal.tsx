import React, { useState } from "react";
import {
  Database,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  Copy,
  Check,
  X,
  Activity,
  KeyRound,
} from "lucide-react";
import { Chip, FieldLabel } from "./ui";
import { MongoStatus, mongoService } from "../services/mongoService";
import { AppState } from "../types";

interface MongoModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: MongoStatus | null;
  onRefreshStatus: () => Promise<void>;
  accessConfigured: boolean;
  isAuthenticated: boolean;
  onAuthChange: (authenticated: boolean) => void;
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
  accessConfigured,
  isAuthenticated,
  onAuthChange,
  currentState,
  onStateRestored,
  autoSync,
  onToggleAutoSync,
}: MongoModalProps) {
  const [accessPassword, setAccessPassword] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async () => {
    if (!accessPassword) {
      setSyncFeedback({ type: "error", message: "Masukkan kata sandi akses tim." });
      return;
    }
    setIsAuthenticating(true);
    setSyncFeedback(null);
    try {
      const res = await mongoService.login(accessPassword);
      if (res.success) {
        setAccessPassword("");
        onAuthChange(true);
        await onRefreshStatus();
        setSyncFeedback({ type: "success", message: "Akses penyimpanan tim berhasil dibuka." });
      } else {
        setSyncFeedback({ type: "error", message: res.error || "Autentikasi gagal." });
      }
    } catch (err: any) {
      setSyncFeedback({ type: "error", message: err.message || "Gagal memverifikasi akses." });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    setSyncFeedback(null);
    try {
      await mongoService.logout();
      onAuthChange(false);
      await onRefreshStatus();
      setSyncFeedback({ type: "success", message: "Akses penyimpanan tim ditutup." });
    } catch (err: any) {
      setSyncFeedback({ type: "error", message: err.message || "Gagal menutup sesi." });
    }
  };

  const handleClose = () => {
    setAccessPassword("");
    onClose();
  };

  const handlePushToCloud = async () => {
    if (!isAuthenticated) return;
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const stateRes = await mongoService.saveState(currentState, "default_tp1");
      if (!stateRes.success) {
        setSyncFeedback({ type: "error", message: stateRes.error || "Gagal menyimpan sesi." });
        return;
      }

      const evidenceList = Object.values(currentState.evidence || {});
      if (evidenceList.length > 0) {
        const evidenceRes = await mongoService.syncEvidence(evidenceList);
        if (!evidenceRes.success) {
          setSyncFeedback({
            type: "error",
            message: evidenceRes.error || "Sesi tersimpan, tetapi sinkronisasi bukti gagal.",
          });
          return;
        }
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
    if (!isAuthenticated) return;
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await mongoService.loadState("default_tp1");
      if (!res.success) {
        setSyncFeedback({ type: "error", message: res.error || "Gagal mengambil sesi dari penyimpanan tim." });
      } else if (res.data) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="MongoDB Integrator & Sinkronisasi"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-md border border-line bg-surface text-ink shadow-xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <Database
              className={`h-4 w-4 shrink-0 ${status?.connected ? "text-ok" : "text-warn"}`}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <h3 className="flex flex-wrap items-center gap-2 text-sm font-bold tracking-tight text-ink">
                Sinkronisasi MongoDB
                <Chip tone={status?.connected ? "ok" : "warn"}>
                  {status?.connected ? "Atlas Connected" : "Local Standby"}
                </Chip>
              </h3>
              <p className="mt-0.5 text-xs text-ink-muted">
                Simpan sesi kerja, bukti E01–E16, dan laporan ke MongoDB Atlas.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="btn btn-ghost shrink-0 !px-2"
            aria-label="Tutup panel MongoDB"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 text-sm">
          {/* Status area */}
          <div className="rounded-sm border border-line bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-ink">
                  {status?.connected ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" aria-hidden="true" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
                  )}
                  <span>
                    {status?.connected
                      ? `Terhubung ke Database MongoDB: ${status.database}`
                      : "Mode Standby Lokal (Menunggu MONGODB_URI)"}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-ink-muted">
                  {status?.connected
                    ? `Ping ${status.pingMs}ms. Perubahan tersimpan langsung ke cloud.`
                    : "Aplikasi tetap berjalan dengan penyimpanan lokal browser. Hubungkan Atlas untuk persistensi cloud."}
                </p>
              </div>
              <button
                type="button"
                onClick={onRefreshStatus}
                className="btn btn-outline !px-2 !py-1 font-mono !text-[11px]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Cek Ping
              </button>
            </div>

            {/* Collection counters (angka riil dari status) */}
            <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3 text-center sm:grid-cols-4">
              <div className="rounded-sm border border-line bg-surface-2 px-2 py-2">
                <dt className="label-micro">sessions</dt>
                <dd className="mt-1 font-mono text-lg font-bold tabular-nums text-ink">
                  {status?.counts.sessions || 0}
                </dd>
              </div>
              <div className="rounded-sm border border-line bg-surface-2 px-2 py-2">
                <dt className="label-micro">evidence</dt>
                <dd className="mt-1 font-mono text-lg font-bold tabular-nums text-ink">
                  {status?.counts.evidence || 0}
                </dd>
              </div>
              <div className="rounded-sm border border-line bg-surface-2 px-2 py-2">
                <dt className="label-micro">reports</dt>
                <dd className="mt-1 font-mono text-lg font-bold tabular-nums text-ink">
                  {status?.counts.reports || 0}
                </dd>
              </div>
              <div className="rounded-sm border border-line bg-surface-2 px-2 py-2">
                <dt className="label-micro">ping</dt>
                <dd
                  className={`mt-1 font-mono text-lg font-bold tabular-nums ${
                    status?.connected ? "text-ok" : "text-ink-muted"
                  }`}
                >
                  {status?.connected ? `${status.pingMs}ms` : "-"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Access control */}
          <div className="space-y-3 rounded-sm border border-line bg-surface-2 p-4">
            <h4 className="label-micro flex items-center gap-2 !text-ink-soft">
              <KeyRound className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              Akses Penyimpanan Tim
            </h4>
            {!accessConfigured ? (
              <p className="text-xs leading-relaxed text-warn">
                Akses cloud dikunci sampai <code>APP_ACCESS_PASSWORD</code> (minimal 32 karakter) diatur pada
                environment server/Vercel.
              </p>
            ) : isAuthenticated ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-ok">Sesi tim aktif pada perangkat ini.</p>
                <button type="button" onClick={handleLogout} className="btn btn-outline">
                  Kunci Sesi
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <FieldLabel htmlFor="database-access-password">Kata sandi akses tim</FieldLabel>
                  <input
                    id="database-access-password"
                    type="password"
                    autoComplete="current-password"
                    value={accessPassword}
                    onChange={(event) => setAccessPassword(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void handleLogin();
                    }}
                    className="field"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={isAuthenticating}
                  className="btn btn-primary"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  {isAuthenticating ? "Memverifikasi..." : "Buka Akses"}
                </button>
              </div>
            )}
          </div>

          {/* Sync Actions */}
          <div className="space-y-3 rounded-sm border border-line bg-surface-2 p-4">
            <h4 className="label-micro flex items-center gap-2 !text-ink-soft">
              <UploadCloud className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              Aksi Sinkronisasi Data
            </h4>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handlePushToCloud}
                disabled={isSyncing || !isAuthenticated}
                className="btn btn-primary"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                {isSyncing ? "Menyinkronkan..." : "Simpan / Push ke MongoDB"}
              </button>
              <button
                type="button"
                onClick={handlePullFromCloud}
                disabled={isSyncing || !isAuthenticated}
                className="btn btn-outline"
              >
                <DownloadCloud className="h-3.5 w-3.5" />
                Tarik / Pull dari MongoDB
              </button>
              <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-ink-soft">
                <input
                  type="checkbox"
                  checked={autoSync}
                  disabled={!isAuthenticated}
                  onChange={(e) => onToggleAutoSync(e.target.checked)}
                  className="h-4 w-4 accent-accent"
                />
                Auto-sync setiap ada perubahan
              </label>
            </div>
          </div>

          {/* Feedback Message */}
          {syncFeedback && (
            <div
              role="status"
              className={`flex items-center gap-2 rounded-sm border p-3 text-xs ${
                syncFeedback.type === "success"
                  ? "border-ok/40 bg-ok-wash text-ok"
                  : "border-danger/40 bg-danger-wash text-danger"
              }`}
            >
              {syncFeedback.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              <span>{syncFeedback.message}</span>
            </div>
          )}

          {/* Database credentials stay on the server; never accept them from this browser. */}
          <div className="space-y-3 rounded-sm border border-line bg-surface-2 p-4">
            <h4 className="label-micro flex items-center gap-2 !text-ink-soft">
              <Activity className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              Konfigurasi MongoDB Server
            </h4>
            <div className="space-y-2">
              <div>
                <FieldLabel htmlFor="mongo-connection-uri">MONGODB_URI (server-side only)</FieldLabel>
                <input
                  id="mongo-connection-uri"
                  type="text"
                  placeholder="mongodb+srv://username:password@cluster.mongodb.net/..."
                  value="Dikelola di Vercel"
                  readOnly
                  aria-readonly="true"
                  className="field field-mono"
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="sm:w-1/2">
                  <FieldLabel htmlFor="mongo-db-name">MONGODB_DB_NAME</FieldLabel>
                  <input
                    id="mongo-db-name"
                    type="text"
                    placeholder="Nama Database (default: bigdata_tp1)"
                    value="bigdata_tp1"
                    readOnly
                    aria-readonly="true"
                    className="field field-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={onRefreshStatus}
                  className="btn btn-primary sm:flex-1"
                >
                  <Activity className="h-3.5 w-3.5" />
                  Cek Status Server
                </button>
              </div>
            </div>
          </div>

          {/* Deployment Configuration Info */}
          <div className="code-block space-y-2 !p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-code-line bg-code-2 px-3 py-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-code-muted">
                Format Environment Variable (.env &amp; Vercel):
              </span>
              <button
                type="button"
                onClick={handleCopySample}
                className="btn !border-code-line !bg-transparent !px-2 !py-1 font-mono !text-[11px] !text-code-muted hover:!text-code-ink"
              >
                {copiedKey ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedKey ? "Tersalin" : "Salin URI Contoh"}
              </button>
            </div>
            <div className="space-y-2 px-3 py-2.5">
              <pre className="overflow-x-auto font-mono text-[11.5px] leading-relaxed text-code-ink">
{`MONGODB_URI="${sampleConnectionString}"
MONGODB_DB_NAME="bigdata_tp1"
APP_ACCESS_PASSWORD="<minimal-32-karakter>"`}
              </pre>
              <p className="font-sans text-[11px] leading-relaxed text-code-muted">
                Di Vercel: Masuk ke <strong className="text-code-ink">Settings &rarr; Environment Variables</strong>,
                tambahkan tiga variable di atas. Jangan tempel URI atau kata sandi di halaman aplikasi; koneksi MongoDB hanya dikonfigurasi di sisi server.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-end border-t border-line px-5 py-3">
          <button type="button" onClick={handleClose} className="btn btn-outline">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
