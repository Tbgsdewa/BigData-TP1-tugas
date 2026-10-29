export const ENV = {
  host: "Docker Desktop (WSL2), alokasi minimal RAM 6 GB, CPU 4",
  images: {
    hadoop: "apache/hadoop:3.3.6",
    spark: "apache/spark:3.5.1-python3",
  },
  imageNote: "Verifikasi tag di Docker Hub; jika gagal catat di Kendala",
  hadoopHome: "/opt/hadoop",
  sparkHome: "/opt/spark",
  replication: 2,
  containers: [
    "namenode",
    "datanode1",
    "datanode2",
    "resourcemanager",
    "nodemanager",
    "spark-master",
    "spark-worker1",
    "spark-worker2",
  ],
  ports: {
    nnUI: 9870,
    rmUI: 8088,
    sparkMasterUI: 8080,
    sparkWorker1UI: 8081,
    sparkWorker2UI: 8082,
    sparkAppUI: 4040,
    sparkMaster: 7077,
    hdfsRPC: 8020,
  },
  spark: {
    executorMemory: "512m",
    totalExecutorCores: 2,
    workerCores: 2,
    workerMemory: "1g",
    deployMode: "client",
  },
};

export const NIM_REGEX = /^[0-9A-Za-z_-]{5,20}$/;

export const DATASET = {
  file: "words.txt",
  counts: { hadoop: 500, spark: 400, hdfs: 300, yarn: 200, data: 100 } as Record<string, number>,
  totalWords: 1500,
  distinct: 5,
};

export const SUBMIT_FILES = [
  "TP1_<NIM>_<Nama>.pdf",
  "TP1_Bukti_<NIM>_<Nama>.zip",
  "TP1_Video_<NIM>_<Nama> (atau tautan)",
];

export const DEADLINE = "Sesi 7 (minggu ke-8), tanggal pasti mengikuti pengumuman LMS";

export const RUBRIC = [
  { k: "Pemahaman masalah", w: 10 },
  { k: "Ketepatan metode", w: 25 },
  { k: "Eksekusi (tools & AI + disclosure)", w: 20 },
  { k: "Kualitas dan akurasi hasil", w: 25 },
  { k: "Validasi dan video walkthrough", w: 20 },
];

export const KNOWN_ISSUES = [
  {
    regex: /Name node is in safe mode/i,
    label: "Name node is in safe mode",
    solution: "Tunggu 30-60 dtk, ulangi S02.",
  },
  {
    regex: /Permission denied/i,
    label: "Permission denied",
    solution: "Ulangi chmod -R 777 pada S08.",
  },
  {
    regex: /already exists/i,
    label: "Path already exists",
    solution: "Hapus: hdfs dfs -rm -r /user/<NIM>/out_xxx lalu ulangi.",
  },
  {
    regex: /Connection refused|UnknownHost/i,
    label: "Connection refused / UnknownHost",
    solution: "Cek docker ps; container belum Up.",
  },
  {
    regex: /OutOfMemory|Killed|exit code 137/i,
    label: "OutOfMemory / Killed (Exit 137)",
    solution: "Naikkan RAM Docker Desktop >= 6 GB; tutup aplikasi berat.",
  },
  {
    regex: /port is already allocated/i,
    label: "Port is already allocated",
    solution: "Ubah port host di compose atau hentikan proses yang memakai port.",
  },
];

export interface StepDef {
  id: string;
  judul: string;
  cmd: string;
  bashCmd?: string;
  psCmd?: string;
  expected: string;
  evidenceId: string;
  phase: number;
  phaseTitle: string;
}

export interface PhaseDef {
  id: number;
  title: string;
  subtitle: string;
  stepIds: string[];
}

