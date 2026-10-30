import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Settings,
  BookOpen,
  Activity,
  CheckCircle,
  FileCheck,
  FileText,
  Video,
  ShieldAlert,
  Moon,
  Sun,
  RotateCcw,
  AlertTriangle,
  Layers,
  Search,
  Terminal,
  ExternalLink,
  Command,
  X,
  Check,
  HardDrive,
  Cpu,
  ArrowRight,
  ShieldCheck,
  Clock,
  Tv,
  Database,
} from "lucide-react";
import { INITIAL_STATE, SAMPLE_STATE } from "./sampleData";
import { AppState } from "./types";
import { scanAllCredentials } from "./scanner";
import { STEPS_TEMPLATE, EVIDENCE_DEF, ENV } from "./constants";
import { mongoService, MongoStatus } from "./services/mongoService";
import { MongoModal } from "./components/MongoModal";
import { SetupTab } from "./tabs/Setup";
import { RunbookTab } from "./tabs/Runbook";
import { MonitorTab } from "./tabs/Monitor";
import { ValidationTab } from "./tabs/Validation";
import { EvidenceTab } from "./tabs/Evidence";
import { ReportTab } from "./tabs/Report";
import { VideoTab } from "./tabs/Video";
import { DisclosureTab } from "./tabs/Disclosure";

const STORAGE_KEY = "tp1_v1";

export type ActiveTab =
  | "Setup"
  | "Runbook"
  | "Monitor"
  | "Validation"
  | "Evidence"
  | "Report"
  | "Video"
  | "Disclosure";

