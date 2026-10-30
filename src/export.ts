import { DEADLINE, ENV, EVIDENCE_DEF, KNOWN_ISSUES, STEPS_TEMPLATE } from "./constants";
import { parseDfsAdmin, parseFsck, parseMrLog, parseSparkJson, parseSparkLog, parseWordCountOutput, parseYarnApps, parseYarnNodes } from "./parsers";
import { findRemainingIsiPlaceholders, scanAllCredentials } from "./scanner";
import { AppState } from "./types";
import { compareWordCounts, evaluateDfsAdmin, evaluateFsck, evaluateMrLog, evaluateSparkExitCode, evaluateSparkJson, evaluateSparkLog, evaluateYarnApps, evaluateYarnNodes } from "./validate";

export interface ExportGateStatus {
  canExport: boolean;
  reasons: string[];
  isSampleMode: boolean;
  stepsCompleted: number;
  totalSteps: number;
  evidenceCompleted: number;
  totalEvidence: number;
  isValid: boolean;
  isiCount: number;
  credentialLeakCount: number;
}

export function checkExportGate(state: AppState): ExportGateStatus {
  const reasons: string[] = [];

  // 1. Mode Contoh OFF
  const isSampleMode = state.sampleMode;
  if (isSampleMode) {
    reasons.push('Mode Contoh sedang aktif ("CONTOH - BUKAN BUKTI"). Nonaktifkan untuk ekspor.');
  }

  // 2. Semua step S01-S15 dicentang
  const totalSteps = STEPS_TEMPLATE.length;
  let stepsCompleted = 0;
  STEPS_TEMPLATE.forEach((s) => {
    if (state.steps[s.id]?.completed) stepsCompleted++;
  });
  if (stepsCompleted < totalSteps) {
    reasons.push(`Langkah Runbook belum semua dicentang (${stepsCompleted}/${totalSteps} selesai).`);
  }

  // 3. Evidence E01-E16 lengkap (filename terisi dan note >= 20 karakter)
  const totalEvidence = EVIDENCE_DEF.length;
  let evidenceCompleted = 0;
  EVIDENCE_DEF.forEach((ev) => {
    const item = state.evidence[ev.id];
    if (item && item.filename.trim() && item.notes.trim().length >= 20) {
      evidenceCompleted++;
    }
  });
  if (evidenceCompleted < totalEvidence) {
    reasons.push(`Metadata bukti E01-E16 belum lengkap (${evidenceCompleted}/${totalEvidence} valid; tiap bukti wajib memiliki nama file dan keterangan minimal 20 karakter).`);
  }

  // 4. Verdict VALID
  const mrMap = parseWordCountOutput(state.wordCountMR);
  const sparkMap = parseWordCountOutput(state.wordCountSpark);
  const cmpResult = compareWordCounts(mrMap, sparkMap);
  const isValid = cmpResult.verdict === "VALID";
  if (!isValid) {
    reasons.push(`Hasil komparasi WordCount belum "VALID" (saat ini: ${cmpResult.verdict}).`);
  }

  // 5. Tidak ada "[ISI]" tersisa
  const isiFindings = findRemainingIsiPlaceholders(state);
  const isiCount = isiFindings.length;
  if (isiCount > 0) {
    reasons.push(`Masih terdapat ${isiCount} placeholder "[ISI]" yang belum diisi pada form/disclosure.`);
  }

  // 6. Scanner kredensial nol temuan
  const credLeaks = scanAllCredentials(state);
  const credentialLeakCount = credLeaks.length;
  if (credentialLeakCount > 0) {
    reasons.push(`Terdeteksi ${credentialLeakCount} potensi kebocoran kredensial (password/token/key). Hapus sebelum ekspor.`);
  }

  const canExport =
    !isSampleMode &&
    stepsCompleted === totalSteps &&
    evidenceCompleted === totalEvidence &&
    isValid &&
    isiCount === 0 &&
    credentialLeakCount === 0;

  return {
    canExport,
    reasons,
    isSampleMode,
    stepsCompleted,
    totalSteps,
    evidenceCompleted,
    totalEvidence,
    isValid,
    isiCount,
    credentialLeakCount,
  };
}

export function getFileSubmissions(state: AppState) {
  const primary = state.members[0] || { nim: "NIM", nama: "Nama" };
  const safeNim = primary.nim.trim() || "NIM";
  const safeNama = (primary.nama.trim() || "Nama").replace(/\s+/g, "_");

  return {
    pdf: `TP1_${safeNim}_${safeNama}.pdf`,
    zip: `TP1_Bukti_${safeNim}_${safeNama}.zip`,
    video: `TP1_Video_${safeNim}_${safeNama}.mp4`,
    md: `TP1_${safeNim}_${safeNama}.md`,
  };
}