export const PHASES: PhaseDef[] = [
  {
    id: 1,
    title: "Fase 1: Inisialisasi & Verifikasi Health Klaster",
    subtitle: "Menyalakan 8 kontainer, inspeksi Safe Mode NameNode, kuorum DataNode, dan registrasi YARN/Spark",
    stepIds: ["S01", "S02", "S03", "S04", "S05"],
  },
  {
    id: 2,
    title: "Fase 2: Manajemen HDFS & Dataset Uji",
    subtitle: "Membuat namespace HDFS mahasiswa, mengunggah 1.500 baris kata acuan, dan memvalidasi replikasi blok",
    stepIds: ["S06", "S07", "S08", "S09"],
  },
  {
    id: 3,
    title: "Fase 3: Komputasi Hadoop MapReduce",
    subtitle: "Mengeksekusi job WordCount MapReduce terdistribusi di bawah manajemen YARN dan verifikasi part-r-00000",
    stepIds: ["S10", "S11", "S12"],
  },
  {
    id: 4,
    title: "Fase 4: Komputasi Apache Spark & Verifikasi Pasca-Eksekusi",
    subtitle: "Submisi job PySpark via spark-submit client mode ke Spark Master Standalone dan verifikasi part-00000",
    stepIds: ["S13", "S14", "S15"],
  },
];

