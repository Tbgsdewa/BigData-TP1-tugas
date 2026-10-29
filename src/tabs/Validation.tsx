import React, { useState, useMemo } from "react";
import {
  Check,
  X,
  ShieldCheck,
  AlertCircle,
  FileCode,
  Scale,
  ArrowUpDown,
  Filter,
  CheckCheck,
} from "lucide-react";
import { DATASET } from "../constants";
import { parseWordCountOutputDetailed } from "../parsers";
import { AppState } from "../types";
import { compareWordCounts } from "../validate";

interface ValidationProps {
  state: AppState;
  onChange: (updater: (prev: AppState) => AppState) => void;
}

type SortMode = "FREQUENCY" | "ALPHABETICAL" | "DISCREPANCY";

export const ValidationTab: React.FC<ValidationProps> = ({ state, onChange }) => {
  const [sortMode, setSortMode] = useState<SortMode>("FREQUENCY");

  // Detailed parsers
  const mrDetailed = useMemo(
    () => parseWordCountOutputDetailed(state.wordCountMR),
    [state.wordCountMR]
  );
  const sparkDetailed = useMemo(
    () => parseWordCountOutputDetailed(state.wordCountSpark),
    [state.wordCountSpark]
  );

  const mrMap = mrDetailed ? mrDetailed.map : null;
  const sparkMap = sparkDetailed ? sparkDetailed.map : null;

  const cmpResult = useMemo(
    () => compareWordCounts(mrMap, sparkMap, mrDetailed, sparkDetailed),
    [mrMap, sparkMap, mrDetailed, sparkDetailed]
  );

  const handleUpdateMR = (val: string) => {
    onChange((prev) => ({
      ...prev,
      wordCountMR: val,
    }));
  };

  const handleUpdateSpark = (val: string) => {
    onChange((prev) => ({
      ...prev,
      wordCountSpark: val,
    }));
  };

  const expectedWords = Object.keys(DATASET.counts);
  const allWordsEncountered = Array.from(
    new Set([
      ...expectedWords,
      ...(mrMap ? Array.from(mrMap.keys()) : []),
      ...(sparkMap ? Array.from(sparkMap.keys()) : []),
    ])
  );

  // Sorted list based on chosen mode
  const sortedWords = useMemo(() => {
    const list = [...allWordsEncountered];
    if (sortMode === "FREQUENCY") {
      return list.sort((a, b) => {
        const countA = DATASET.counts[a] ?? mrMap?.get(a) ?? 0;
        const countB = DATASET.counts[b] ?? mrMap?.get(b) ?? 0;
        return countB - countA;
      });
    }
    if (sortMode === "ALPHABETICAL") {
      return list.sort((a, b) => a.localeCompare(b));
    }
    if (sortMode === "DISCREPANCY") {
      return list.sort((a, b) => {
        const expA = DATASET.counts[a] ?? 0;
        const mrA = mrMap?.get(a) ?? 0;
        const spA = sparkMap?.get(a) ?? 0;
        const mismatchA = mrA !== expA || spA !== expA ? 1 : 0;

        const expB = DATASET.counts[b] ?? 0;
        const mrB = mrMap?.get(b) ?? 0;
        const spB = sparkMap?.get(b) ?? 0;
        const mismatchB = mrB !== expB || spB !== expB ? 1 : 0;

        return mismatchB - mismatchA;
      });
    }
    return list;
  }, [allWordsEncountered, sortMode, mrMap, sparkMap]);

  const isDark = state.theme === "dark";

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <section
        className={`border rounded-lg p-5 transition-colors ${
          isDark ? "bg-[#0d1322] border-slate-800" : "bg-white border-slate-200"
        }`}
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Scale className="w-4 h-4 text-indigo-400" />
              Validasi & Komparasi Output WordCount (Hadoop vs Spark)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Inspeksi deterministik toleransi 0 terhadap dataset acuan 1.500 kata. Mendukung deteksi separator TAB maupun normalisasi multi-spasi terminal.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-300 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded flex items-center gap-2">
            <span>Acuan:</span>
            <strong className="text-emerald-400">{DATASET.file}</strong>
            <span className="text-slate-500">·</span>
            <span>{DATASET.distinct} kata</span>
            <span className="text-slate-500">·</span>
            <span className="tabular-nums font-semibold">{DATASET.totalWords} baris</span>
          </div>
        </div>
      </section>

      {/* Primary Verification Telemetry Panel */}
      <div
        className={`p-5 rounded-lg border transition-colors ${
          cmpResult.verdict === "VALID"
            ? "bg-emerald-950/20 border-emerald-800/80 text-emerald-200"
            : "bg-rose-950/20 border-rose-800/80 text-rose-200"
        }`}
      >
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center gap-3">
            {cmpResult.verdict === "VALID" ? (
              <ShieldCheck className="w-8 h-8 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-8 h-8 text-rose-400 shrink-0" />
            )}
            <div>
              <div className="flex items-center gap-2 font-mono">
                <span className="text-xs uppercase tracking-wider text-slate-400">Status Validasi:</span>
                <span
                  className={`text-sm font-bold px-2 py-0.5 rounded ${
                    cmpResult.verdict === "VALID"
                      ? "bg-emerald-500 text-slate-950"
                      : "bg-rose-600 text-white"
                  }`}
                >
                  {cmpResult.verdict}
                </span>
                <span className="text-xs text-slate-400 font-sans ml-1">
                  (Paritas: <strong className="font-mono text-white">{cmpResult.parityRatio}%</strong>)
                </span>
              </div>
              <p className="text-xs mt-1 text-slate-300">
                {cmpResult.verdict === "VALID"
                  ? "Seluruh 4 syarat validasi terpenuhi sempurna: kunci identik, hitungan exact, total 1.500 kata, dan hasil MapReduce == Spark."
                  : "Hasil komputasi belum lulus 4 syarat acuan. Periksa rincian tabel perbandingan di bawah."}
              </p>
            </div>
          </div>

          {/* 4 Integrity Requirement Checkpoints */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono w-full lg:w-auto">
            <div
              className={`px-2.5 py-1.5 rounded border flex items-center gap-1.5 ${
                cmpResult.isMatchKeys
                  ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
                  : "bg-rose-950/60 border-rose-800 text-rose-300"
              }`}
            >
              {cmpResult.isMatchKeys ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
              <span>1. Kunci Identik</span>
            </div>

            <div
              className={`px-2.5 py-1.5 rounded border flex items-center gap-1.5 ${
                cmpResult.isMatchCounts
                  ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
                  : "bg-rose-950/60 border-rose-800 text-rose-300"
              }`}
            >
              {cmpResult.isMatchCounts ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
              <span>2. Frekuensi Exact</span>
            </div>

            <div
              className={`px-2.5 py-1.5 rounded border flex items-center gap-1.5 ${
                cmpResult.isTotalWords1500
                  ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
                  : "bg-rose-950/60 border-rose-800 text-rose-300"
              }`}
            >
              {cmpResult.isTotalWords1500 ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
              <span>3. Total 1.500</span>
            </div>

            <div
              className={`px-2.5 py-1.5 rounded border flex items-center gap-1.5 ${
                cmpResult.isMrEqualsSpark
                  ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
                  : "bg-rose-950/60 border-rose-800 text-rose-300"
              }`}
            >
              {cmpResult.isMrEqualsSpark ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
              <span>4. MR == Spark</span>
            </div>
          </div>
        </div>

        {/* Separator detection feedback */}
        {cmpResult.hasSpaceExpandedTabs && (
          <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] font-mono flex items-center gap-2 text-cyan-300">
            <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>
              Catatan Toleransi Lapangan: Deteksi multi-spasi terkonversi otomatis dari salinan terminal; parsing berhasil dinormalisasi secara deterministik.
            </span>
          </div>
        )}
      </div>

      {/* Comparison Table with Sorting Controls */}
      <section
        className={`border rounded-lg overflow-hidden transition-colors ${
          isDark ? "bg-[#0d1322] border-slate-800" : "bg-white border-slate-200"
        }`}
      >
        <div className="px-5 py-3 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900/40">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-white">
              Tabel Komparasi Frekuensi Kata Terdistribusi
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              ({sortedWords.length} entri kata)
            </span>
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-1 text-xs font-mono">
            <span className="text-slate-500 mr-1 text-[11px] font-sans">Urutan:</span>
            <button
              onClick={() => setSortMode("FREQUENCY")}
              className={`px-2 py-1 rounded text-[11px] transition-colors ${
                sortMode === "FREQUENCY"
                  ? "bg-indigo-600 text-white font-semibold"
                  : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              Frekuensi (500 → 100)
            </button>
            <button
              onClick={() => setSortMode("ALPHABETICAL")}
              className={`px-2 py-1 rounded text-[11px] transition-colors ${
                sortMode === "ALPHABETICAL"
                  ? "bg-indigo-600 text-white font-semibold"
                  : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              Alfabetis (A → Z)
            </button>
            <button
              onClick={() => setSortMode("DISCREPANCY")}
              className={`px-2 py-1 rounded text-[11px] transition-colors ${
                sortMode === "DISCREPANCY"
                  ? "bg-indigo-600 text-white font-semibold"
                  : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              Prioritas Selisih
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-5 w-40">Kata (Kunci)</th>
                <th className="py-2.5 px-5 text-right w-44">Expected (Acuan)</th>
                <th className="py-2.5 px-5 text-right w-52">MapReduce (part-r-00000)</th>
                <th className="py-2.5 px-5 text-right w-52">Spark (part-00000)</th>
                <th className="py-2.5 px-5 text-center w-36">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {sortedWords.map((word) => {
                const exp = DATASET.counts[word] ?? 0;
                const mrVal = mrMap ? mrMap.get(word) ?? null : null;
                const spVal = sparkMap ? sparkMap.get(word) ?? null : null;
                const isMatch = mrVal === exp && spVal === exp;

                return (
                  <tr
                    key={word}
                    className={`hover:bg-slate-800/20 transition-colors ${
                      !isMatch ? "bg-rose-950/20" : ""
                    }`}
                  >
                    <td className="py-2.5 px-5 font-bold text-slate-200">
                      {word}
                      {exp === 0 && (
                        <span className="ml-2 text-[10px] text-rose-400 bg-rose-950 px-1 py-0.5 rounded border border-rose-800 font-sans">
                          Kunci Ekstra
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-5 text-right font-semibold text-amber-300 tabular-nums">
                      {exp}
                    </td>
                    <td
                      className={`py-2.5 px-5 text-right tabular-nums ${
                        mrVal === exp ? "text-emerald-400" : "text-rose-400 font-bold"
                      }`}
                    >
                      {mrVal !== null ? mrVal : <span className="text-slate-600 font-sans">N/A</span>}
                    </td>
                    <td
                      className={`py-2.5 px-5 text-right tabular-nums ${
                        spVal === exp ? "text-emerald-400" : "text-rose-400 font-bold"
                      }`}
                    >
                      {spVal !== null ? spVal : <span className="text-slate-600 font-sans">N/A</span>}
                    </td>
                    <td className="py-2.5 px-5 text-center">
                      {isMatch ? (
                        <span className="font-mono text-[11px] font-semibold text-emerald-400">
                          MATCH
                        </span>
                      ) : (
                        <span className="font-mono text-[11px] font-semibold text-rose-400">
                          MISMATCH
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-950 font-bold text-slate-200 border-t border-slate-800">
              <tr>
                <td className="py-2.5 px-5 text-slate-400 font-sans uppercase text-[11px]">
                  Total Akumulasi Kata
                </td>
                <td className="py-2.5 px-5 text-right text-amber-300 tabular-nums">
                  {DATASET.totalWords}
                </td>
                <td
                  className={`py-2.5 px-5 text-right tabular-nums ${
                    cmpResult.mrTotalWords === DATASET.totalWords ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {cmpResult.mrTotalWords}
                </td>
                <td
                  className={`py-2.5 px-5 text-right tabular-nums ${
                    cmpResult.sparkTotalWords === DATASET.totalWords ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {cmpResult.sparkTotalWords}
                </td>
                <td className="py-2.5 px-5 text-center font-sans text-xs">
                  {cmpResult.isTotalWords1500 ? (
                    <span className="text-emerald-400">Tepat 1.500 Kata</span>
                  ) : (
                    <span className="text-rose-400">Total Tidak Sesuai</span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Difference Explanations if any */}
      {cmpResult.differences.length > 0 && (
        <section className="bg-rose-950/20 border border-rose-800/60 rounded-lg p-4">
          <h4 className="text-xs font-bold text-rose-300 mb-2">
            Rincian Selisih Komparasi:
          </h4>
          <ul className="list-disc list-inside space-y-1 text-xs text-slate-300 font-mono">
            {cmpResult.differences.map((diff, idx) => (
              <li key={idx}>
                <strong className="text-rose-400">{diff.word}</strong>: {diff.diffExplanation}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Raw Output Inputs with Detailed Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* MR Part-r-00000 */}
        <section
          className={`border rounded-lg p-4 transition-colors ${
            isDark ? "bg-[#0d1322] border-slate-800" : "bg-white border-slate-200"
          }`}
        >
          <div className="flex justify-between items-center mb-2">
            <div>
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-amber-400" />
                Output MapReduce (part-r-00000)
              </span>
              <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                docker exec namenode hdfs dfs -cat /user/&lt;NIM&gt;/out_mr/part-r-00000
              </span>
            </div>
            <div className="text-right text-[11px] font-mono text-slate-400">
              {mrDetailed ? (
                <span className="text-emerald-400">{mrDetailed.totalLines} baris terbaca</span>
              ) : (
                <span className="text-slate-500">TIDAK TERBACA</span>
              )}
            </div>
          </div>
          <textarea
            rows={7}
            value={state.wordCountMR}
            onChange={(e) => handleUpdateMR(e.target.value)}
            placeholder="hadoop	500&#10;spark	400&#10;hdfs	300&#10;yarn	200&#10;data	100"
            className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-xs font-mono text-slate-200 placeholder-slate-700 focus:outline-none focus:border-indigo-500 leading-relaxed"
          />
        </section>

        {/* Spark Part-00000 */}
        <section
          className={`border rounded-lg p-4 transition-colors ${
            isDark ? "bg-[#0d1322] border-slate-800" : "bg-white border-slate-200"
          }`}
        >
          <div className="flex justify-between items-center mb-2">
            <div>
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                Output Spark (part-00000)
              </span>
              <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                docker exec namenode hdfs dfs -cat /user/&lt;NIM&gt;/out_spark/part-00000
              </span>
            </div>
            <div className="text-right text-[11px] font-mono text-slate-400">
              {sparkDetailed ? (
                <span className="text-emerald-400">{sparkDetailed.totalLines} baris terbaca</span>
              ) : (
                <span className="text-slate-500">TIDAK TERBACA</span>
              )}
            </div>
          </div>
          <textarea
            rows={7}
            value={state.wordCountSpark}
            onChange={(e) => handleUpdateSpark(e.target.value)}
            placeholder="hadoop	500&#10;spark	400&#10;hdfs	300&#10;yarn	200&#10;data	100"
            className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-xs font-mono text-slate-200 placeholder-slate-700 focus:outline-none focus:border-indigo-500 leading-relaxed"
          />
        </section>
      </div>
    </div>
  );
};
