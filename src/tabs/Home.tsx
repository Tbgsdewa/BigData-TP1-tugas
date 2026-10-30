import React, { useMemo } from "react";
import { AlertTriangle, ArrowRight, Database, RefreshCw, ShieldCheck } from "lucide-react";
import { AppState } from "../types";
import { MongoStatus } from "../services/mongoService";
import { checkExportGate, getFileSubmissions } from "../export";
import { compareWordCounts } from "../validate";
import { parseWordCountOutput } from "../parsers";
import { DEADLINE, ENV, STEPS_TEMPLATE, EVIDENCE_DEF } from "../constants";
import { findRemainingIsiPlaceholders, scanAllCredentials } from "../scanner";
import { Chip, Panel } from "../components/ui";

interface HomeProps {
  state: AppState;
  mongoStatus: MongoStatus | null;
  onNavigate: (tab: "Setup" | "Runbook" | "Monitor" | "Validation" | "Evidence" | "Report" | "Video" | "Disclosure") => void;
  onOpenMongo: () => void;
  onRefreshMongo: () => Promise<void>;
}

export const HomeTab: React.FC<HomeProps> = ({ state, mongoStatus, onNavigate, onOpenMongo, onRefreshMongo }) => {
  const gate = checkExportGate(state);
  const files = getFileSubmissions(state);
  const credentials = scanAllCredentials(state);
  const isiCount = state.noAiUsage ? 0 : findRemainingIsiPlaceholders(state).length;

  const stepsDone = STEPS_TEMPLATE.filter((s) => state.steps[s.id]?.completed).length;
  const nextStep = STEPS_TEMPLATE.find((s) => !state.steps[s.id]?.completed);
  const prereqDone = Object.values(state.prerequisites).filter(Boolean).length;
  const membersReady = state.members.filter((m) => m.nama.trim() && m.nim.trim()).length;
  const monitorFilled = Object.values(state.monitorLogs).filter((v) => v.trim().length > 0).length;
  const videoDone = Object.values(state.videoChecklist).filter(Boolean).length;

  const parity = useMemo(() => {
    const mr = parseWordCountOutput(state.wordCountMR);
    const sp = parseWordCountOutput(state.wordCountSpark);
    return compareWordCounts(mr, sp);
  }, [state.wordCountMR, state.wordCountSpark]);

  const parityLabel =
    !mrOrSparkPresent(state)
      ? "BELUM ADA DATA"
      : parity.verdict === "VALID"
      ? `VALID · PARITAS ${parity.parityRatio}%`
      : `${parity.verdict} · PARITAS ${parity.parityRatio}%`;

  // Tindakan nyata yang masih tertunda — urutan prioritas alur kerja
  const pending: Array<{ text: string; tab: Parameters<typeof onNavigate>[0]; cta: string }> = [];
  if (membersReady === 0) {
    pending.push({ text: "Isi identitas anggota kelompok (nama + NIM) — NIM pertama menggantikan <NIM> di seluruh path HDFS.", tab: "Setup", cta: "Buka Setup" });
  }
  if (prereqDone < 3) {
    pending.push({ text: `Verifikasi prasyarat host (${prereqDone}/3 tercentang).`, tab: "Setup", cta: "Buka Setup" });
  }
  if (nextStep) {
    pending.push({ text: `Lanjutkan runbook dari ${nextStep.id}: ${nextStep.judul} (sisa ${STEPS_TEMPLATE.length - stepsDone} langkah).`, tab: "Runbook", cta: "Buka Runbook" });
  }
  if (monitorFilled < Object.keys(state.monitorLogs).length) {
    pending.push({ text: `Tempel log pemantauan ke dalam workbench (${monitorFilled}/8 sumber terisi).`, tab: "Monitor", cta: "Buka Monitor" });
  }
  if (!gate.isValid) {
    pending.push({ text: "Komparasi output WordCount MapReduce vs Spark belum VALID (toleransi selisih 0).", tab: "Validation", cta: "Buka Validasi" });
  }
  if (gate.evidenceCompleted < gate.totalEvidence) {
    pending.push({ text: `Lengkapi metadata bukti E01–E16 (${gate.evidenceCompleted}/${gate.totalEvidence} lengkap).`, tab: "Evidence", cta: "Buka Bukti" });
  }
  if (gate.credentialLeakCount > 0) {
    pending.push({ text: `Bersihkan ${gate.credentialLeakCount} pola kredensial rahasia dari teks log/laporan.`, tab: "Monitor", cta: "Periksa Log" });
  }
  if (isiCount > 0) {
    pending.push({ text: `Ganti ${isiCount} placeholder "[ISI]" yang masih tersisa pada formulir/disclosure.`, tab: "Disclosure", cta: "Buka Disclosure" });
  }
  if (videoDone < 4) {
    pending.push({ text: `Selesaikan checklist standar mutu rekaman video (${videoDone}/4).`, tab: "Video", cta: "Buka Video" });
  }
  if (!gate.canExport && pending.length === 0) {
    pending.push({ text: state.sampleMode ? "Mode Contoh aktif — kembali ke data asli untuk membuka gerbang ekspor." : "Periksa gerbang ekspor laporan.", tab: "Report", cta: "Buka Laporan" });
  }

  const peta: Array<{ no: string; label: string; status: React.ReactNode; tab: Parameters<typeof onNavigate>[0] }> = [
    { no: "1", label: "Setup & Spesifikasi", status: <MeterInline done={prereqDone === 3 && membersReady > 0} text={`Prasyarat ${prereqDone}/3 · Anggota ${membersReady}/${state.members.length}`} />, tab: "Setup" },
    { no: "2", label: "Runbook S01–S15", status: <MeterInline done={stepsDone === STEPS_TEMPLATE.length} text={`${stepsDone}/${STEPS_TEMPLATE.length} langkah selesai`} />, tab: "Runbook" },
    { no: "3", label: "Monitor Log", status: <MeterInline done={monitorFilled === 8} text={`${monitorFilled}/8 sumber log terisi`} />, tab: "Monitor" },
    { no: "4", label: "Validasi WordCount", status: <MeterInline done={parity.verdict === "VALID"} text={parityLabel} />, tab: "Validation" },
    { no: "5", label: "Bukti E01–E16", status: <MeterInline done={gate.evidenceCompleted === gate.totalEvidence} text={`${gate.evidenceCompleted}/${gate.totalEvidence} bukti lengkap`} />, tab: "Evidence" },
    { no: "6", label: "Laporan & Ekspor", status: gate.canExport ? <Chip tone="ok">Gerbang terbuka</Chip> : <Chip tone={state.sampleMode ? "warn" : "neutral"}>Terkunci · {gate.reasons.length} syarat tersisa</Chip>, tab: "Report" },
    { no: "7", label: "Video Walkthrough", status: <MeterInline done={videoDone === 4} text={`Checklist mutu ${videoDone}/4`} />, tab: "Video" },
    { no: "8", label: "AI Disclosure", status: state.noAiUsage ? <Chip tone="ok">Deklarasi non-AI</Chip> : <MeterInline done={isiCount === 0} text={isiCount > 0 ? `${isiCount} placeholder [ISI] tersisa` : "Disclosure terisi"} />, tab: "Disclosure" },
  ];

  return (
    <div className="space-y-6">
      {/* Kartu identitas tugas */}
      <Panel
        no="00"
        title="Dek Operasional Tugas Pemantapan 1"
        sub={
          <>
            Penyiapan, pemantauan, validasi, dan dokumentasi klaster Hadoop/Spark dalam satu alur periksa.
            Semua angka di bawah dihitung dari state aplikasi — <strong className="text-ink-soft">bukan
            contoh, bukan karangan</strong>.
          </>
        }
        actions={
          state.sampleMode ? (
            <Chip tone="warn">
              <AlertTriangle className="h-3 w-3" /> Mode Contoh Aktif
            </Chip>
          ) : undefined
        }
      >
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="label-micro">Lingkungan</dt>
            <dd className="mt-1 font-mono text-ink-soft">
              {ENV.images.hadoop}
              <br />
              {ENV.images.spark}
            </dd>
          </div>
          <div>
            <dt className="label-micro">Batas Pengumpulan</dt>
            <dd className="mt-1 text-ink-soft">{DEADLINE}</dd>
          </div>
          <div>
            <dt className="label-micro">Berkas Akhir</dt>
            <dd className="mt-1 font-mono text-[11px] text-ink-soft">
              {files.pdf}
              <br />
              {files.zip}
            </dd>
          </div>
          <div>
            <dt className="label-micro">Integritas</dt>
            <dd className="mt-1">
              {credentials.length === 0 ? (
                <Chip tone="ok">
                  <ShieldCheck className="h-3 w-3" /> Bebas kredensial
                </Chip>
              ) : (
                <Chip tone="danger">
                  <AlertTriangle className="h-3 w-3" /> {credentials.length} temuan kredensial
                </Chip>
              )}
            </dd>
          </div>
        </dl>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Langkah berikutnya */}
        <div className="lg:col-span-3">
          <Panel no="→" title="Langkah Berikutnya" sub="Disusun dari prioritas alur kerja; hanya pekerjaan yang benar-benar tertunda.">
            {pending.length === 0 ? (
              <div className="flex items-start gap-3 rounded-sm border border-ok/40 bg-ok-wash px-4 py-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
                <p className="text-xs leading-relaxed text-ink-soft">
                  Tidak ada tindakan tertunda yang dapat dideteksi dari state. Gerbang ekspor{" "}
                  {gate.canExport ? "terbuka — siapkan unggah ke LMS." : "masih terkunci; buka Laporan untuk melihat syaratnya."}
                </p>
              </div>
            ) : (
              <ol className="space-y-2">
                {pending.slice(0, 5).map((item, idx) => (
                  <li
                    key={item.text}
                    className="flex items-start justify-between gap-3 rounded-sm border border-line bg-surface-2/60 px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 font-mono text-[11px] font-bold tabular-nums text-accent">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <p className="text-xs leading-relaxed text-ink-soft">{item.text}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigate(item.tab)}
                      className="btn btn-outline shrink-0 !px-2 !py-1 font-mono !text-[11px]"
                    >
                      {item.cta} <ArrowRight className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        {/* Koneksi database */}
        <div className="lg:col-span-2">
          <Panel no="DB" title="Koneksi Basis Data" sub="Status nyata hasil polling endpoint /api/mongo.">
            {mongoStatus?.connected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Chip tone="ok">
                    <Database className="h-3 w-3" /> Atlas terhubung
                  </Chip>
                  <span className="font-mono text-[11px] text-ink-muted">ping {mongoStatus.pingMs}ms</span>
                </div>
                <dl className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                  <div className="rounded-sm border border-line bg-surface-2 px-2.5 py-2">
                    <dt className="label-micro">Database</dt>
                    <dd className="mt-1 truncate font-semibold text-ink">{mongoStatus.database}</dd>
                  </div>
                  <div className="rounded-sm border border-line bg-surface-2 px-2.5 py-2">
                    <dt className="label-micro">Sesi</dt>
                    <dd className="mt-1 tabular-nums font-semibold text-ink">{mongoStatus.counts.sessions}</dd>
                  </div>
                  <div className="rounded-sm border border-line bg-surface-2 px-2.5 py-2">
                    <dt className="label-micro">Bukti</dt>
                    <dd className="mt-1 tabular-nums font-semibold text-ink">{mongoStatus.counts.evidence}</dd>
                  </div>
                  <div className="rounded-sm border border-line bg-surface-2 px-2.5 py-2">
                    <dt className="label-micro">Laporan</dt>
                    <dd className="mt-1 tabular-nums font-semibold text-ink">{mongoStatus.counts.reports}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs leading-relaxed text-ink-soft">
                  {mongoStatus === null
                    ? "Status belum diterima dari server — kemungkinan backend belum berjalan atau MONGODB_URI belum dikonfigurasi. Kerja lokal (localStorage) tetap aman."
                    : "MongoDB belum terhubung (standby). Aplikasi berjalan penuh dengan penyimpanan lokal browser; hubungkan Atlas untuk persistensi cloud."}
                </p>
                <EvidensCountNote state={state} />
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
              <button type="button" onClick={onOpenMongo} className="btn btn-primary">
                <Database className="h-3.5 w-3.5" /> Panel Koneksi
              </button>
              <button type="button" onClick={() => onRefreshMongo()} className="btn btn-outline">
                <RefreshCw className="h-3.5 w-3.5" /> Cek Ulang Ping
              </button>
            </div>
          </Panel>
        </div>
      </div>

      {/* Peta pekerjaan */}
      <Panel no="01–08" title="Peta Alur Kerja" sub="Status tiap bagian; angka diambil langsung dari state aplikasi.">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line">
                <th className="label-micro py-2 pr-2 text-left font-normal">#</th>
                <th className="label-micro py-2 pr-2 text-left font-normal">Bagian</th>
                <th className="label-micro py-2 pr-2 text-left font-normal">Status Saat Ini</th>
                <th className="label-micro py-2 text-right font-normal">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {peta.map((row) => (
                <tr key={row.no}>
                  <td className="py-2.5 pr-2 font-mono text-[11px] font-bold text-accent">{row.no}</td>
                  <td className="py-2.5 pr-2 font-semibold text-ink">{row.label}</td>
                  <td className="py-2.5 pr-2">{row.status}</td>
                  <td className="py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => onNavigate(row.tab)}
                      className="btn btn-ghost !px-2 !py-1 font-mono !text-[11px]"
                    >
                      Buka <ArrowRight className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Gerbang ekspor ringkas */}
      {!gate.canExport && gate.reasons.length > 0 && (
        <Panel title="Gerbang Ekspor Laporan" sub="Enam syarat yang masih menahan ekspor.">
          <ul className="space-y-1.5">
            {gate.reasons.map((r) => (
              <li key={r} className="flex items-start gap-2 text-xs leading-relaxed text-ink-soft">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
                {r}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => onNavigate("Report")} className="btn btn-outline mt-3">
            Lihat panel ekspor <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </Panel>
      )}
    </div>
  );
};

function mrOrSparkPresent(state: AppState): boolean {
  return state.wordCountMR.trim().length > 0 || state.wordCountSpark.trim().length > 0;
}

const MeterInline: React.FC<{ done: boolean; text: string }> = ({ done, text }) => (
  <span className={`font-mono text-[11px] ${done ? "text-ok" : "text-ink-muted"}`}>{text}</span>
);

const EvidensCountNote: React.FC<{ state: AppState }> = ({ state }) => {
  const gate = checkExportGate(state);
  return (
    <p className="font-mono text-[11px] text-ink-muted">
      Bukti E01–E16 tercatat di perangkat ini: {gate.evidenceCompleted}/{EVIDENCE_DEF.length} lengkap.
    </p>
  );
};
