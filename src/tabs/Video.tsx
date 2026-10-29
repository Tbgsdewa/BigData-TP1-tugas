import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Video,
  Clock,
  User,
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Copy,
  Check,
  Award,
  FileText,
  Download,
  Terminal,
  Monitor,
  Volume2,
  Users,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Sliders,
  Radio,
  Tv,
} from "lucide-react";
import { VIDEO_SEGMENTS } from "../constants";
import { AppState } from "../types";

interface VideoProps {
  state: AppState;
  onChange: (updater: (prev: AppState) => AppState) => void;
}

// Convert "M:SS - M:SS" or "MM:SS - MM:SS" into [startSeconds, endSeconds]
function parseTimeRange(timeStr: string): [number, number] {
  const parts = timeStr.split("-").map((p) => p.trim());
  const parseSec = (s: string) => {
    const segments = s.split(":").map(Number);
    if (segments.length === 2) {
      return (segments[0] || 0) * 60 + (segments[1] || 0);
    }
    return 0;
  };
  return [parseSec(parts[0]), parseSec(parts[1])];
}

interface SegmentScriptDetail {
  id: string;
  title: string;
  durSec: number;
  timeRange: string;
  leadRole: string;
  onScreenVisuals: string[];
  cliCommands: string[];
  spokenScript: string;
  rubricFocus: string;
  uiTargetUrl?: string;
  uiTargetName?: string;
}

interface RehearsalTake {
  id: string;
  timestamp: string;
  durationSec: number;
  verdict: "PASS" | "WARN" | "PENALTY";
  notes: string;
}

