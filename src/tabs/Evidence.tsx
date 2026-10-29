import React, { useState, useMemo } from "react";
import {
  Camera,
  Clock,
  Check,
  AlertCircle,
  Download,
  Search,
  FileSpreadsheet,
  FileJson,
  Wand2,
  Sparkles,
  Database,
} from "lucide-react";
import { EVIDENCE_DEF } from "../constants";
import { mongoService } from "../services/mongoService";
import { AppState, EvidenceItem } from "../types";

interface EvidenceProps {
  state: AppState;
  onChange: (updater: (prev: AppState) => AppState) => void;
}

type FilterStatus = "ALL" | "INCOMPLETE" | "COMPLETE";

export const EvidenceTab: React.FC<EvidenceProps> = ({ state, onChange }) => {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [mongoSyncStatus, setMongoSyncStatus] = useState<"idle" | "syncing" | "synced" | "error">("idle");

  const primaryNim = state.members[0]?.nim?.trim() || "NIM";

  const handleSyncToMongo = async () => {
    setMongoSyncStatus("syncing");
    try {
      const items = Object.values(state.evidence || {});
      const res = await mongoService.syncEvidence(items);
      if (res.success) {
        setMongoSyncStatus("synced");
        setTimeout(() => setMongoSyncStatus("idle"), 3000);
      } else {
        setMongoSyncStatus("error");
        setTimeout(() => setMongoSyncStatus("idle"), 3000);
      }
    } catch {
      setMongoSyncStatus("error");
      setTimeout(() => setMongoSyncStatus("idle"), 3000);
    }
  };

  const completedCount = EVIDENCE_DEF.filter((def) => {
    const item = state.evidence[def.id];
    return item && item.filename.trim() !== "" && item.notes.trim().length >= 20;
  }).length;

  const total = EVIDENCE_DEF.length;
  const progressPct = Math.round((completedCount / total) * 100);

  const handleUpdateItem = (id: string, field: keyof EvidenceItem, val: string) => {
    onChange((prev) => {
      const existing = prev.evidence[id] || {
        id,
        stepId: EVIDENCE_DEF.find((d) => d.id === id)?.stepId || "",
        title: EVIDENCE_DEF.find((d) => d.id === id)?.title || "",
        filename: "",
        notes: "",
        timestamp: "",
      };
      return {
        ...prev,
        evidence: {
          ...prev.evidence,
          [id]: {
            ...existing,
            [field]: val,
          },
        },
      };
    });
  };

  const setNowTimestamp = (id: string) => {
    const now = new Date();
    const formatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
    handleUpdateItem(id, "timestamp", formatted);
  };

  // Batch action: Normalize all filenames
  const handleNormalizeAllFilenames = () => {
    onChange((prev) => {
      const updated = { ...prev.evidence };
      EVIDENCE_DEF.forEach((def) => {
        const existing = updated[def.id] || {
          id: def.id,
          stepId: def.stepId,
          title: def.title,
          filename: "",
          notes: "",
          timestamp: "",
        };
        const standardName = def.defaultFilenamePattern.replace(/<NIM>/g, primaryNim);
        updated[def.id] = {
          ...existing,
          filename: standardName,
        };
      });
      return { ...prev, evidence: updated };
    });
  };

  // Batch action: Apply formal observation templates to empty notes
  const handlePopulateFormalTemplates = () => {
    onChange((prev) => {
      const updated = { ...prev.evidence };
      EVIDENCE_DEF.forEach((def) => {
        const existing = updated[def.id] || {
          id: def.id,
          stepId: def.stepId,
          title: def.title,
          filename: "",
          notes: "",
          timestamp: "",
        };
        // Fill if notes is empty or under 20 chars
        if (!existing.notes || existing.notes.trim().length < 20) {
          updated[def.id] = {
            ...existing,
            notes: def.formalTemplate,
          };
        }
      });
      return { ...prev, evidence: updated };
    });
  };

  // Batch action: Sync current timestamp on empty timestamps
  const handleSyncTimestamps = () => {
    const now = new Date();
    const formatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

    onChange((prev) => {
      const updated = { ...prev.evidence };
      EVIDENCE_DEF.forEach((def) => {
        const existing = updated[def.id] || {
          id: def.id,
          stepId: def.stepId,
          title: def.title,
          filename: "",
          notes: "",
          timestamp: "",
        };
        if (!existing.timestamp) {
          updated[def.id] = {
            ...existing,
            timestamp: formatted,
          };
        }
      });
      return { ...prev, evidence: updated };
    });
  };

  // Export Manifest as CSV
  const handleExportCsv = () => {
    const headers = ["ID", "Langkah", "Judul Bukti", "Nama Berkas", "Waktu Eksekusi", "Status", "Keterangan Observasi"];
    const rows = EVIDENCE_DEF.map((def) => {
      const item = state.evidence[def.id] || { filename: "", notes: "", timestamp: "" };
      const isComplete = item.filename.trim() !== "" && item.notes.trim().length >= 20;
      return [
        def.id,
        def.stepId,
        `"${def.title.replace(/"/g, '""')}"`,
        `"${item.filename.replace(/"/g, '""')}"`,
        `"${item.timestamp}"`,
        isComplete ? "LENGKAP" : "BELUM LENGKAP",
        `"${item.notes.replace(/"/g, '""')}"`,
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `manifest_bukti_${primaryNim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export Manifest as JSON
  const handleExportJson = () => {
    const manifest = {
      nim: primaryNim,
      totalEvidence: EVIDENCE_DEF.length,
      completedEvidence: completedCount,
      generatedAt: new Date().toISOString(),
      items: EVIDENCE_DEF.map((def) => {
        const item = state.evidence[def.id] || { filename: "", notes: "", timestamp: "" };
        return {
          id: def.id,
          stepId: def.stepId,
          title: def.title,
          filename: item.filename,
          notes: item.notes,
          timestamp: item.timestamp,
          isComplete: item.filename.trim() !== "" && item.notes.trim().length >= 20,
        };
      }),
    };

    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `manifest_bukti_${primaryNim}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered evidence list
  const filteredEvidence = useMemo(() => {
    return EVIDENCE_DEF.filter((def) => {
      const item = state.evidence[def.id] || { filename: "", notes: "", timestamp: "" };
      const isComplete = item.filename.trim() !== "" && item.notes.trim().length >= 20;

      // Status filter
      if (filterStatus === "COMPLETE" && !isComplete) return false;
      if (filterStatus === "INCOMPLETE" && isComplete) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = def.id.toLowerCase().includes(q);
        const matchesStep = def.stepId.toLowerCase().includes(q);
        const matchesTitle = def.title.toLowerCase().includes(q);
        const matchesFile = item.filename.toLowerCase().includes(q);
        const matchesNotes = item.notes.toLowerCase().includes(q);
        if (!matchesId && !matchesStep && !matchesTitle && !matchesFile && !matchesNotes) {
          return false;
        }
      }

      return true;
    });
  }, [state.evidence, filterStatus, searchQuery]);

  const isDark = state.theme === "dark";

  return (
    <div className="space-y-6">
      {/* Header Info & Progress Strip */}
      <section
        className={`border rounded-lg p-5 transition-colors ${
          isDark ? "bg-[#0d1322] border-slate-800" : "bg-white border-slate-200"
        }`}
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Camera className="w-4 h-4 text-indigo-400" />
              Katalog & Manajemen Metadata Bukti Pelaksanaan (E01 - E16)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Kelola metadata berkas tangkapan layar, observasi formal ilmiah (&ge; 20 karakter), dan ekspor manifest bukti.
            </p>
          </div>

          <div className="w-full md:w-60 text-xs">
            <div className="flex justify-between items-center mb-1 font-mono">
              <span className="text-slate-400">Kelengkapan Bukti</span>
              <span className="font-semibold text-slate-200 tabular-nums">
                {completedCount} / {total} ({progressPct}%)
              </span>
            </div>
            <div className="w-full bg-slate-950 rounded h-1.5 overflow-hidden border border-slate-800">
              <div
                className={`h-1.5 rounded transition-all duration-200 ${
                  completedCount === total ? "bg-emerald-500" : "bg-indigo-500"
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Toolbar: Batch Utilities & Manifest Exporters */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 mt-4 text-xs font-mono">
          {/* Batch Assistants */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleNormalizeAllFilenames}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-slate-200 transition-colors flex items-center gap-1.5"
              title="Mengisi seluruh nama berkas dengan pola resmi: E##_<NIM>_<nama>.png"
            >
              <Wand2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Normalisasi Nama Berkas</span>
            </button>

            <button
              onClick={handlePopulateFormalTemplates}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-slate-200 transition-colors flex items-center gap-1.5"
              title="Mengisi deskripsi observasi akademis terstruktur pada baris yang masih kosong"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Lengkapi Template Observasi</span>
            </button>

            <button
              onClick={handleSyncTimestamps}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-slate-200 transition-colors flex items-center gap-1.5"
              title="Isi waktu saat ini pada tanggal eksekusi yang masih kosong"
            >
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Sinkronisasi Waktu</span>
            </button>
          </div>

          {/* Manifest Export Buttons */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-[11px] font-sans">Ekspor Manifest:</span>
            <button
              onClick={handleExportCsv}
              className="px-2.5 py-1 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded text-slate-300 transition-colors flex items-center gap-1"
              title="Unduh manifest bukti format CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>.CSV</span>
            </button>
            <button
              onClick={handleExportJson}
              className="px-2.5 py-1 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded text-slate-300 transition-colors flex items-center gap-1"
              title="Unduh manifest bukti format JSON"
            >
              <FileJson className="w-3.5 h-3.5 text-purple-400" />
              <span>.JSON</span>
            </button>
            <button
              onClick={handleSyncToMongo}
              disabled={mongoSyncStatus === "syncing"}
              className={`px-2.5 py-1 border rounded transition-colors flex items-center gap-1 ${
                mongoSyncStatus === "synced"
                  ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                  : mongoSyncStatus === "error"
                  ? "bg-rose-950 text-rose-300 border-rose-800"
                  : "bg-slate-900 hover:bg-slate-800 text-cyan-300 border-cyan-800/60"
              }`}
              title="Sinkronkan seluruh daftar bukti E01-E16 ke koleksi MongoDB"
            >
              <Database className="w-3.5 h-3.5" />
              <span>
                {mongoSyncStatus === "syncing"
                  ? "Sync..."
                  : mongoSyncStatus === "synced"
                  ? "Tersinkron"
                  : mongoSyncStatus === "error"
                  ? "Gagal"
                  : "Sync MongoDB"}
              </span>
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mt-3 pt-3 border-t border-slate-800/60 font-mono text-xs">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilterStatus("ALL")}
              className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
                filterStatus === "ALL"
                  ? "bg-indigo-600 text-white font-semibold"
                  : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              Semua ({total})
            </button>
            <button
              onClick={() => setFilterStatus("INCOMPLETE")}
              className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
                filterStatus === "INCOMPLETE"
                  ? "bg-indigo-600 text-white font-semibold"
                  : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              Belum Lengkap ({total - completedCount})
            </button>
            <button
              onClick={() => setFilterStatus("COMPLETE")}
              className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
                filterStatus === "COMPLETE"
                  ? "bg-indigo-600 text-white font-semibold"
                  : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              Lengkap ({completedCount})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Cari bukti / file / observasi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-3 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </section>

      {/* Evidence Table */}
      <section
        className={`border rounded-lg overflow-hidden transition-colors ${
          isDark ? "bg-[#0d1322] border-slate-800" : "bg-white border-slate-200"
        }`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4 w-14 font-mono">ID</th>
                <th className="py-2.5 px-4 w-16 font-mono">Langkah</th>
                <th className="py-2.5 px-4 w-56">Deskripsi Bukti</th>
                <th className="py-2.5 px-4 w-56 font-mono">Nama Berkas Gambar</th>
                <th className="py-2.5 px-4">Keterangan Observasi Terverifikasi</th>
                <th className="py-2.5 px-4 w-44 font-mono">Waktu Eksekusi</th>
                <th className="py-2.5 px-4 w-16 text-center font-mono">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredEvidence.map((def) => {
                const item = state.evidence[def.id] || {
                  id: def.id,
                  stepId: def.stepId,
                  title: def.title,
                  filename: "",
                  notes: "",
                  timestamp: "",
                };

                const isNotesValid = item.notes.trim().length >= 20;
                const isFileValid = item.filename.trim() !== "";
                const isComplete = isNotesValid && isFileValid;

                return (
                  <tr
                    key={def.id}
                    className={`hover:bg-slate-800/20 transition-colors ${
                      isComplete ? "bg-slate-950/20" : "bg-slate-950/50"
                    }`}
                  >
                    <td className="py-2.5 px-4 font-mono font-bold text-indigo-400">{def.id}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-400">{def.stepId}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-200 leading-snug">
                      {def.title}
                    </td>

                    {/* Filename Input */}
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          placeholder={def.defaultFilenamePattern.replace(/<NIM>/g, primaryNim)}
                          value={item.filename}
                          onChange={(e) => handleUpdateItem(def.id, "filename", e.target.value)}
                          className={`w-full bg-slate-950 border rounded px-2 py-1 text-xs font-mono text-white placeholder-slate-700 focus:outline-none ${
                            isFileValid ? "border-slate-800 focus:border-indigo-500" : "border-amber-600/60"
                          }`}
                        />
                        {!item.filename && (
                          <button
                            onClick={() =>
                              handleUpdateItem(
                                def.id,
                                "filename",
                                def.defaultFilenamePattern.replace(/<NIM>/g, primaryNim)
                              )
                            }
                            className="p-1 text-slate-500 hover:text-indigo-400 transition-colors"
                            title="Terapkan nama standar"
                          >
                            <Wand2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Notes Textarea & Template Helper */}
                    <td className="py-2.5 px-4">
                      <div className="space-y-1">
                        <textarea
                          rows={2}
                          placeholder={def.formalTemplate}
                          value={item.notes}
                          onChange={(e) => handleUpdateItem(def.id, "notes", e.target.value)}
                          className={`w-full bg-slate-950 border rounded p-1.5 text-xs text-white placeholder-slate-700 focus:outline-none leading-relaxed ${
                            isNotesValid ? "border-slate-800 focus:border-indigo-500" : "border-amber-600/60"
                          }`}
                        />
                        <div className="flex justify-between items-center text-[10px] font-mono">
                          <button
                            onClick={() => handleUpdateItem(def.id, "notes", def.formalTemplate)}
                            className="text-slate-500 hover:text-cyan-400 transition-colors font-sans"
                            title="Terapkan template observasi standar ilmiah"
                          >
                            Terapkan Template
                          </button>
                          <span
                            className={
                              isNotesValid ? "text-slate-500" : "text-amber-400 font-semibold"
                            }
                          >
                            {item.notes.length}/20 karakter
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Timestamp Input */}
                    <td className="py-2.5 px-4 font-mono">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          placeholder="YYYY-MM-DD HH:MM:SS"
                          value={item.timestamp}
                          onChange={(e) => handleUpdateItem(def.id, "timestamp", e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          onClick={() => setNowTimestamp(def.id)}
                          className="p-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-slate-300 transition-colors"
                          title="Isi waktu saat ini"
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Status Checkmark */}
                    <td className="py-2.5 px-4 text-center font-mono">
                      {isComplete ? (
                        <span className="text-emerald-400 font-bold" title="Lengkap (File + Keterangan &ge; 20 Karakter)">
                          <Check className="w-4 h-4 mx-auto" />
                        </span>
                      ) : (
                        <span className="text-amber-500" title="Belum Lengkap">
                          <AlertCircle className="w-4 h-4 mx-auto" />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
