import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  AlertTriangle,
  BookOpen,
  Activity,
  CheckCircle2,
  Command,
  Database,
  FileCheck2,
  FileText,
  Lock,
  Menu,
  Moon,
  RotateCcw,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Tv,
  Unlock,
  X,
  LayoutDashboard,
} from "lucide-react";
import { INITIAL_STATE, SAMPLE_STATE } from "./sampleData";
import { AppState } from "./types";
import { scanAllCredentials, findRemainingIsiPlaceholders } from "./scanner";
import { checkExportGate } from "./export";
import { STEPS_TEMPLATE, EVIDENCE_DEF } from "./constants";
import { mongoService, MongoStatus } from "./services/mongoService";
import { MongoModal } from "./components/MongoModal";
import { Chip, BrandMark, Monogram } from "./components/ui";
import { HomeTab } from "./tabs/Home";
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
  | "Ringkasan"
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

interface SectionDef {
  id: ActiveTab;
  no: string;
  label: string;
  icon: React.FC<{ className?: string }>;
  group: "Pusat Kerja" | "Persiapan" | "Eksekusi" | "Verifikasi" | "Dokumentasi";
}

const SECTIONS: SectionDef[] = [
  { id: "Ringkasan", no: "0", label: "Ringkasan Pekerjaan", icon: LayoutDashboard, group: "Pusat Kerja" },
  { id: "Setup", no: "1", label: "Setup & Spesifikasi", icon: Settings, group: "Persiapan" },
  { id: "Runbook", no: "2", label: "Runbook S01–S15", icon: BookOpen, group: "Eksekusi" },
  { id: "Monitor", no: "3", label: "Monitor Log", icon: Activity, group: "Eksekusi" },
  { id: "Validation", no: "4", label: "Validasi WordCount", icon: CheckCircle2, group: "Verifikasi" },
  { id: "Evidence", no: "5", label: "Bukti E01–E16", icon: FileCheck2, group: "Verifikasi" },
  { id: "Report", no: "6", label: "Laporan & Ekspor", icon: FileText, group: "Dokumentasi" },
  { id: "Video", no: "7", label: "Video Walkthrough", icon: Tv, group: "Dokumentasi" },
  { id: "Disclosure", no: "8", label: "AI Disclosure", icon: ShieldAlert, group: "Dokumentasi" },
];