export const VideoTab: React.FC<VideoProps> = ({ state, onChange }) => {
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeFilterId, setActiveFilterId] = useState<string>("ALL");
  const [takes, setTakes] = useState<RehearsalTake[]>(() => {
    const saved = localStorage.getItem("tp1_rehearsal_takes");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [
      {
        id: "take-init-1",
        timestamp: new Date(Date.now() - 3600000).toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        durationSec: 442, // 07:22
        verdict: "WARN",
        notes: "Uji coba awal: bagian MapReduce dan Spark sedikit berlarut-larut.",
      },
      {
        id: "take-init-2",
        timestamp: new Date(Date.now() - 1800000).toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        durationSec: 428, // 07:08
        verdict: "PASS",
        notes: "Pacing optimal: transisi lancar, seluruh Web UI terliput, durasi di bawah target 07:15.",
      },
    ];
  });
  const [takeNoteInput, setTakeNoteInput] = useState<string>("");

  const nimPlaceholder = state.members[0]?.nim || "24060122140123";
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Rehearsal timer tick with speed multiplier
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSec((prev) => prev + 1);
      }, Math.round(1000 / playbackSpeed));
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, playbackSpeed]);

  // Persist takes
  useEffect(() => {
    try {
      localStorage.setItem("tp1_rehearsal_takes", JSON.stringify(takes));
    } catch {
      // ignore
    }
  }, [takes]);

  const isDark = state.theme === "dark";

  const targetSec = 7 * 60 + 15; // 07:15 = 435s
  const maxSec = 8 * 60; // 08:00 = 480s

  const formatTime = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const timerStatus: "STANDBY" | "ON_TRACK" | "WARNING" | "OVERDUE" =
    elapsedSec === 0
      ? "STANDBY"
      : elapsedSec <= targetSec
      ? "ON_TRACK"
      : elapsedSec <= maxSec
      ? "WARNING"
      : "OVERDUE";

  // Segment Detailed Data enriched for production engineering walkthrough
  const segmentDetails: SegmentScriptDetail[] = useMemo(
    () => [
      {
        id: "S1",
        title: "Perkenalan, Identitas & Lingkungan Host",
        durSec: 45,
        timeRange: "0:00 - 0:45",
        leadRole: "Docker & HDFS",
        onScreenVisuals: [
          "Webcam seluruh anggota tim aktif di sudut layar",
          "Terminal Host: Menampilkan info WSL2 / Docker Engine (docker version)",
          "Diagram ringkas topologi 8 kontainer klaster Big Data",
        ],
        cliCommands: [
          "docker --version",
          "docker compose version",
          "wsl --status # (atau free -h di Linux/WSL)",
        ],
        spokenScript: `Selamat pagi/siang Bapak/Ibu dosen dan asisten praktikum. Kami dari kelompok praktikum mempresentasikan implementasi klaster Big Data Apache Hadoop dan Apache Spark terintegrasi pada lingkungan Docker. Anggota tim kami: ${
          state.members
            .map((m, i) => `${m.nama || `Mahasiswa ${i + 1}`} (${m.nim || "NIM"}) selaku penanggung jawab ${m.porsi}`)
            .join(", ")
        }. Arsitektur klaster kami terdiri dari 8 kontainer terisolasi: 1 NameNode, 2 DataNode, 1 YARN ResourceManager, 1 NodeManager, 1 Spark Master, dan 2 Spark Worker. Seluruh kontainer dialokasikan pada bridge network khusus dengan batas sumber daya host 8 GB RAM dan 4 vCPU.`,
        rubricFocus: "Identitas lengkap anggota, kejelasan alokasi peran, arsitektur 8 kontainer.",
      },
      {
        id: "S2",
        title: "Orkestrasasi Docker Compose & Status Kontainer",
        durSec: 60,
        timeRange: "0:45 - 1:45",
        leadRole: "Docker & HDFS",
        onScreenVisuals: [
          "Editor kode (VS Code): Menyoroti file docker-compose.yml dan config",
          "Terminal: Eksekusi docker compose up -d secara real-time",
          "Terminal: Eksekusi docker ps menampilkan seluruh 8 kontainer Up",
        ],
        cliCommands: [
          "docker compose up -d",
          'docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"',
        ],
        spokenScript: `Pada tahap penyiapan, kami mengeksekusi 'docker compose up -d'. Layanan diorkestrasi secara berurutan dengan konfigurasi environment terpadu dari file config. Perhatikan keluaran perintah 'docker ps': seluruh 8 kontainer saat ini berstatus 'Up' tanpa adanya restart loop. Port binding kunci mencakup port 9870 untuk Web UI NameNode, port 8088 untuk YARN ResourceManager, port 8080 untuk Spark Master, serta port IPC 8020 dan 7077 telah terikat secara tepat ke host lokal.`,
        rubricFocus: "8 kontainer Up tanpa crashloop, port binding tepat, bukan terminal mock.",
      },
      {
        id: "S3",
        title: "Verifikasi Integritas HDFS, Replikasi & Dataset Uji",
        durSec: 75,
        timeRange: "1:45 - 3:00",
        leadRole: "Docker & HDFS",
        onScreenVisuals: [
          "Terminal: hdfs dfsadmin -safemode get (Safe mode is OFF)",
          "Terminal: hdfs dfsadmin -report (2 Live DataNodes aktif)",
          "Terminal: wc -l /tmp/words.txt (Dataset tepat 1.500 baris)",
          "Terminal: hdfs fsck /user/<NIM>/input/words.txt (Status HEALTHY, replikasi 2)",
          "Browser Chrome: Web UI NameNode http://localhost:9870 tab Datanodes",
        ],
        cliCommands: [
          "docker exec namenode hdfs dfsadmin -safemode get",
          "docker exec namenode hdfs dfsadmin -report",
          `docker exec namenode hdfs dfs -mkdir -p /user/${nimPlaceholder}/input`,
          `docker exec namenode hdfs fsck /user/${nimPlaceholder}/input/words.txt -files -blocks -locations`,
        ],
        spokenScript: `Memasuki pengujian HDFS, kami memastikan Safe Mode NameNode telah berada pada kondisi 'OFF'. Selanjutnya, perintah 'hdfs dfsadmin -report' membuktikan klaster memiliki 2 Live DataNodes yang terhubung secara sinkron. Kami membuat direktori kerja HDFS '/user/${nimPlaceholder}/input' dan mengunggah dataset acuan 'words.txt' berukuran tepat 1.500 baris. Melalui eksekusi 'hdfs fsck', sistem mengonfirmasi status file adalah HEALTHY dengan rata-rata replikasi blok tepat 2.0. Kami juga menunjukkan Web UI NameNode pada port 9870 yang mengonfirmasi direktori dan kedua DataNode aktif.`,
        rubricFocus: "Safe mode OFF, 2 Live DataNodes, FSCK HEALTHY replikasi 2, dataset 1.500 baris, Web UI 9870.",
        uiTargetUrl: "http://localhost:9870",
        uiTargetName: "NameNode Web UI (Port 9870)",
      },
      {
        id: "S4",
        title: "Eksekusi Hadoop MapReduce & Monitoring YARN",
        durSec: 75,
        timeRange: "3:00 - 4:15",
        leadRole: "MapReduce & YARN",
        onScreenVisuals: [
          "Terminal: Eksekusi hadoop jar hadoop-mapreduce-examples-3.3.6.jar wordcount",
          "Terminal: Output map % dan reduce % bergerak hingga 'completed successfully'",
          "Browser Chrome: Web UI YARN http://localhost:8088 menampilkan aplikasi SUCCEEDED",
          "Terminal: hdfs dfs -cat /user/<NIM>/out_mr/part-r-00000 menampilkan 5 kata acuan",
        ],
        cliCommands: [
          `docker exec namenode hadoop jar /opt/hadoop/share/hadoop/mapreduce/hadoop-mapreduce-examples-3.3.6.jar wordcount /user/${nimPlaceholder}/input /user/${nimPlaceholder}/out_mr`,
          `docker exec namenode hdfs dfs -cat /user/${nimPlaceholder}/out_mr/part-r-00000`,
          "docker exec resourcemanager yarn application -list -appStates ALL",
        ],
        spokenScript: `Selanjutnya kami mengeksekusi komputasi MapReduce bawaan Hadoop dengan argumen direktori input dan output '/user/${nimPlaceholder}/out_mr'. Proses pemetaan (Map) dan agregasi (Reduce) diatur oleh YARN ResourceManager. Pada Web UI YARN port 8088, terlihat Application ID dialokasikan ke NodeManager dan bertransisi dari RUNNING menjadi FINISHED dengan FinalStatus SUCCEEDED. Hasil reduksi pada file 'part-r-00000' menampilkan agregasi 5 kata acuan dengan format kata<TAB>frekuensi tanpa ada baris data yang cacat.`,
        rubricFocus: "Log MapReduce sukses, YARN UI 8088 terbukti SUCCEEDED, output part-r-00000 5 kata acuan.",
        uiTargetUrl: "http://localhost:8088",
        uiTargetName: "YARN ResourceManager (Port 8088)",
      },
      {
        id: "S5",
        title: "Eksekusi Apache Spark Standalone (wc.py)",
        durSec: 90,
        timeRange: "4:15 - 5:45",
        leadRole: "Spark & submit",
        onScreenVisuals: [
          "Editor kode: Memperlihatkan skrip PySpark wc.py (SparkSession, flatMap, map, reduceByKey, coalesce(1))",
          "Terminal: Eksekusi spark-submit dengan flag --executor-memory 512m dan --total-executor-cores 2",
          "Terminal: Pengecekan exit code bernilai 0 ($LASTEXITCODE / echo $?)",
          "Browser Chrome: Web UI Spark Master http://localhost:8080 menampilkan Completed Applications",
          "Terminal: hdfs dfs -cat /user/<NIM>/out_spark/part-00000",
        ],
        cliCommands: [
          `docker exec spark-master /opt/spark/bin/spark-submit --master spark://spark-master:7077 --deploy-mode client --executor-memory 512m --total-executor-cores 2 /opt/app/wc.py hdfs://namenode:8020/user/${nimPlaceholder}/input/words.txt hdfs://namenode:8020/user/${nimPlaceholder}/out_spark`,
          "echo $? # (PowerShell: $LASTEXITCODE)",
          `docker exec namenode hdfs dfs -cat /user/${nimPlaceholder}/out_spark/part-00000`,
        ],
        spokenScript: `Sekarang beralih ke komputasi Apache Spark Standalone. Skrip 'wc.py' membaca file langsung dari HDFS melalui protokol RPC 'hdfs://namenode:8020'. Kami mengirimkan tugas komputasi menggunakan 'spark-submit' dengan flag spesifik: master 'spark://spark-master:7077', executor memory dibatasi '512m', serta 2 total executor cores. Proses eksekusi selesai dengan exit code 0. Di Web UI Spark Master port 8080, aplikasi 'TP1-WordCount' tercatat berstatus FINISHED. File output 'part-00000' berhasil dibuat di HDFS out_spark dengan struktur agregasi RDD in-memory yang sangat cepat.`,
        rubricFocus: "Flag memori 512m & core 2 dijelaskan lisan, exit code 0, Web UI Spark 8080, part-00000 terbentuk.",
        uiTargetUrl: "http://localhost:8080",
        uiTargetName: "Spark Master Web UI (Port 8080)",
      },
      {
        id: "S6",
        title: "Komparasi, Validasi Paritas Output & Analisis Kinerja",
        durSec: 60,
        timeRange: "5:45 - 6:45",
        leadRole: "Validasi & laporan",
        onScreenVisuals: [
          "Terminal: Perbandingan side-by-side keluaran MapReduce vs Spark",
          "Aplikasi / Spreadsheet: Tabel paritas 5 kata acuan dengan selisih 0",
          "Grafik / Metrik: Perbandingan waktu komputasi disk-based MapReduce vs in-memory Spark",
        ],
        cliCommands: [
          `docker exec namenode hdfs dfs -cat /user/${nimPlaceholder}/out_mr/part-r-00000`,
          `docker exec namenode hdfs dfs -cat /user/${nimPlaceholder}/out_spark/part-00000`,
        ],
        spokenScript: `Pada tahap validasi komparatif, kami membuktikan paritas absolut antara Hadoop MapReduce dan Apache Spark. Untuk kelima kata acuan: kata pertama, kedua, hingga kelima, frekuensi kemunculan keduanya identik persis dengan selisih 0. Akumulasi total kata adalah tepat 1.500 kata sesuai ukuran dataset input. Dari aspek performa, Apache Spark menyelesaikan tugas secara signifikan lebih cepat berkat manipulasi RDD dalam memori (in-memory) tanpa overhead penulisan berkas perantara ke disk lokal pada tahap shuffle seperti halnya MapReduce konvensional.`,
        rubricFocus: "100% data parity, selisih 0, total 1.500 kata exact, analisis trade-off komputasi.",
      },
      {
        id: "S7",
        title: "Kesimpulan, Transparansi AI & Penutup",
        durSec: 30,
        timeRange: "6:45 - 7:15",
        leadRole: "Validasi & laporan",
        onScreenVisuals: [
          "Kamera presenter seluruh anggota tim",
          "Tangkapan layar formulir AI Disclosure / Rekapitulasi Berkas LMS",
          "Timer rekaman OBS menunjukkan durasi di bawah batas 07:15 (maksimal 08:00)",
        ],
        cliCommands: [],
        spokenScript: `Sebagai kesimpulan, implementasi klaster hibrida Hadoop dan Spark berhasil dibangun dan berfungsi 100% tanpa anomali. Terkait integritas akademik, kami mendeklarasikan penggunaan asisten AI sebatas penelusuran sintaksis dan template skrip yang seluruhnya telah kami uji dan verifikasi keabsahannya secara langsung pada klaster terminal nyata. Durasi video ini berada dalam koridor waktu yang ditentukan di bawah 07:15. Terima kasih atas perhatian Bapak/Ibu dosen dan asisten praktikum.`,
        rubricFocus: "Refleksi teknis, transparansi AI jujur, durasi tepat <= 07:15 (maks 08:00).",
      },
    ],
    [state.members, nimPlaceholder]
  );

  // Active segment detection based on elapsed timer
  const currentSegmentIndex = useMemo(() => {
    let acc = 0;
    for (let i = 0; i < segmentDetails.length; i++) {
      const seg = segmentDetails[i];
      if (elapsedSec >= acc && elapsedSec < acc + seg.durSec) {
        return i;
      }
      acc += seg.durSec;
    }
    return elapsedSec >= targetSec ? segmentDetails.length - 1 : 0;
  }, [elapsedSec, segmentDetails, targetSec]);

  const activeSegment = segmentDetails[currentSegmentIndex];

  // Active segment remaining seconds
  const activeSegmentTiming = useMemo(() => {
    let start = 0;
    for (let i = 0; i < currentSegmentIndex; i++) {
      start += segmentDetails[i].durSec;
    }
    const end = start + activeSegment.durSec;
    const segElapsed = Math.max(0, elapsedSec - start);
    const segRemaining = Math.max(0, end - elapsedSec);
    const isOverSegment = elapsedSec > end;
    return { start, end, segElapsed, segRemaining, isOverSegment };
  }, [currentSegmentIndex, elapsedSec, activeSegment, segmentDetails]);

  // Jump to specific segment
  const handleJumpToSegment = (segId: string) => {
    let start = 0;
    for (const seg of segmentDetails) {
      if (seg.id === segId) {
        setElapsedSec(start);
        break;
      }
      start += seg.durSec;
    }
  };

  const handleAssignMember = (segId: string, memberId: string) => {
    onChange((prev) => ({
      ...prev,
      videoAssignments: {
        ...prev.videoAssignments,
        [segId]: memberId,
      },
    }));
  };

  const handleToggleChecklist = (field: keyof typeof state.videoChecklist) => {
    onChange((prev) => ({
      ...prev,
      videoChecklist: {
        ...prev.videoChecklist,
        [field]: !prev.videoChecklist[field],
      },
    }));
  };

  // Auto-distribute segments evenly across members
  const handleAutoDistribute = () => {
    if (state.members.length === 0) return;
    const newAssignments: Record<string, string> = {};
    segmentDetails.forEach((seg, idx) => {
      const member = state.members[idx % state.members.length];
      newAssignments[seg.id] = member.id;
    });
    onChange((prev) => ({
      ...prev,
      videoAssignments: newAssignments,
    }));
  };

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  // Record Take
  const handleRecordTake = () => {
    const verdict =
      elapsedSec <= targetSec ? "PASS" : elapsedSec <= maxSec ? "WARN" : "PENALTY";
    const newTake: RehearsalTake = {
      id: `take-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      durationSec: elapsedSec,
      verdict,
      notes:
        takeNoteInput.trim() ||
        (verdict === "PASS"
          ? "Target 07:15 tercapai."
          : verdict === "WARN"
          ? "Dalam rentang batas maksimal 08:00."
          : "Melebihi batas maksimal 08:00 (potensi penalti nilai)."),
    };
    setTakes((prev) => [newTake, ...prev]);
    setTakeNoteInput("");
  };

  const handleDeleteTake = (id: string) => {
    setTakes((prev) => prev.filter((t) => t.id !== id));
  };

  // Workload equity statistics
  const workloadStats = useMemo(() => {
    return state.members.map((member) => {
      const assignedSegs = segmentDetails.filter(
        (seg) => state.videoAssignments[seg.id] === member.id
      );
      const totalSec = assignedSegs.reduce((acc, curr) => acc + curr.durSec, 0);
      const percentage = Math.round((totalSec / targetSec) * 100);
      return {
        member,
        assignedCount: assignedSegs.length,
        totalSec,
        percentage,
      };
    });
  }, [state.members, segmentDetails, state.videoAssignments, targetSec]);

  // Generate full markdown script for export
  const fullScriptMarkdown = useMemo(() => {
    const lines: string[] = [];
    lines.push("# RUNDOWN & NASKAH LENGKAP VIDEO WALKTHROUGH (7 SEGMEN)");
    lines.push(`**Target Durasi:** 07:15 (435 detik) | **Batas Maksimal LMS:** 08:00 (480 detik)`);
    lines.push(`**Kelompok Mahasiswa:**`);
    state.members.forEach((m, i) => {
      lines.push(`- ${i + 1}. ${m.nama || "Tanpa Nama"} (${m.nim || "NIM"}) - ${m.porsi}`);
    });
    lines.push("\n---\n");

    segmentDetails.forEach((seg) => {
      const assignedMember = state.members.find(
        (m) => m.id === state.videoAssignments[seg.id]
      );
      lines.push(`## [${seg.id}] ${seg.title}`);
      lines.push(`- **Alokasi Waktu:** ${seg.timeRange} (${seg.durSec} detik)`);
      lines.push(
        `- **Pembicara Bertugas:** ${
          assignedMember ? `${assignedMember.nama} (${assignedMember.nim})` : "Belum ditentukan"
        }`
      );
      lines.push(`- **Fokus Rubrik:** ${seg.rubricFocus}`);
      lines.push(`- **Aksi Visual Layar:**`);
      seg.onScreenVisuals.forEach((v) => lines.push(`  * ${v}`));
      if (seg.cliCommands.length > 0) {
        lines.push(`- **Perintah Terminal:**`);
        seg.cliCommands.forEach((c) => lines.push(`  \`\`\`bash\n  ${c}\n  \`\`\``));
      }
      lines.push(`- **Naskah Teleprompter (Lisan):**`);
      lines.push(`> "${seg.spokenScript}"`);
      lines.push("\n");
    });

    lines.push("## CHECKLIST KEPATUHAN PRODUKSI");
    lines.push(`- [${state.videoChecklist.terminalReal ? "x" : " "}] Terminal Nyata (Bukan mock/animasi)`);
    lines.push(
      `- [${state.videoChecklist.bukanSlideSaja ? "x" : " "}] Bukan Hanya Slide (Menampilkan Web UI 9870, 8088, 8080)`
    );
    lines.push(
      `- [${state.videoChecklist.tiapAnggotaTampil ? "x" : " "}] Seluruh Anggota Berbicara & Tampil`
    );
    lines.push(
      `- [${state.videoChecklist.tanpaKredensial ? "x" : " "}] Bebas Kredensial & Token Rahasia`
    );

    return lines.join("\n");
  }, [segmentDetails, state.members, state.videoAssignments, state.videoChecklist, targetSec]);

  // Filtered segments
  const displayedSegments = useMemo(() => {
    if (activeFilterId === "ALL") return segmentDetails;
    return segmentDetails.filter((s) => s.id === activeFilterId);
  }, [segmentDetails, activeFilterId]);

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <section
        className={`border rounded-lg p-5 transition-colors ${
          isDark ? "bg-[#0d1322] border-slate-800" : "bg-white border-slate-200"
        }`}
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-800 uppercase tracking-wider">
                Bagian 7
              </span>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Video className="w-5 h-5 text-indigo-400" />
                Latihan & Orkestrasasi Video Walkthrough Klaster
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Panduan produksi video akademik 7 segmen dengan simulasi timer teleprompter,
              alokasi beban bicara anggota kelompok, dan naskah teknis terverifikasi rubrik.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleCopy(fullScriptMarkdown, "full-script")}
              className="px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-mono font-medium flex items-center gap-1.5 transition-colors"
              title="Salin seluruh naskah dan rundown untuk prompter OBS"
            >
              {copiedKey === "full-script" ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Naskah Disalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Salin Naskah Lengkap</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                const blob = new Blob([fullScriptMarkdown], { type: "text/markdown;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `Rundown_Video_Walkthrough_${nimPlaceholder}.md`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="px-3 py-1.5 rounded bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-700/60 text-xs font-mono font-medium flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>Unduh .MD</span>
            </button>
          </div>
        </div>

        {/* Technical Constraints Overview */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded bg-slate-950/70 border border-slate-800/70">
            <span className="text-[10px] font-mono text-slate-500 uppercase block">Target Waktu</span>
            <span className="text-sm font-bold font-mono text-emerald-400 tabular-nums">07:15</span>
            <span className="text-[10px] text-slate-400 block">435 detik ideal</span>
          </div>

          <div className="p-2.5 rounded bg-slate-950/70 border border-slate-800/70">
            <span className="text-[10px] font-mono text-slate-500 uppercase block">Batas Maksimal</span>
            <span className="text-sm font-bold font-mono text-amber-400 tabular-nums">08:00</span>
            <span className="text-[10px] text-slate-400 block">&gt;08:00 penalti LMS</span>
          </div>

          <div className="p-2.5 rounded bg-slate-950/70 border border-slate-800/70">
            <span className="text-[10px] font-mono text-slate-500 uppercase block">Jumlah Segmen</span>
            <span className="text-sm font-bold font-mono text-indigo-300">7 Segmen</span>
            <span className="text-[10px] text-slate-400 block">Wajib urut & runtut</span>
          </div>

          <div className="p-2.5 rounded bg-slate-950/70 border border-slate-800/70">
            <span className="text-[10px] font-mono text-slate-500 uppercase block">Kamera & Suara</span>
            <span className="text-sm font-bold font-mono text-cyan-400">Semua Anggota</span>
            <span className="text-[10px] text-slate-400 block">Wajib berbicara lisan</span>
          </div>
        </div>
      </section>

      {/* Interactive Rehearsal Studio & Teleprompter Pacer */}
      <section
        className={`border rounded-lg p-5 transition-colors relative overflow-hidden ${
          isDark ? "bg-[#0b101c] border-slate-800" : "bg-white border-slate-200"
        }`}
      >
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400">
                Pacer Studio & Rehearsal Clock
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-3">
              <span
                className={`text-4xl font-mono font-bold tracking-tight tabular-nums ${
                  timerStatus === "OVERDUE"
                    ? "text-rose-400"
                    : timerStatus === "WARNING"
                    ? "text-amber-400"
                    : "text-white"
                }`}
              >
                {formatTime(elapsedSec)}
              </span>

              <div className="text-xs font-mono text-slate-400">
                <span>/ Target 07:15</span>
                <span className="text-slate-600 mx-1.5">|</span>
                <span className="text-amber-500">Max 08:00</span>
              </div>

              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                  timerStatus === "STANDBY"
                    ? "bg-slate-900 text-slate-400 border-slate-800"
                    : timerStatus === "ON_TRACK"
                    ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                    : timerStatus === "WARNING"
                    ? "bg-amber-950 text-amber-300 border-amber-800"
                    : "bg-rose-950 text-rose-300 border-rose-800 animate-pulse"
                }`}
              >
                {timerStatus === "STANDBY" && "Standby / Siap Latihan"}
                {timerStatus === "ON_TRACK" && "Dalam Target (Aman)"}
                {timerStatus === "WARNING" && "Zona Peringatan (07:15 - 08:00)"}
                {timerStatus === "OVERDUE" && "Melebihi Batas LMS (Penalti Nilai)"}
              </span>
            </div>
          </div>

          {/* Controls toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Speed selection */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded p-0.5 text-xs font-mono">
              <span className="text-[10px] text-slate-500 px-2 flex items-center gap-1">
                <Sliders className="w-3 h-3" /> Kecepatan:
              </span>
              {[1, 1.25, 1.5].map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                    playbackSpeed === spd
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Play/Pause */}
            {!isRunning ? (
              <button
                type="button"
                onClick={() => setIsRunning(true)}
                className="px-3.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Mulai Rehearsal</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsRunning(false)}
                className="px-3.5 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Jeda Pacer</span>
              </button>
            )}

            {/* Reset */}
            <button
              type="button"
              onClick={() => {
                setIsRunning(false);
                setElapsedSec(0);
              }}
              className="px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            {/* Simpan Take */}
            <button
              type="button"
              onClick={handleRecordTake}
              disabled={elapsedSec === 0}
              className={`px-3 py-1.5 rounded text-xs font-mono font-medium flex items-center gap-1.5 transition-colors ${
                elapsedSec > 0
                  ? "bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800"
                  : "bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed"
              }`}
            >
              <Tv className="w-3.5 h-3.5 text-emerald-400" />
              <span>Catat Take ({formatTime(elapsedSec)})</span>
            </button>
          </div>
        </div>

        {/* Global Progress Bar with Segments Division */}
        <div className="mt-4 space-y-2">
          <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-800 relative flex">
            {/* Visual breakdown per segment proportional */}
            {segmentDetails.map((seg, idx) => {
              const segPct = (seg.durSec / maxSec) * 100;
              const isPast = activeSegmentTiming.end > seg.durSec; // rough
              return (
                <div
                  key={seg.id}
                  style={{ width: `${segPct}%` }}
                  className={`h-full border-r border-slate-950 text-[9px] font-mono text-center flex items-center justify-center transition-colors ${
                    idx === currentSegmentIndex
                      ? "bg-indigo-600 text-white font-bold"
                      : idx < currentSegmentIndex
                      ? "bg-indigo-950/80 text-indigo-400/60"
                      : "bg-slate-900/60 text-slate-600"
                  }`}
                  title={`${seg.id}: ${seg.title} (${seg.timeRange})`}
                >
                  <span className="hidden sm:inline">{seg.id}</span>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
            <span>00:00 (Mulai)</span>
            <span className="text-indigo-400">
              Segmen Aktif: <strong>{activeSegment.id}</strong> ({formatTime(activeSegmentTiming.segElapsed)} / {activeSegment.durSec}s)
            </span>
            <span className="text-emerald-400">07:15 (Target Ideal)</span>
            <span className="text-amber-400">08:00 (Maksimal LMS)</span>
          </div>
        </div>

        {/* Active Teleprompter Focus Box */}
        <div className="mt-5 p-4 rounded-lg bg-slate-950 border border-indigo-900/70 shadow-md">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-slate-800/70">
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-mono text-xs font-bold shadow-sm">
                {activeSegment.id}
              </span>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">
                  {activeSegment.title}
                </h3>
                <span className="text-xs font-mono text-indigo-300">
                  Target Alokasi: {activeSegment.timeRange} ({activeSegment.durSec} detik)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-mono block">Pembicara Bertugas:</span>
                <span className="text-xs font-bold text-emerald-300 font-mono">
                  {state.members.find((m) => m.id === state.videoAssignments[activeSegment.id])?.nama ||
                    "(Belum dialokasikan)"}
                </span>
              </div>

              {activeSegment.uiTargetUrl && (
                <a
                  href={activeSegment.uiTargetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-700 text-xs font-mono flex items-center gap-1 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Buka {activeSegment.uiTargetName?.split(" ")[0]}</span>
                </a>
              )}
            </div>
          </div>

          {/* Teleprompter Live Script */}
          <div className="mt-3.5 space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-mono uppercase font-bold text-slate-400 flex items-center gap-1">
                  <Volume2 className="w-3 h-3 text-indigo-400" />
                  Naskah Lisan Presenter (Baca dengan tempo artikulatif & percaya diri):
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(activeSegment.spokenScript, `prompter-${activeSegment.id}`)}
                  className="text-[11px] font-mono text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                >
                  {copiedKey === `prompter-${activeSegment.id}` ? (
                    <span className="text-emerald-400 font-semibold">Tersalin!</span>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Salin Naskah Segmen</span>
                    </>
                  )}
                </button>
              </div>
              <blockquote className="p-3.5 rounded bg-[#070b14] border border-slate-800 text-xs md:text-sm text-slate-200 leading-relaxed font-sans italic">
                "{activeSegment.spokenScript}"
              </blockquote>
            </div>

            {/* Quick Terminal Command & Visual Directives */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800/80 text-xs">
                <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold block mb-1 flex items-center gap-1">
                  <Monitor className="w-3 h-3" /> Panduan Visual Layar (OBS Studio):
                </span>
                <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                  {activeSegment.onScreenVisuals.map((vis, vIdx) => (
                    <li key={vIdx} className="leading-tight">
                      {vis}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800/80 text-xs">
                <span className="text-[10px] font-mono text-indigo-400 uppercase font-bold block mb-1 flex items-center gap-1">
                  <Terminal className="w-3 h-3" /> Perintah Terminal Segmen Ini:
                </span>
                {activeSegment.cliCommands.length > 0 ? (
                  <div className="space-y-1.5 font-mono text-[11px]">
                    {activeSegment.cliCommands.map((cmd, cIdx) => (
                      <div
                        key={cIdx}
                        className="flex items-center justify-between bg-black/60 px-2 py-1 rounded border border-slate-800"
                      >
                        <code className="text-amber-300 truncate max-w-[280px] sm:max-w-[340px]">
                          {cmd}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopy(cmd, `cmd-${activeSegment.id}-${cIdx}`)}
                          className="text-slate-400 hover:text-white p-0.5 ml-1 transition-colors"
                          title="Salin perintah"
                        >
                          {copiedKey === `cmd-${activeSegment.id}-${cIdx}` ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic mt-2">
                    (Tidak ada perintah CLI baru pada segmen ini; fokus visual pada webcam & form akreditasi).
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Production Compliance Checklist (LMS Rubric Gate) */}
      <section
        className={`border rounded-lg p-5 transition-colors ${
          isDark ? "bg-[#0d1322] border-slate-800" : "bg-white border-slate-200"
        }`}
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
          <h3 className="text-xs font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Checklist Standar Mutu Rekaman (Pemeriksaan Wajib Sebelum Unggah)</span>
          </h3>
          <span className="text-[11px] font-mono text-slate-400">
            Status:{" "}
            {Object.values(state.videoChecklist).filter(Boolean).length === 4 ? (
              <strong className="text-emerald-400">100% SIAP REKAM</strong>
            ) : (
              <strong className="text-amber-400">
                {Object.values(state.videoChecklist).filter(Boolean).length} / 4 Lulus
              </strong>
            )}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <label className="flex items-start gap-2.5 p-3 rounded border border-slate-800 bg-slate-950/60 cursor-pointer hover:border-slate-700 transition-colors">
            <input
              type="checkbox"
              checked={state.videoChecklist.terminalReal}
              onChange={() => handleToggleChecklist("terminalReal")}
              className="mt-0.5 w-4 h-4 text-indigo-600 rounded bg-slate-900 border-slate-700"
            />
            <div>
              <span className="font-semibold text-slate-200 block">Terminal Nyata (Bukan Mock)</span>
              <span className="text-[11px] text-slate-400 mt-0.5 block leading-tight">
                Rekam eksekusi CLI asli di terminal WSL2/PowerShell, bukan tayangan slide animasi atau rekaan log.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-2.5 p-3 rounded border border-slate-800 bg-slate-950/60 cursor-pointer hover:border-slate-700 transition-colors">
            <input
              type="checkbox"
              checked={state.videoChecklist.bukanSlideSaja}
              onChange={() => handleToggleChecklist("bukanSlideSaja")}
              className="mt-0.5 w-4 h-4 text-indigo-600 rounded bg-slate-900 border-slate-700"
            />
            <div>
              <span className="font-semibold text-slate-200 block">Tampilkan Browser Web UI</span>
              <span className="text-[11px] text-slate-400 mt-0.5 block leading-tight">
                Buka tab browser nyata untuk NameNode (9870), YARN RM (8088), dan Spark Master (8080).
              </span>
            </div>
          </label>

          <label className="flex items-start gap-2.5 p-3 rounded border border-slate-800 bg-slate-950/60 cursor-pointer hover:border-slate-700 transition-colors">
            <input
              type="checkbox"
              checked={state.videoChecklist.tiapAnggotaTampil}
              onChange={() => handleToggleChecklist("tiapAnggotaTampil")}
              className="mt-0.5 w-4 h-4 text-indigo-600 rounded bg-slate-900 border-slate-700"
            />
            <div>
              <span className="font-semibold text-slate-200 block">Seluruh Anggota Berbicara</span>
              <span className="text-[11px] text-slate-400 mt-0.5 block leading-tight">
                Setiap anggota kelompok memaparkan bagian masing-masing secara bergiliran dengan suara jernih.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-2.5 p-3 rounded border border-slate-800 bg-slate-950/60 cursor-pointer hover:border-slate-700 transition-colors">
            <input
              type="checkbox"
              checked={state.videoChecklist.tanpaKredensial}
              onChange={() => handleToggleChecklist("tanpaKredensial")}
              className="mt-0.5 w-4 h-4 text-indigo-600 rounded bg-slate-900 border-slate-700"
            />
            <div>
              <span className="font-semibold text-slate-200 block">Bebas Kredensial Pribadi</span>
              <span className="text-[11px] text-slate-400 mt-0.5 block leading-tight">
                Layar bersih dari password, token API rahasia, path sensitif, atau file pribadi di terminal.
              </span>
            </div>
          </label>
        </div>
      </section>

      {/* Workload Distribution & Speaker Equity */}
      <section
        className={`border rounded-lg p-5 transition-colors ${
          isDark ? "bg-[#0d1322] border-slate-800" : "bg-white border-slate-200"
        }`}
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Keseimbangan Beban Bicara Anggota Kelompok (Speaker Equity Tracker)</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Rubrik penilaian mewajibkan seluruh anggota berkontribusi secara lisan dengan porsi yang proporsional.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAutoDistribute}
            className="px-3 py-1.5 rounded bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800 text-xs font-mono font-medium flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
            <span>Alokasikan Otomatis Merata</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {workloadStats.map(({ member, assignedCount, totalSec, percentage }) => (
            <div
              key={member.id}
              className={`p-3 rounded border ${
                assignedCount === 0
                  ? "bg-rose-950/20 border-rose-900/60"
                  : isDark
                  ? "bg-slate-950/70 border-slate-800"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-semibold text-white block">
                    {member.nama || "Tanpa Nama"}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 block">
                    NIM: {member.nim || "-"}
                  </span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-indigo-300">
                  {member.porsi}
                </span>
              </div>

              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-slate-400">{assignedCount} Segmen</span>
                  <span className="font-bold text-white">
                    {formatTime(totalSec)} ({percentage}%)
                  </span>
                </div>
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full ${
                      assignedCount === 0
                        ? "bg-rose-500"
                        : percentage < 15
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(100, percentage)}%` }}
                  />
                </div>
              </div>

              {assignedCount === 0 && (
                <div className="mt-2 text-[10px] text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>Peringatan: Belum mendapat jatah segmen!</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 7 Segments Detailed Rundown & Cue Sheets */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Rundown & Kartu Panduan 7 Segmen Video
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              (Total durasi: 07:15)
            </span>
          </div>

          {/* Quick Segment Filter Pill Bar */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800 text-xs font-mono">
            <button
              type="button"
              onClick={() => setActiveFilterId("ALL")}
              className={`px-2 py-0.5 rounded text-[11px] ${
                activeFilterId === "ALL"
                  ? "bg-indigo-600 text-white font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Semua (7)
            </button>
            {segmentDetails.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveFilterId(s.id)}
                className={`px-2 py-0.5 rounded text-[11px] ${
                  activeFilterId === s.id
                    ? "bg-indigo-600 text-white font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {s.id}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {displayedSegments.map((seg) => {
            const assignedMemberId = state.videoAssignments[seg.id] || "";
            const [start, end] = parseTimeRange(seg.timeRange);
            const isCurrentlyActive = elapsedSec >= start && elapsedSec < end;
            const assignedMember = state.members.find((m) => m.id === assignedMemberId);

            return (
              <div
                key={seg.id}
                className={`border rounded-lg p-4 transition-colors ${
                  isCurrentlyActive
                    ? "bg-indigo-950/30 border-indigo-500 shadow-md ring-1 ring-indigo-500/30"
                    : isDark
                    ? "bg-[#0d1322] border-slate-800/90 hover:border-slate-700"
                    : "bg-white border-slate-200"
                }`}
              >
                {/* Header Card */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-slate-800/60">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${
                        isCurrentlyActive
                          ? "bg-indigo-600 text-white border-indigo-400"
                          : "text-indigo-400 bg-indigo-950/60 border-indigo-800/60"
                      }`}
                    >
                      {seg.id}
                    </span>

                    <h4 className="text-xs font-bold text-white tracking-tight">
                      {seg.title}
                    </h4>

                    <span className="font-mono text-[11px] text-cyan-400 tabular-nums">
                      {seg.timeRange} ({seg.durSec} detik)
                    </span>

                    {isCurrentlyActive && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 animate-pulse">
                        SEDANG BERLANGSUNG
                      </span>
                    )}
                  </div>

                  {/* Actions & Member Dropdown */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleJumpToSegment(seg.id)}
                      className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[11px] font-mono text-slate-300 border border-slate-800 flex items-center gap-1 transition-colors"
                      title="Set timer pacer ke awal segmen ini"
                    >
                      <RotateCcw className="w-3 h-3 text-indigo-400" />
                      <span>Lompat ke {seg.id}</span>
                    </button>

                    <div className="flex items-center gap-1.5 text-xs">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <select
                        value={assignedMemberId}
                        onChange={(e) => handleAssignMember(seg.id, e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                      >
                        <option value="">-- Pilih Mahasiswa --</option>
                        {state.members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nama || m.nim ? `${m.nama || "Tanpa Nama"} (${m.nim || "NIM"})` : m.porsi}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Body Content: Script + Directives + Rubric */}
                <div className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
                  {/* Left: Script Teleprompter (8 cols) */}
                  <div className="lg:col-span-8 space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 uppercase">
                      <span className="font-semibold text-slate-300">Naskah Pembicara Lisan:</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(seg.spokenScript, `card-script-${seg.id}`)}
                        className="text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                      >
                        {copiedKey === `card-script-${seg.id}` ? (
                          <span className="text-emerald-400 font-bold">Disalin</span>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Salin</span>
                          </>
                        )}
                      </button>
                    </div>

                    <p className="p-3 rounded bg-slate-950/70 border border-slate-800 text-slate-200 text-xs leading-relaxed italic font-sans">
                      "{seg.spokenScript}"
                    </p>

                    {/* Rubric Alignment Note */}
                    <div className="flex items-start gap-1.5 text-[11px] text-slate-400 font-mono bg-indigo-950/20 p-2 rounded border border-indigo-900/40">
                      <Award className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-indigo-300">Target Bukti Rubrik:</strong> {seg.rubricFocus}
                      </span>
                    </div>
                  </div>

                  {/* Right: Technical directives & CLI (4 cols) */}
                  <div className="lg:col-span-4 space-y-2.5">
                    <div>
                      <span className="text-[10px] font-mono uppercase font-semibold text-cyan-400 block mb-1">
                        Aksi Visual di Layar:
                      </span>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-300">
                        {seg.onScreenVisuals.map((vis, vIdx) => (
                          <li key={vIdx} className="leading-snug">
                            {vis}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {seg.cliCommands.length > 0 && (
                      <div>
                        <span className="text-[10px] font-mono uppercase font-semibold text-indigo-400 block mb-1">
                          Perintah Terminal Terkait:
                        </span>
                        <div className="space-y-1">
                          {seg.cliCommands.map((cmd, cIdx) => (
                            <div
                              key={cIdx}
                              className="flex items-center justify-between bg-black/60 px-2 py-1 rounded border border-slate-800 font-mono text-[10px]"
                            >
                              <code className="text-amber-300 truncate max-w-[190px]">{cmd}</code>
                              <button
                                type="button"
                                onClick={() => handleCopy(cmd, `seg-cmd-${seg.id}-${cIdx}`)}
                                className="text-slate-400 hover:text-white p-0.5"
                                title="Salin perintah"
                              >
                                {copiedKey === `seg-cmd-${seg.id}-${cIdx}` ? (
                                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-2.5 h-2.5" />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Recording Takes Log & History */}
      <section
        className={`border rounded-lg p-5 transition-colors ${
          isDark ? "bg-[#0d1322] border-slate-800" : "bg-white border-slate-200"
        }`}
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <Tv className="w-4 h-4 text-cyan-400" />
              <span>Log Riwayat Uji Coba Rekaman (Rehearsal Takes)</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Catat waktu rekaman setiap kali kelompok Anda melakukan gladi resik untuk memantau konsistensi pacing.
            </p>
          </div>

          {/* Quick Input Note */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Catatan take (opsional)..."
              value={takeNoteInput}
              onChange={(e) => setTakeNoteInput(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono w-full sm:w-64"
            />
            <button
              type="button"
              onClick={handleRecordTake}
              disabled={elapsedSec === 0}
              className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-mono font-medium shrink-0 transition-colors"
            >
              Simpan Take
            </button>
          </div>
        </div>

        {takes.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs font-mono border border-dashed border-slate-800 rounded">
            Belum ada riwayat take yang tercatat. Jalankan timer rehearsal lalu klik "Catat Take".
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-mono text-slate-400 uppercase">
                  <th className="py-2 px-3">Waktu</th>
                  <th className="py-2 px-3">Durasi</th>
                  <th className="py-2 px-3">Status LMS</th>
                  <th className="py-2 px-3">Catatan Evaluasi</th>
                  <th className="py-2 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {takes.map((take) => (
                  <tr key={take.id} className="hover:bg-slate-900/30">
                    <td className="py-2 px-3 text-slate-400">{take.timestamp}</td>
                    <td className="py-2 px-3 text-white font-bold tabular-nums">
                      {formatTime(take.durationSec)}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                          take.verdict === "PASS"
                            ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                            : take.verdict === "WARN"
                            ? "bg-amber-950 text-amber-300 border-amber-800"
                            : "bg-rose-950 text-rose-300 border-rose-800"
                        }`}
                      >
                        {take.verdict === "PASS" && "Lolos Ideal (<=07:15)"}
                        {take.verdict === "WARN" && "Toleransi (07:15-08:00)"}
                        {take.verdict === "PENALTY" && "Terlalu Panjang (>08:00)"}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-300 font-sans text-xs">
                      {take.notes}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteTake(take.id)}
                        className="text-slate-500 hover:text-rose-400 text-[11px] transition-colors"
                        title="Hapus take ini"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
