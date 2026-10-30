import React, { useState } from "react";
import {
  FileText,
  Download,
  Printer,
  Copy,
  Check,
  Lock,
  Unlock,
  Award,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileJson,
  ArrowRight,
  ClipboardCopy,
  Database,
} from "lucide-react";
import { DEADLINE, EVIDENCE_DEF, KNOWN_ISSUES, RUBRIC, STEPS_TEMPLATE } from "../constants";
import { checkExportGate, generateReportMarkdown, getFileSubmissions } from "../export";
import { parseWordCountOutput, parseDfsAdmin, parseFsck, parseYarnNodes, parseSparkJson } from "../parsers";
import { mongoService } from "../services/mongoService";
import { AppState } from "../types";
import { Chip, Meter, MicroLabel, Panel, SegButton } from "../components/ui";

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

/* Gaya tipografi judul bab pada pratinjau akademik — satu aksen, garis kiri tipis. */
const BAB_HEADING =
  "border-l-2 border-accent pl-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink print:border-ink";

/* Sel kata status tanpa pil dekoratif — cukup kata mono berwarna ok/gagal. */
const statusWord = (ok: boolean, okText: string, badText: string) => (
  <span className={`font-mono font-bold ${ok ? "text-ok" : "text-danger"}`}>{ok ? okText : badText}</span>
);

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

  /* Entri daftar audit 6 pilar gerbang ekspor — murni tampilan, kondisi & navigasi tetap dari gateStatus. */
  const pillarTiles: React.ReactNode[] = [
    <div key="p1" className="rounded-sm border border-line bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <MicroLabel>1 · Mode Contoh</MicroLabel>
        <Chip tone={!gateStatus.isSampleMode ? "ok" : "warn"}>
          {!gateStatus.isSampleMode ? "NON-AKTIF" : "AKTIF (KUNCI)"}
        </Chip>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
        {!gateStatus.isSampleMode
          ? "Data yang diproses merupakan data pengujian asli Anda."
          : "Mode Contoh aktif. Matikan saklar di bar atas untuk mengekspor."}
      </p>
    </div>,
    <div key="p2" className="flex flex-col justify-between gap-1 rounded-sm border border-line bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <MicroLabel>2 · Runbook (S01-S15)</MicroLabel>
        <Chip tone={gateStatus.stepsCompleted === gateStatus.totalSteps ? "ok" : "danger"}>
          {gateStatus.stepsCompleted}/{gateStatus.totalSteps} SELESAI
        </Chip>
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-ink-muted">
          {gateStatus.stepsCompleted === gateStatus.totalSteps
            ? "Seluruh 15 langkah telah tereksekusi."
            : `Kurang ${gateStatus.totalSteps - gateStatus.stepsCompleted} langkah.`}
        </span>
        {onNavigateToTab && gateStatus.stepsCompleted < gateStatus.totalSteps && (
          <button
            type="button"
            onClick={() => onNavigateToTab("Runbook")}
            className="inline-flex shrink-0 items-center gap-0.5 font-mono text-[10px] font-semibold text-accent hover:text-accent-strong"
          >
            Buka <ArrowRight className="h-2.5 w-2.5" />
          </button>
        )}
      </div>
    </div>,
    <div key="p3" className="flex flex-col justify-between gap-1 rounded-sm border border-line bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <MicroLabel>3 · Berkas Bukti (E01-E16)</MicroLabel>
        <Chip tone={gateStatus.evidenceCompleted === gateStatus.totalEvidence ? "ok" : "danger"}>
          {gateStatus.evidenceCompleted}/{gateStatus.totalEvidence} LENGKAP
        </Chip>
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-ink-muted">
          {gateStatus.evidenceCompleted === gateStatus.totalEvidence
            ? "Nama berkas & catatan >= 20 karakter."
            : `Kurang ${gateStatus.totalEvidence - gateStatus.evidenceCompleted} bukti.`}
        </span>
        {onNavigateToTab && gateStatus.evidenceCompleted < gateStatus.totalEvidence && (
          <button
            type="button"
            onClick={() => onNavigateToTab("Evidence")}
            className="inline-flex shrink-0 items-center gap-0.5 font-mono text-[10px] font-semibold text-accent hover:text-accent-strong"
          >
            Buka <ArrowRight className="h-2.5 w-2.5" />
          </button>
        )}
      </div>
    </div>,
    <div key="p4" className="flex flex-col justify-between gap-1 rounded-sm border border-line bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <MicroLabel>4 · Validasi WordCount</MicroLabel>
        <Chip tone={gateStatus.isValid ? "ok" : "danger"}>
          {gateStatus.isValid ? "VALID (100%)" : "BELUM VALID"}
        </Chip>
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-ink-muted">
          {gateStatus.isValid
            ? "MR == Spark, Total 1.500, Kunci Cocok."
            : "Periksa output part-r-00000 & part-00000."}
        </span>
        {onNavigateToTab && !gateStatus.isValid && (
          <button
            type="button"
            onClick={() => onNavigateToTab("Validation")}
            className="inline-flex shrink-0 items-center gap-0.5 font-mono text-[10px] font-semibold text-accent hover:text-accent-strong"
          >
            Buka <ArrowRight className="h-2.5 w-2.5" />
          </button>
        )}
      </div>
    </div>,
    <div key="p5" className="flex flex-col justify-between gap-1 rounded-sm border border-line bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <MicroLabel>5 · Placeholder Bebas</MicroLabel>
        <Chip tone={gateStatus.isiCount === 0 ? "ok" : "danger"}>
          {gateStatus.isiCount === 0 ? "0 TERSISA" : `${gateStatus.isiCount} [ISI]`}
        </Chip>
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-ink-muted">
          {gateStatus.isiCount === 0
            ? "Tidak ada placeholder [ISI] tersisa."
            : "Masih ada placeholder pada form / disclosure."}
        </span>
        {onNavigateToTab && gateStatus.isiCount > 0 && (
          <button
            type="button"
            onClick={() => onNavigateToTab("Disclosure")}
            className="inline-flex shrink-0 items-center gap-0.5 font-mono text-[10px] font-semibold text-accent hover:text-accent-strong"
          >
            Buka <ArrowRight className="h-2.5 w-2.5" />
          </button>
        )}
      </div>
    </div>,
    <div key="p6" className="flex flex-col justify-between gap-1 rounded-sm border border-line bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <MicroLabel>6 · Sanitasi Kredensial</MicroLabel>
        <Chip tone={gateStatus.credentialLeakCount === 0 ? "ok" : "danger"}>
          {gateStatus.credentialLeakCount === 0 ? "0 BOCOR (BERSIH)" : `${gateStatus.credentialLeakCount} BOCOR`}
        </Chip>
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-ink-muted">
          {gateStatus.credentialLeakCount === 0
            ? "Bebas API key, password, token rahasia."
            : "Segera hapus token/password pada teks input."}
        </span>
        {onNavigateToTab && gateStatus.credentialLeakCount > 0 && (
          <button
            type="button"
            onClick={() => onNavigateToTab("Monitor")}
            className="inline-flex shrink-0 items-center gap-0.5 font-mono text-[10px] font-semibold text-accent hover:text-accent-strong"
          >
            Periksa <ArrowRight className="h-2.5 w-2.5" />
          </button>
        )}
      </div>
    </div>,
  ];

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <Panel
        no="6"
        className="print:hidden"
        title={
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-accent" />
            Laporan Akhir & Ekspor LMS
          </span>
        }
        sub="Delapan bab laporan, gerbang ekspor, dan berkas pengumpulan."
        actions={
          <span className="flex items-center gap-2">
            <MicroLabel>Batas Pengumpulan</MicroLabel>
            <Chip tone="warn" className="!normal-case">
              {DEADLINE}
            </Chip>
          </span>
        }
      >
        <p className="text-[11px] leading-relaxed text-ink-soft">
          Ekspor terbuka otomatis hanya setelah enam syarat integritas di bawah terpenuhi. Periksa pratinjau
          dokumen sebelum mencetak atau mengunggah ke LMS.
        </p>
      </Panel>

      {/* Gerbang Ekspor Status Deck */}
      <Panel
        className="print:hidden"
        title={
          <span className="flex flex-wrap items-center gap-2">
            {gateStatus.canExport ? (
              <Unlock className="h-4 w-4 shrink-0 text-ok" />
            ) : (
              <Lock className="h-4 w-4 shrink-0 text-ink-muted" />
            )}
            <span className="font-mono text-xs font-bold uppercase tracking-[0.12em]">
              {gateStatus.canExport ? "Gerbang Ekspor Terbuka" : "Gerbang Ekspor Terkunci"}
            </span>
            <Chip tone={gateStatus.canExport ? "ok" : "danger"}>
              {gateStatus.canExport ? "SIAP EKSPOR" : "TERKUNCI"}
            </Chip>
          </span>
        }
        sub={
          gateStatus.canExport
            ? "Keenam syarat terpenuhi: 15 langkah selesai, 16 bukti lengkap, komparasi WordCount VALID, nol temuan kredensial, tanpa placeholder [ISI]."
            : "Ekspor terkunci sampai enam syarat di bawah terpenuhi."
        }
        actions={
          <>
            <button
              type="button"
              onClick={handleCopyMarkdown}
              disabled={!gateStatus.canExport}
              title={!gateStatus.canExport ? "Gerbang ekspor masih terkunci" : "Salin isi laporan lengkap ke clipboard"}
              className="btn btn-outline"
            >
              {copiedMd ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedMd ? "Tersalin" : "Salin Markdown"}
            </button>

            <button
              type="button"
              onClick={handleDownloadMarkdown}
              disabled={!gateStatus.canExport}
              title={!gateStatus.canExport ? "Gerbang ekspor masih terkunci" : "Unduh berkas laporan dalam format .md"}
              className="btn btn-outline"
            >
              <Download className="h-3.5 w-3.5" />
              Unduh .MD
            </button>

            <button
              type="button"
              onClick={handlePrintPdf}
              disabled={!gateStatus.canExport}
              title={!gateStatus.canExport ? "Gerbang ekspor masih terkunci" : "Cetak dokumen laporan resmi / simpan sebagai PDF"}
              className="btn btn-primary"
            >
              <Printer className="h-3.5 w-3.5" />
              Cetak / PDF
            </button>

            <button
              type="button"
              onClick={handleSaveReportToMongo}
              disabled={!gateStatus.canExport || mongoSaveStatus === "saving"}
              title="Simpan salinan laporan ke database MongoDB"
              className={`btn btn-outline ${
                gateStatus.canExport && mongoSaveStatus === "saved"
                  ? "!border-ok/60 !bg-ok-wash !text-ok"
                  : gateStatus.canExport && mongoSaveStatus === "error"
                  ? "!border-danger/60 !bg-danger-wash !text-danger"
                  : ""
              }`}
            >
              <Database
                className={`h-3.5 w-3.5 ${
                  gateStatus.canExport && mongoSaveStatus === "saved"
                    ? "text-ok"
                    : gateStatus.canExport && mongoSaveStatus === "error"
                    ? "text-danger"
                    : ""
                }`}
              />
              {mongoSaveStatus === "saving"
                ? "Menyimpan..."
                : mongoSaveStatus === "saved"
                ? "Tersimpan di MongoDB"
                : mongoSaveStatus === "error"
                ? "Gagal Simpan"
                : "Simpan ke MongoDB"}
            </button>
          </>
        }
      >
        {/* Daftar Audit 6 Pilar Integritas */}
        <div className="mb-2 flex items-center justify-between">
          <MicroLabel>Diagnostik Enam Syarat Ekspor</MicroLabel>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">{pillarTiles}</div>

        {/* Supplementary Manifest Downloads */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
          <MicroLabel>Paket Ekspor Tambahan untuk Arsip ZIP &amp; Audit</MicroLabel>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportEvidenceCsv}
              className="btn btn-outline !px-2.5 !py-1 font-mono !text-[11px]"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-ok" />
              Manifest Bukti (.csv)
            </button>
            <button
              type="button"
              onClick={handleExportBundleJson}
              className="btn btn-outline !px-2.5 !py-1 font-mono !text-[11px]"
            >
              <FileJson className="h-3.5 w-3.5 text-accent" />
              Audit Bundle (.json)
            </button>
          </div>
        </div>
      </Panel>

      {/* Target File Submissions Standard */}
      <Panel
        className="print:hidden"
        title="Format Berkas LMS"
        sub="Klik baris untuk menyalin nama berkas."
      >
        <dl className="overflow-hidden rounded-sm border border-line">
          {(
            [
              { key: "pdf", kind: "1 · Laporan Resmi (PDF)", tag: "Utama", name: fileNames.pdf },
              { key: "zip", kind: "2 · Arsip Bukti (ZIP)", tag: "16 Tangkapan Layar", name: fileNames.zip },
              { key: "video", kind: "3 · Rekaman Video / Tautan", tag: "Maksimal 08:00", name: fileNames.video },
            ] as const
          ).map((row, idx) => (
            <div
              key={row.key}
              role="button"
              tabIndex={0}
              onClick={() => handleCopySubmissionName(row.name, row.key)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleCopySubmissionName(row.name, row.key);
                }
              }}
              className={`flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 transition-colors hover:bg-surface-2/70 ${
                idx > 0 ? "border-t border-line" : ""
              }`}
              title="Klik untuk menyalin nama berkas"
            >
              <dt className="label-micro w-44 shrink-0">{row.kind}</dt>
              <span className="hidden w-32 shrink-0 font-mono text-[10px] text-accent sm:block">{row.tag}</span>
              <dd className="min-w-0 flex-1 truncate font-mono text-xs font-semibold text-ink">{row.name}</dd>
              <button
                type="button"
                onClick={() => handleCopySubmissionName(row.name, row.key)}
                className="btn btn-ghost !px-2 !py-1 font-mono !text-[11px]"
              >
                {copiedSub === row.key ? (
                  <Check className="h-3 w-3 text-ok" />
                ) : (
                  <ClipboardCopy className="h-3 w-3" />
                )}
                <span>{copiedSub === row.key ? "Nama Tersalin" : "Salin Nama"}</span>
              </button>
            </div>
          ))}
        </dl>
      </Panel>

      {/* Rubric Self-Check Accordion */}
      <section className="rounded-sm border border-line bg-surface print:hidden">
        <div
          onClick={() => setShowRubricDetails(!showRubricDetails)}
          className="flex cursor-pointer flex-wrap items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-surface-2/60"
        >
          <div className="flex items-center gap-2.5">
            <Award className="h-4 w-4 shrink-0 text-accent" />
            <div>
              <h3 className="text-xs font-bold text-ink">
                Rubrik Self-Check Kesiapan Laporan & Pengujian{" "}
                <span className="font-mono text-[11px] font-normal text-ink-muted">
                  (5 Komponen Penilaian Resmi LMS)
                </span>
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Meter value={totalChecked} total={totalQuestions} className="w-36 sm:w-44" />
            <span className="font-mono text-xs font-bold tabular-nums text-ink">{overallReadinessPct}% siap</span>
            <button type="button" className="text-ink-muted" aria-label="Buka/tutup detail rubrik">
              {showRubricDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {showRubricDetails && (
          <div className="border-t border-line p-5">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {RUBRIC.map((rub) => {
                const questions = RUBRIC_QUESTIONS[rub.k] || [];
                const checkedInGroup = questions.filter((_, idx) => state.rubricChecks[`${rub.k}_${idx}`]).length;
                const groupPct = questions.length > 0 ? Math.round((checkedInGroup / questions.length) * 100) : 0;

                return (
                  <div key={rub.k} className="rounded-sm border border-line bg-surface-2/40 p-4">
                    <div className="flex items-start justify-between gap-3 border-b border-line pb-2">
                      <div>
                        <span className="block text-xs font-bold text-ink">{rub.k}</span>
                        <span className="label-micro mt-0.5 block">Bobot Penilaian: {rub.w}%</span>
                      </div>
                      <span className="font-mono text-[11px] font-bold tabular-nums text-accent">{groupPct}%</span>
                    </div>

                    <div className="mt-3 space-y-2">
                      {questions.map((question, qIdx) => {
                        const checkKey = `${rub.k}_${qIdx}`;
                        const isChecked = !!state.rubricChecks[checkKey];
                        return (
                          <label
                            key={qIdx}
                            className="flex cursor-pointer items-start gap-2 transition-colors hover:text-ink"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleRubricCheck(checkKey)}
                              style={{ accentColor: "var(--c-accent)" }}
                              className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer"
                            />
                            <span
                              className={`text-[11px] leading-relaxed ${
                                isChecked ? "text-ink-soft" : "text-ink-muted"
                              }`}
                            >
                              {question}
                            </span>
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
      <section className="rounded-sm border border-line bg-surface print:border-0 print:bg-transparent">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2/60 px-4 py-2.5 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <MicroLabel>Format Pratinjau Dokumen</MicroLabel>
            <div className="flex items-center gap-1">
              <SegButton active={viewMode === "academic"} onClick={() => setViewMode("academic")}>
                Dokumen Akademik (A4)
              </SegButton>
              <SegButton active={viewMode === "markdown"} onClick={() => setViewMode("markdown")}>
                Kode Sumber Markdown (.md)
              </SegButton>
            </div>
          </div>
          <span className="font-mono text-[11px] text-ink-muted">
            {viewMode === "academic" ? "Siap Cetak PDF (Tata Letak Resmi)" : "Raw Markdown Generator"}
          </span>
        </div>

        {viewMode === "markdown" ? (
          <div className="p-4 print:p-0">
            <div className="code-block max-h-[600px] whitespace-pre-wrap leading-relaxed print:max-h-none print:overflow-visible print:whitespace-pre-wrap">
              {markdownText}
            </div>
          </div>
        ) : (
          <div className="max-h-[700px] overflow-y-auto bg-surface-2/40 p-4 md:p-6 print:max-h-none print:overflow-visible print:bg-transparent print:p-0">
            {/* Lembar kertas A4-like */}
            <article className="mx-auto max-w-3xl space-y-6 rounded-sm border border-line bg-surface p-6 text-xs leading-relaxed md:p-10 print:max-w-none print:space-y-4 print:border-0 print:p-0">
              {/* Academic Paper Header */}
              <div className="border-b-2 border-line-strong pb-4 text-center print:border-ink">
                <p className="label-micro">
                  STMIK Pelita Nusantara • Program Studi Ilmu Komputer / Teknik Informatika
                </p>
                <h1 className="mt-2 text-base font-bold uppercase tracking-wide text-ink">
                  Laporan Praktikum Mandiri: Tugas Pemantapan 1 (TP1)
                </h1>
                <p className="mt-1 text-xs font-medium text-accent print:text-ink-soft">
                  Penyiapan, Eksekusi, dan Pemantauan Klaster Terdistribusi Hadoop & Apache Spark
                </p>
                <p className="mt-1 font-mono text-[10px] text-ink-muted">
                  Batas Pengumpulan: {DEADLINE} • Berkas: {fileNames.pdf}
                </p>
              </div>

              {/* Identitas Mahasiswa Table */}
              <div className="rounded-sm border border-line p-4 print:p-2">
                <h4 className="label-micro mb-2">Identitas Praktikan & Pembagian Tugas Kelompok</h4>
                <div className="grid grid-cols-1 gap-3 font-mono text-[11px] sm:grid-cols-2 lg:grid-cols-3">
                  {state.members
                    .filter((m) => m.nama || m.nim)
                    .map((m, idx) => (
                      <div key={idx} className="rounded-sm border border-line bg-surface-2/50 p-2.5 print:bg-transparent">
                        <span className="block text-[10px] text-ink-muted">
                          Anggota #{idx + 1} {idx === 0 ? "(Ketua/Lead)" : ""}
                        </span>
                        <strong className="mt-0.5 block text-ink">{m.nama || "-"}</strong>
                        <span className="block text-[10px] text-accent print:text-ink-soft">NIM: {m.nim || "-"}</span>
                        <span className="mt-1 block text-[10px] text-ink-muted">Peran: {m.porsi}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Bab I: Ringkasan Topologi Klaster */}
              <div className="space-y-2">
                <h3 className={BAB_HEADING}>I. Karakteristik Klaster & Konfigurasi Host</h3>
                <div className="grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-4">
                  <div className="rounded-sm border border-line p-2">
                    <span className="block text-[10px] text-ink-muted">Host Environment:</span>
                    <span className="font-semibold text-ink">Docker WSL2</span>
                  </div>
                  <div className="rounded-sm border border-line p-2">
                    <span className="block text-[10px] text-ink-muted">Alokasi Sumber Daya:</span>
                    <span className="font-semibold text-ink">Min 6GB RAM / 4 vCPU</span>
                  </div>
                  <div className="rounded-sm border border-line p-2">
                    <span className="block text-[10px] text-ink-muted">Total Kontainer:</span>
                    <span className="font-semibold text-ink">8 Kontainer Aktif</span>
                  </div>
                  <div className="rounded-sm border border-line p-2">
                    <span className="block text-[10px] text-ink-muted">Faktor Replikasi HDFS:</span>
                    <span className="font-semibold text-ink">2 (datanode1, datanode2)</span>
                  </div>
                </div>

                {/* Port Matrix */}
                <div className="rounded-sm border border-line p-2.5 font-mono text-[11px]">
                  <span className="label-micro mb-1 block">Daftar Port Web UI Klaster:</span>
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    <span className="rounded-sm border border-line bg-surface-2 px-2 py-0.5 text-ink-soft">
                      NameNode: 9870
                    </span>
                    <span className="rounded-sm border border-line bg-surface-2 px-2 py-0.5 text-ink-soft">
                      YARN RM: 8088
                    </span>
                    <span className="rounded-sm border border-line bg-surface-2 px-2 py-0.5 text-ink-soft">
                      Spark Master: 8080
                    </span>
                    <span className="rounded-sm border border-line bg-surface-2 px-2 py-0.5 text-ink-soft">
                      Spark Worker: 8081 / 8082
                    </span>
                    <span className="rounded-sm border border-line bg-surface-2 px-2 py-0.5 text-ink-soft">
                      Spark App: 4040
                    </span>
                  </div>
                </div>
              </div>

              {/* Bab II: Log 15 Langkah Runbook */}
              <div className="space-y-2">
                <h3 className={BAB_HEADING}>II. Log Eksekusi 15 Langkah Runbook (S01 - S15)</h3>
                <div className="overflow-x-auto rounded-sm border border-line">
                  <table className="w-full text-left font-mono text-[10px]">
                    <thead className="border-b border-line bg-surface-2">
                      <tr>
                        <th className="label-micro px-2 py-1.5 text-left">ID</th>
                        <th className="label-micro px-2 py-1.5 text-left">Judul Langkah</th>
                        <th className="label-micro px-2 py-1.5 text-left">Keluaran Diharapkan</th>
                        <th className="label-micro px-2 py-1.5 text-center">Bukti</th>
                        <th className="label-micro px-2 py-1.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {STEPS_TEMPLATE.map((st) => {
                        const completed = state.steps[st.id]?.completed;
                        return (
                          <tr key={st.id} className="hover:bg-surface-2/60 print:hover:bg-transparent">
                            <td className="px-2 py-1 font-bold text-ink">{st.id}</td>
                            <td className="px-2 py-1 text-ink">{st.judul}</td>
                            <td className="max-w-[200px] truncate px-2 py-1 text-ink-muted">{st.expected}</td>
                            <td className="px-2 py-1 text-center font-semibold text-ink-soft">{st.evidenceId}</td>
                            <td className="px-2 py-1 text-center">{statusWord(!!completed, "SELESAI", "BELUM")}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bab III: Hasil Uji Validasi WordCount */}
              <div className="space-y-2">
                <h3 className={BAB_HEADING}>III. Hasil Eksekusi Pemrosesan Terdistribusi (WordCount 1.500 Kata)</h3>
                <p className="text-[11px] text-ink-muted">
                  Perbandingan luaran deterministik antara mesin MapReduce (Hadoop) dan PySpark RDD (Apache Spark):
                </p>
                <div className="overflow-x-auto rounded-sm border border-line">
                  <table className="w-full text-left font-mono text-[11px]">
                    <thead className="border-b border-line bg-surface-2">
                      <tr>
                        <th className="label-micro px-3 py-1.5 text-left">Token Kata</th>
                        <th className="label-micro px-3 py-1.5 text-right">Target Acuan</th>
                        <th className="label-micro px-3 py-1.5 text-right">Hasil MapReduce</th>
                        <th className="label-micro px-3 py-1.5 text-right">Hasil PySpark</th>
                        <th className="label-micro px-3 py-1.5 text-center">Status Paritas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {["hadoop", "spark", "hdfs", "yarn", "data"].map((key) => {
                        const exp = key === "hadoop" ? 500 : key === "spark" ? 400 : key === "hdfs" ? 300 : key === "yarn" ? 200 : 100;
                        const mrVal = mrCounts?.get(key);
                        const spVal = sparkCounts?.get(key);
                        const match = mrVal === exp && spVal === exp;
                        return (
                          <tr key={key} className="hover:bg-surface-2/60 print:hover:bg-transparent">
                            <td className="px-3 py-1.5 font-bold text-ink">{key}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-ink-soft">{exp}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-ink">{mrVal ?? "-"}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-ink">{spVal ?? "-"}</td>
                            <td className="px-3 py-1.5 text-center">{statusWord(match, "PARITAS 100%", "SELISIH")}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bab IV: Pemantauan Daemons Klaster */}
              <div className="space-y-2">
                <h3 className={BAB_HEADING}>IV. Ringkasan Status Pemantauan Daemons</h3>
                <div className="grid grid-cols-1 gap-2 font-mono text-[11px] sm:grid-cols-2">
                  <div className="rounded-sm border border-line p-2.5">
                    <span className="block text-[10px] text-ink-muted">HDFS DFSAdmin:</span>
                    <span className="font-semibold text-ink">
                      Live DataNodes: {dfsReport?.live ?? "N/A"} / Under-replicated: {dfsReport?.underRep ?? "N/A"}
                    </span>
                  </div>
                  <div className="rounded-sm border border-line p-2.5">
                    <span className="block text-[10px] text-ink-muted">HDFS FSCK Health:</span>
                    <span className="font-semibold text-ink">
                      Status: {fsckReport?.status ?? "N/A"} (Target: HEALTHY)
                    </span>
                  </div>
                  <div className="rounded-sm border border-line p-2.5">
                    <span className="block text-[10px] text-ink-muted">YARN NodeManager:</span>
                    <span className="font-semibold text-ink">
                      Total Nodes: {yarnNodesReport?.total ?? "N/A"} (Running: {yarnNodesReport?.running ?? "N/A"})
                    </span>
                  </div>
                  <div className="rounded-sm border border-line p-2.5">
                    <span className="block text-[10px] text-ink-muted">Spark Master Standalone:</span>
                    <span className="font-semibold text-ink">
                      Status: {sparkJsonReport?.status ?? "N/A"} (Alive Workers: {sparkJsonReport?.aliveworkers ?? "N/A"})
                    </span>
                  </div>
                </div>
              </div>

              {/* Bab V: Catatan Kendala & Resolusi Lapangan */}
              <div className="space-y-2">
                <h3 className={BAB_HEADING}>V. Catatan Kendala & Resolusi Teknis Lapangan</h3>
                {encounteredIssues.length > 0 ? (
                  <div className="space-y-1.5 font-mono text-[11px]">
                    {encounteredIssues.map((ci, idx) => (
                      <div key={idx} className="rounded-sm border border-line bg-surface-2/50 p-2 print:bg-transparent">
                        <strong className="block text-warn">{ci.label}</strong>
                        <span className="text-[10px] text-ink-soft">{ci.solution}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="font-mono text-[11px] text-ink-muted">
                    Tidak terdeteksi kendala kegagalan kritis dari teks log yang dimasukkan. Eksekusi berjalan stabil
                    pada lingkungan kontainer.
                  </p>
                )}
              </div>

              {/* Bab VI: AI & Tooling Disclosure */}
              <div className="space-y-2">
                <h3 className={BAB_HEADING}>VI. Deklarasi Penggunaan AI & Perkakas Otomasi</h3>
                <p className="text-[11px] text-ink-muted">
                  {state.noAiUsage
                    ? "Praktikan menyatakan bahwa seluruh pengerjaan TP1 dilakukan secara mandiri tanpa menggunakan asisten generative AI."
                    : `Praktikan mencatat penggunaan ${state.disclosureRows.length} interaksi perkakas asistif AI dengan verifikasi mandiri.`}
                </p>
                {!state.noAiUsage && state.disclosureRows.length > 0 && (
                  <div className="overflow-x-auto rounded-sm border border-line">
                    <table className="w-full text-left font-mono text-[10px]">
                      <thead className="border-b border-line bg-surface-2">
                        <tr>
                          <th className="label-micro px-2 py-1.5 text-left">Tool/AI</th>
                          <th className="label-micro px-2 py-1.5 text-left">Tujuan</th>
                          <th className="label-micro px-2 py-1.5 text-left">Diambil</th>
                          <th className="label-micro px-2 py-1.5 text-left">Ditolak</th>
                          <th className="label-micro px-2 py-1.5 text-left">Verifikasi Mandiri</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {state.disclosureRows.map((dr, idx) => (
                          <tr key={idx} className="hover:bg-surface-2/60 print:hover:bg-transparent">
                            <td className="px-2 py-1 font-bold text-ink">{dr.tool}</td>
                            <td className="px-2 py-1 text-ink-soft">{dr.tujuan}</td>
                            <td className="px-2 py-1 text-ink-soft">{dr.diambil}</td>
                            <td className="px-2 py-1 text-ink-soft">{dr.ditolak}</td>
                            <td className="px-2 py-1 text-ink-soft">{dr.verifikasi}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Bab VII: Manifest Bukti */}
              <div className="space-y-2">
                <h3 className={BAB_HEADING}>VII. Ringkasan 16 Berkas Bukti Tangkapan Layar (E01 - E16)</h3>
                <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px] sm:grid-cols-4">
                  {EVIDENCE_DEF.map((evDef) => {
                    const ev = state.evidence[evDef.id];
                    const isDone = ev && ev.filename.trim() && ev.notes.trim().length >= 20;
                    return (
                      <div key={evDef.id} className="rounded-sm border border-line p-1.5">
                        <div className="flex items-center justify-between">
                          <strong className="text-ink">{evDef.id}</strong>
                          <span className={`font-bold ${isDone ? "text-ok" : "text-danger"}`}>
                            {isDone ? "LENGKAP" : "BELUM"}
                          </span>
                        </div>
                        <span className="mt-0.5 block truncate text-ink-soft">{ev?.filename || "(belum diisi)"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Lembar Tanda Tangan Praktikan */}
              <div className="flex items-end justify-between border-t border-line pt-6 print:border-ink print:pt-4">
                <div className="font-mono text-[10px] text-ink-muted">
                  Dicetak melalui Tugas BigData Tbgsdewa % Dearizka • STMIK Pelita Nusantara
                </div>
                <div className="space-y-8 text-right font-mono text-[11px]">
                  <div>
                    <p className="text-ink-muted">Medan, {new Date().toLocaleDateString("id-ID")}</p>
                    <p className="font-semibold text-ink">Perwakilan Praktikan,</p>
                  </div>
                  <div>
                    <p className="font-bold text-ink underline">{state.members[0]?.nama || "Mahasiswa TP1"}</p>
                    <p className="text-[10px] text-accent print:text-ink-soft">
                      NIM: {state.members[0]?.nim || "...................."}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          </div>
        )}
      </section>
    </div>
  );
};
