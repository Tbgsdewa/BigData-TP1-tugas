import React from "react";
import { Shield, Plus, Trash2, AlertCircle, Check } from "lucide-react";
import { AppState, DisclosureRow } from "../types";

interface DisclosureProps {
  state: AppState;
  onChange: (updater: (prev: AppState) => AppState) => void;
}

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

  const isDark = state.theme === "dark";

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <section className={`border rounded-lg p-5 transition-colors ${
        isDark ? "bg-[#0d1322] border-slate-800" : "bg-white border-slate-200"
      }`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400" />
              Pernyataan & Transparansi Penggunaan AI / Tools (Disclosure)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Dokumentasikan pemanfaatan asisten atau pustaka pihak ketiga secara faktual dan mandiri.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-300 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded">
            Integritas Akademik: Jangan membuat klaim atas nama orang lain
          </div>
        </div>
      </section>

      {/* No AI Usage Checkbox Banner */}
      <div className={`p-4 rounded-lg border transition-colors ${
        isDark ? "bg-[#0d1322] border-slate-800" : "bg-white border-slate-200"
      }`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={state.noAiUsage}
              onChange={(e) => handleToggleNoAi(e.target.checked)}
              className="mt-0.5 w-4 h-4 text-indigo-600 rounded bg-slate-950 border-slate-700"
            />
            <div>
              <span className="text-xs font-bold text-slate-200 block">
                Kelompok kami menyatakan TIDAK MEMAKAI AI generatif dalam penyelesaian tugas ini
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Jika dicentang, tabel disclosure di bawah dinonaktifkan dan laporan akhir mencantumkan deklarasi pengerjaan mandiri tanpa AI.
              </span>
            </div>
          </label>
          {state.noAiUsage && (
            <span className="text-xs font-mono font-semibold px-2 py-0.5 bg-emerald-950 border border-emerald-800 text-emerald-300 rounded shrink-0">
              Deklarasi Non-AI Aktif
            </span>
          )}
        </div>
      </div>

      {/* Warning on [ISI] */}
      {!state.noAiUsage && remainingIsiCount > 0 && (
        <div className="bg-amber-950/30 border border-amber-800/80 p-3.5 rounded-lg flex items-center gap-2 text-xs text-amber-200 font-mono">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Perhatian: {remainingIsiCount} placeholder [ISI] masih ada pada tabel disclosure. Ganti dengan rincian riil sebelum ekspor.
          </span>
        </div>
      )}

      {/* Disclosure Table */}
      {!state.noAiUsage && (
        <section className={`border rounded-lg overflow-hidden transition-colors ${
          isDark ? "bg-[#0d1322] border-slate-800" : "bg-white border-slate-200"
        }`}>
          <div className="px-5 py-3 border-b border-slate-800 flex justify-between items-center bg-slate-900/40">
            <h3 className="text-xs font-bold text-white">Tabel Pencatatan Pemanfaatan AI / Tools</h3>
            <button
              onClick={handleAddRow}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah Baris
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4 w-40 font-mono">Tool / Model</th>
                  <th className="py-2.5 px-4 w-52">Tujuan Penggunaan</th>
                  <th className="py-2.5 px-4">Bagian yang Diambil</th>
                  <th className="py-2.5 px-4">Bagian yang Ditolak</th>
                  <th className="py-2.5 px-4">Cara Verifikasi</th>
                  <th className="py-2.5 px-4 w-12 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {state.disclosureRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-2.5 px-4 align-top">
                      <input
                        type="text"
                        placeholder="e.g. ChatGPT / Claude"
                        value={row.tool}
                        onChange={(e) => handleUpdateRow(row.id, "tool", e.target.value)}
                        className={`w-full bg-slate-950 border rounded px-2 py-1 text-xs text-white placeholder-slate-700 focus:outline-none font-mono ${
                          row.tool.includes("[ISI]") ? "border-amber-600 font-bold" : "border-slate-800 focus:border-indigo-500"
                        }`}
                      />
                    </td>
                    <td className="py-2.5 px-4 align-top">
                      <textarea
                        rows={3}
                        placeholder="Tujuan konsultasi..."
                        value={row.tujuan}
                        onChange={(e) => handleUpdateRow(row.id, "tujuan", e.target.value)}
                        className={`w-full bg-slate-950 border rounded p-1.5 text-xs text-white placeholder-slate-700 focus:outline-none ${
                          row.tujuan.includes("[ISI]") ? "border-amber-600 font-bold" : "border-slate-800 focus:border-indigo-500"
                        }`}
                      />
                    </td>
                    <td className="py-2.5 px-4 align-top">
                      <textarea
                        rows={3}
                        placeholder="Logika/sintaks yang diadopsi..."
                        value={row.diambil}
                        onChange={(e) => handleUpdateRow(row.id, "diambil", e.target.value)}
                        className={`w-full bg-slate-950 border rounded p-1.5 text-xs text-white placeholder-slate-700 focus:outline-none ${
                          row.diambil.includes("[ISI]") ? "border-amber-600 font-bold" : "border-slate-800 focus:border-indigo-500"
                        }`}
                      />
                    </td>
                    <td className="py-2.5 px-4 align-top">
                      <textarea
                        rows={3}
                        placeholder="Saran yang ditolak atau tidak valid..."
                        value={row.ditolak}
                        onChange={(e) => handleUpdateRow(row.id, "ditolak", e.target.value)}
                        className={`w-full bg-slate-950 border rounded p-1.5 text-xs text-white placeholder-slate-700 focus:outline-none ${
                          row.ditolak.includes("[ISI]") ? "border-amber-600 font-bold" : "border-slate-800 focus:border-indigo-500"
                        }`}
                      />
                    </td>
                    <td className="py-2.5 px-4 align-top">
                      <textarea
                        rows={3}
                        placeholder="Pengujian lokal di CLI..."
                        value={row.verifikasi}
                        onChange={(e) => handleUpdateRow(row.id, "verifikasi", e.target.value)}
                        className={`w-full bg-slate-950 border rounded p-1.5 text-xs text-white placeholder-slate-700 focus:outline-none ${
                          row.verifikasi.includes("[ISI]") ? "border-amber-600 font-bold" : "border-slate-800 focus:border-indigo-500"
                        }`}
                      />
                    </td>
                    <td className="py-2.5 px-4 align-middle text-center">
                      {state.disclosureRows.length > 1 && (
                        <button
                          onClick={() => handleRemoveRow(row.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                          title="Hapus baris"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