const GROUP_ORDER: SectionDef["group"][] = ["Pusat Kerja", "Persiapan", "Eksekusi", "Verifikasi", "Dokumentasi"];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("Ringkasan");
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedPaletteIndex, setSelectedPaletteIndex] = useState<number>(0);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);

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

  // Theme class on <html> so canvas color also applies outside #root
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("theme-light", "theme-dark");
    root.classList.add(state.theme === "dark" ? "theme-dark" : "theme-light");
  }, [state.theme]);

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

  // Data integrity & progress — dihitung dari state aktual, tanpa angka karangan
  const credentialFindings = scanAllCredentials(state);
  const gate = checkExportGate(state);
  const prereqDone = Object.values(state.prerequisites).filter(Boolean).length;
  const monitorFilled = Object.values(state.monitorLogs).filter((v) => v.trim().length > 0).length;
  const videoDone = Object.values(state.videoChecklist).filter(Boolean).length;
  const isiCount = state.noAiUsage ? 0 : findRemainingIsiPlaceholders(state).length;

  const sectionMeta = useMemo<Record<ActiveTab, React.ReactNode>>(() => {
    const stepsDone = STEPS_TEMPLATE.filter((s) => state.steps[s.id]?.completed).length;
    return {
      Ringkasan: null,
      Setup: (
        <span className={`font-mono text-[10px] tabular-nums ${prereqDone === 3 ? "text-ok" : "text-ink-muted"}`}>
          {prereqDone}/3
        </span>
      ),
      Runbook: (
        <span
          className={`font-mono text-[10px] tabular-nums ${stepsDone === STEPS_TEMPLATE.length ? "text-ok" : "text-ink-muted"}`}
        >
          {stepsDone}/{STEPS_TEMPLATE.length}
        </span>
      ),
      Monitor: (
        <span className={`font-mono text-[10px] tabular-nums ${monitorFilled === 8 ? "text-ok" : "text-ink-muted"}`}>
          {monitorFilled}/8
        </span>
      ),
      Validation: gate.isValid ? (
        <span className="font-mono text-[10px] font-bold text-ok">VALID</span>
      ) : (
        <span className="font-mono text-[10px] text-ink-muted">—</span>
      ),
      Evidence: (
        <span
          className={`font-mono text-[10px] tabular-nums ${
            gate.evidenceCompleted === gate.totalEvidence ? "text-ok" : "text-ink-muted"
          }`}
        >
          {gate.evidenceCompleted}/{gate.totalEvidence}
        </span>
      ),
      Report: gate.canExport ? (
        <Unlock className="h-3.5 w-3.5 text-ok" aria-label="Gerbang ekspor terbuka" />
      ) : (
        <Lock className="h-3.5 w-3.5 text-ink-muted" aria-label="Gerbang ekspor terkunci" />
      ),
      Video: (
        <span className={`font-mono text-[10px] tabular-nums ${videoDone === 4 ? "text-ok" : "text-ink-muted"}`}>
          {videoDone}/4
        </span>
      ),
      Disclosure: state.noAiUsage ? (
        <span className="font-mono text-[10px] text-ok">NON-AI</span>
      ) : isiCount > 0 ? (
        <span className="font-mono text-[10px] text-warn">{isiCount}·ISI</span>
      ) : (
        <span className="font-mono text-[10px] text-ok">ISI</span>
      ),
    };
  }, [state, gate, prereqDone, monitorFilled, videoDone, isiCount]);

  // Command Palette Items Indexing
  const paletteItems: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [];

    SECTIONS.forEach((tab) => {
      list.push({
        id: `tab-${tab.id}`,
        category: "Navigasi Tab",
        title: `${tab.no === "0" ? "" : `${tab.no}. `}${tab.label}`,
        subtitle: `Beralih ke bagian ${tab.label}`,
        shortcut: tab.no,
        action: () => {
          setActiveTab(tab.id);
          setIsCommandPaletteOpen(false);
          setIsMobileNavOpen(false);
        },
      });
    });

    STEPS_TEMPLATE.forEach((step) => {
      list.push({
        id: `step-${step.id}`,
        category: "Langkah Runbook",
        title: `${step.id}: ${step.judul}`,
        subtitle: `Fase ${step.phase} - ${step.phaseTitle} (Ekspektasi: ${step.expected})`,
        action: () => {
          setActiveTab("Runbook");
          setIsCommandPaletteOpen(false);
          setIsMobileNavOpen(false);
        },
      });
    });

    EVIDENCE_DEF.forEach((ev) => {
      list.push({
        id: `ev-${ev.id}`,
        category: "Berkas Bukti",
        title: `${ev.id}: ${ev.title}`,
        subtitle: `Terkait langkah ${ev.stepId} · File: ${ev.defaultFilenamePattern.replace(
          "<NIM>",
          state.members[0]?.nim?.trim() || "<NIM>"
        )}`,
        action: () => {
          setActiveTab("Evidence");
          setIsCommandPaletteOpen(false);
          setIsMobileNavOpen(false);
        },
      });
    });

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

    list.push(
      {
        id: "act-sample",
        category: "Aksi Cepat",
        title: state.sampleMode ? "Nonaktifkan Mode Contoh" : "Aktifkan Mode Contoh (Sample Data)",
        subtitle: "Muat dataset pengujian bawaan aplikasi untuk uji coba antarmuka",
        action: () => {
          handleToggleSampleMode();
          setIsCommandPaletteOpen(false);
        },
      },
      {
        id: "act-theme",
        category: "Aksi Cepat",
        title: state.theme === "dark" ? "Beralih ke Tema Terang" : "Beralih ke Tema Gelap",
        subtitle: "Sesuaikan kontras tampilan workbench",
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
  }, [state.sampleMode, state.theme, state.members, handleToggleSampleMode, handleToggleTheme, handleResetData, mongoStatus]);

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
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        setSearchQuery("");
        setSelectedPaletteIndex(0);
        return;
      }

      if (e.key === "Escape" && isCommandPaletteOpen) {
        e.preventDefault();
        setIsCommandPaletteOpen(false);
        return;
      }

      if (isCommandPaletteOpen) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedPaletteIndex((prev) => (prev < filteredPaletteItems.length - 1 ? prev + 1 : 0));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedPaletteIndex((prev) => (prev > 0 ? prev - 1 : filteredPaletteItems.length - 1));
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (filteredPaletteItems[selectedPaletteIndex]) {
            filteredPaletteItems[selectedPaletteIndex].action();
          }
        }
        return;
      }

      if (!isInput && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (e.key === "0") {
          e.preventDefault();
          setActiveTab("Ringkasan");
          return;
        }
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 8) {
          e.preventDefault();
          const section = SECTIONS.find((s) => s.no === String(num));
          if (section) setActiveTab(section.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCommandPaletteOpen, filteredPaletteItems, selectedPaletteIndex]);

  const navigate = useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
    setIsMobileNavOpen(false);
    window.scrollTo({ top: 0 });
  }, []);

  const activeSection = SECTIONS.find((s) => s.id === activeTab)!;

  const sidebarContent = (
    <>
      <div className="border-b border-line px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandMark className="h-[18px] w-auto shrink-0 text-ink" />
            <p className="text-[15px] font-extrabold uppercase leading-none tracking-[0.01em] text-ink">
              Klaster<span className="text-accent">Deck</span>
            </p>
          </div>
          <span className="shrink-0 rounded-sm border border-line px-1.5 py-0.5 font-mono text-[9px] text-ink-muted">
            TP1
          </span>
        </div>
        <p className="label-micro mt-2.5 truncate">
          {state.members[0]?.nama?.trim()
            ? `Operator: ${state.members[0].nama.trim()}`
            : "Tbgsdewa % Dearizka · Belum diklaim"}
        </p>
        <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-ink-muted">
          Hadoop 3.3.6 × Spark 3.5.1 · STMIK Pelita Nusantara
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3" aria-label="Navigasi bagian tugas">
        {GROUP_ORDER.map((group) => (
          <div key={group} className="mb-4 last:mb-0">
            <p className="label-micro mb-1.5 px-2">{group}</p>
            <ul className="space-y-0.5">
              {SECTIONS.filter((s) => s.group === group).map((section) => {
                const Icon = section.icon;
                const isActive = activeTab === section.id;
                return (
                  <li key={section.id}>
                    <button
                      type="button"
                      onClick={() => navigate(section.id)}
                      aria-current={isActive ? "page" : undefined}
                      className={`group flex w-full items-center gap-2.5 rounded-sm border-l-2 px-2 py-1.5 text-left text-xs transition-colors ${
                        isActive
                          ? "border-l-accent bg-surface-2 font-semibold text-ink"
                          : "border-l-transparent text-ink-soft hover:bg-surface-2/70 hover:text-ink"
                      }`}
                    >
                      <Icon
                        className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-accent" : "text-ink-muted"}`}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        <span className="mr-1.5 font-mono text-[10px] text-ink-muted">{section.no}</span>
                        {section.label}
                      </span>
                      {sectionMeta[section.id]}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line px-3 py-3">
        <div className="mb-3 flex items-center gap-2.5 rounded-sm border border-line bg-surface-2/60 px-2.5 py-2">
          <Monogram name={state.members[0]?.nama || ""} />
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold text-ink-soft">
              {state.members[0]?.nama?.trim() || "Operator belum terdaftar"}
            </p>
            <p className="truncate font-mono text-[10px] text-ink-muted">
              {state.members[0]?.nim?.trim() || "NIM —"} · {state.members[0]?.porsi || "porsi —"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsMongoModalOpen(true)}
          className={`btn w-full ${mongoStatus?.connected ? "btn-outline" : "btn-outline"}`}
          title="Buka panel integrasi dan sinkronisasi MongoDB"
        >
          <Database className={`h-3.5 w-3.5 ${mongoStatus?.connected ? "text-ok" : "text-warn"}`} />
          <span className="truncate font-mono text-[11px]">
            {mongoStatus?.connected
              ? `MongoDB ${mongoStatus.pingMs}ms`
              : mongoStatus
              ? "MongoDB Standby"
              : "MongoDB Dicek…"}
          </span>
        </button>
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-ink-muted">
          Pintasan: <span className="text-ink-soft">Ctrl K</span> cari ·{" "}
          <span className="text-ink-soft">0–8</span> pindah bagian
        </p>
      </div>
    </>
  );

  return (
    <div
      className={`min-h-screen bg-canvas text-ink transition-colors ${
        state.theme === "dark" ? "theme-dark" : "theme-light"
      }`}
    >
      {/* Sample Mode Banner */}
      {state.sampleMode && (
        <div className="border-b border-warn/40 bg-warn-wash px-4 py-1.5 text-warn">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-wider">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Mode Contoh Aktif — ekspor terkunci sampai kembali ke data asli
            </p>
            <button
              onClick={handleToggleSampleMode}
              className="btn btn-outline !border-warn/50 !px-2 !py-0.5 !text-[11px] !text-warn hover:!text-ink"
            >
              Kembali ke Data Asli
            </button>
          </div>
        </div>
      )}

      {/* Credential Leak Warning Banner */}
      {credentialFindings.length > 0 && (
        <div className="border-b border-danger/40 bg-danger-wash px-4 py-1.5 text-danger">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-xs font-semibold">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Peringatan Integritas: {credentialFindings.length} pola kredensial rahasia terdeteksi pada teks
              laporan.
            </p>
            <span className="status-chip border-danger/50 font-mono text-[10px] text-danger">
              {credentialFindings[0].source} (L{credentialFindings[0].line}:C{credentialFindings[0].column})
            </span>
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-[1600px]">
        {/* Sidebar desktop */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
          {sidebarContent}
        </aside>

        {/* Drawer mobile */}
        {isMobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigasi">
            <div className="absolute inset-0 bg-black/50" onClick={() => setIsMobileNavOpen(false)} />
            <div className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-line bg-surface shadow-lg">
              <div className="flex justify-end px-2 py-2">
                <button
                  type="button"
                  onClick={() => setIsMobileNavOpen(false)}
                  className="btn btn-ghost !px-2"
                  aria-label="Tutup navigasi"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex min-h-0 flex-1 flex-col">{sidebarContent}</div>
            </div>
          </div>
        )}

        {/* Kolom kerja */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur-none">
            <div className="flex h-13 items-center gap-3 px-4 py-2.5">
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(true)}
                className="btn btn-outline !px-2 lg:hidden"
                aria-label="Buka navigasi"
              >
                <Menu className="h-4 w-4" />
              </button>

              {/* Brand kompak untuk layar sempit */}
              <div className="flex items-center gap-2 lg:hidden">
                <BrandMark className="h-3.5 w-auto text-ink" />
                <span className="text-[12px] font-extrabold uppercase tracking-tight text-ink">
                  Klaster<span className="text-accent">Deck</span>
                </span>
              </div>

              <div className="hidden min-w-0 items-baseline gap-2 lg:flex">
                <span className="font-mono text-[11px] tracking-wider text-ink-muted">
                  KLASTERDECK <span className="text-ink-muted/60">/</span>{" "}
                  <span className="font-bold text-accent">{activeSection.no.padStart(2, "0")}</span>
                </span>
                <h1 className="truncate text-sm font-bold uppercase tracking-tight text-ink">
                  {activeSection.label}
                </h1>
              </div>

              {/* Pencarian / command palette */}
              <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 md:justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsCommandPaletteOpen(true);
                    setSearchQuery("");
                  }}
                  className="hidden w-full max-w-sm items-center justify-between gap-2 rounded-sm border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink md:flex"
                >
                  <span className="flex items-center gap-2 truncate">
                    <Search className="h-3.5 w-3.5" />
                    Cari langkah, bukti, Web UI…
                  </span>
                  <kbd className="rounded-sm border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px]">
                    Ctrl K
                  </kbd>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCommandPaletteOpen(true);
                    setSearchQuery("");
                  }}
                  className="btn btn-outline !px-2 md:hidden"
                  aria-label="Buka pencarian"
                >
                  <Search className="h-4 w-4" />
                </button>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {state.sampleMode && (
                  <Chip tone="warn" className="hidden sm:inline-flex" title="Mode data contoh aktif">
                    Contoh
                  </Chip>
                )}
                <button
                  type="button"
                  onClick={handleToggleSampleMode}
                  className={`btn font-mono ${state.sampleMode ? "btn-primary" : "btn-outline"}`}
                  title="Beralih ke data contoh terverifikasi untuk demonstrasi"
                >
                  {state.sampleMode ? "Contoh ON" : "Contoh OFF"}
                </button>
                <button
                  type="button"
                  onClick={handleToggleTheme}
                  className="btn btn-ghost !px-2"
                  aria-label="Ganti tema terang/gelap"
                >
                  {state.theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleResetData}
                  className="btn btn-danger-ghost !px-2"
                  title="Reset seluruh state ke nilai awal"
                  aria-label="Reset data"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            </div>
          </header>

          {/* Command palette */}
          {isCommandPaletteOpen && (
            <div
              className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-20"
              onClick={() => setIsCommandPaletteOpen(false)}
            >
              <div
                className="w-full max-w-2xl overflow-hidden rounded-md border border-line-strong/70 bg-surface text-ink shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 border-b border-line px-4 py-3">
                  <Command className="h-4 w-4 shrink-0 text-accent" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Ketik pencarian atau gunakan tombol panah (contoh: S10, E09, Spark, Web UI)..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSelectedPaletteIndex(0);
                    }}
                    className="w-full bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none"
                  />
                  <kbd className="rounded-sm border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
                    ESC
                  </kbd>
                </div>

                <ul className="max-h-96 overflow-y-auto p-2">
                  {filteredPaletteItems.length === 0 ? (
                    <li className="py-8 text-center font-mono text-xs text-ink-muted">
                      Tidak ditemukan hasil untuk "{searchQuery}".
                    </li>
                  ) : (
                    filteredPaletteItems.map((item, idx) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={item.action}
                          onMouseEnter={() => setSelectedPaletteIndex(idx)}
                          className={`flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-xs transition-colors ${
                            idx === selectedPaletteIndex ? "bg-accent text-accent-ink" : "text-ink-soft hover:bg-surface-2"
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span
                                className={`shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase ${
                                  idx === selectedPaletteIndex
                                    ? "border-accent-ink/30 text-accent-ink"
                                    : "border-line text-ink-muted"
                                }`}
                              >
                                {item.category}
                              </span>
                              <span className="truncate font-semibold">{item.title}</span>
                            </span>
                            <span
                              className={`mt-0.5 block truncate text-[11px] ${
                                idx === selectedPaletteIndex ? "text-accent-ink/80" : "text-ink-muted"
                              }`}
                            >
                              {item.subtitle}
                            </span>
                          </span>
                          {item.shortcut && (
                            <span
                              className={`shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] ${
                                idx === selectedPaletteIndex
                                  ? "border-accent-ink/30 text-accent-ink"
                                  : "border-line text-ink-muted"
                              }`}
                            >
                              {item.shortcut}
                            </span>
                          )}
                        </button>
                      </li>
                    ))
                  )}
                </ul>

                <div className="flex justify-between border-t border-line bg-surface-2 px-4 py-2 font-mono text-[10px] text-ink-muted">
                  <span>Navigasi: ↑ ↓ memilih · Enter eksekusi</span>
                  <span>Pintasan bagian: 0–8</span>
                </div>
              </div>
            </div>
          )}

          {/* Konten bagian aktif */}
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {activeTab === "Ringkasan" && (
              <HomeTab
                state={state}
                mongoStatus={mongoStatus}
                onNavigate={navigate}
                onOpenMongo={() => setIsMongoModalOpen(true)}
                onRefreshMongo={refreshMongoStatus}
              />
            )}
            {activeTab === "Setup" && <SetupTab state={state} onChange={setState} />}
            {activeTab === "Runbook" && (
              <RunbookTab state={state} onChange={setState} onNavigateToTab={(t) => navigate(t as ActiveTab)} />
            )}
            {activeTab === "Monitor" && <MonitorTab state={state} onChange={setState} />}
            {activeTab === "Validation" && <ValidationTab state={state} onChange={setState} />}
            {activeTab === "Evidence" && <EvidenceTab state={state} onChange={setState} />}
            {activeTab === "Report" && (
              <ReportTab state={state} onChange={setState} onNavigateToTab={(t) => navigate(t as ActiveTab)} />
            )}
            {activeTab === "Video" && <VideoTab state={state} onChange={setState} />}
            {activeTab === "Disclosure" && <DisclosureTab state={state} onChange={setState} />}
          </main>

          <footer className="border-t border-line px-4 py-4 text-xs text-ink-muted sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2">
                <BrandMark className="h-3 w-auto shrink-0 text-ink-muted" />
                <span className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">KlasterDeck</span>
                <span className="text-ink-muted">· STMIK Pelita Nusantara · Tugas Pemantapan 1 Big Data ·
                  Apache Hadoop 3.3.6 &amp; Apache Spark 3.5.1</span>
              </p>
              <p className="flex items-center gap-3 font-mono text-[11px]">
                {credentialFindings.length === 0 ? (
                  <span className="flex items-center gap-1 text-ok">
                    <ShieldCheck className="h-3 w-3" /> Bebas Kredensial
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-danger">
                    <AlertTriangle className="h-3 w-3" /> {credentialFindings.length} Kredensial
                  </span>
                )}
                <span className="hidden sm:inline">Toleransi galat 0</span>
              </p>
            </div>
          </footer>
        </div>
      </div>

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
    </div>
  );
}