export function generateReportMarkdown(state: AppState): string {
  const primary = state.members[0] || { nim: "NIM", nama: "Nama" };
  const safeNim = primary.nim.trim() || "NIM";
  const safeNama = primary.nama.trim() || "Nama";

  const mrMap = parseWordCountOutput(state.wordCountMR);
  const sparkMap = parseWordCountOutput(state.wordCountSpark);
  const cmp = compareWordCounts(mrMap, sparkMap);

  // Monitor evaluations
  const dfs = evaluateDfsAdmin(parseDfsAdmin(state.monitorLogs.dfsadmin));
  const yn = evaluateYarnNodes(parseYarnNodes(state.monitorLogs.yarnNodes));
  const ya = evaluateYarnApps(parseYarnApps(state.monitorLogs.yarnApps));
  const fsck = evaluateFsck(parseFsck(state.monitorLogs.fsck));
  const mr = evaluateMrLog(parseMrLog(state.monitorLogs.mrLog));
  const spLog = evaluateSparkLog(parseSparkLog(state.monitorLogs.sparkLog));
  const spJson = evaluateSparkJson(parseSparkJson(state.monitorLogs.sparkJson));
  const spExit = evaluateSparkExitCode(state.monitorLogs.sparkExitCode);

  // Check issues in logs
  const allLogsJoined = Object.values(state.monitorLogs).join("\n");
  const encounteredIssues = KNOWN_ISSUES.filter((ki) => ki.regex.test(allLogsJoined));

  const isSuccessful = cmp.verdict === "VALID";

  return `# LAPORAN TUGAS PEMANTAPAN 1 (TP1) - BIG DATA
## Penyiapan dan Pemantauan Klaster Hadoop/Spark
**Institusi**: STMIK Pelita Nusantara
**Batas Pengumpulan**: ${DEADLINE}
${state.sampleMode ? "\n> ⚠️ **PERINGATAN: DOKUMEN INI DIBUAT DALAM MODE CONTOH (BUKAN BUKTI NYATA)**\n" : ""}

---

### 1. JUDUL & IDENTITAS ANGGOTA
- **Nama Berkas**: TP1_${safeNim}_${safeNama.replace(/\s+/g, "_")}.pdf
- **Daftar Anggota Kelompok**:
${state.members.map((m, idx) => `  ${idx + 1}. **${m.nama || "Nama Anggota"}** (NIM: \`${m.nim || "NIM"}\`) — Porsi: *${m.porsi}*`).join("\n")}

---

### 2. TUJUAN & MASALAH
1. Melakukan provisi klaster big data terdistribusi multi-kontainer (${ENV.containers.length} container) berbasis Docker Compose yang mengintegrasikan Apache Hadoop ${ENV.images.hadoop} dan Apache Spark ${ENV.images.spark}.
2. Menguji mekanisme replikasi blok HDFS (faktor replikasi = ${ENV.replication}) dengan dataset uji kata berjumlah tepat 1.500 baris.
3. Menjalankan komputasi WordCount paralel pada Hadoop MapReduce (dikelola YARN) dan Apache Spark (spark-submit pada Spark Standalone Cluster).
4. Memverifikasi bahwa agregasi frekuensi kata dari kedua engine menghasilkan angka yang sama persis (selisih 0).

---

### 3. LINGKUNGAN & TOOLS
- **Host**: ${ENV.host}
- **Image Hadoop**: \`${ENV.images.hadoop}\` (*${ENV.imageNote}*)
- **Image Spark**: \`${ENV.images.spark}\`
- **Replikasi HDFS**: ${ENV.replication}
- **Port Web UI**: NameNode (\`${ENV.ports.nnUI}\`), YARN RM (\`${ENV.ports.rmUI}\`), Spark Master (\`${ENV.ports.sparkMasterUI}\`), Spark Workers (\`${ENV.ports.sparkWorker1UI}, ${ENV.ports.sparkWorker2UI}\`), Spark App UI (\`${ENV.ports.sparkAppUI}\`)
- **Konfigurasi Spark**: Executor Memory: \`${ENV.spark.executorMemory}\`, Total Executor Cores: \`${ENV.spark.totalExecutorCores}\`, Worker Cores: \`${ENV.spark.workerCores}\`, Worker Memory: \`${ENV.spark.workerMemory}\`, Deploy Mode: \`${ENV.spark.deployMode}\`
- **Prasyarat Host**:
  - Alokasi RAM >= 6 GB: ${state.prerequisites.ramAllocated ? "Terpenuhi" : "Belum"}
  - WSL2 Integration: ${state.prerequisites.wsl2Ready ? "Terpenuhi" : "Belum"}
  - Port bebas: ${state.prerequisites.portsFree ? "Terpenuhi" : "Belum"}

---

### 4. LANGKAH-LANGKAH RUNBOOK (S01 - S15)
${STEPS_TEMPLATE.map((s) => {
  const st = state.steps[s.id] || { completed: false, notes: "" };
  return `#### [${s.id}] ${s.judul} (${s.evidenceId}) - ${st.completed ? "SELESAI" : "BELUM"}
- **Perintah**:
\`\`\`bash
${s.cmd.replace(/<NIM>/g, safeNim)}
\`\`\`
- **Expected**: ${s.expected}
- **Catatan Pelaksanaan**: ${st.notes || "(Tidak ada catatan khusus)"}
`;
}).join("\n")}

