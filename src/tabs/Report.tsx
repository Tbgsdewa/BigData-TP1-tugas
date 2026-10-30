import React, { useState } from "react";
import {
  FileText,
  Download,
  Printer,
  Copy,
  Check,
  Lock,
  Unlock,
  AlertTriangle,
  Award,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileJson,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  ClipboardCopy,
  Database,
} from "lucide-react";
import { DEADLINE, ENV, EVIDENCE_DEF, KNOWN_ISSUES, RUBRIC, STEPS_TEMPLATE } from "../constants";
import { checkExportGate, generateReportMarkdown, getFileSubmissions } from "../export";
import { parseWordCountOutput, parseDfsAdmin, parseFsck, parseYarnNodes, parseSparkJson } from "../parsers";
import { mongoService } from "../services/mongoService";
import { AppState } from "../types";

interface ReportProps {
  state: AppState;
  onChange: (updater: (prev: AppState) => AppState) => void;
  onNavigateToTab?: (tab: string) => void;
}

const RUBRIC_QUESTIONS: Record<string, string[]> = {
  "Pemahaman masalah": [
    "Memahami arsitektur NameNode/DataNode HDFS dan alokasi resource YARN / Spark Master.",
    "Menguasai alur map, shuffle, reduce vs pemrosesan in-memory Spark RDD.",
    "Mampu mengidentifikasi mekanisme replikasi blok (faktor 2) dan transisi safe mode.",
  ],
  "Ketepatan metode": [
    "Konfigurasi docker-compose & environment env_file dibuat sesuai spesifikasi tanpa port clash.",
    "Skrip PySpark (app/wc.py) memanfaatkan SparkSession dan transformasi deterministik.",
    "Perintah HDFS terstruktur rapi pada direktori user mahasiswa (/user/<NIM>/).",
  ],
  "Eksekusi (tools & AI + disclosure)": [
    "Semua 15 langkah runbook tereksekusi pada terminal kontainer nyata.",
    "Tabel disclosure AI terisi jujur, transparan, dan terverifikasi mandiri (atau opsi non-AI).",
    "Parameter resource spark-submit (--executor-memory 512m) dikonfigurasi tepat.",
  ],
  "Kualitas dan akurasi hasil": [
    "Dataset kata berjumlah tepat 1.500 baris terverifikasi dengan perintah wc -l.",
    "Hasil keluaran part-r-00000 dan part-00000 menghasilkan frekuensi acuan 100% presisi.",
    "Toleransi kesalahan nol terpenuhi tanpa selisih atau kunci ekstra.",
  ],
  "Validasi dan video walkthrough": [
    "Video rekaman mencakup 7 segmen timeline terstruktur dalam durasi maksimal 8 menit.",
    "Setiap anggota kelompok berkontribusi aktif dan berbicara secara langsung dalam video.",
    "Semua 16 bukti visual terdokumentasi rapi tanpa mengekspos kredensial rahasia.",
  ],
};