export const STEPS_TEMPLATE: StepDef[] = [
  {
    id: "S01",
    judul: "Start klaster",
    phase: 1,
    phaseTitle: "Inisialisasi & Health Check Klaster",
    cmd: 'docker compose up -d\ndocker ps --format "table {{.Names}}\\t{{.Status}}"',
    bashCmd: 'docker compose up -d\ndocker ps --format "table {{.Names}}\\t{{.Status}}"',
    psCmd: 'docker compose up -d; docker ps --format "table {{.Names}}\\t{{.Status}}"',
    expected: '8 container "Up"',
    evidenceId: "E01",
  },
  {
    id: "S02",
    judul: "Cek safemode",
    phase: 1,
    phaseTitle: "Inisialisasi & Health Check Klaster",
    cmd: "docker exec namenode hdfs dfsadmin -safemode get",
    bashCmd: "docker exec namenode hdfs dfsadmin -safemode get",
    psCmd: "docker exec namenode hdfs dfsadmin -safemode get",
    expected: '"Safe mode is OFF"',
    evidenceId: "E02",
  },
  {
    id: "S03",
    judul: "Laporan HDFS",
    phase: 1,
    phaseTitle: "Inisialisasi & Health Check Klaster",
    cmd: "docker exec namenode hdfs dfsadmin -report",
    bashCmd: "docker exec namenode hdfs dfsadmin -report",
    psCmd: "docker exec namenode hdfs dfsadmin -report",
    expected: "Live datanodes (2)",
    evidenceId: "E03",
  },
  {
    id: "S04",
    judul: "Node YARN",
    phase: 1,
    phaseTitle: "Inisialisasi & Health Check Klaster",
    cmd: "docker exec resourcemanager yarn node -list",
    bashCmd: "docker exec resourcemanager yarn node -list",
    psCmd: "docker exec resourcemanager yarn node -list",
    expected: "Total Nodes:1 atau lebih, state RUNNING",
    evidenceId: "E04",
  },
  {
    id: "S05",
    judul: "Status Spark Master",
    phase: 1,
    phaseTitle: "Inisialisasi & Health Check Klaster",
    cmd: "curl.exe -s http://localhost:8080/json",
    bashCmd: "curl -s http://localhost:8080/json",
    psCmd: "curl.exe -s http://localhost:8080/json",
    expected: "status ALIVE, 2 worker ALIVE",
    evidenceId: "E05",
  },
  {
    id: "S06",
    judul: "Buat direktori HDFS",
    phase: 2,
    phaseTitle: "Manajemen HDFS & Dataset Uji",
    cmd: "docker exec namenode hdfs dfs -mkdir -p /user/<NIM>/input",
    bashCmd: "docker exec namenode hdfs dfs -mkdir -p /user/<NIM>/input",
    psCmd: "docker exec namenode hdfs dfs -mkdir -p /user/<NIM>/input",
    expected: "tanpa error",
    evidenceId: "E06",
  },
  {
    id: "S07",
    judul: "Buat dataset",
    phase: 2,
    phaseTitle: "Manajemen HDFS & Dataset Uji",
    cmd: "docker exec namenode bash -c 'for p in hadoop:500 spark:400 hdfs:300 yarn:200 data:100; do for i in $(seq 1 ${p#*:}); do echo ${p%%:*}; done; done > /tmp/words.txt'\ndocker exec namenode wc -l /tmp/words.txt",
    bashCmd: "docker exec namenode bash -c 'for p in hadoop:500 spark:400 hdfs:300 yarn:200 data:100; do for i in $(seq 1 ${p#*:}); do echo ${p%%:*}; done; done > /tmp/words.txt'\ndocker exec namenode wc -l /tmp/words.txt",
    psCmd: "docker exec namenode bash -c 'for p in hadoop:500 spark:400 hdfs:300 yarn:200 data:100; do for i in $(seq 1 `${p#*:}); do echo `${p%%:*}; done; done > /tmp/words.txt'\ndocker exec namenode wc -l /tmp/words.txt",
    expected: "1500",
    evidenceId: "E07",
  },
  {
    id: "S08",
    judul: "Upload ke HDFS",
    phase: 2,
    phaseTitle: "Manajemen HDFS & Dataset Uji",
    cmd: "docker exec namenode hdfs dfs -put -f /tmp/words.txt /user/<NIM>/input/\ndocker exec namenode hdfs dfs -chmod -R 777 /user/<NIM>\ndocker exec namenode hdfs dfs -ls /user/<NIM>/input",
    bashCmd: "docker exec namenode hdfs dfs -put -f /tmp/words.txt /user/<NIM>/input/\ndocker exec namenode hdfs dfs -chmod -R 777 /user/<NIM>\ndocker exec namenode hdfs dfs -ls /user/<NIM>/input",
    psCmd: "docker exec namenode hdfs dfs -put -f /tmp/words.txt /user/<NIM>/input/; docker exec namenode hdfs dfs -chmod -R 777 /user/<NIM>; docker exec namenode hdfs dfs -ls /user/<NIM>/input",
    expected: "words.txt tampil",
    evidenceId: "E08",
  },
  {
    id: "S09",
    judul: "Cek blok & replikasi",
    phase: 2,
    phaseTitle: "Manajemen HDFS & Dataset Uji",
    cmd: "docker exec namenode hdfs fsck /user/<NIM>/input/words.txt -files -blocks -locations",
    bashCmd: "docker exec namenode hdfs fsck /user/<NIM>/input/words.txt -files -blocks -locations",
    psCmd: "docker exec namenode hdfs fsck /user/<NIM>/input/words.txt -files -blocks -locations",
    expected: "HEALTHY, replikasi 2",
    evidenceId: "E09",
  },
  {
    id: "S10",
    judul: "Jalankan MapReduce",
    phase: 3,
    phaseTitle: "Komputasi Hadoop MapReduce",
    cmd: "docker exec namenode hadoop jar /opt/hadoop/share/hadoop/mapreduce/hadoop-mapreduce-examples-3.3.6.jar wordcount /user/<NIM>/input /user/<NIM>/out_mr",
    bashCmd: "docker exec namenode hadoop jar /opt/hadoop/share/hadoop/mapreduce/hadoop-mapreduce-examples-3.3.6.jar wordcount /user/<NIM>/input /user/<NIM>/out_mr",
    psCmd: "docker exec namenode hadoop jar /opt/hadoop/share/hadoop/mapreduce/hadoop-mapreduce-examples-3.3.6.jar wordcount /user/<NIM>/input /user/<NIM>/out_mr",
    expected: '"completed successfully"',
    evidenceId: "E10",
  },
  {
    id: "S11",
    judul: "Hasil MapReduce",
    phase: 3,
    phaseTitle: "Komputasi Hadoop MapReduce",
    cmd: "docker exec namenode hdfs dfs -cat /user/<NIM>/out_mr/part-r-00000",
    bashCmd: "docker exec namenode hdfs dfs -cat /user/<NIM>/out_mr/part-r-00000",
    psCmd: "docker exec namenode hdfs dfs -cat /user/<NIM>/out_mr/part-r-00000",
    expected: "5 baris kata<TAB>jumlah",
    evidenceId: "E11",
  },
  {
    id: "S12",
    judul: "Riwayat aplikasi YARN",
    phase: 3,
    phaseTitle: "Komputasi Hadoop MapReduce",
    cmd: "docker exec resourcemanager yarn application -list -appStates ALL",
    bashCmd: "docker exec resourcemanager yarn application -list -appStates ALL",
    psCmd: "docker exec resourcemanager yarn application -list -appStates ALL",
    expected: "FINISHED / SUCCEEDED",
    evidenceId: "E12",
  },
  {
    id: "S13",
    judul: "spark-submit",
    phase: 4,
    phaseTitle: "Komputasi Apache Spark & Verifikasi Pasca-Eksekusi",
    cmd: "docker exec spark-master /opt/spark/bin/spark-submit --master spark://spark-master:7077 --deploy-mode client --executor-memory 512m --total-executor-cores 2 /opt/app/wc.py hdfs://namenode:8020/user/<NIM>/input/words.txt hdfs://namenode:8020/user/<NIM>/out_spark\necho $? # PowerShell: $LASTEXITCODE",
    bashCmd: "docker exec spark-master /opt/spark/bin/spark-submit --master spark://spark-master:7077 --deploy-mode client --executor-memory 512m --total-executor-cores 2 /opt/app/wc.py hdfs://namenode:8020/user/<NIM>/input/words.txt hdfs://namenode:8020/user/<NIM>/out_spark\necho $?",
    psCmd: "docker exec spark-master /opt/spark/bin/spark-submit --master spark://spark-master:7077 --deploy-mode client --executor-memory 512m --total-executor-cores 2 /opt/app/wc.py hdfs://namenode:8020/user/<NIM>/input/words.txt hdfs://namenode:8020/user/<NIM>/out_spark\n$LASTEXITCODE",
    expected: "exit code 0",
    evidenceId: "E13",
  },
  {
    id: "S14",
    judul: "Hasil Spark",
    phase: 4,
    phaseTitle: "Komputasi Apache Spark & Verifikasi Pasca-Eksekusi",
    cmd: "docker exec namenode hdfs dfs -cat /user/<NIM>/out_spark/part-00000",
    bashCmd: "docker exec namenode hdfs dfs -cat /user/<NIM>/out_spark/part-00000",
    psCmd: "docker exec namenode hdfs dfs -cat /user/<NIM>/out_spark/part-00000",
    expected: "5 baris",
    evidenceId: "E14",
  },
  {
    id: "S15",
    judul: "Status Spark pasca-eksekusi",
    phase: 4,
    phaseTitle: "Komputasi Apache Spark & Verifikasi Pasca-Eksekusi",
    cmd: "curl.exe -s http://localhost:8080/json",
    bashCmd: "curl -s http://localhost:8080/json",
    psCmd: "curl.exe -s http://localhost:8080/json",
    expected: "completedapps berisi state FINISHED",
    evidenceId: "E15",
  },
];