interface CommandItem {
  id: string;
  category: "Navigasi Tab" | "Langkah Runbook" | "Berkas Bukti" | "Web UI Klaster" | "Aksi Cepat";
  title: string;
  subtitle: string;
  shortcut?: string;
  action: () => void;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("Setup");
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedPaletteIndex, setSelectedPaletteIndex] = useState<number>(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isTopologyOpen, setIsTopologyOpen] = useState<boolean>(false);

  // Load from localStorage
  const [state, setState] = useState<AppState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...INITIAL_STATE,
          ...parsed,
          prerequisites: { ...INITIAL_STATE.prerequisites, ...parsed.prerequisites },
          monitorLogs: { ...INITIAL_STATE.monitorLogs, ...parsed.monitorLogs },
          videoChecklist: { ...INITIAL_STATE.videoChecklist, ...parsed.videoChecklist },
          sampleMode: !!parsed.sampleMode,
        };
      }
    } catch (e) {
      console.error("Gagal membaca localStorage", e);
    }
    return INITIAL_STATE;
  });

  // Preserve user work when toggling sample mode
  const [userBackupState, setUserBackupState] = useState<AppState | null>(null);

  // Save to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Gagal menyimpan ke localStorage", e);
    }
  }, [state]);

  // MongoDB Integration State
  const [mongoStatus, setMongoStatus] = useState<MongoStatus | null>(null);
  const [isMongoModalOpen, setIsMongoModalOpen] = useState<boolean>(false);
  const [autoSync, setAutoSync] = useState<boolean>(() => {
    try {
      return localStorage.getItem("tp1_mongo_autosync") === "true";
    } catch {
      return false;
    }
  });

  const refreshMongoStatus = useCallback(async () => {
    try {
      const s = await mongoService.getStatus();
      setMongoStatus(s);
    } catch (e) {
      console.error("Gagal membaca status MongoDB", e);
    }
  }, []);

  useEffect(() => {
    refreshMongoStatus();
    const interval = setInterval(refreshMongoStatus, 20000);
    return () => clearInterval(interval);
  }, [refreshMongoStatus]);

  // Auto-sync state changes to MongoDB
  useEffect(() => {
    if (autoSync && !state.sampleMode) {
      const timer = setTimeout(() => {
        mongoService.saveState(state, "default_tp1").catch(() => {});
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [state, autoSync]);

  const handleToggleAutoSync = (enabled: boolean) => {
    setAutoSync(enabled);
    try {
      localStorage.setItem("tp1_mongo_autosync", enabled ? "true" : "false");
    } catch {}
  };

  const handleStateRestored = (newState: AppState) => {
    setState(newState);
  };

  const handleToggleSampleMode = useCallback(() => {
    if (!state.sampleMode) {
      setUserBackupState(state);
      setState({
        ...SAMPLE_STATE,
        sampleMode: true,
        theme: state.theme,
      });
    } else {
      if (userBackupState) {
        setState({
          ...userBackupState,
          sampleMode: false,
          theme: state.theme,
        });
      } else {
        setState({
          ...INITIAL_STATE,
          sampleMode: false,
          theme: state.theme,
        });
      }
    }
  }, [state, userBackupState]);

  const handleToggleTheme = useCallback(() => {
    setState((prev) => ({
      ...prev,
      theme: prev.theme === "dark" ? "light" : "dark",
    }));
  }, []);

  const handleResetData = useCallback(() => {
    if (
      window.confirm(
        "Apakah Anda yakin ingin mereset seluruh data kembali ke kondisi awal? Semua input akan dihapus."
      )
    ) {
      setState(INITIAL_STATE);
      setUserBackupState(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Credential Leak Scanner
  const credentialFindings = scanAllCredentials(state);

  // HUD Metrics Calculations
  const completedStepsCount = useMemo(
    () => STEPS_TEMPLATE.filter((s) => state.steps[s.id]?.completed).length,
    [state.steps]
  );
  const stepsPercentage = Math.round((completedStepsCount / STEPS_TEMPLATE.length) * 100);

  const evidenceUploadedCount = useMemo(
    () => EVIDENCE_DEF.filter((e) => state.evidence[e.id]?.filename?.trim()).length,
    [state.evidence]
  );

  const isDark = state.theme === "dark";
  const primaryNim = state.members[0]?.nim?.trim() || "<NIM>";

  const tabs: Array<{ id: ActiveTab; label: string; icon: React.FC<{ className?: string }> }> = useMemo(
    () => [
      { id: "Setup", label: "1. Setup & Specs", icon: Settings },
      { id: "Runbook", label: "2. Runbook (S01-S15)", icon: BookOpen },
      { id: "Monitor", label: "3. Monitor Log", icon: Activity },
      { id: "Validation", label: "4. Validasi WordCount", icon: CheckCircle },
      { id: "Evidence", label: "5. Bukti E01-E16", icon: FileCheck },
      { id: "Report", label: "6. Laporan & Ekspor", icon: FileText },
      { id: "Video", label: "7. Video Timeline", icon: Video },
      { id: "Disclosure", label: "8. AI Disclosure", icon: ShieldAlert },
    ],
    []
  );

  // Cluster Nodes topology reference
  const clusterNodes = useMemo(
    () => [
      { name: "namenode", role: "HDFS NameNode (Metadata)", port: "9870", url: "http://localhost:9870", ipc: "8020" },
      { name: "datanode1", role: "HDFS DataNode 1 (Blok)", port: "9864", ipc: "9866" },
      { name: "datanode2", role: "HDFS DataNode 2 (Replikasi 2)", port: "9864", ipc: "9866" },
      { name: "resourcemanager", role: "YARN ResourceManager", port: "8088", url: "http://localhost:8088", ipc: "8032" },
      { name: "nodemanager", role: "YARN NodeManager", port: "8042", ipc: "8040" },
      { name: "spark-master", role: "Apache Spark Master", port: "8080", url: "http://localhost:8080", ipc: "7077" },
      { name: "spark-worker1", role: "Spark Worker 1 (512m/1c)", port: "8081", ipc: "7078" },
      { name: "spark-worker2", role: "Spark Worker 2 (512m/1c)", port: "8081", ipc: "7079" },
    ],
    []
  );

  // Command Palette Items Indexing
  const paletteItems: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [];

    // Tabs
    tabs.forEach((tab, index) => {
      list.push({
        id: `tab-${tab.id}`,
        category: "Navigasi Tab",
        title: tab.label,
        subtitle: `Beralih ke tab kerja ${tab.label}`,
        shortcut: `${index + 1}`,
        action: () => {
          setActiveTab(tab.id);
          setIsCommandPaletteOpen(false);
        },
      });
    });

    // Runbook steps S01-S15
    STEPS_TEMPLATE.forEach((step) => {
      list.push({
        id: `step-${step.id}`,
        category: "Langkah Runbook",
        title: `${step.id}: ${step.judul}`,
        subtitle: `Fase ${step.phase} - ${step.phaseTitle} (Ekspektasi: ${step.expected})`,
        action: () => {
          setActiveTab("Runbook");
          setIsCommandPaletteOpen(false);
        },
      });
    });

    // Evidence E01-E16
    EVIDENCE_DEF.forEach((ev) => {
      list.push({
        id: `ev-${ev.id}`,
        category: "Berkas Bukti",
        title: `${ev.id}: ${ev.title}`,
        subtitle: `Terkait langkah ${ev.stepId} · File: ${ev.defaultFilenamePattern.replace("<NIM>", primaryNim)}`,
        action: () => {
          setActiveTab("Evidence");
          setIsCommandPaletteOpen(false);
        },
      });
    });

    // Web UI
    list.push(
      {
        id: "ui-namenode",
        category: "Web UI Klaster",
        title: "Buka HDFS NameNode Web UI",
        subtitle: "http://localhost:9870 (Cek Safe mode, Live Datanodes, file browser)",
        shortcut: "Port 9870",
        action: () => {
          window.open("http://localhost:9870", "_blank");
          setIsCommandPaletteOpen(false);
        },
      },
      {
        id: "ui-yarn",
        category: "Web UI Klaster",
        title: "Buka YARN ResourceManager Web UI",
        subtitle: "http://localhost:8088 (Pantau aplikasi MapReduce FINISHED/SUCCEEDED)",
        shortcut: "Port 8088",
        action: () => {
          window.open("http://localhost:8088", "_blank");
          setIsCommandPaletteOpen(false);
        },
      },
      {
        id: "ui-spark",
        category: "Web UI Klaster",
        title: "Buka Spark Master Web UI",
        subtitle: "http://localhost:8080 (Pantau Completed Applications TP1-WordCount)",
        shortcut: "Port 8080",
        action: () => {
          window.open("http://localhost:8080", "_blank");
          setIsCommandPaletteOpen(false);
        },
      }
    );

    // Quick Actions
    list.push(
      {
        id: "act-sample",
        category: "Aksi Cepat",
        title: state.sampleMode ? "Nonaktifkan Mode Contoh" : "Aktifkan Mode Contoh (Sample Data)",
        subtitle: "Muat data pengujian terverifikasi 100% untuk demonstrasi laboratorium",
        action: () => {
          handleToggleSampleMode();
          setIsCommandPaletteOpen(false);
        },
      },
      {
        id: "act-theme",
        category: "Aksi Cepat",
        title: state.theme === "dark" ? "Beralih ke Tema Terang (Light Mode)" : "Beralih ke Tema Gelap (Dark Mode)",
        subtitle: "Sesuaikan kontras tampilan antarmuka workstation",
        action: () => {
          handleToggleTheme();
          setIsCommandPaletteOpen(false);
        },
      },
      {
        id: "act-reset",
        category: "Aksi Cepat",
        title: "Reset Semua State Data",
        subtitle: "Kembalikan ke kondisi formulir kosong awal",
        action: () => {
          handleResetData();
          setIsCommandPaletteOpen(false);
        },
      },
      {
        id: "act-mongo",
        category: "Aksi Cepat",
        title: "Integrasi MongoDB: Status & Sinkronisasi Cloud",
        subtitle: mongoStatus?.connected
          ? `Terhubung ke ${mongoStatus.database} (${mongoStatus.pingMs}ms). Buka panel data & koleksi.`
          : "Buka panel koneksi MongoDB Atlas, pengujian ping, dan sinkronisasi persisten.",
        shortcut: "DB",
        action: () => {
          setIsMongoModalOpen(true);
          setIsCommandPaletteOpen(false);
        },
      }
    );

    return list;
  }, [tabs, state.sampleMode, state.theme, primaryNim, handleToggleSampleMode, handleToggleTheme, handleResetData, mongoStatus]);

  // Filter palette items based on search query
  const filteredPaletteItems = useMemo(() => {
    if (!searchQuery.trim()) return paletteItems;
    const q = searchQuery.toLowerCase();
    return paletteItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [paletteItems, searchQuery]);

  // Keyboard navigation & global shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in form inputs (unless Ctrl+K or Esc)
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      // Ctrl + K or Cmd + K toggles command palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        setSearchQuery("");
        setSelectedPaletteIndex(0);
        return;
      }

      // Escape closes palette
      if (e.key === "Escape" && isCommandPaletteOpen) {
        e.preventDefault();
        setIsCommandPaletteOpen(false);
        return;
      }

      // If palette is open: navigate with arrows & enter
      if (isCommandPaletteOpen) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedPaletteIndex((prev) =>
            prev < filteredPaletteItems.length - 1 ? prev + 1 : 0
          );
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedPaletteIndex((prev) =>
            prev > 0 ? prev - 1 : filteredPaletteItems.length - 1
          );
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (filteredPaletteItems[selectedPaletteIndex]) {
            filteredPaletteItems[selectedPaletteIndex].action();
          }
        }
        return;
      }

      // Number keys 1-8 for direct tab switching when NOT typing in an input
      if (!isInput && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= tabs.length) {
          e.preventDefault();
          setActiveTab(tabs[num - 1].id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCommandPaletteOpen, filteredPaletteItems, selectedPaletteIndex, tabs]);

  return (
    <div
      className={`min-h-screen transition-colors duration-150 ${
        isDark ? "bg-[#0b0f19] text-slate-100" : "bg-[#f8fafc] text-slate-900"
      }`}
    >
      {/* Sample Mode Banner */}
      {state.sampleMode && (
        <div className="bg-amber-500 text-slate-950 text-xs font-bold uppercase tracking-wider py-1 px-4 sticky top-0 z-50 flex items-center justify-between border-b border-amber-600 font-mono">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>MODE DATA CONTOH AKTIF · EKSPOR DIKUNCI DEMI INTEGRITAS AKADEMIK</span>
          </div>
          <button
            onClick={handleToggleSampleMode}
            className="text-[10px] bg-slate-950 text-amber-300 hover:text-white px-2 py-0.5 rounded font-mono uppercase transition-colors"
          >
            Kembali ke Data Asli
          </button>
        </div>
      )}

      {/* Credential Leak Warning Banner */}
      {credentialFindings.length > 0 && (
        <div className="bg-rose-950 border-b border-rose-800 text-rose-200 text-xs py-1.5 px-4 sticky top-0 z-40 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-semibold">
              Peringatan Integritas: Terdeteksi {credentialFindings.length} pola kredensial rahasia pada teks laporan.
            </span>
          </div>
          <span className="font-mono text-[11px] bg-rose-900/60 px-2 py-0.5 rounded border border-rose-700 text-rose-100">
            {credentialFindings[0].source} (L{credentialFindings[0].line}:C{credentialFindings[0].column})
          </span>
        </div>
      )}

      {/* Top Header & Workstation Command Bar */}
      <header
        className={`border-b sticky top-0 z-30 transition-colors ${
          isDark ? "bg-[#0d1322] border-slate-800" : "bg-white border-slate-200"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main Bar: Zone 1 (Brand) - Zone 2 (Search & HUD) - Zone 3 (Actions) */}
          <div className="flex items-center justify-between h-14 gap-4">
            {/* Zone 1: Single Wordmark Element */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-7 h-7 rounded bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
                <Layers className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-white whitespace-nowrap">
                  Tugas BigData Tbgsdewa % Dearizka
                </span>
                <span className="text-slate-500 text-xs" aria-hidden="true">·</span>
                <span className="text-xs text-slate-400 whitespace-nowrap hidden sm:inline">
                  STMIK Pelita Nusantara
                </span>
              </div>
            </div>

            {/* Zone 2: Quick Search Command Palette Trigger */}
            <div className="flex-1 max-w-md mx-2 hidden md:block">
              <button
                type="button"
                onClick={() => {
                  setIsCommandPaletteOpen(true);
                  setSearchQuery("");
                }}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded text-xs transition-colors border ${
                  isDark
                    ? "bg-slate-950/80 hover:bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                    : "bg-slate-100 hover:bg-slate-200/80 border-slate-300 text-slate-600 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <span>Cari langkah (S01-S15), bukti (E01-E16), Web UI...</span>
                </div>
                <kbd className="font-mono text-[10px] bg-slate-900 border border-slate-700/80 px-1.5 py-0.5 rounded text-slate-400">
                  Ctrl K
                </kbd>
              </button>
            </div>

            {/* Zone 3: Actions Toolbar */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Quick Topology Toggle */}
              <button
                type="button"
                onClick={() => setIsTopologyOpen((prev) => !prev)}
                className={`text-xs px-2.5 py-1 rounded font-mono font-medium flex items-center gap-1.5 transition-colors border ${
                  isTopologyOpen
                    ? "bg-indigo-950 text-indigo-300 border-indigo-700"
                    : isDark
                    ? "bg-slate-950 text-slate-400 hover:text-slate-200 border-slate-800"
                    : "bg-slate-100 text-slate-700 hover:text-slate-900 border-slate-300"
                }`}
                title="Buka status matriks 8 kontainer klaster"
              >
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">8 Node</span>
              </button>

              {/* Sample Mode Toggle */}
              <button
                type="button"
                onClick={handleToggleSampleMode}
                className={`text-xs px-2.5 py-1 rounded font-mono font-medium transition-colors border ${
                  state.sampleMode
                    ? "bg-amber-500 text-slate-950 font-bold border-amber-600"
                    : isDark
                    ? "bg-slate-950 text-slate-400 hover:text-white border-slate-800"
                    : "bg-slate-100 text-slate-700 hover:text-slate-950 border-slate-300"
                }`}
                title="Beralih ke data contoh terverifikasi untuk demonstrasi"
              >
                {state.sampleMode ? "Contoh: ON" : "Contoh: OFF"}
              </button>

              {/* Theme Toggle */}
              <button
                type="button"
                onClick={handleToggleTheme}
                className={`p-1.5 rounded transition-colors ${
                  isDark
                    ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
                aria-label="Toggle theme"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {/* Reset Data */}
              <button
                type="button"
                onClick={handleResetData}
                className={`p-1.5 rounded text-slate-400 hover:text-rose-400 transition-colors ${
                  isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"
                }`}
                title="Reset seluruh state ke nilai awal"
                aria-label="Reset data"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Persistent Workstation HUD (Telemetry Bar) */}
          <div className="py-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-y-2 gap-x-4 text-xs font-mono">
            {/* Left: Key Progress Telemetry */}
            <div className="flex flex-wrap items-center gap-3 text-slate-400">
              {/* Runbook Progress */}
              <button
                type="button"
                onClick={() => setActiveTab("Runbook")}
                className="hover:text-white flex items-center gap-1.5 transition-colors"
                title="Menuju tab Runbook S01-S15"
              >
                <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                <span>Runbook:</span>
                <span className={`font-bold tabular-nums ${completedStepsCount === 15 ? "text-emerald-400" : "text-slate-200"}`}>
                  {completedStepsCount}/15 ({stepsPercentage}%)
                </span>
              </button>

              <span className="text-slate-700" aria-hidden="true">·</span>

              {/* Evidence Progress */}
              <button
                type="button"
                onClick={() => setActiveTab("Evidence")}
                className="hover:text-white flex items-center gap-1.5 transition-colors"
                title="Menuju tab Bukti E01-E16"
              >
                <FileCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>Bukti:</span>
                <span className={`font-bold tabular-nums ${evidenceUploadedCount === 16 ? "text-emerald-400" : "text-slate-200"}`}>
                  {evidenceUploadedCount}/16 Siap
                </span>
              </button>

              <span className="text-slate-700" aria-hidden="true">·</span>

              {/* Paritas WordCount */}
              <button
                type="button"
                onClick={() => setActiveTab("Validation")}
                className="hover:text-white flex items-center gap-1.5 transition-colors"
                title="Menuju tab Validasi WordCount"
              >
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Paritas:</span>
                <span className="text-emerald-400 font-bold">100% (Selisih 0)</span>
              </button>

              <span className="text-slate-700" aria-hidden="true">·</span>

              {/* Video Rehearsal Pacing */}
              <button
                type="button"
                onClick={() => setActiveTab("Video")}
                className="hover:text-white flex items-center gap-1.5 transition-colors"
                title="Menuju tab Video Walkthrough"
              >
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Video Target:</span>
                <span className="text-slate-200 font-bold tabular-nums">07:15</span>
                <span className="text-[10px] text-slate-500">(Max 08:00)</span>
              </button>
            </div>

            {/* Right: Security & Integrity Indicator + MongoDB Status */}
            <div className="flex items-center gap-2">
              {/* MongoDB Status Button */}
              <button
                type="button"
                onClick={() => setIsMongoModalOpen(true)}
                className={`text-[11px] px-2 py-0.5 rounded flex items-center gap-1.5 border transition-colors ${
                  mongoStatus?.connected
                    ? "bg-emerald-950/40 text-emerald-300 border-emerald-900/60 hover:bg-emerald-900/40"
                    : "bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800"
                }`}
                title="Buka panel integrasi dan sinkronisasi MongoDB"
              >
                <Database className={`w-3 h-3 ${mongoStatus?.connected ? "text-emerald-400" : "text-amber-400"}`} />
                <span>
                  {mongoStatus?.connected
                    ? `MongoDB: Atlas (${mongoStatus.pingMs}ms)`
                    : "MongoDB: Standby"}
                </span>
              </button>

              <span
                className={`text-[11px] px-2 py-0.5 rounded flex items-center gap-1 border ${
                  credentialFindings.length === 0
                    ? "bg-emerald-950/40 text-emerald-300 border-emerald-900/60"
                    : "bg-rose-950/60 text-rose-300 border-rose-800 animate-pulse"
                }`}
              >
                {credentialFindings.length === 0 ? (
                  <>
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span>Integritas: Bebas Kredensial</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3 text-rose-400" />
                    <span>{credentialFindings.length} Kredensial Terdeteksi!</span>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Collapsible Cluster Nodes Matrix Bar */}
          {isTopologyOpen && (
            <div className="py-3 px-3 my-2 rounded bg-slate-950 border border-slate-800 text-xs font-mono space-y-2 animate-in fade-in duration-150">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
                <span className="text-[11px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                  Topologi 8 Node Klaster Big Data (Docker Bridge Network)
                </span>
                <button
                  type="button"
                  onClick={() => setIsTopologyOpen(false)}
                  className="text-slate-500 hover:text-white text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {clusterNodes.map((node) => (
                  <div
                    key={node.name}
                    className="p-2 rounded bg-slate-900/80 border border-slate-800/80 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-[11px]">{node.name}</span>
                        <span className="text-[10px] text-emerald-400 font-semibold">UP</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block truncate mt-0.5 font-sans">
                        {node.role}
                      </span>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-slate-800 flex items-center justify-between text-[10px]">
                      <span className="text-slate-500">Port {node.port}</span>
                      {node.url ? (
                        <a
                          href={node.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5"
                        >
                          <span>Web UI</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ) : (
                        <span className="text-slate-600">IPC {node.ipc}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clean Workstation Tabs Bar */}
          <nav className="flex space-x-1 overflow-x-auto py-1.5 border-t border-slate-800/60 scrollbar-none">
            {tabs.map((tab, idx) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-indigo-600 text-white font-semibold shadow-sm"
                      : isDark
                      ? "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                  title={`Tekan [${idx + 1}] untuk berpindah cepat`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Global Command Palette Modal (Ctrl + K) */}
      {isCommandPaletteOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-16 px-4"
          onClick={() => setIsCommandPaletteOpen(false)}
        >
          <div
            className={`w-full max-w-2xl rounded-lg shadow-2xl border overflow-hidden ${
              isDark ? "bg-[#0d1322] border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Box */}
            <div className="flex items-center px-4 py-3 border-b border-slate-800 gap-3">
              <Command className="w-4 h-4 text-indigo-400 shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="Ketik pencarian atau gunakan tombol panah (contoh: S10, E09, Spark, Web UI)..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedPaletteIndex(0);
                }}
                className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none font-sans"
              />
              <kbd className="font-mono text-[10px] bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-slate-400">
                ESC
              </kbd>
            </div>

            {/* Results List */}
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-800/40 p-2">
              {filteredPaletteItems.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs font-mono">
                  Tidak ditemukan hasil untuk "{searchQuery}".
                </div>
              ) : (
                filteredPaletteItems.map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.action}
                    onMouseEnter={() => setSelectedPaletteIndex(idx)}
                    className={`w-full text-left px-3 py-2.5 rounded flex items-center justify-between text-xs transition-colors ${
                      idx === selectedPaletteIndex
                        ? "bg-indigo-600 text-white"
                        : "hover:bg-slate-900/60 text-slate-200"
                    }`}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase font-semibold ${
                            idx === selectedPaletteIndex
                              ? "bg-indigo-700 text-white"
                              : "bg-slate-900 text-slate-400 border border-slate-800"
                          }`}
                        >
                          {item.category}
                        </span>
                        <span className="font-semibold truncate">{item.title}</span>
                      </div>
                      <p
                        className={`text-[11px] truncate mt-0.5 ${
                          idx === selectedPaletteIndex ? "text-indigo-100" : "text-slate-400"
                        }`}
                      >
                        {item.subtitle}
                      </p>
                    </div>

                    {item.shortcut && (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${
                          idx === selectedPaletteIndex
                            ? "border-indigo-400 text-indigo-100"
                            : "border-slate-800 text-slate-400 bg-slate-900"
                        }`}
                      >
                        {item.shortcut}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Modal Footer Keyboard Guide */}
            <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-800 text-[10px] font-mono text-slate-500 flex justify-between items-center">
              <span>Navigasi: ↑ ↓ untuk memilih · Enter untuk eksekusi</span>
              <span>Pintasan Tab: Tekan 1 sampai 8 kapan saja</span>
            </div>
          </div>
        </div>
      )}

      {/* MongoDB Integration & Synchronization Modal */}
      <MongoModal
        isOpen={isMongoModalOpen}
        onClose={() => setIsMongoModalOpen(false)}
        status={mongoStatus}
        onRefreshStatus={refreshMongoStatus}
        currentState={state}
        onStateRestored={handleStateRestored}
        autoSync={autoSync}
        onToggleAutoSync={handleToggleAutoSync}
      />

      {/* Main Content Viewport */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === "Setup" && <SetupTab state={state} onChange={setState} />}
        {activeTab === "Runbook" && (
          <RunbookTab state={state} onChange={setState} onNavigateToTab={(t) => setActiveTab(t as ActiveTab)} />
        )}
        {activeTab === "Monitor" && <MonitorTab state={state} onChange={setState} />}
        {activeTab === "Validation" && <ValidationTab state={state} onChange={setState} />}
        {activeTab === "Evidence" && <EvidenceTab state={state} onChange={setState} />}
        {activeTab === "Report" && (
          <ReportTab
            state={state}
            onChange={setState}
            onNavigateToTab={(t) => setActiveTab(t as ActiveTab)}
          />
        )}
        {activeTab === "Video" && <VideoTab state={state} onChange={setState} />}
        {activeTab === "Disclosure" && <DisclosureTab state={state} onChange={setState} />}
      </main>

      {/* Engineering Footer */}
      <footer
        className={`border-t py-5 text-xs transition-colors ${
          isDark ? "border-slate-800 text-slate-500" : "border-slate-200 text-slate-500"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p>
            STMIK Pelita Nusantara · Tugas Pemantapan 1 Big Data · Apache Hadoop 3.3.6 & Apache Spark 3.5.1
          </p>
          <div className="flex items-center gap-3 font-mono text-[11px] text-slate-600">
            <span>Toleransi galat 0</span>
            <span aria-hidden="true">·</span>
            <span>Deterministik</span>
            <span aria-hidden="true">·</span>
            <span>Pintasan: Ctrl+K</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
