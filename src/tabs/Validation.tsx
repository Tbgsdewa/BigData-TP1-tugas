import React, { useState, useMemo } from "react";
import { Check, X } from "lucide-react";
import { DATASET } from "../constants";
import { parseWordCountOutputDetailed } from "../parsers";
import { AppState } from "../types";
import { compareWordCounts } from "../validate";
import { Chip, FieldLabel, MicroLabel, Panel, SegButton } from "../components/ui";

interface ValidationProps {
  state: AppState;
  onChange: (updater: (prev: AppState) => AppState) => void;
}

type SortMode = "FREQUENCY" | "ALPHABETICAL" | "DISCREPANCY";

/** Baris checkpoint syarat validasi — ikon centang/silang fungsional, warna status token. */
const Checkpoint: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => (
  <div className="flex items-center gap-2 border-b border-line/60 py-1 last:border-b-0">
    <span className={ok ? "text-ok" : "text-danger"} aria-hidden="true">
      {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
    </span>
    <span className="font-mono text-[11px] text-ink-soft">{label}</span>
  </div>
);

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

  const isValid = cmpResult.verdict === "VALID";

  return (
    <div className="space-y-6">
      {/* Header Info + strip acuan dataset */}
      <Panel
        no="4"
        title="Komparasi WordCount MR vs Spark"
        sub="Bandingkan baris per baris terhadap acuan 1.500 kata; toleransi selisih 0, separator TAB atau spasi ganda sama-sama ditangani."
        actions={
          <div className="flex items-center gap-2 rounded-sm border border-line bg-surface-2 px-3 py-1.5 font-mono text-[11px] text-ink-soft">
            <MicroLabel>Acuan</MicroLabel>
            <span className="text-accent">{DATASET.file}</span>
            <span aria-hidden="true" className="text-ink-muted">
              ·
            </span>
            <span>{DATASET.distinct} kata</span>
            <span aria-hidden="true" className="text-ink-muted">
              ·
            </span>
            <span className="tabular-nums font-semibold text-ink">{DATASET.totalWords} baris</span>
          </div>
        }
      >
        {/* Verdict banner: kiri verdict besar + paritas, kanan 2x2 checkpoint */}
        <div
          className={`flex flex-col gap-4 rounded-sm border p-4 lg:flex-row lg:items-center lg:justify-between ${
            isValid ? "border-ok/40 bg-ok-wash" : "border-danger/40 bg-danger-wash"
          }`}
        >
          <div className="min-w-0">
            <MicroLabel>Status Validasi</MicroLabel>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span
                className={`font-mono text-xl font-bold tracking-tight ${
                  isValid ? "text-ok" : "text-danger"
                }`}
              >
                {cmpResult.verdict}
              </span>
              <span className="font-mono text-xs tabular-nums text-ink-soft">
                Paritas: <strong className="font-semibold text-ink">{cmpResult.parityRatio}%</strong>
              </span>
            </div>
            <p className="mt-1.5 max-w-prose text-xs leading-relaxed text-ink-soft">
              {isValid
                ? "Seluruh 4 syarat validasi terpenuhi sempurna: kunci identik, hitungan exact, total 1.500 kata, dan hasil MapReduce == Spark."
                : "Hasil komputasi belum lulus 4 syarat acuan. Periksa rincian tabel perbandingan di bawah."}
            </p>
          </div>

          {/* 4 Integrity Requirement Checkpoints */}
          <div
            className="grid w-full shrink-0 grid-cols-1 gap-x-6 sm:grid-cols-2 lg:w-auto"
            aria-label="Empat syarat validasi"
          >
            <Checkpoint ok={cmpResult.isMatchKeys} label="1. Kunci Identik" />
            <Checkpoint ok={cmpResult.isMatchCounts} label="2. Frekuensi Exact" />
            <Checkpoint ok={cmpResult.isTotalWords1500} label="3. Total 1.500" />
            <Checkpoint ok={cmpResult.isMrEqualsSpark} label="4. MR == Spark" />
          </div>
        </div>

        {/* Separator detection feedback */}
        {cmpResult.hasSpaceExpandedTabs && (
          <p className="mt-3 flex items-start gap-2 border-t border-line pt-3 font-mono text-[11px] leading-relaxed text-warn">
            <span aria-hidden="true">※</span>
            <span>
              Catatan Toleransi Lapangan: Deteksi multi-spasi terkonversi otomatis dari salinan terminal;
              parsing berhasil dinormalisasi secara deterministik.
            </span>
          </p>
        )}
      </Panel>

      {/* Comparison Table with Sorting Controls */}
      <Panel
        flush
        title="Frekuensi per Kata"
        sub={`${sortedWords.length} entri kata dibandingkan terhadap acuan.`}
        actions={
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Urutan tabel">
            <MicroLabel className="mr-1">Urutan</MicroLabel>
            <SegButton active={sortMode === "FREQUENCY"} onClick={() => setSortMode("FREQUENCY")}>
              Frekuensi (500 → 100)
            </SegButton>
            <SegButton active={sortMode === "ALPHABETICAL"} onClick={() => setSortMode("ALPHABETICAL")}>
              Alfabetis (A → Z)
            </SegButton>
            <SegButton active={sortMode === "DISCREPANCY"} onClick={() => setSortMode("DISCREPANCY")}>
              Prioritas Selisih
            </SegButton>
          </div>
        }
        bodyClassName="overflow-x-auto"
      >
        <table className="w-full min-w-[720px] text-left font-mono text-xs">
          <thead>
            <tr className="border-b border-line-strong bg-surface-2">
              <th scope="col" className="label-micro px-5 py-2.5 font-semibold">
                Kata (Kunci)
              </th>
              <th scope="col" className="label-micro px-5 py-2.5 text-right font-semibold">
                Expected (Acuan)
              </th>
              <th scope="col" className="label-micro px-5 py-2.5 text-right font-semibold">
                MapReduce (part-r-00000)
              </th>
              <th scope="col" className="label-micro px-5 py-2.5 text-right font-semibold">
                Spark (part-00000)
              </th>
              <th scope="col" className="label-micro px-5 py-2.5 text-center font-semibold">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sortedWords.map((word) => {
              const exp = DATASET.counts[word] ?? 0;
              const mrVal = mrMap ? mrMap.get(word) ?? null : null;
              const spVal = sparkMap ? sparkMap.get(word) ?? null : null;
              const isMatch = mrVal === exp && spVal === exp;

              return (
                <tr key={word} className={`transition-colors hover:bg-surface-2/60 ${!isMatch ? "bg-danger-wash/40" : ""}`}>
                  <td className="px-5 py-2.5 font-bold text-ink">
                    {word}
                    {exp === 0 && <span className="status-chip chip-warn ml-2 font-sans">Kunci Ekstra</span>}
                  </td>
                  <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-ink-soft">{exp}</td>
                  <td
                    className={`px-5 py-2.5 text-right tabular-nums ${
                      mrVal === exp ? "text-ok" : "font-bold text-danger"
                    }`}
                  >
                    {mrVal !== null ? mrVal : <span className="font-sans text-ink-muted">N/A</span>}
                  </td>
                  <td
                    className={`px-5 py-2.5 text-right tabular-nums ${
                      spVal === exp ? "text-ok" : "font-bold text-danger"
                    }`}
                  >
                    {spVal !== null ? spVal : <span className="font-sans text-ink-muted">N/A</span>}
                  </td>
                  <td
                    className={`px-5 py-2.5 text-center text-[11px] font-semibold ${
                      isMatch ? "text-ok" : "text-danger"
                    }`}
                  >
                    {isMatch ? "MATCH" : "MISMATCH"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-line-strong bg-surface-2 font-bold text-ink">
              <td className="px-5 py-2.5 font-sans text-[11px] uppercase tracking-wider text-ink-muted">
                Total Akumulasi Kata
              </td>
              <td className="px-5 py-2.5 text-right tabular-nums text-ink-soft">{DATASET.totalWords}</td>
              <td
                className={`px-5 py-2.5 text-right tabular-nums ${
                  cmpResult.mrTotalWords === DATASET.totalWords ? "text-ok" : "text-danger"
                }`}
              >
                {cmpResult.mrTotalWords}
              </td>
              <td
                className={`px-5 py-2.5 text-right tabular-nums ${
                  cmpResult.sparkTotalWords === DATASET.totalWords ? "text-ok" : "text-danger"
                }`}
              >
                {cmpResult.sparkTotalWords}
              </td>
              <td className={`px-5 py-2.5 text-center font-sans text-xs ${cmpResult.isTotalWords1500 ? "text-ok" : "text-danger"}`}>
                {cmpResult.isTotalWords1500 ? "Tepat 1.500 Kata" : "Total Tidak Sesuai"}
              </td>
            </tr>
          </tfoot>
        </table>
      </Panel>

      {/* Difference Explanations if any */}
      {cmpResult.differences.length > 0 && (
        <section className="rounded-sm border border-danger/40 bg-danger-wash/60 p-4">
          <h4 className="label-micro mb-2 font-semibold text-danger">Rincian Selisih Komparasi</h4>
          <ul className="space-y-1.5 text-xs leading-relaxed text-ink-soft">
            {cmpResult.differences.map((diff, idx) => (
              <li key={idx} className="flex gap-2">
                <span aria-hidden="true" className="text-danger">
                  •
                </span>
                <span className="font-mono">
                  <strong className="font-bold text-danger">{diff.word}</strong>: {diff.diffExplanation}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Raw Output Inputs with Detailed Diagnostics */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* MR Part-r-00000 */}
        <section className="panel rounded-sm p-4">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <FieldLabel htmlFor="validation-input-mr">Output MapReduce (part-r-00000)</FieldLabel>
              <MicroLabel className="mt-1 block">Perintah Acuan</MicroLabel>
              <p className="mt-0.5 break-all font-mono text-[10.5px] text-ink-muted">
                docker exec namenode hdfs dfs -cat /user/&lt;NIM&gt;/out_mr/part-r-00000
              </p>
            </div>
            {mrDetailed ? (
              <Chip tone="ok" className="tabular-nums">
                {mrDetailed.totalLines} baris terbaca
              </Chip>
            ) : (
              <Chip tone="neutral">TIDAK TERBACA</Chip>
            )}
          </div>
          <textarea
            id="validation-input-mr"
            rows={7}
            value={state.wordCountMR}
            onChange={(e) => handleUpdateMR(e.target.value)}
            placeholder={"hadoop\t500\nspark\t400\nhdfs\t300\nyarn\t200\ndata\t100"}
            className="w-full rounded-sm border border-code-line bg-code px-3 py-2.5 font-mono text-xs leading-relaxed text-code-ink placeholder:text-code-muted/50 focus:border-accent focus:outline-none"
          />
        </section>

        {/* Spark Part-00000 */}
        <section className="panel rounded-sm p-4">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <FieldLabel htmlFor="validation-input-spark">Output Spark (part-00000)</FieldLabel>
              <MicroLabel className="mt-1 block">Perintah Acuan</MicroLabel>
              <p className="mt-0.5 break-all font-mono text-[10.5px] text-ink-muted">
                docker exec namenode hdfs dfs -cat /user/&lt;NIM&gt;/out_spark/part-00000
              </p>
            </div>
            {sparkDetailed ? (
              <Chip tone="ok" className="tabular-nums">
                {sparkDetailed.totalLines} baris terbaca
              </Chip>
            ) : (
              <Chip tone="neutral">TIDAK TERBACA</Chip>
            )}
          </div>
          <textarea
            id="validation-input-spark"
            rows={7}
            value={state.wordCountSpark}
            onChange={(e) => handleUpdateSpark(e.target.value)}
            placeholder={"hadoop\t500\nspark\t400\nhdfs\t300\nyarn\t200\ndata\t100"}
            className="w-full rounded-sm border border-code-line bg-code px-3 py-2.5 font-mono text-xs leading-relaxed text-code-ink placeholder:text-code-muted/50 focus:border-accent focus:outline-none"
          />
        </section>
      </div>
    </div>
  );
};