export interface EvidenceDef {
  id: string;
  stepId: string;
  title: string;
  defaultFilenamePattern: string;
  formalTemplate: string;
}

export const EVIDENCE_DEF: EvidenceDef[] = [
  {
    id: "E01",
    stepId: "S01",
    title: "docker ps 8 container Up",
    defaultFilenamePattern: "E01_<NIM>_docker_ps_up.png",
    formalTemplate: "Tangkapan layar terminal eksekusi docker ps menampilkan seluruh 8 kontainer (NameNode, 2 DataNode, RM, NM, Spark Master, 2 Spark Workers) berstatus Up.",
  },
  {
    id: "E02",
    stepId: "S02",
    title: "Safe mode is OFF NameNode",
    defaultFilenamePattern: "E02_<NIM>_safemode_off.png",
    formalTemplate: "Pemeriksaan perintah hdfs dfsadmin -safemode get menampilkan respons Safe mode is OFF pada NameNode.",
  },
  {
    id: "E03",
    stepId: "S03",
    title: "hdfs dfsadmin -report (2 Live DataNodes)",
    defaultFilenamePattern: "E03_<NIM>_dfsadmin_report_live.png",
    formalTemplate: "Laporan hdfs dfsadmin -report mengonfirmasi 2 Live DataNodes aktif dengan kapasitas teralokasi normal.",
  },
  {
    id: "E04",
    stepId: "S04",
    title: "yarn node -list RUNNING",
    defaultFilenamePattern: "E04_<NIM>_yarn_nodes_running.png",
    formalTemplate: "Perintah yarn node -list pada ResourceManager menunjukkan NodeManager terhubung dalam state RUNNING.",
  },
  {
    id: "E05",
    stepId: "S05",
    title: "Spark Master JSON status ALIVE & 2 workers",
    defaultFilenamePattern: "E05_<NIM>_spark_master_alive.png",
    formalTemplate: "Respon JSON Spark Master /json membuktikan status master ALIVE dengan aliveworkers bernilai tepat 2.",
  },
  {
    id: "E06",
    stepId: "S06",
    title: "hdfs dfs -mkdir /user/<NIM>/input",
    defaultFilenamePattern: "E06_<NIM>_hdfs_mkdir_input.png",
    formalTemplate: "Pembuatan direktori HDFS /user/<NIM>/input berhasil dieksekusi tanpa error atau kendala izin.",
  },
  {
    id: "E07",
    stepId: "S07",
    title: "Pembuatan dataset 1500 baris wc -l",
    defaultFilenamePattern: "E07_<NIM>_dataset_wc_1500.png",
    formalTemplate: "Verifikasi dataset wc -l /tmp/words.txt membuktikan jumlah baris dataset acuan tepat 1.500 baris kata.",
  },
  {
    id: "E08",
    stepId: "S08",
    title: "hdfs dfs -put & ls dataset di HDFS",
    defaultFilenamePattern: "E08_<NIM>_hdfs_put_dataset_ls.png",
    formalTemplate: "File words.txt berhasil diunggah ke HDFS dan terverifikasi pada direktori /user/<NIM>/input via hdfs dfs -ls.",
  },
  {
    id: "E09",
    stepId: "S09",
    title: "hdfs fsck status HEALTHY & replikasi 2",
    defaultFilenamePattern: "E09_<NIM>_fsck_healthy_rep2.png",
    formalTemplate: "Pemeriksaan integritas hdfs fsck memvalidasi Status: HEALTHY dengan rata-rata replikasi blok tepat 2.0.",
  },
  {
    id: "E10",
    stepId: "S10",
    title: "Eksekusi Hadoop MapReduce selesai sukses",
    defaultFilenamePattern: "E10_<NIM>_mr_completed_success.png",
    formalTemplate: "Log terminal Hadoop MapReduce contoh wordcount selesai dengan status completed successfully tanpa error.",
  },
  {
    id: "E11",
    stepId: "S11",
    title: "Keluaran part-r-00000 MapReduce",
    defaultFilenamePattern: "E11_<NIM>_mr_output_part_r.png",
    formalTemplate: "Output part-r-00000 MapReduce menampilkan agregasi 5 kata acuan sesuai persis formula yang diharapkan.",
  },
  {
    id: "E12",
    stepId: "S12",
    title: "yarn application -list FINISHED/SUCCEEDED",
    defaultFilenamePattern: "E12_<NIM>_yarn_app_finished.png",
    formalTemplate: "Daftar aplikasi YARN mencatat riwayat job MapReduce dalam status State: FINISHED dan Final-State: SUCCEEDED.",
  },
  {
    id: "E13",
    stepId: "S13",
    title: "spark-submit exit code 0",
    defaultFilenamePattern: "E13_<NIM>_spark_submit_exit_0.png",
    formalTemplate: "Eksekusi spark-submit script wc.py ke Spark Master Standalone selesai sukses dengan exit code bernilai 0.",
  },
  {
    id: "E14",
    stepId: "S14",
    title: "Keluaran part-00000 Spark",
    defaultFilenamePattern: "E14_<NIM>_spark_output_part_0.png",
    formalTemplate: "Berkas part-00000 Spark pada direktori out_spark HDFS menampilkan 5 baris kata dan frekuensi yang identik.",
  },
  {
    id: "E15",
    stepId: "S15",
    title: "Spark Master JSON completedapps FINISHED",
    defaultFilenamePattern: "E15_<NIM>_spark_json_completed.png",
    formalTemplate: "Endpoint Spark Master /json mencatat completedapps memuat aplikasi TP1-WordCount dengan status FINISHED.",
  },
  {
    id: "E16",
    stepId: "UI",
    title: "Tangkapan layar Web UI (NameNode 9870, YARN 8088, Spark 8080, Spark App 4040)",
    defaultFilenamePattern: "E16_<NIM>_web_ui_dashboards.png",
    formalTemplate: "Kompilasi tangkapan layar Web UI NameNode (9870), YARN RM (8088), Spark Master (8080), dan Spark App (4040).",
  },
];