export const ReportTab: React.FC<ReportProps> = ({ state, onChange, onNavigateToTab }) => {
  const [copiedMd, setCopiedMd] = useState(false);
  const [copiedSub, setCopiedSub] = useState<string | null>(null);
  const [showRubricDetails, setShowRubricDetails] = useState(false);
  const [viewMode, setViewMode] = useState<"academic" | "markdown">("academic");
  const [mongoSaveStatus, setMongoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const gateStatus = checkExportGate(state);
  const markdownText = generateReportMarkdown(state);
  const fileNames = getFileSubmissions(state);

  const primaryNim = state.members[0]?.nim?.trim() || "NIM";
  const primaryNama = state.members[0]?.nama?.trim() || "Nama_Mahasiswa";

  const handleSaveReportToMongo = async () => {
    setMongoSaveStatus("saving");
    try {
      const res = await mongoService.saveReport({
        title: `Laporan Praktikum TP1 Big Data - ${primaryNim}`,
        content: markdownText,
        author: `${primaryNama} (${primaryNim})`,
        parityStatus: gateStatus.isValid ? "PASS_100_PERCENT" : "INCOMPLETE",
        metrics: {
          completedSteps: Object.values(state.steps).filter((s) => s.completed).length,
          evidenceCount: Object.values(state.evidence).filter((e) => e.filename).length,
          membersCount: state.members.length,
        },
      });
      if (res.success) {
        setMongoSaveStatus("saved");
        setTimeout(() => setMongoSaveStatus("idle"), 3000);
      } else {
        setMongoSaveStatus("error");
        setTimeout(() => setMongoSaveStatus("idle"), 3000);
      }
    } catch {
      setMongoSaveStatus("error");
      setTimeout(() => setMongoSaveStatus("idle"), 3000);
    }
  };

  // Parsers for report inspection
  const mrCounts = parseWordCountOutput(state.wordCountMR);
  const sparkCounts = parseWordCountOutput(state.wordCountSpark);
  const dfsReport = parseDfsAdmin(state.monitorLogs.dfsadmin);
  const fsckReport = parseFsck(state.monitorLogs.fsck);
  const yarnNodesReport = parseYarnNodes(state.monitorLogs.yarnNodes);
  const sparkJsonReport = parseSparkJson(state.monitorLogs.sparkJson);

  // Issues check
  const allLogsJoined = Object.values(state.monitorLogs).join("\n");
  const encounteredIssues = KNOWN_ISSUES.filter((ki) => ki.regex.test(allLogsJoined));

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(markdownText);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  const handleCopySubmissionName = (name: string, key: string) => {
    navigator.clipboard.writeText(name);
    setCopiedSub(key);
    setTimeout(() => setCopiedSub(null), 2000);
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([markdownText], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileNames.md;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportBundleJson = () => {
    const bundle = {
      project: "Tugas BigData Tbgsdewa % Dearizka",
      institution: "STMIK Pelita Nusantara",
      exportedAt: new Date().toISOString(),
      studentLead: {
        nim: primaryNim,
        nama: primaryNama,
      },
      members: state.members,
      gateStatus,
      steps: state.steps,
      evidenceManifest: state.evidence,
      videoAssignments: state.videoAssignments,
      aiDisclosures: state.disclosureRows,
      noAiUsage: state.noAiUsage,
      wordCountValidation: {
        mrCounts: mrCounts ? Object.fromEntries(mrCounts) : null,
        sparkCounts: sparkCounts ? Object.fromEntries(sparkCounts) : null,
      },
      markdownReport: markdownText,
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tp1_audit_bundle_${primaryNim}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportEvidenceCsv = () => {
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

  const handlePrintPdf = () => {
    window.print();
  };

  const handleToggleRubricCheck = (key: string) => {
    onChange((prev) => ({
      ...prev,
      rubricChecks: {
        ...prev.rubricChecks,
        [key]: !prev.rubricChecks[key],
      },
    }));
  };

  // Rubric calculation
  let totalChecked = 0;
  let totalQuestions = 0;
  RUBRIC.forEach((r) => {
    const qList = RUBRIC_QUESTIONS[r.k] || [];
    qList.forEach((_, idx) => {
      totalQuestions++;
      if (state.rubricChecks[`${r.k}_${idx}`]) {
        totalChecked++;
      }
    });
  });
  const overallReadinessPct = totalQuestions > 0 ? Math.round((totalChecked / totalQuestions) * 100) : 0;

  const isDark = state.theme === "dark";

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <section
        className={`border rounded-lg p-5 transition-colors print:hidden ${
          isDark ? "bg-[#0d1322] border-slate-800" : "bg-white border-slate-200"
        }`}
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              Laporan Akhir Praktikum & Pusat Ekspor Berkas LMS
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Kompilasi formal 8 bab laporan praktikum, verifikasi integritas gerbang ekspor, dan generator berkas pengumpulan.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-300 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded flex items-center gap-2">
            <span className="text-slate-500">Batas Pengumpulan:</span>
            <span className="text-amber-400 font-semibold">{DEADLINE}</span>
          </div>
        </div>
      </section>

      {/* Gerbang Ekspor Status Deck */}
      <section
        className={`p-5 rounded-lg border transition-colors print:hidden ${
          gateStatus.canExport
            ? "bg-emerald-950/20 border-emerald-800/80"
            : "bg-slate-900/60 border-slate-800"
        }`}
      >
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-slate-800/80">
          <div className="flex items-start gap-3">
            <div
              className={`p-2.5 rounded mt-0.5 ${
                gateStatus.canExport
                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {gateStatus.canExport ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  {gateStatus.canExport ? "Gerbang Ekspor Terbuka" : "Gerbang Ekspor Terkunci"}
                </h3>
                <span
                  className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded border ${
                    gateStatus.canExport
                      ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                      : "bg-slate-800 text-slate-400 border-slate-700"
                  }`}
                >
                  {gateStatus.canExport ? "SIAP EKSPOR" : "TERKUNCI"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                {gateStatus.canExport
                  ? "Seluruh persyaratan integritas akademik telah terpenuhi secara penuh: 15 Langkah Selesai, 16 Bukti Lengkap, Paritas WordCount 100%, 0 Kredensial Bocor, dan Bebas Placeholder [ISI]."
                  : "Ekspor dikunci secara otomatis untuk menjamin kepatuhan akademik tugas besar. Lengkapi 6 pilar kriteria di bawah untuk membuka akses ekspor."}
              </p>
            </div>
          </div>

          {/* Action Export Buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <button
              type="button"
              onClick={handleCopyMarkdown}
              disabled={!gateStatus.canExport}
              title={!gateStatus.canExport ? "Gerbang ekspor masih terkunci" : "Salin isi laporan lengkap ke clipboard"}
              className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${
                gateStatus.canExport
                  ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  : "bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-800"
              }`}
            >
              {copiedMd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedMd ? "Tersalin" : "Salin Markdown"}
            </button>

            <button
              type="button"
              onClick={handleDownloadMarkdown}
              disabled={!gateStatus.canExport}
              title={!gateStatus.canExport ? "Gerbang ekspor masih terkunci" : "Unduh berkas laporan dalam format .md"}
              className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${
                gateStatus.canExport
                  ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  : "bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-800"
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              Unduh .MD
            </button>

            <button
              type="button"
              onClick={handlePrintPdf}
              disabled={!gateStatus.canExport}
              title={!gateStatus.canExport ? "Gerbang ekspor masih terkunci" : "Cetak dokumen laporan resmi / simpan sebagai PDF"}
              className={`px-3.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                gateStatus.canExport
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm"
                  : "bg-slate-800 text-slate-600 cursor-not-allowed"
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak / PDF
            </button>

            <button
              type="button"
              onClick={handleSaveReportToMongo}
              disabled={!gateStatus.canExport || mongoSaveStatus === "saving"}
              title="Simpan salinan laporan ke database MongoDB"
              className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${
                gateStatus.canExport
                  ? mongoSaveStatus === "saved"
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                    : mongoSaveStatus === "error"
                    ? "bg-rose-950 text-rose-300 border border-rose-800"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                  : "bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-800"
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              {mongoSaveStatus === "saving"
                ? "Menyimpan..."
                : mongoSaveStatus === "saved"
                ? "Tersimpan di MongoDB"
                : mongoSaveStatus === "error"
                ? "Gagal Simpan"
                : "Simpan ke MongoDB"}
            </button>
          </div>
        </div>

        {/* 6 Integrity Pillars Diagnostic Grid */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {/* 1. Mode Contoh */}
          <div
            className={`p-3 rounded border text-xs ${
              !gateStatus.isSampleMode
                ? "bg-slate-950/80 border-slate-800"
                : "bg-amber-950/30 border-amber-800/80 text-amber-200"
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-mono text-[11px] font-bold text-slate-400 uppercase">
                1. Mode Contoh
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  !gateStatus.isSampleMode
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                    : "bg-amber-950 text-amber-300 border border-amber-800"
                }`}
              >
                {!gateStatus.isSampleMode ? "NON-AKTIF" : "AKTIF (KUNCI)"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {!gateStatus.isSampleMode
                ? "Data yang diproses merupakan data pengujian asli Anda."
                : "Mode Contoh aktif. Matikan saklar di bar atas untuk mengekspor."}
            </p>
          </div>

          {/* 2. Runbook Steps */}
          <div
            className={`p-3 rounded border text-xs ${
              gateStatus.stepsCompleted === gateStatus.totalSteps
                ? "bg-slate-950/80 border-slate-800"
                : "bg-rose-950/20 border-rose-800/60"
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-mono text-[11px] font-bold text-slate-400 uppercase">
                2. Runbook (S01-S15)
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  gateStatus.stepsCompleted === gateStatus.totalSteps
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                    : "bg-rose-950 text-rose-300 border border-rose-800"
                }`}
              >
                {gateStatus.stepsCompleted}/{gateStatus.totalSteps} SELESAI
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] mt-1">
              <span className="text-slate-400">
                {gateStatus.stepsCompleted === gateStatus.totalSteps
                  ? "Seluruh 15 langkah telah tereksekusi."
                  : `Kurang ${gateStatus.totalSteps - gateStatus.stepsCompleted} langkah.`}
              </span>
              {onNavigateToTab && gateStatus.stepsCompleted < gateStatus.totalSteps && (
                <button
                  type="button"
                  onClick={() => onNavigateToTab("Runbook")}
                  className="text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 font-mono text-[10px]"
                >
                  Buka <ArrowRight className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          </div>

          {/* 3. Metadata Bukti */}
          <div
            className={`p-3 rounded border text-xs ${
              gateStatus.evidenceCompleted === gateStatus.totalEvidence
                ? "bg-slate-950/80 border-slate-800"
                : "bg-rose-950/20 border-rose-800/60"
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-mono text-[11px] font-bold text-slate-400 uppercase">
                3. Berkas Bukti (E01-E16)
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  gateStatus.evidenceCompleted === gateStatus.totalEvidence
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                    : "bg-rose-950 text-rose-300 border border-rose-800"
                }`}
              >
                {gateStatus.evidenceCompleted}/{gateStatus.totalEvidence} LENGKAP
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] mt-1">
              <span className="text-slate-400">
                {gateStatus.evidenceCompleted === gateStatus.totalEvidence
                  ? "Nama berkas & catatan >= 20 karakter."
                  : `Kurang ${gateStatus.totalEvidence - gateStatus.evidenceCompleted} bukti.`}
              </span>
              {onNavigateToTab && gateStatus.evidenceCompleted < gateStatus.totalEvidence && (
                <button
                  type="button"
                  onClick={() => onNavigateToTab("Evidence")}
                  className="text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 font-mono text-[10px]"
                >
                  Buka <ArrowRight className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          </div>

          {/* 4. Validasi WordCount */}
          <div
            className={`p-3 rounded border text-xs ${
              gateStatus.isValid
                ? "bg-slate-950/80 border-slate-800"
                : "bg-rose-950/20 border-rose-800/60"
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-mono text-[11px] font-bold text-slate-400 uppercase">
                4. Validasi WordCount
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  gateStatus.isValid
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                    : "bg-rose-950 text-rose-300 border border-rose-800"
                }`}
              >
                {gateStatus.isValid ? "VALID (100%)" : "BELUM VALID"}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] mt-1">
              <span className="text-slate-400">
                {gateStatus.isValid
                  ? "MR == Spark, Total 1.500, Kunci Cocok."
                  : "Periksa output part-r-00000 & part-00000."}
              </span>
              {onNavigateToTab && !gateStatus.isValid && (
                <button
                  type="button"
                  onClick={() => onNavigateToTab("Validation")}
                  className="text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 font-mono text-[10px]"
                >
                  Buka <ArrowRight className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          </div>

          {/* 5. Placeholder [ISI] */}
          <div
            className={`p-3 rounded border text-xs ${
              gateStatus.isiCount === 0
                ? "bg-slate-950/80 border-slate-800"
                : "bg-rose-950/20 border-rose-800/60"
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-mono text-[11px] font-bold text-slate-400 uppercase">
                5. Placeholder Bebas
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  gateStatus.isiCount === 0
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                    : "bg-rose-950 text-rose-300 border border-rose-800"
                }`}
              >
                {gateStatus.isiCount === 0 ? "0 TERSISA" : `${gateStatus.isiCount} [ISI]`}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] mt-1">
              <span className="text-slate-400">
                {gateStatus.isiCount === 0
                  ? "Tidak ada placeholder [ISI] tersisa."
                  : "Masih ada placeholder pada form / disclosure."}
              </span>
              {onNavigateToTab && gateStatus.isiCount > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigateToTab("Disclosure")}
                  className="text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 font-mono text-[10px]"
                >
                  Buka <ArrowRight className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          </div>

          {/* 6. Kredensial Sanitasi */}
          <div
            className={`p-3 rounded border text-xs ${
              gateStatus.credentialLeakCount === 0
                ? "bg-slate-950/80 border-slate-800"
                : "bg-rose-950/20 border-rose-800/60"
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-mono text-[11px] font-bold text-slate-400 uppercase">
                6. Sanitasi Kredensial
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  gateStatus.credentialLeakCount === 0
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                    : "bg-rose-950 text-rose-300 border border-rose-800"
                }`}
              >
                {gateStatus.credentialLeakCount === 0 ? "0 BOCOR (BERSIH)" : `${gateStatus.credentialLeakCount} BOCOR`}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] mt-1">
              <span className="text-slate-400">
                {gateStatus.credentialLeakCount === 0
                  ? "Bebas API key, password, token rahasia."
                  : "Segera hapus token/password pada teks input."}
              </span>
              {onNavigateToTab && gateStatus.credentialLeakCount > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigateToTab("Monitor")}
                  className="text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 font-mono text-[10px]"
                >
                  Periksa <ArrowRight className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Supplementary Manifest Downloads */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-slate-400 text-[11px]">
            Paket Ekspor Tambahan untuk Arsip ZIP & Audit:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportEvidenceCsv}
              className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] font-mono flex items-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              Manifest Bukti (.csv)
            </button>
            <button
              type="button"
              onClick={handleExportBundleJson}
              className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] font-mono flex items-center gap-1.5 transition-colors"
            >
              <FileJson className="w-3.5 h-3.5 text-cyan-400" />
              Audit Bundle (.json)
            </button>
          </div>
        </div>
      </section>

      {/* Target File Submissions Standard */}
      <section
        className={`border rounded-lg p-5 transition-colors print:hidden ${
          isDark ? "bg-[#0d1322] border-slate-800" : "bg-white border-slate-200"
        }`}
      >
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
            Format 3 Berkas Pengumpulan LMS (Wajib Sesuai Pola):
          </h3>
          <span className="text-[11px] text-slate-500 font-mono">Klik untuk menyalin nama berkas</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
          {/* File 1: PDF */}
          <div className="bg-slate-950 p-3 rounded border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-500 text-[10px] mb-1">
                <span>1. Laporan Resmi (PDF)</span>
                <span className="text-indigo-400">Utama</span>
              </div>
              <strong className="text-slate-200 block text-xs truncate mt-0.5">{fileNames.pdf}</strong>
            </div>
            <button
              type="button"
              onClick={() => handleCopySubmissionName(fileNames.pdf, "pdf")}
              className="mt-3 text-[11px] text-slate-400 hover:text-white flex items-center gap-1 pt-1.5 border-t border-slate-900 transition-colors"
            >
              {copiedSub === "pdf" ? <Check className="w-3 h-3 text-emerald-400" /> : <ClipboardCopy className="w-3 h-3" />}
              <span>{copiedSub === "pdf" ? "Nama Tersalin" : "Salin Nama Berkas"}</span>
            </button>
          </div>

          {/* File 2: ZIP */}
          <div className="bg-slate-950 p-3 rounded border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-500 text-[10px] mb-1">
                <span>2. Arsip Bukti (ZIP)</span>
                <span className="text-emerald-400">16 Tangkapan Layar</span>
              </div>
              <strong className="text-slate-200 block text-xs truncate mt-0.5">{fileNames.zip}</strong>
            </div>
            <button
              type="button"
              onClick={() => handleCopySubmissionName(fileNames.zip, "zip")}
              className="mt-3 text-[11px] text-slate-400 hover:text-white flex items-center gap-1 pt-1.5 border-t border-slate-900 transition-colors"
            >
              {copiedSub === "zip" ? <Check className="w-3 h-3 text-emerald-400" /> : <ClipboardCopy className="w-3 h-3" />}
              <span>{copiedSub === "zip" ? "Nama Tersalin" : "Salin Nama Berkas"}</span>
            </button>
          </div>

          {/* File 3: Video */}
          <div className="bg-slate-950 p-3 rounded border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-500 text-[10px] mb-1">
                <span>3. Rekaman Video / Tautan</span>
                <span className="text-amber-400">Maksimal 08:00</span>
              </div>
              <strong className="text-slate-200 block text-xs truncate mt-0.5">{fileNames.video}</strong>
            </div>
            <button
              type="button"
              onClick={() => handleCopySubmissionName(fileNames.video, "video")}
              className="mt-3 text-[11px] text-slate-400 hover:text-white flex items-center gap-1 pt-1.5 border-t border-slate-900 transition-colors"
            >
              {copiedSub === "video" ? <Check className="w-3 h-3 text-emerald-400" /> : <ClipboardCopy className="w-3 h-3" />}
              <span>{copiedSub === "video" ? "Nama Tersalin" : "Salin Nama Berkas"}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Rubric Self-Check Accordion */}
      <section
        className={`border rounded-lg overflow-hidden transition-colors print:hidden ${
          isDark ? "bg-[#0d1322] border-slate-800" : "bg-white border-slate-200"
        }`}
      >
        <div
          onClick={() => setShowRubricDetails(!showRubricDetails)}
          className="p-4 bg-slate-900/60 border-b border-slate-800 cursor-pointer flex justify-between items-center hover:bg-slate-900 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Award className="w-4 h-4 text-amber-400" />
            <div>
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                Rubrik Self-Check Kesiapan Laporan & Pengujian
                <span className="text-[11px] font-mono text-slate-400 font-normal">
                  (5 Komponen Penilaian Resmi LMS)
                </span>
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold text-amber-400 tabular-nums">
              {overallReadinessPct}% siap
            </span>
            <button type="button" className="text-slate-400">
              {showRubricDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {showRubricDetails && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {RUBRIC.map((rub) => {
                const questions = RUBRIC_QUESTIONS[rub.k] || [];
                const checkedInGroup = questions.filter((_, idx) => state.rubricChecks[`${rub.k}_${idx}`]).length;
                const groupPct = questions.length > 0 ? Math.round((checkedInGroup / questions.length) * 100) : 0;

                return (
                  <div key={rub.k} className="bg-slate-950/60 border border-slate-800/80 rounded p-3.5">
                    <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-slate-800/80">
                      <div>
                        <span className="text-xs font-bold text-white block">{rub.k}</span>
                        <span className="text-[10px] text-slate-400 font-mono">Bobot Penilaian: {rub.w}%</span>
                      </div>
                      <span className="font-mono text-[11px] text-indigo-400 font-bold tabular-nums">
                        {groupPct}%
                      </span>
                    </div>

                    <div className="space-y-2 mt-2">
                      {questions.map((question, qIdx) => {
                        const checkKey = `${rub.k}_${qIdx}`;
                        const isChecked = !!state.rubricChecks[checkKey];
                        return (
                          <label
                            key={qIdx}
                            className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer hover:text-white transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleRubricCheck(checkKey)}
                              className="mt-0.5 w-3.5 h-3.5 text-indigo-600 rounded bg-slate-950 border-slate-700"
                            />
                            <span className="text-[11px] leading-relaxed">{question}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Document View Switcher */}
      <section className="border border-slate-800 rounded-lg overflow-hidden print:border-none print:shadow-none">
        <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap justify-between items-center gap-2 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold text-slate-300">
              Format Pratinjau Dokumen:
            </span>
            <div className="flex rounded border border-slate-700 bg-slate-950 p-0.5 text-[11px] font-mono">
              <button
                type="button"
                onClick={() => setViewMode("academic")}
                className={`px-2.5 py-1 rounded transition-colors ${
                  viewMode === "academic"
                    ? "bg-indigo-600 text-white font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Dokumen Akademik (A4)
              </button>
              <button
                type="button"
                onClick={() => setViewMode("markdown")}
                className={`px-2.5 py-1 rounded transition-colors ${
                  viewMode === "markdown"
                    ? "bg-indigo-600 text-white font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Kode Sumber Markdown (.md)
              </button>
            </div>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {viewMode === "academic" ? "Siap Cetak PDF (Tata Letak Resmi)" : "Raw Markdown Generator"}
          </span>
        </div>

        {viewMode === "markdown" ? (
          <div className="p-6 bg-slate-950 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed max-h-[600px] overflow-y-auto print:bg-white print:text-black print:max-h-none print:p-0">
            {markdownText}
          </div>
        ) : (
          <div className="p-6 md:p-10 bg-slate-950/80 text-slate-200 text-xs leading-relaxed space-y-6 max-h-[700px] overflow-y-auto print:bg-white print:text-slate-900 print:max-h-none print:p-0 print:space-y-4">
            {/* Academic Paper Header */}
            <div className="border-b-2 border-slate-700 pb-4 text-center space-y-1.5 print:border-black">
              <p className="text-[10px] font-mono tracking-widest uppercase text-slate-400 print:text-slate-600">
                STMIK Pelita Nusantara • Program Studi Ilmu Komputer / Teknik Informatika
              </p>
              <h1 className="text-base font-bold text-white tracking-wide uppercase print:text-black">
                Laporan Praktikum Mandiri: Tugas Pemantapan 1 (TP1)
              </h1>
              <p className="text-xs text-indigo-400 font-medium print:text-slate-800">
                Penyiapan, Eksekusi, dan Pemantauan Klaster Terdistribusi Hadoop & Apache Spark
              </p>
              <p className="text-[10px] text-slate-500 font-mono print:text-slate-600">
                Batas Pengumpulan: {DEADLINE} • Berkas: {fileNames.pdf}
              </p>
            </div>

            {/* Identitas Mahasiswa Table */}
            <div className="border border-slate-800 rounded p-4 bg-slate-900/60 print:bg-white print:border-slate-300 print:p-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 font-mono print:text-black">
                Identitas Praktikan & Pembagian Tugas Kelompok
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 font-mono text-[11px]">
                {state.members.filter((m) => m.nama || m.nim).map((m, idx) => (
                  <div key={idx} className="border border-slate-800 rounded p-2.5 bg-slate-950 print:bg-white print:border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Anggota #{idx + 1} {idx === 0 ? "(Ketua/Lead)" : ""}</span>
                    <strong className="text-white block print:text-black mt-0.5">{m.nama || "-"}</strong>
                    <span className="text-indigo-400 text-[10px] block print:text-slate-700">NIM: {m.nim || "-"}</span>
                    <span className="text-slate-400 text-[10px] block mt-1">Peran: {m.porsi}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bab I: Ringkasan Topologi Klaster */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono border-l-2 border-indigo-500 pl-2 print:text-black print:border-black">
                I. Karakteristik Klaster & Konfigurasi Host
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                <div className="bg-slate-900/80 p-2 rounded border border-slate-800 print:bg-white print:border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Host Environment:</span>
                  <span className="text-slate-200 print:text-black font-semibold">Docker WSL2</span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded border border-slate-800 print:bg-white print:border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Alokasi Sumber Daya:</span>
                  <span className="text-slate-200 print:text-black font-semibold">Min 6GB RAM / 4 vCPU</span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded border border-slate-800 print:bg-white print:border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Total Kontainer:</span>
                  <span className="text-slate-200 print:text-black font-semibold">8 Kontainer Aktif</span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded border border-slate-800 print:bg-white print:border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Faktor Replikasi HDFS:</span>
                  <span className="text-slate-200 print:text-black font-semibold">2 (datanode1, datanode2)</span>
                </div>
              </div>

              {/* Port Matrix */}
              <div className="p-2.5 rounded bg-slate-900/40 border border-slate-800 text-[11px] font-mono print:bg-white print:border-slate-200">
                <span className="text-slate-400 text-[10px] block mb-1">Daftar Port Web UI Klaster:</span>
                <div className="flex flex-wrap gap-2 text-[10px]">
                  <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 print:bg-slate-100">NameNode: 9870</span>
                  <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 print:bg-slate-100">YARN RM: 8088</span>
                  <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 print:bg-slate-100">Spark Master: 8080</span>
                  <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 print:bg-slate-100">Spark Worker: 8081 / 8082</span>
                  <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 print:bg-slate-100">Spark App: 4040</span>
                </div>
              </div>
            </div>

            {/* Bab II: Log 15 Langkah Runbook */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono border-l-2 border-indigo-500 pl-2 print:text-black print:border-black">
                II. Log Eksekusi 15 Langkah Runbook (S01 - S15)
              </h3>
              <div className="overflow-x-auto border border-slate-800 rounded print:border-slate-300">
                <table className="w-full text-left font-mono text-[10px]">
                  <thead className="bg-slate-900 text-slate-400 print:bg-slate-100 print:text-black">
                    <tr>
                      <th className="py-1 px-2">ID</th>
                      <th className="py-1 px-2">Judul Langkah</th>
                      <th className="py-1 px-2">Keluaran Diharapkan</th>
                      <th className="py-1 px-2 text-center">Bukti</th>
                      <th className="py-1 px-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 print:divide-slate-200">
                    {STEPS_TEMPLATE.map((st) => {
                      const completed = state.steps[st.id]?.completed;
                      return (
                        <tr key={st.id} className="hover:bg-slate-900/40 print:hover:bg-transparent">
                          <td className="py-1 px-2 font-bold text-indigo-400 print:text-black">{st.id}</td>
                          <td className="py-1 px-2 text-white print:text-black">{st.judul}</td>
                          <td className="py-1 px-2 text-slate-400 print:text-slate-700 truncate max-w-[200px]">{st.expected}</td>
                          <td className="py-1 px-2 text-center text-slate-300 print:text-black font-semibold">{st.evidenceId}</td>
                          <td className="py-1 px-2 text-center">
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              completed ? "bg-emerald-950 text-emerald-300 print:bg-slate-100 print:text-black" : "bg-rose-950 text-rose-300"
                            }`}>
                              {completed ? "SELESAI" : "BELUM"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bab III: Hasil Uji Validasi WordCount */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono border-l-2 border-indigo-500 pl-2 print:text-black print:border-black">
                III. Hasil Eksekusi Pemrosesan Terdistribusi (WordCount 1.500 Kata)
              </h3>
              <p className="text-[11px] text-slate-400 print:text-slate-700">
                Perbandingan luaran deterministik antara mesin MapReduce (Hadoop) dan PySpark RDD (Apache Spark):
              </p>
              <div className="overflow-x-auto border border-slate-800 rounded print:border-slate-300">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead className="bg-slate-900 text-slate-400 print:bg-slate-100 print:text-black">
                    <tr>
                      <th className="py-1.5 px-3">Token Kata</th>
                      <th className="py-1.5 px-3 text-right">Target Acuan</th>
                      <th className="py-1.5 px-3 text-right">Hasil MapReduce</th>
                      <th className="py-1.5 px-3 text-right">Hasil PySpark</th>
                      <th className="py-1.5 px-3 text-center">Status Paritas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 print:divide-slate-200">
                    {["hadoop", "spark", "hdfs", "yarn", "data"].map((key) => {
                      const exp = key === "hadoop" ? 500 : key === "spark" ? 400 : key === "hdfs" ? 300 : key === "yarn" ? 200 : 100;
                      const mrVal = mrCounts?.get(key);
                      const spVal = sparkCounts?.get(key);
                      const match = mrVal === exp && spVal === exp;
                      return (
                        <tr key={key} className="hover:bg-slate-900/40 print:hover:bg-transparent">
                          <td className="py-1.5 px-3 font-bold text-white print:text-black">{key}</td>
                          <td className="py-1.5 px-3 text-right text-slate-400 print:text-black tabular-nums">{exp}</td>
                          <td className="py-1.5 px-3 text-right text-slate-300 print:text-black tabular-nums">{mrVal ?? "-"}</td>
                          <td className="py-1.5 px-3 text-right text-slate-300 print:text-black tabular-nums">{spVal ?? "-"}</td>
                          <td className="py-1.5 px-3 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              match ? "bg-emerald-950 text-emerald-300 print:bg-slate-100 print:text-black" : "bg-rose-950 text-rose-300"
                            }`}>
                              {match ? "PARITAS 100%" : "SELISIH"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bab IV: Pemantauan Daemons Klaster */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono border-l-2 border-indigo-500 pl-2 print:text-black print:border-black">
                IV. Ringkasan Status Pemantauan Daemons
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px]">
                <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800 print:bg-white print:border-slate-200">
                  <span className="text-[10px] text-slate-500 block">HDFS DFSAdmin:</span>
                  <span className="text-white print:text-black font-semibold">
                    Live DataNodes: {dfsReport?.live ?? "N/A"} / Under-replicated: {dfsReport?.underRep ?? "N/A"}
                  </span>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800 print:bg-white print:border-slate-200">
                  <span className="text-[10px] text-slate-500 block">HDFS FSCK Health:</span>
                  <span className="text-white print:text-black font-semibold">
                    Status: {fsckReport?.status ?? "N/A"} (Target: HEALTHY)
                  </span>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800 print:bg-white print:border-slate-200">
                  <span className="text-[10px] text-slate-500 block">YARN NodeManager:</span>
                  <span className="text-white print:text-black font-semibold">
                    Total Nodes: {yarnNodesReport?.total ?? "N/A"} (Running: {yarnNodesReport?.running ?? "N/A"})
                  </span>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800 print:bg-white print:border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Spark Master Standalone:</span>
                  <span className="text-white print:text-black font-semibold">
                    Status: {sparkJsonReport?.status ?? "N/A"} (Alive Workers: {sparkJsonReport?.aliveworkers ?? "N/A"})
                  </span>
                </div>
              </div>
            </div>

            {/* Bab V: Catatan Kendala & Resolusi Lapangan */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono border-l-2 border-indigo-500 pl-2 print:text-black print:border-black">
                V. Catatan Kendala & Resolusi Teknis Lapangan
              </h3>
              {encounteredIssues.length > 0 ? (
                <div className="space-y-1.5 font-mono text-[11px]">
                  {encounteredIssues.map((ci, idx) => (
                    <div key={idx} className="p-2 rounded bg-slate-900 border border-slate-800 print:bg-white print:border-slate-200">
                      <strong className="text-amber-400 print:text-black block">{ci.label}</strong>
                      <span className="text-slate-300 print:text-slate-700 text-[10px]">{ci.solution}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 print:text-slate-600 font-mono">
                  Tidak terdeteksi kendala kegagalan kritis dari teks log yang dimasukkan. Eksekusi berjalan stabil pada lingkungan kontainer.
                </p>
              )}
            </div>

            {/* Bab VI: AI & Tooling Disclosure */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono border-l-2 border-indigo-500 pl-2 print:text-black print:border-black">
                VI. Deklarasi Penggunaan AI & Perkakas Otomasi
              </h3>
              <p className="text-[11px] text-slate-400 print:text-slate-700">
                {state.noAiUsage
                  ? "Praktikan menyatakan bahwa seluruh pengerjaan TP1 dilakukan secara mandiri tanpa menggunakan asisten generative AI."
                  : `Praktikan mencatat penggunaan ${state.disclosureRows.length} interaksi perkakas asistif AI dengan verifikasi mandiri.`}
              </p>
              {!state.noAiUsage && state.disclosureRows.length > 0 && (
                <div className="overflow-x-auto border border-slate-800 rounded print:border-slate-300">
                  <table className="w-full text-left font-mono text-[10px]">
                    <thead className="bg-slate-900 text-slate-400 print:bg-slate-100 print:text-black">
                      <tr>
                        <th className="py-1 px-2">Tool/AI</th>
                        <th className="py-1 px-2">Tujuan</th>
                        <th className="py-1 px-2">Diambil</th>
                        <th className="py-1 px-2">Ditolak</th>
                        <th className="py-1 px-2">Verifikasi Mandiri</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 print:divide-slate-200">
                      {state.disclosureRows.map((dr, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/40 print:hover:bg-transparent">
                          <td className="py-1 px-2 font-bold text-white print:text-black">{dr.tool}</td>
                          <td className="py-1 px-2 text-slate-300 print:text-slate-700">{dr.tujuan}</td>
                          <td className="py-1 px-2 text-slate-300 print:text-slate-700">{dr.diambil}</td>
                          <td className="py-1 px-2 text-slate-300 print:text-slate-700">{dr.ditolak}</td>
                          <td className="py-1 px-2 text-indigo-300 print:text-black">{dr.verifikasi}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Bab VII: Manifest Bukti */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono border-l-2 border-indigo-500 pl-2 print:text-black print:border-black">
                VII. Ringkasan 16 Berkas Bukti Tangkapan Layar (E01 - E16)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-[10px]">
                {EVIDENCE_DEF.map((evDef) => {
                  const ev = state.evidence[evDef.id];
                  const isDone = ev && ev.filename.trim() && ev.notes.trim().length >= 20;
                  return (
                    <div key={evDef.id} className="p-1.5 bg-slate-900 border border-slate-800 rounded print:bg-white print:border-slate-300">
                      <div className="flex justify-between items-center">
                        <strong className="text-indigo-400">{evDef.id}</strong>
                        <span className={`text-[9px] font-bold ${isDone ? "text-emerald-400" : "text-rose-400"}`}>
                          {isDone ? "LENGKAP" : "BELUM"}
                        </span>
                      </div>
                      <span className="text-slate-300 block truncate mt-0.5">{ev?.filename || "(belum diisi)"}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lembar Tanda Tangan Praktikan */}
            <div className="pt-6 border-t border-slate-800 flex justify-between items-end print:border-slate-300 print:pt-4">
              <div className="text-[10px] text-slate-500 print:text-slate-600 font-mono">
                Dicetak melalui Tugas BigData Tbgsdewa % Dearizka • STMIK Pelita Nusantara
              </div>
              <div className="text-right space-y-8 font-mono text-[11px]">
                <div>
                  <p className="text-slate-400 print:text-slate-600">Medan, {new Date().toLocaleDateString("id-ID")}</p>
                  <p className="font-semibold text-white print:text-black">Perwakilan Praktikan,</p>
                </div>
                <div>
                  <p className="font-bold underline text-white print:text-black">{state.members[0]?.nama || "Mahasiswa TP1"}</p>
                  <p className="text-[10px] text-indigo-400 print:text-slate-700">NIM: {state.members[0]?.nim || "...................."}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
