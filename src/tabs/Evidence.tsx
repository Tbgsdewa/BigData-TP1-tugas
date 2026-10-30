import React, { useState, useMemo } from "react";
import { Clock, Database, FileJson, FileSpreadsheet, Sparkles, Wand2 } from "lucide-react";
import { EVIDENCE_DEF } from "../constants";
import { mongoService } from "../services/mongoService";
import { AppState, EvidenceItem } from "../types";
import { Chip, EmptyState, Meter, MicroLabel, Panel, SegButton } from "../components/ui";

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

  return (
    <div className="space-y-6">
      {/* Header, meter kelengkapan, toolbar batch/ekspor, filter & pencarian */}
      <Panel
        no="5"
        title="Bukti Pelaksanaan E01–E16"
        sub="Nama berkas tangkapan layar, catatan observasi (minimal 20 karakter), dan manifest bukti."
        actions={<Meter value={completedCount} total={total} completeLabel="Kelengkapan Bukti" className="w-44" />}
      >
        {/* Toolbar: Batch Utilities & Manifest Exporters */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Batch Assistants */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleNormalizeAllFilenames}
              className="btn btn-outline"
              title="Mengisi seluruh nama berkas dengan pola resmi: E##_<NIM>_<nama>.png"
            >
              <Wand2 className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              <span>Normalisasi Nama Berkas</span>
            </button>

            <button
              type="button"
              onClick={handlePopulateFormalTemplates}
              className="btn btn-outline"
              title="Mengisi deskripsi observasi akademis terstruktur pada baris yang masih kosong"
            >
              <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              <span>Lengkapi Template Observasi</span>
            </button>

            <button
              type="button"
              onClick={handleSyncTimestamps}
              className="btn btn-outline"
              title="Isi waktu saat ini pada tanggal eksekusi yang masih kosong"
            >
              <Clock className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              <span>Sinkronisasi Waktu</span>
            </button>
          </div>

          {/* Manifest Export Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <MicroLabel className="mr-0.5">Ekspor Manifest</MicroLabel>
            <button
              type="button"
              onClick={handleExportCsv}
              className="btn btn-outline font-mono"
              title="Unduh manifest bukti format CSV"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
              <span>.CSV</span>
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="btn btn-outline font-mono"
              title="Unduh manifest bukti format JSON"
            >
              <FileJson className="h-3.5 w-3.5" aria-hidden="true" />
              <span>.JSON</span>
            </button>
            <button
              type="button"
              onClick={handleSyncToMongo}
              disabled={mongoSyncStatus === "syncing"}
              className={`btn font-mono ${
                mongoSyncStatus === "synced"
                  ? "border border-ok/50 bg-ok-wash text-ok"
                  : mongoSyncStatus === "error"
                  ? "border border-danger/50 bg-danger-wash text-danger"
                  : "border border-accent/50 bg-surface text-accent hover:border-accent"
              }`}
              title="Sinkronkan seluruh daftar bukti E01-E16 ke koleksi MongoDB"
            >
              <Database className="h-3.5 w-3.5" aria-hidden="true" />
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
        <div className="mt-4 flex flex-col gap-3 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filter status bukti">
            <SegButton active={filterStatus === "ALL"} onClick={() => setFilterStatus("ALL")}>
              Semua ({total})
            </SegButton>
            <SegButton active={filterStatus === "INCOMPLETE"} onClick={() => setFilterStatus("INCOMPLETE")}>
              Belum Lengkap ({total - completedCount})
            </SegButton>
            <SegButton active={filterStatus === "COMPLETE"} onClick={() => setFilterStatus("COMPLETE")}>
              Lengkap ({completedCount})
            </SegButton>
          </div>

          <div className="w-full sm:w-64">
            <label htmlFor="evidence-search" className="sr-only">
              Cari bukti, nama berkas, atau observasi
            </label>
            <input
              id="evidence-search"
              type="text"
              placeholder="Cari bukti / file / observasi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="field font-mono"
            />
          </div>
        </div>
      </Panel>

      {/* Evidence Table */}
      <section className="panel overflow-hidden rounded-sm">
        {filteredEvidence.length === 0 ? (
          <EmptyState
            className="m-4"
            text={`Filter dan pencarian menghasilkan 0 baris. Ubah status filter atau kosongkan kata kunci "${searchQuery.trim()}."`}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead>
                <tr className="border-b border-line-strong bg-surface-2">
                  <th scope="col" className="label-micro px-4 py-2.5 font-semibold">
                    ID
                  </th>
                  <th scope="col" className="label-micro px-4 py-2.5 font-semibold">
                    Langkah
                  </th>
                  <th scope="col" className="label-micro px-4 py-2.5 font-semibold">
                    Deskripsi Bukti
                  </th>
                  <th scope="col" className="label-micro px-4 py-2.5 font-semibold">
                    Nama Berkas Gambar
                  </th>
                  <th scope="col" className="label-micro px-4 py-2.5 font-semibold">
                    Keterangan Observasi Terverifikasi
                  </th>
                  <th scope="col" className="label-micro px-4 py-2.5 font-semibold">
                    Waktu Eksekusi
                  </th>
                  <th scope="col" className="label-micro px-4 py-2.5 text-center font-semibold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
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
                    <tr key={def.id} className="transition-colors hover:bg-surface-2/60">
                      <td className="px-4 py-2.5 align-top font-mono font-bold text-accent">{def.id}</td>
                      <td className="px-4 py-2.5 align-top font-mono text-ink-muted">{def.stepId}</td>
                      <td className="px-4 py-2.5 align-top font-medium leading-snug text-ink">{def.title}</td>

                      {/* Filename Input */}
                      <td className="px-4 py-2.5 align-top">
                        <label htmlFor={`ev-${def.id}-filename`} className="sr-only">
                          Nama berkas gambar {def.id}
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            id={`ev-${def.id}-filename`}
                            type="text"
                            placeholder={def.defaultFilenamePattern.replace(/<NIM>/g, primaryNim)}
                            value={item.filename}
                            onChange={(e) => handleUpdateItem(def.id, "filename", e.target.value)}
                            className={`field field-mono min-w-[190px] !text-[11px] ${
                              isFileValid ? "" : "!border-warn"
                            }`}
                          />
                          {!item.filename && (
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateItem(
                                  def.id,
                                  "filename",
                                  def.defaultFilenamePattern.replace(/<NIM>/g, primaryNim)
                                )
                              }
                              className="btn btn-ghost !px-1.5 !py-1"
                              title="Terapkan nama standar"
                              aria-label={`Terapkan nama standar untuk ${def.id}`}
                            >
                              <Wand2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Notes Textarea & Template Helper */}
                      <td className="px-4 py-2.5 align-top">
                        <label htmlFor={`ev-${def.id}-notes`} className="sr-only">
                          Keterangan observasi {def.id}
                        </label>
                        <div className="space-y-1">
                          <textarea
                            id={`ev-${def.id}-notes`}
                            rows={2}
                            placeholder={def.formalTemplate}
                            value={item.notes}
                            onChange={(e) => handleUpdateItem(def.id, "notes", e.target.value)}
                            className={`field min-w-[240px] leading-relaxed ${
                              isNotesValid ? "" : "!border-warn"
                            }`}
                          />
                          <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
                            <button
                              type="button"
                              onClick={() => handleUpdateItem(def.id, "notes", def.formalTemplate)}
                              className="text-ink-muted underline-offset-2 transition-colors hover:text-accent hover:underline"
                              title="Terapkan template observasi standar ilmiah"
                            >
                              Terapkan Template
                            </button>
                            <span className={`tabular-nums ${isNotesValid ? "text-ink-muted" : "font-semibold text-warn"}`}>
                              {item.notes.length}/20 karakter
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Timestamp Input */}
                      <td className="px-4 py-2.5 align-top">
                        <label htmlFor={`ev-${def.id}-timestamp`} className="sr-only">
                          Waktu eksekusi {def.id}
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            id={`ev-${def.id}-timestamp`}
                            type="text"
                            placeholder="YYYY-MM-DD HH:MM:SS"
                            value={item.timestamp}
                            onChange={(e) => handleUpdateItem(def.id, "timestamp", e.target.value)}
                            className="field field-mono min-w-[150px] !text-[11px]"
                          />
                          <button
                            type="button"
                            onClick={() => setNowTimestamp(def.id)}
                            className="btn btn-outline !px-1.5 !py-1.5"
                            title="Isi waktu saat ini"
                            aria-label={`Isi waktu saat ini untuk ${def.id}`}
                          >
                            <Clock className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Completeness Status */}
                      <td className="px-4 py-2.5 text-center align-top">
                        {isComplete ? (
                          <Chip tone="ok" title="Lengkap (File + Keterangan ≥ 20 Karakter)">
                            LENGKAP
                          </Chip>
                        ) : (
                          <Chip tone="warn" title="Belum Lengkap">
                            BELUM
                          </Chip>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
