import React from "react";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { AppState, DisclosureRow } from "../types";
import { Chip, Panel } from "../components/ui";

interface DisclosureProps {
  state: AppState;
  onChange: (updater: (prev: AppState) => AppState) => void;
}

/** Kelas input/textarea sel disclosure; penanda contoh disorot sebagai peringatan. */
const cellFieldClass = (hasIsi: boolean, mono = false) =>
  `w-full rounded-sm border bg-surface-2 px-2 py-1 text-xs text-ink placeholder:text-ink-muted/60 transition-colors focus:outline-none focus:border-accent ${
    mono ? "font-mono " : ""
  }${hasIsi ? "border-warn/60 font-bold" : "border-line"}`;

const TH_LABEL =
  "whitespace-nowrap px-4 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted";

export const DisclosureTab: React.FC<DisclosureProps> = ({ state, onChange }) => {
  const handleToggleNoAi = (checked: boolean) => {
    onChange((prev) => ({
      ...prev,
      noAiUsage: checked,
    }));
  };

  const handleAddRow = () => {
    const newRow: DisclosureRow = {
      id: `d_${Date.now()}`,
      tool: "",
      tujuan: "",
      diambil: "",
      ditolak: "",
      verifikasi: "",
    };
    onChange((prev) => ({
      ...prev,
      disclosureRows: [...prev.disclosureRows, newRow],
    }));
  };

  const handleRemoveRow = (id: string) => {
    onChange((prev) => ({
      ...prev,
      disclosureRows: prev.disclosureRows.filter((r) => r.id !== id),
    }));
  };

  const handleUpdateRow = (id: string, field: keyof DisclosureRow, val: string) => {
    onChange((prev) => ({
      ...prev,
      disclosureRows: prev.disclosureRows.map((r) => (r.id === id ? { ...r, [field]: val } : r)),
    }));
  };

  const remainingIsiCount = state.noAiUsage
    ? 0
    : state.disclosureRows.reduce((acc, row) => {
        let count = 0;
        if (row.tool.includes("[ISI]")) count++;
        if (row.tujuan.includes("[ISI]")) count++;
        if (row.diambil.includes("[ISI]")) count++;
        if (row.ditolak.includes("[ISI]")) count++;
        if (row.verifikasi.includes("[ISI]")) count++;
        return acc + count;
      }, 0);

  return (
    <div className="space-y-5">
      {/* Header Info */}
      <Panel
        no="8.1"
        title="Lembar Transparansi AI / Tools"
        sub="Tulis faktual: tool apa dipakai, untuk apa, dan bagaimana hasilnya Anda verifikasi."
        actions={
          <span className="rounded-sm border border-line bg-surface-2 px-3 py-1.5 font-mono text-[11px] text-ink-soft">
            Integritas Akademik: Jangan membuat klaim atas nama orang lain
          </span>
        }
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={state.noAiUsage}
              onChange={(e) => handleToggleNoAi(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
            />
            <span>
              <span className="block text-xs font-bold text-ink">
                Kelompok kami menyatakan TIDAK MEMAKAI AI generatif dalam penyelesaian tugas ini
              </span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-muted">
                Jika dicentang, tabel disclosure di bawah dinonaktifkan dan laporan akhir mencantumkan
                deklarasi pengerjaan mandiri tanpa AI.
              </span>
            </span>
          </label>
          {state.noAiUsage && (
            <Chip tone="ok" className="shrink-0">
              Deklarasi Non-AI Aktif
            </Chip>
          )}
        </div>
      </Panel>

      {/* Warning on sample markers */}
      {!state.noAiUsage && remainingIsiCount > 0 && (
        <div className="flex items-center gap-2 rounded-sm border border-warn/50 bg-warn-wash p-3.5 text-xs font-mono text-warn">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Perhatian: {remainingIsiCount} penanda contoh masih ada pada tabel disclosure. Ganti dengan
            rincian riil sebelum ekspor.
          </span>
        </div>
      )}

      {/* Disclosure Table */}
      {!state.noAiUsage && (
        <Panel
          no="8.2"
          title="Catatan Pemanfaatan Tools"
          actions={
            <button type="button" onClick={handleAddRow} className="btn btn-primary">
              <Plus className="h-3.5 w-3.5" /> Tambah Baris
            </button>
          }
          flush
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-xs">
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  <th className={`${TH_LABEL} w-44 min-w-[176px]`}>Tool / Model</th>
                  <th className={`${TH_LABEL} min-w-[190px]`}>Tujuan Penggunaan</th>
                  <th className={`${TH_LABEL} min-w-[190px]`}>Bagian yang Diambil</th>
                  <th className={`${TH_LABEL} min-w-[190px]`}>Bagian yang Ditolak</th>
                  <th className={`${TH_LABEL} min-w-[190px]`}>Cara Verifikasi</th>
                  <th className={`${TH_LABEL} w-12 text-center`}>Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {state.disclosureRows.map((row, index) => (
                  <tr key={row.id} className="transition-colors hover:bg-surface-2/60">
                    <td className="px-4 py-2.5 align-top">
                      <input
                        type="text"
                        placeholder="e.g. ChatGPT / Claude"
                        aria-label={`Tool / Model, baris ${index + 1}`}
                        value={row.tool}
                        onChange={(e) => handleUpdateRow(row.id, "tool", e.target.value)}
                        className={cellFieldClass(row.tool.includes("[ISI]"), true)}
                      />
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <textarea
                        rows={3}
                        placeholder="Tujuan konsultasi..."
                        aria-label={`Tujuan Penggunaan, baris ${index + 1}`}
                        value={row.tujuan}
                        onChange={(e) => handleUpdateRow(row.id, "tujuan", e.target.value)}
                        className={`${cellFieldClass(row.tujuan.includes("[ISI]"))} resize-y`}
                      />
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <textarea
                        rows={3}
                        placeholder="Logika/sintaks yang diadopsi..."
                        aria-label={`Bagian yang Diambil, baris ${index + 1}`}
                        value={row.diambil}
                        onChange={(e) => handleUpdateRow(row.id, "diambil", e.target.value)}
                        className={`${cellFieldClass(row.diambil.includes("[ISI]"))} resize-y`}
                      />
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <textarea
                        rows={3}
                        placeholder="Saran yang ditolak atau tidak valid..."
                        aria-label={`Bagian yang Ditolak, baris ${index + 1}`}
                        value={row.ditolak}
                        onChange={(e) => handleUpdateRow(row.id, "ditolak", e.target.value)}
                        className={`${cellFieldClass(row.ditolak.includes("[ISI]"))} resize-y`}
                      />
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <textarea
                        rows={3}
                        placeholder="Pengujian lokal di CLI..."
                        aria-label={`Cara Verifikasi, baris ${index + 1}`}
                        value={row.verifikasi}
                        onChange={(e) => handleUpdateRow(row.id, "verifikasi", e.target.value)}
                        className={`${cellFieldClass(row.verifikasi.includes("[ISI]"))} resize-y`}
                      />
                    </td>
                    <td className="px-4 py-2.5 align-middle text-center">
                      {state.disclosureRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.id)}
                          className="btn btn-danger-ghost !px-2"
                          title="Hapus baris"
                          aria-label={`Hapus baris ${index + 1}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
};