export const CONFIG_FILE_CONTENT = `CORE-SITE.XML_fs.default.name=hdfs://namenode
CORE-SITE.XML_fs.defaultFS=hdfs://namenode
HDFS-SITE.XML_dfs.namenode.rpc-address=namenode:8020
HDFS-SITE.XML_dfs.replication=2
MAPRED-SITE.XML_mapreduce.framework.name=yarn
MAPRED-SITE.XML_yarn.app.mapreduce.am.env=HADOOP_MAPRED_HOME=$HADOOP_HOME
MAPRED-SITE.XML_mapreduce.map.env=HADOOP_MAPRED_HOME=$HADOOP_HOME
MAPRED-SITE.XML_mapreduce.reduce.env=HADOOP_MAPRED_HOME=$HADOOP_HOME
YARN-SITE.XML_yarn.resourcemanager.hostname=resourcemanager
YARN-SITE.XML_yarn.nodemanager.aux-services=mapreduce_shuffle
YARN-SITE.XML_yarn.nodemanager.pmem-check-enabled=false
YARN-SITE.XML_yarn.nodemanager.vmem-check-enabled=false`;

export const DOCKER_COMPOSE_TEMPLATE = `services:
  namenode:
    image: ${ENV.images.hadoop}
    container_name: namenode
    command: ["hdfs", "namenode"]
    ports:
      - "${ENV.ports.nnUI}:9870"
    env_file: ./config
    environment:
      - ENSURE_NAMENODE_DIR=/tmp/hadoop-root/dfs/name
    restart: unless-stopped

  datanode1:
    image: ${ENV.images.hadoop}
    container_name: datanode1
    command: ["hdfs", "datanode"]
    env_file: ./config
    restart: unless-stopped

  datanode2:
    image: ${ENV.images.hadoop}
    container_name: datanode2
    command: ["hdfs", "datanode"]
    env_file: ./config
    restart: unless-stopped

  resourcemanager:
    image: ${ENV.images.hadoop}
    container_name: resourcemanager
    command: ["yarn", "resourcemanager"]
    ports:
      - "${ENV.ports.rmUI}:8088"
    env_file: ./config
    restart: unless-stopped

  nodemanager:
    image: ${ENV.images.hadoop}
    container_name: nodemanager
    command: ["yarn", "nodemanager"]
    env_file: ./config
    restart: unless-stopped

  spark-master:
    image: ${ENV.images.spark}
    container_name: spark-master
    command: ["/opt/spark/bin/spark-class", "org.apache.spark.deploy.master.Master", "--host", "spark-master"]
    ports:
      - "${ENV.ports.sparkMasterUI}:8080"
      - "${ENV.ports.sparkMaster}:7077"
    volumes:
      - ./app:/opt/app
    restart: unless-stopped

  spark-worker1:
    image: ${ENV.images.spark}
    container_name: spark-worker1
    command: ["/opt/spark/bin/spark-class", "org.apache.spark.deploy.worker.Worker", "spark://spark-master:7077", "--cores", "${ENV.spark.workerCores}", "--memory", "${ENV.spark.workerMemory}"]
    ports:
      - "${ENV.ports.sparkWorker1UI}:8081"
    restart: unless-stopped

  spark-worker2:
    image: ${ENV.images.spark}
    container_name: spark-worker2
    command: ["/opt/spark/bin/spark-class", "org.apache.spark.deploy.worker.Worker", "spark://spark-master:7077", "--cores", "${ENV.spark.workerCores}", "--memory", "${ENV.spark.workerMemory}"]
    ports:
      - "${ENV.ports.sparkWorker2UI}:8081"
    restart: unless-stopped
`;

