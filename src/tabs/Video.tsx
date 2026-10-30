import React, { useState, useEffect, useMemo, useRef } from "react";
import { Chip, CopyButton, EmptyState, MicroLabel, Panel, SegButton } from "../components/ui";
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

const takeVerdictTone: Record<RehearsalTake["verdict"], "ok" | "warn" | "danger"> = {
  PASS: "ok",
  WARN: "warn",
  PENALTY: "danger",
};

/** Baris perintah CLI — gaya blok terminal (selalu gelap), dengan salin. */
const CliLine: React.FC<{ cmd: string; copied: boolean; onCopy: () => void }> = ({
  cmd,
  copied,
  onCopy,
}) => (
  <div className="flex items-start justify-between gap-2 rounded-sm border border-code-line bg-code px-2.5 py-1.5">
    <code className="min-w-0 flex-1 break-all font-mono text-[11px] leading-relaxed text-code-ink">
      {cmd}
    </code>
    <button
      type="button"
      onClick={onCopy}
      aria-label="Salin perintah"
      title="Salin perintah"
      className={`shrink-0 rounded-sm px-1 py-0.5 font-mono text-[10px] transition-colors ${
        copied ? "text-code-ink" : "text-code-muted hover:text-code-ink"
      }`}
    >
      {copied ? "Tersalin" : "Salin"}
    </button>
  </div>
);

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
    return [];
  });
  const [takeNoteInput, setTakeNoteInput] = useState<string>("");

  const nimPlaceholder = state.members[0]?.nim || "<NIM>";
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
        spokenScript: `Selamat pagi/siang Bapak/Ibu dosen dan asisten praktikum. Kelompok kami mengerjakan Tugas Pemantapan 1: membangun dan memverifikasi klaster Hadoop dan Spark dengan Docker. Anggota dan pembagiannya: ${
          state.members
            .map((m, i) => `${m.nama || `Mahasiswa ${i + 1}`} (${m.nim || "NIM"}), ${m.porsi}`)
            .join(", ")
        }. Topologi kami delapan kontainer dalam satu bridge network: 1 NameNode, 2 DataNode, 1 ResourceManager, 1 NodeManager, 1 Spark Master, 2 Spark Worker. Host-nya Docker Desktop di WSL2, alokasi sumber daya mengikuti pengaturan Resources.`,
        rubricFocus: "Identitas lengkap anggota, kejelasan alokasi peran, arsitektur 8 kontainer.",
      },
      {
        id: "S2",
        title: "Docker Compose & Status Kontainer",
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
        spokenScript: `Kami jalankan 'docker compose up -d'. Lihat keluaran 'docker ps': delapan kontainer berstatus Up, tidak ada yang restart berulang. Port yang terikat ke host: 9870 untuk NameNode UI, 8088 untuk YARN, 8080 sampai 8082 untuk Spark, serta 8020 dan 7077 untuk RPC.`,
        rubricFocus: "8 kontainer Up tanpa crashloop, port binding tepat, bukan terminal mock.",
      },
      {
        id: "S3",
        title: "Verifikasi HDFS, Replikasi & Dataset Uji",
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
        spokenScript: `Kami cek safemode: statusnya OFF. 'hdfs dfsadmin -report' menampilkan dua DataNode live. Dataset 'words.txt' kami unggah ke /user/${nimPlaceholder}/input; 'wc -l' mengonfirmasi 1.500 baris. 'hdfs fsck' pada file itu mengembalikan HEALTHY dengan replikasi blok 2.0. Di NameNode UI port 9870, tab Datanodes menampilkan hasil yang sama.`,
        rubricFocus: "Safe mode OFF, 2 Live DataNodes, FSCK HEALTHY replikasi 2, dataset 1.500 baris, Web UI 9870.",
        uiTargetUrl: "http://localhost:9870",
        uiTargetName: "NameNode Web UI (Port 9870)",
      },
      {
        id: "S4",
        title: "Eksekusi MapReduce di YARN",
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
        spokenScript: `Job wordcount bawaan Hadoop kami jalankan dengan input /user/${nimPlaceholder}/input dan output /user/${nimPlaceholder}/out_mr. Progress map dan reduce terlihat di terminal sampai selesai. Di YARN UI port 8088, aplikasi bergeser dari RUNNING ke FINISHED dengan FinalStatus SUCCEEDED. 'part-r-00000' berisi lima kata acuan, formatnya kata TAB frekuensi.`,
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
        spokenScript: `Untuk Spark, skrip 'wc.py' membaca langsung dari hdfs://namenode:8020. 'spark-submit' kami arahkan ke spark://spark-master:7077, mode client, --executor-memory 512m, --total-executor-cores 2. Exit code bernilai 0. Spark Master UI port 8080 menampilkan aplikasi TP1-WordCount berstatus FINISHED, dan 'part-00000' terbentuk di direktori out_spark.`,
        rubricFocus: "Flag memori 512m & core 2 dijelaskan lisan, exit code 0, Web UI Spark 8080, part-00000 terbentuk.",
        uiTargetUrl: "http://localhost:8080",
        uiTargetName: "Spark Master Web UI (Port 8080)",
      },
      {
        id: "S6",
        title: "Komparasi MR vs Spark",
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
        spokenScript: `Kami bandingkan 'part-r-00000' hasil MapReduce dengan 'part-00000' hasil Spark, baris per baris. Lima kata acuan punya frekuensi yang sama persis, selisih nol, total 1.500 kata sesuai dataset. Pada ukuran ini Spark selesai lebih cepat karena RDD diolah di memori, sedangkan MapReduce menulis hasil antara ke disk saat shuffle.`,
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
        spokenScript: `Kesimpulannya: klaster berjalan dan kedua engine menghasilkan output yang sama. Sesuai lembar disclosure, tools AI hanya kami pakai untuk penelusuran sintaks dan template; semua perintah di video ini dieksekusi di terminal nyata dan kami cek hasilnya langsung. Durasi rekaman ini di bawah 07:15. Terima kasih kepada Bapak/Ibu dosen dan asisten praktikum.`,
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
        assignedSegIds: assignedSegs.map((s) => s.id),
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

  const checklistDone = Object.values(state.videoChecklist).filter(Boolean).length;

  const checklistItems: Array<{
    field: keyof typeof state.videoChecklist;
    title: string;
    desc: string;
  }> = [
    {
      field: "terminalReal",
      title: "Terminal Nyata (Bukan Mock)",
      desc: "Rekam eksekusi CLI asli di terminal WSL2/PowerShell, bukan tayangan slide animasi atau rekaan log.",
    },
    {
      field: "bukanSlideSaja",
      title: "Tampilkan Browser Web UI",
      desc: "Buka tab browser nyata untuk NameNode (9870), YARN RM (8088), dan Spark Master (8080).",
    },
    {
      field: "tiapAnggotaTampil",
      title: "Seluruh Anggota Berbicara",
      desc: "Setiap anggota kelompok memaparkan bagian masing-masing secara bergiliran dengan suara jernih.",
    },
    {
      field: "tanpaKredensial",
      title: "Bebas Kredensial Pribadi",
      desc: "Layar bersih dari password, token API rahasia, path sensitif, atau file pribadi di terminal.",
    },
  ];

  return (
    <div className="space-y-5">
      {/* 7 — Video Walkthrough: header + fakta batasan teknis */}
      <Panel
        no="7"
        title="Latihan Video Walkthrough"
        sub="Rundown 7 segmen, timer gladi resik, dan pembagian bicara anggota."
        actions={
          <>
            <button
              type="button"
              onClick={() => handleCopy(fullScriptMarkdown, "full-script")}
              title="Salin seluruh naskah dan rundown untuk prompter OBS"
              className={`btn btn-outline font-mono ${copiedKey === "full-script" ? "!border-ok/60 !text-ok" : ""}`}
            >
              {copiedKey === "full-script" ? "Naskah Disalin" : "Salin Naskah Lengkap"}
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
              className="btn btn-primary font-mono"
            >
              Unduh .MD
            </button>
          </>
        }
      >
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <div>
            <dt className="label-micro">Target Waktu</dt>
            <dd className="mt-1 font-mono text-sm font-bold tabular-nums text-ink">07:15</dd>
            <dd className="font-mono text-[10px] text-ink-muted">435 detik ideal</dd>
          </div>
          <div>
            <dt className="label-micro">Batas Maksimal</dt>
            <dd className="mt-1 font-mono text-sm font-bold tabular-nums text-warn">08:00</dd>
            <dd className="font-mono text-[10px] text-ink-muted">&gt;08:00 penalti LMS</dd>
          </div>
          <div>
            <dt className="label-micro">Jumlah Segmen</dt>
            <dd className="mt-1 font-mono text-sm font-bold text-ink">7 Segmen</dd>
            <dd className="font-mono text-[10px] text-ink-muted">Wajib urut &amp; runtut</dd>
          </div>
          <div>
            <dt className="label-micro">Kamera &amp; Suara</dt>
            <dd className="mt-1 font-mono text-sm font-bold text-ink">Semua Anggota</dd>
            <dd className="font-mono text-[10px] text-ink-muted">Wajib berbicara lisan</dd>
          </div>
        </dl>
      </Panel>

      {/* Pacer rehearsal: timer, kontrol, progres segmen, teleprompter aktif */}
      <Panel
        title="Pacer Latihan"
        sub="Timer gladi resik; teleprompter mengikuti segmen aktif."
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          {/* Timer utama */}
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`h-2 w-2 shrink-0 rounded-full ${
                  isRunning ? "animate-pulse bg-danger" : "bg-line-strong"
                }`}
              />
              <MicroLabel>Rehearsal Clock</MicroLabel>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
              <span
                className={`font-mono text-5xl font-bold tracking-tight tabular-nums ${
                  timerStatus === "OVERDUE"
                    ? "text-danger"
                    : timerStatus === "WARNING"
                    ? "text-warn"
                    : "text-ink"
                }`}
              >
                {formatTime(elapsedSec)}
              </span>
              <span className="font-mono text-xs text-ink-muted">
                / Target 07:15 <span className="mx-1 text-line-strong">|</span>{" "}
                <span className="text-warn">Max 08:00</span>
              </span>
              <Chip
                tone={
                  timerStatus === "STANDBY"
                    ? "neutral"
                    : timerStatus === "ON_TRACK"
                    ? "ok"
                    : timerStatus === "WARNING"
                    ? "warn"
                    : "danger"
                }
                className={timerStatus === "OVERDUE" ? "animate-pulse" : ""}
              >
                {timerStatus === "STANDBY" && "Standby / Siap Latihan"}
                {timerStatus === "ON_TRACK" && "Dalam Target (Aman)"}
                {timerStatus === "WARNING" && "Zona Peringatan (07:15 - 08:00)"}
                {timerStatus === "OVERDUE" && "Melebihi Batas LMS (Penalti Nilai)"}
              </Chip>
            </div>
          </div>

          {/* Kontrol pacer */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <MicroLabel>Kecepatan:</MicroLabel>
              {[1, 1.25, 1.5].map((spd) => (
                <SegButton
                  key={spd}
                  active={playbackSpeed === spd}
                  onClick={() => setPlaybackSpeed(spd)}
                >
                  {spd}x
                </SegButton>
              ))}
            </div>
            {!isRunning ? (
              <button
                type="button"
                onClick={() => setIsRunning(true)}
                className="btn btn-primary font-mono"
              >
                Mulai Rehearsal
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsRunning(false)}
                className="btn btn-primary font-mono"
              >
                Jeda Pacer
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsRunning(false);
                setElapsedSec(0);
              }}
              className="btn btn-outline font-mono"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleRecordTake}
              disabled={elapsedSec === 0}
              className="btn btn-outline font-mono"
            >
              Catat Take ({formatTime(elapsedSec)})
            </button>
          </div>
        </div>

        {/* Progres segmen global */}
        <div className="mt-5 space-y-2">
          <MicroLabel>Peta Progres 7 Segmen</MicroLabel>
          <div className="flex h-7 w-full overflow-hidden rounded-sm border border-line bg-surface-2">
            {segmentDetails.map((seg, idx) => {
              const segPct = (seg.durSec / maxSec) * 100;
              return (
                <div
                  key={seg.id}
                  style={{ width: `${segPct}%` }}
                  title={`${seg.id}: ${seg.title} (${seg.timeRange})`}
                  className={`flex items-center justify-center border-r border-line font-mono text-[9px] last:border-r-0 ${
                    idx === currentSegmentIndex
                      ? "bg-accent font-bold text-accent-ink"
                      : idx < currentSegmentIndex
                      ? "bg-accent-wash text-accent"
                      : "bg-surface-2 text-ink-muted"
                  }`}
                >
                  {seg.id}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 font-mono text-[10px] text-ink-muted">
            <span>00:00 (Mulai)</span>
            <span className="text-accent">
              Segmen Aktif: <strong>{activeSegment.id}</strong> ({formatTime(activeSegmentTiming.segElapsed)} /{" "}
              {activeSegment.durSec}s)
            </span>
            <span className="tabular-nums text-ink-soft">07:15 (Target Ideal)</span>
            <span className="tabular-nums text-warn">08:00 (Maksimal LMS)</span>
          </div>
        </div>

        {/* Teleprompter fokus segmen aktif */}
        <div className="mt-6 rounded-sm border border-accent/40 bg-canvas p-4">
          <div className="flex flex-col gap-3 border-b border-line pb-3 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="rounded-sm bg-accent px-2 py-0.5 font-mono text-xs font-bold text-accent-ink">
                {activeSegment.id}
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold tracking-tight text-ink">{activeSegment.title}</h3>
                <span className="font-mono text-[11px] tabular-nums text-ink-muted">
                  Target Alokasi: {activeSegment.timeRange} ({activeSegment.durSec} detik)
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <MicroLabel className="block">Pembicara Bertugas</MicroLabel>
                <span className="font-mono text-xs font-semibold text-ink">
                  {state.members.find((m) => m.id === state.videoAssignments[activeSegment.id])?.nama ||
                    "(Belum dialokasikan)"}
                </span>
              </div>
              {activeSegment.uiTargetUrl && (
                <a
                  href={activeSegment.uiTargetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline !px-2 !py-1 font-mono !text-[11px]"
                >
                  Buka {activeSegment.uiTargetName?.split(" ")[0]}
                </a>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <MicroLabel>
                  Naskah Lisan Presenter (Baca dengan tempo artikulatif &amp; percaya diri)
                </MicroLabel>
                <button
                  type="button"
                  onClick={() => handleCopy(activeSegment.spokenScript, `prompter-${activeSegment.id}`)}
                  className={`btn btn-ghost !px-2 !py-0.5 font-mono !text-[11px] ${
                    copiedKey === `prompter-${activeSegment.id}` ? "!text-ok" : ""
                  }`}
                >
                  {copiedKey === `prompter-${activeSegment.id}`
                    ? "Tersalin!"
                    : "Salin Naskah Segmen"}
                </button>
              </div>
              <blockquote className="rounded-sm border-l-2 border-accent bg-surface-2 p-4 text-[13px] italic leading-relaxed text-ink-soft">
                “{activeSegment.spokenScript}”
              </blockquote>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <MicroLabel className="mb-1.5 block">Panduan Visual Layar (OBS Studio)</MicroLabel>
                <ul className="list-disc space-y-1 pl-5 text-xs leading-snug text-ink-soft">
                  {activeSegment.onScreenVisuals.map((vis, vIdx) => (
                    <li key={vIdx}>{vis}</li>
                  ))}
                </ul>
              </div>
              <div>
                <MicroLabel className="mb-1.5 block">Perintah Terminal Segmen Ini</MicroLabel>
                {activeSegment.cliCommands.length > 0 ? (
                  <div className="space-y-1.5">
                    {activeSegment.cliCommands.map((cmd, cIdx) => (
                      <CliLine
                        key={cIdx}
                        cmd={cmd}
                        copied={copiedKey === `cmd-${activeSegment.id}-${cIdx}`}
                        onCopy={() => handleCopy(cmd, `cmd-${activeSegment.id}-${cIdx}`)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] italic text-ink-muted">
                    (Tidak ada perintah CLI baru pada segmen ini; fokus visual pada webcam &amp; form akreditasi).
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </Panel>

      {/* Checklist kepatuhan produksi */}
      <Panel
        title="Checklist Mutu Rekaman"
        actions={
          checklistDone === 4 ? (
            <Chip tone="ok">100% Siap Rekam</Chip>
          ) : (
            <span className="font-mono text-[11px] text-ink-muted">
              Status: <strong className="text-warn">{checklistDone} / 4 Lulus</strong>
            </span>
          )
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {checklistItems.map(({ field, title, desc }) => (
            <label
              key={field}
              className="flex cursor-pointer items-start gap-2.5 rounded-sm border border-line bg-surface-2 p-3 text-xs transition-colors hover:border-line-strong"
            >
              <input
                type="checkbox"
                checked={state.videoChecklist[field]}
                onChange={() => handleToggleChecklist(field)}
                style={{ accentColor: "var(--c-accent)" }}
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              <span className="min-w-0">
                <span className="block font-semibold text-ink">{title}</span>
                <span className="mt-0.5 block text-[11px] leading-tight text-ink-muted">{desc}</span>
              </span>
            </label>
          ))}
        </div>
      </Panel>

      {/* Keseimbangan beban bicara */}
      <Panel
        title="Pembagian Bicara Anggota"
        sub="Rubrik penilaian mewajibkan seluruh anggota berkontribusi secara lisan dengan porsi yang proporsional."
        actions={
          <button
            type="button"
            onClick={handleAutoDistribute}
            className="btn btn-outline font-mono"
          >
            Alokasikan Otomatis Merata
          </button>
        }
      >
        {workloadStats.length === 0 ? (
          <EmptyState text="Belum ada anggota kelompok. Tambahkan anggota pada bagian Setup untuk mengatur jatah bicara." />
        ) : (
          <div className="divide-y divide-line rounded-sm border border-line">
            {workloadStats.map(({ member, assignedCount, assignedSegIds, totalSec, percentage }) => (
              <div
                key={member.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 text-xs"
              >
                <div className="min-w-0 flex-1 basis-40">
                  <span className="block truncate font-semibold text-ink">
                    {member.nama || "Tanpa Nama"}
                  </span>
                  <span className="block font-mono text-[10px] text-ink-muted">
                    NIM: {member.nim || "-"}
                  </span>
                </div>
                <Chip tone="neutral">{member.porsi}</Chip>
                <span className="font-mono text-[11px] text-ink-soft">
                  {assignedSegIds.length > 0 ? assignedSegIds.join(" · ") : "—"}
                </span>
                <span className="font-mono text-[11px] tabular-nums">
                  <span className="text-ink-muted">{assignedCount} Segmen</span>{" "}
                  <strong className="text-ink">
                    {formatTime(totalSec)} ({percentage}%)
                  </strong>
                </span>
                <div className="meter w-full basis-full sm:w-36 sm:basis-auto">
                  <div
                    className="meter-fill"
                    style={{
                      width: `${Math.min(100, percentage)}%`,
                      background:
                        assignedCount === 0 || percentage < 15
                          ? "var(--c-warn)"
                          : "var(--c-accent)",
                    }}
                  />
                </div>
                {assignedCount === 0 && (
                  <span className="w-full basis-full font-mono text-[10px] text-warn sm:w-auto sm:basis-auto">
                    Peringatan: Belum mendapat jatah segmen!
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Rundown 7 segmen */}
      <Panel
        title="Rundown 7 Segmen"
        sub="Total durasi 07:15 · setiap kartu memuat naskah, aksi visual, perintah CLI, dan target bukti rubrik."
        actions={
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filter segmen">
            <SegButton active={activeFilterId === "ALL"} onClick={() => setActiveFilterId("ALL")}>
              Semua (7)
            </SegButton>
            {segmentDetails.map((s) => (
              <SegButton
                key={s.id}
                active={activeFilterId === s.id}
                onClick={() => setActiveFilterId(s.id)}
              >
                {s.id}
              </SegButton>
            ))}
          </div>
        }
      >
        <div className="space-y-3">
          {displayedSegments.map((seg) => {
            const assignedMemberId = state.videoAssignments[seg.id] || "";
            const [start, end] = parseTimeRange(seg.timeRange);
            const isCurrentlyActive = elapsedSec >= start && elapsedSec < end;

            return (
              <div
                key={seg.id}
                className={`rounded-sm border p-4 transition-colors ${
                  isCurrentlyActive ? "border-accent/60 bg-accent-wash/30" : "border-line bg-canvas"
                }`}
              >
                {/* Baris header kartu */}
                <div className="flex flex-col gap-3 border-b border-line pb-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <span className="font-mono text-xs font-bold tabular-nums text-accent">
                      {seg.id}
                    </span>
                    <h3 className="text-xs font-bold tracking-tight text-ink">{seg.title}</h3>
                    <span className="font-mono text-[11px] tabular-nums text-ink-muted">
                      {seg.timeRange} ({seg.durSec} detik)
                    </span>
                    {isCurrentlyActive && (
                      <span className="status-chip chip-ok animate-pulse">Sedang Berlangsung</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleJumpToSegment(seg.id)}
                      title="Set timer pacer ke awal segmen ini"
                      className="btn btn-outline !px-2 !py-1 font-mono !text-[11px]"
                    >
                      Lompat ke {seg.id}
                    </button>
                    <div className="flex items-center gap-1.5">
                      <label htmlFor={`assign-${seg.id}`} className="sr-only">
                        Pilih pembicara untuk segmen {seg.id}
                      </label>
                      <select
                        id={`assign-${seg.id}`}
                        value={assignedMemberId}
                        onChange={(e) => handleAssignMember(seg.id, e.target.value)}
                        className="field font-mono !w-auto max-w-[220px] !text-xs"
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

                {/* Isi kartu: naskah + direktif teknis */}
                <div className="mt-3 grid grid-cols-1 gap-4 text-xs lg:grid-cols-12">
                  <div className="space-y-2.5 lg:col-span-8">
                    <div className="flex items-center justify-between gap-2">
                      <MicroLabel>Naskah Pembicara Lisan</MicroLabel>
                      <CopyButton
                        text={seg.spokenScript}
                        label="Salin"
                        title={`Salin naskah segmen ${seg.id}`}
                      />
                    </div>
                    <blockquote className="rounded-sm border-l-2 border-accent bg-surface-2 p-3 italic leading-relaxed text-ink-soft">
                      “{seg.spokenScript}”
                    </blockquote>
                    <div className="rounded-sm border-l-2 border-accent-wash bg-surface-2 p-2.5">
                      <MicroLabel className="block">Target Bukti Rubrik</MicroLabel>
                      <p className="mt-0.5 font-mono text-[11px] leading-snug text-ink-soft">
                        {seg.rubricFocus}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 lg:col-span-4">
                    <div>
                      <MicroLabel className="mb-1 block">Aksi Visual di Layar</MicroLabel>
                      <ul className="list-disc space-y-0.5 pl-5 text-[11px] leading-snug text-ink-soft">
                        {seg.onScreenVisuals.map((vis, vIdx) => (
                          <li key={vIdx}>{vis}</li>
                        ))}
                      </ul>
                    </div>

                    {seg.cliCommands.length > 0 && (
                      <div>
                        <MicroLabel className="mb-1 block">Perintah Terminal Terkait</MicroLabel>
                        <div className="space-y-1">
                          {seg.cliCommands.map((cmd, cIdx) => (
                            <CliLine
                              key={cIdx}
                              cmd={cmd}
                              copied={copiedKey === `seg-cmd-${seg.id}-${cIdx}`}
                              onCopy={() => handleCopy(cmd, `seg-cmd-${seg.id}-${cIdx}`)}
                            />
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
      </Panel>

      {/* Log riwayat take */}
      <Panel
        title="Riwayat Uji Coba Rekaman"
        sub='Catat durasi tiap gladi resik untuk memantau pacing.'
        actions={
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="w-full sm:w-56">
              <label htmlFor="take-note-input" className="sr-only">
                Catatan take (opsional)
              </label>
              <input
                id="take-note-input"
                type="text"
                placeholder="Catatan take (opsional)..."
                value={takeNoteInput}
                onChange={(e) => setTakeNoteInput(e.target.value)}
                className="field font-mono !text-xs"
              />
            </div>
            <button
              type="button"
              onClick={handleRecordTake}
              disabled={elapsedSec === 0}
              className="btn btn-primary shrink-0 font-mono"
            >
              Simpan Take
            </button>
          </div>
        }
      >
        {takes.length === 0 ? (
          <EmptyState text='Belum ada riwayat take yang tercatat. Jalankan timer rehearsal lalu klik "Catat Take".' />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead>
                <tr className="border-b border-line">
                  <th className="label-micro px-3 py-2 font-normal">Waktu</th>
                  <th className="label-micro px-3 py-2 font-normal">Durasi</th>
                  <th className="label-micro px-3 py-2 font-normal">Status LMS</th>
                  <th className="label-micro px-3 py-2 font-normal">Catatan Evaluasi</th>
                  <th className="label-micro px-3 py-2 text-right font-normal">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {takes.map((take) => (
                  <tr key={take.id} className="hover:bg-surface-2/60">
                    <td className="px-3 py-2 font-mono text-[11px] tabular-nums text-ink-muted">
                      {take.timestamp}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] font-bold tabular-nums text-ink">
                      {formatTime(take.durationSec)}
                    </td>
                    <td className="px-3 py-2">
                      <Chip tone={takeVerdictTone[take.verdict]}>
                        {take.verdict === "PASS" && "Lolos Ideal (<=07:15)"}
                        {take.verdict === "WARN" && "Toleransi (07:15-08:00)"}
                        {take.verdict === "PENALTY" && "Terlalu Panjang (>08:00)"}
                      </Chip>
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-soft">{take.notes}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteTake(take.id)}
                        title="Hapus take ini"
                        aria-label={`Hapus take ${take.timestamp}`}
                        className="btn btn-danger-ghost !px-2 !py-0.5 font-mono !text-[11px]"
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
      </Panel>
    </div>
  );
};