---

### 5. METADATA BUKTI PELAKSANAAN (E01 - E16)
${EVIDENCE_DEF.map((ev) => {
  const item = state.evidence[ev.id] || { filename: "", notes: "", timestamp: "" };
  return `- **[${ev.id}] ${ev.title}** (Langkah: ${ev.stepId})
  - File: \`${item.filename || "[Belum diisi]"}\`
  - Waktu Rekam: ${item.timestamp || "-"}
  - Keterangan: ${item.notes || "[Belum diisi]"}`;
}).join("\n\n")}

---

### 6. PEMANTAUAN, VALIDASI, KENDALA & SOLUSI
#### A. Ringkasan Status Metrik Klaster
- **NameNode & DataNode (dfsadmin)**: [${dfs.verdict}] ${dfs.details}
- **YARN Node Manager**: [${yn.verdict}] ${yn.details}
- **YARN Application**: [${ya.verdict}] ${ya.details}
- **HDFS File System Check (fsck)**: [${fsck.verdict}] ${fsck.details}
- **Hadoop MapReduce Log**: [${mr.verdict}] ${mr.details} | Durasi CPU map: ${mr.durationMs !== null ? `${mr.durationMs} ms (Informasi)` : "N/A"}
- **Spark Submit Log**: [${spLog.verdict}] ${spLog.details} | Durasi Job: ${spLog.durationSec !== null ? `${spLog.durationSec} s (Informasi)` : "N/A"}
- **Spark Master JSON**: [${spJson.verdict}] ${spJson.details}
- **Spark Exit Code**: [${spExit.verdict}] ${spExit.details}

#### B. Hasil Validasi WordCount (Dataset 1.500 Kata)
- **Status Akhir Validasi**: **${cmp.verdict}**
- **Kesesuaian Kunci (Kata Unik)**: ${cmp.isMatchKeys ? "PASS (5/5 kata identik)" : "FAIL"}
- **Kesesuaian Frekuensi Kata Acuan**: ${cmp.isMatchCounts ? "PASS" : "FAIL"}
- **Total Kata Tepat 1.500**: ${cmp.isTotalWords1500 ? `PASS (MR: ${cmp.mrTotalWords}, Spark: ${cmp.sparkTotalWords})` : `FAIL (MR: ${cmp.mrTotalWords}, Spark: ${cmp.sparkTotalWords})`}
- **Ekuivalensi Hasil MR vs Spark**: ${cmp.isMrEqualsSpark ? "PASS (100% identik)" : "FAIL"}

${cmp.differences.length > 0 ? `##### Daftar Selisih Komparasi:
${cmp.differences.map((d) => `- **${d.word}**: Acuan=${d.expected}, MR=${d.mr ?? "null"}, Spark=${d.spark ?? "null"} (${d.diffExplanation})`).join("\n")}` : "_Tidak ada selisih. Hasil komputasi MapReduce dan Spark cocok sempurna terhadap dataset acuan._"}

#### C. Kendala Terdeteksi & Solusi
${encounteredIssues.length > 0 ? encounteredIssues.map((ci) => `- **${ci.label}**: ${ci.solution}`).join("\n") : "- Tidak ada kendala sistem kritis yang terdeteksi dari log yang dimasukkan."}

---

### 7. KESIMPULAN
${isSuccessful
  ? `Berdasarkan serangkaian pengujian dari penyiapan klaster Docker Compose hingga eksekusi dua mesin pemrosesan data terdistribusi (Hadoop MapReduce dan Apache Spark), klaster dinyatakan **BERHASIL DIKONFIGURASI DAN DIAUTENTIKASI SECARA PENUH**. Replikasi HDFS berjalan stabil dengan status HEALTHY pada 2 DataNode hidup, serta job komputasi WordCount berhasil mengolah 1.500 kata dengan hasil yang 100% deterministik dan konsisten antara MapReduce dan Spark.`
  : `Pengujian klaster **BELUM DAPAT DINYATAKAN BERHASIL LENGKAP**. Validasi data atau metrik pemantauan masih menunjukkan ketidaksesuaian terhadap kriteria acuan. Periksa kembali log eksekusi, pastikan integritas blok HDFS, serta jalankan ulang komputasi hingga seluruh toleransi kesalahan terpenuhi.`}

---

### 8. AI & TOOL DISCLOSURE
${state.noAiUsage
  ? "_Pernyataan: Kelompok ini menyatakan TIDAK MENGGUNAKAN AI generatif dalam penyelesaian tugas ini._"
  : state.disclosureRows.length === 0
  ? "_Belum ada baris disclosure AI yang dicatat._"
  : `| Tool / AI | Tujuan Penggunaan | Bagian yang Diambil | Bagian yang Ditolak | Cara Verifikasi |
|---|---|---|---|---|
${state.disclosureRows.map((r) => `| ${r.tool} | ${r.tujuan} | ${r.diambil} | ${r.ditolak} | ${r.verifikasi} |`).join("\n")}`}
`;
}