export const WC_PY_CONTENT = `import sys
from pyspark.sql import SparkSession

s = SparkSession.builder.appName("TP1-WordCount").getOrCreate()
r = s.sparkContext.textFile(sys.argv[1]).flatMap(lambda l: l.split()).map(lambda w: (w, 1)).reduceByKey(lambda a, b: a + b).coalesce(1)
r.map(lambda x: f"{x[0]}\\t{x[1]}").saveAsTextFile(sys.argv[2])
s.stop()
`;

export const VIDEO_SEGMENTS = [
  {
    id: "S1",
    title: "Intro & Lingkungan",
    time: "0:00 - 0:45",
    dur: "45 dtk",
    keywords: ["Identitas anggota & peran", "Docker Desktop WSL2", "Alokasi RAM & CPU host", "Topologi 8 container"],
  },
  {
    id: "S2",
    title: "Compose & Container",
    time: "0:45 - 1:45",
    dur: "60 dtk",
    keywords: ["docker compose up -d", "docker ps 8 container Up", "Port binding Web UI", "Health status"],
  },
  {
    id: "S3",
    title: "HDFS & Data",
    time: "1:45 - 3:00",
    dur: "75 dtk",
    keywords: ["NameNode metadata", "DataNode blok", "replikasi 2", "dfsadmin -report", "fsck HEALTHY", "Dataset 1500 baris"],
  },
  {
    id: "S4",
    title: "MapReduce & YARN",
    time: "3:00 - 4:15",
    dur: "75 dtk",
    keywords: ["map", "shuffle", "reduce", "YARN ResourceManager/NodeManager", "yarn application -list", "Hasil part-r-00000"],
  },
  {
    id: "S5",
    title: "Spark Submit",
    time: "4:15 - 5:45",
    dur: "90 dtk",
    keywords: ["driver", "executor", "cluster manager=Spark Master", "flag spark-submit (--executor-memory, --total-executor-cores)", "Hasil part-00000"],
  },
  {
    id: "S6",
    title: "Validasi",
    time: "5:45 - 6:45",
    dur: "60 dtk",
    keywords: ["Komparasi MR vs Spark", "Kesesuaian 1500 kata exact", "Toleransi 0 kesalahan", "Web UI 9870, 8088, 8080"],
  },
  {
    id: "S7",
    title: "Kesimpulan",
    time: "6:45 - 7:15",
    dur: "30 dtk",
    keywords: ["Hasil pengujian klaster", "Kendala yang dihadapi & solusi", "Refleksi pembelajaran big data"],
  },
];
