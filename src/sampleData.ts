import { AppState } from "./types";

export const SAMPLE_STATE: AppState = {
  sampleMode: true,
  theme: "dark",
  members: [
    {
      id: "m1",
      nama: "Budi Santoso",
      nim: "2101001",
      porsi: "Docker & HDFS",
    },
    {
      id: "m2",
      nama: "Dewi Lestari",
      nim: "2101002",
      porsi: "MapReduce & YARN",
    },
    {
      id: "m3",
      nama: "Ahmad Fauzi",
      nim: "2101003",
      porsi: "Spark & submit",
    },
  ],
  prerequisites: {
    ramAllocated: true,
    wsl2Ready: true,
    portsFree: true,
  },
  steps: {
    S01: { completed: true, notes: "Semua 8 kontainer berhasil start dengan status Up" },
    S02: { completed: true, notes: "Safe mode NameNode otomatis OFF setelah 30 detik" },
    S03: { completed: true, notes: "Live datanodes (2) terdeteksi normal pada dfsadmin -report" },
    S04: { completed: true, notes: "NodeManager berhasil registrasi ke ResourceManager YARN (state RUNNING)" },
    S05: { completed: true, notes: "Spark Master status ALIVE dengan 2 worker aktif di port 8081 & 8082" },
    S06: { completed: true, notes: "Direktori HDFS /user/2101001/input dibuat tanpa kendala" },
    S07: { completed: true, notes: "File words.txt berisi tepat 1500 baris kata acuan terverifikasi wc -l" },
    S08: { completed: true, notes: "File sukses diupload ke HDFS dan izin direktori diatur 777" },
    S09: { completed: true, notes: "Status fsck HEALTHY dengan replikasi rata-rata 2.0" },
    S10: { completed: true, notes: "Hadoop MapReduce example wordcount selesai dengan completed successfully" },
    S11: { completed: true, notes: "Keluaran part-r-00000 menghasilkan 5 baris kata dan frekuensi sesuai" },
    S12: { completed: true, notes: "Riwayat YARN tercatat FINISHED dan SUCCEEDED" },
    S13: { completed: true, notes: "spark-submit client mode selesai dengan exit code 0" },
    S14: { completed: true, notes: "Keluaran part-00000 Spark identik dengan keluaran MapReduce" },
    S15: { completed: true, notes: "Spark Master JSON mencatat completedapps berstatus FINISHED" },
  },
  monitorLogs: {
    dfsadmin: `Configured Capacity: 105673199616 (98.42 GB)
Present Capacity: 84538559692 (78.73 GB)
DFS Remaining: 84538330214 (78.73 GB)
DFS Used: 229478 (224.1 KB)
DFS Used%: 0.00%
Replicated Blocks:
	Under replicated blocks: 0
	Blocks with corrupt replicas: 0
	Missing blocks: 0
	Missing blocks with replication factor 1: 0
	Low redundancy blocks with highest priority to recover: 0
	Pending deletion blocks: 0
Erasure Coded Block Groups: 
	Low redundancy block groups: 0
	Block groups with corrupt internal blocks: 0
	Missing block groups: 0
	Pending deletion blocks: 0

-------------------------------------------------
Live datanodes (2):

Name: 172.18.0.3:9866 (datanode1)
Hostname: datanode1
Decommission Status : Normal
Configured Capacity: 52836599808 (49.21 GB)
DFS Used: 114739 (112 KB)
Non DFS Used: 10567319961 (9.84 GB)
DFS Remaining: 42269279847 (39.37 GB)

Name: 172.18.0.4:9866 (datanode2)
Hostname: datanode2
Decommission Status : Normal
Configured Capacity: 52836599808 (49.21 GB)
DFS Used: 114739 (112 KB)
Non DFS Used: 10567319961 (9.84 GB)
DFS Remaining: 42269279847 (39.37 GB)`,
    yarnNodes: `Total Nodes:1
         Node-Id             Node-State Node-Http-Address Number-of-Running-Containers
nodemanager:44879               RUNNING nodemanager:8042                            0`,
    yarnApps: `Total Applications:1
                Application-Id	    Application-Name	      Application-Type	                        User	     Queue	             State	       Final-State	            Progress	                       Tracking-URL
application_1713500000000_0001	           wordcount	             MAPREDUCE	                        root	   default	          FINISHED	         SUCCEEDED	                100%	http://resourcemanager:8088/proxy/application_1713500000000_0001/`,
    fsck: `Connecting to namenode via http://namenode:9870/fsck?ugi=root&files=1&blocks=1&locations=1&path=%2Fuser%2F2101001%2Finput%2Fwords.txt
FSCK started by root (auth:SIMPLE) from /172.18.0.2 for path /user/2101001/input/words.txt at Mon Oct 19 09:15:00 UTC 2026
/user/2101001/input/words.txt 8192 bytes, 1 block(s):  OK
0. BP-1901847291-172.18.0.2-1713500000000:blk_1073741825_1001 len=8192 Live_repl=2 [DatanodeInfoWithStorage[172.18.0.3:9866,DS-1], DatanodeInfoWithStorage[172.18.0.4:9866,DS-2]]

Status: HEALTHY
 Number of data-nodes:  2
 Number of racks:       1
 Total dirs:            0
 Total files:           1
 Total symlinks:        0
 Total compact blocks:  0
 Total blocks (validated): 1 (avg. block size 8192 B)
 Minimally replicated blocks:   1 (100.0 %)
 Over-replicated blocks:        0 (0.0 %)
 Under-replicated blocks:       0 (0.0 %)
 Mis-replicated blocks:         0 (0.0 %)
 Default replication factor:    2
 Average block replication:     2.0
 Corrupt blocks:                0
 Missing replicas:              0 (0.0 %)
 Number of data-nodes:          2
 Number of racks:               1
FSCK ended at Mon Oct 19 09:15:00 UTC 2026 in 18 msecs`,
    mrLog: `26/10/19 09:20:10 INFO client.RMProxy: Connecting to ResourceManager at resourcemanager/172.18.0.5:8032
26/10/19 09:20:11 INFO mapreduce.JobSubmitter: Submitting tokens for job: job_1713500000000_0001
26/10/19 09:20:12 INFO impl.YarnClientImpl: Submitted application application_1713500000000_0001
26/10/19 09:20:13 INFO mapreduce.Job: The url to track the job: http://resourcemanager:8088/proxy/application_1713500000000_0001/
26/10/19 09:20:13 INFO mapreduce.Job: Running job: job_1713500000000_0001
26/10/19 09:20:20 INFO mapreduce.Job: Job job_1713500000000_0001 running in ull mode
26/10/19 09:20:21 INFO mapreduce.Job:  map 0% reduce 0%
26/10/19 09:20:28 INFO mapreduce.Job:  map 100% reduce 0%
26/10/19 09:20:35 INFO mapreduce.Job:  map 100% reduce 100%
26/10/19 09:20:36 INFO mapreduce.Job: Job job_1713500000000_0001 completed successfully
	Map-Reduce Framework
		Map input records=1500
		Map output records=1500
		Map output bytes=10500
		Combine input records=1500
		Combine output records=5
		Reduce input groups=5
		Reduce shuffle bytes=75
		Reduce input records=5
		Reduce output records=5
		Total time spent by all map tasks (ms)=6780
		Total time spent by all reduce tasks (ms)=4320`,
    sparkLog: `26/10/19 09:30:01 INFO SparkContext: Running Spark version 3.5.1
26/10/19 09:30:02 INFO StandaloneAppClient$ClientEndpoint: Connecting to master spark://spark-master:7077...
26/10/19 09:30:02 INFO StandaloneSchedulerBackend: Connected to Spark cluster with app ID app-20261019093002-0000
26/10/19 09:30:03 INFO StandaloneSchedulerBackend: Executor added: app-20261019093002-0000/0 on worker-20261019090000-172.18.0.7-8081 (172.18.0.7:41123) with 1 core
26/10/19 09:30:03 INFO StandaloneSchedulerBackend: Executor added: app-20261019093002-0000/1 on worker-20261019090000-172.18.0.8-8081 (172.18.0.8:41125) with 1 core
26/10/19 09:30:05 INFO DAGScheduler: Got job 0 (saveAsTextFile at wc.py:6) with 1 output partitions
26/10/19 09:30:08 INFO DAGScheduler: Job 0 finished: saveAsTextFile at wc.py:6, took 3.421500 s
26/10/19 09:30:09 INFO SparkContext: Successfully stopped SparkContext`,
    sparkJson: `{
  "url": "spark://spark-master:7077",
  "aliveworkers": 2,
  "cores": 4,
  "coresused": 0,
  "memory": 2147483648,
  "memoryused": 0,
  "workers": [
    {
      "id": "worker-20261019090000-172.18.0.7-8081",
      "host": "172.18.0.7",
      "port": 8081,
      "state": "ALIVE",
      "cores": 2,
      "memory": 1073741824
    },
    {
      "id": "worker-20261019090000-172.18.0.8-8081",
      "host": "172.18.0.8",
      "port": 8081,
      "state": "ALIVE",
      "cores": 2,
      "memory": 1073741824
    }
  ],
  "activeapps": [],
  "completedapps": [
    {
      "id": "app-20261019093002-0000",
      "name": "TP1-WordCount",
      "cores": 2,
      "memoryperslave": 512,
      "submitdate": "Mon Oct 19 09:30:02 GMT 2026",
      "state": "FINISHED",
      "duration": 7215
    }
  ],
  "status": "ALIVE"
}`,
    sparkExitCode: "0",
  },
  wordCountMR: "hadoop\t500\nspark\t400\nhdfs\t300\nyarn\t200\ndata\t100",
  wordCountSpark: "hadoop\t500\nspark\t400\nhdfs\t300\nyarn\t200\ndata\t100",
  evidence: {
    E01: {
      id: "E01",
      stepId: "S01",
      title: "docker ps 8 container Up",
      filename: "E01_docker_ps_containers_up.png",
      notes: "Tangkapan layar terminal menunjukkan 8 kontainer (NameNode, 2 DataNode, RM, NM, Spark Master, 2 Spark Workers) berstatus Up.",
      timestamp: "2026-10-19 09:02:15",
    },
    E02: {
      id: "E02",
      stepId: "S02",
      title: "Safe mode is OFF NameNode",
      filename: "E02_safemode_off.png",
      notes: "Terminal eksekusi perintah hdfs dfsadmin -safemode get menampilkan respons Safe mode is OFF pada NameNode.",
      timestamp: "2026-10-19 09:03:00",
    },
    E03: {
      id: "E03",
      stepId: "S03",
      title: "hdfs dfsadmin -report (2 Live DataNodes)",
      filename: "E03_dfsadmin_report_live_datanodes.png",
      notes: "Laporan hdfs dfsadmin -report menampilkan Live datanodes (2) dengan kapasitas terkonfigurasi dan status normal.",
      timestamp: "2026-10-19 09:04:10",
    },
    E04: {
      id: "E04",
      stepId: "S04",
      title: "yarn node -list RUNNING",
      filename: "E04_yarn_node_list_running.png",
      notes: "Perintah yarn node -list pada ResourceManager menunjukkan NodeManager aktif dalam state RUNNING.",
      timestamp: "2026-10-19 09:05:22",
    },
    E05: {
      id: "E05",
      stepId: "S05",
      title: "Spark Master JSON status ALIVE & 2 workers",
      filename: "E05_spark_master_json_alive.png",
      notes: "Tangkapan output curl http://localhost:8080/json membuktikan status master ALIVE dengan aliveworkers bernilai 2.",
      timestamp: "2026-10-19 09:06:40",
    },
    E06: {
      id: "E06",
      stepId: "S06",
      title: "hdfs dfs -mkdir /user/<NIM>/input",
      filename: "E06_hdfs_mkdir_user_input.png",
      notes: "Pembuatan direktori input HDFS untuk user NIM tanpa menghasilkan pesan galat atau peringatan.",
      timestamp: "2026-10-19 09:08:12",
    },
    E07: {
      id: "E07",
      stepId: "S07",
      title: "Pembuatan dataset 1500 baris wc -l",
      filename: "E07_dataset_generate_wc_lines.png",
      notes: "Eksekusi loop bash pembuatan kata dan verifikasi wc -l /tmp/words.txt menghasilkan output tepat 1500 baris.",
      timestamp: "2026-10-19 09:10:05",
    },
    E08: {
      id: "E08",
      stepId: "S08",
      title: "hdfs dfs -put & ls dataset di HDFS",
      filename: "E08_hdfs_put_dataset_ls.png",
      notes: "Upload file words.txt ke direktori HDFS dan verifikasi daftar file hdfs dfs -ls menampilkan file words.txt dengan benar.",
      timestamp: "2026-10-19 09:12:30",
    },
    E09: {
      id: "E09",
      stepId: "S09",
      title: "hdfs fsck status HEALTHY & replikasi 2",
      filename: "E09_hdfs_fsck_healthy_rep2.png",
      notes: "Pemeriksaan integritas hdfs fsck memvalidasi Status: HEALTHY dengan faktor replikasi blok rata-rata tepat 2.0.",
      timestamp: "2026-10-19 09:15:15",
    },
    E10: {
      id: "E10",
      stepId: "S10",
      title: "Eksekusi Hadoop MapReduce selesai sukses",
      filename: "E10_hadoop_mapreduce_job_success.png",
      notes: "Log terminal eksekusi Hadoop MapReduce contoh wordcount selesai dengan status completed successfully.",
      timestamp: "2026-10-19 09:20:45",
    },
    E11: {
      id: "E11",
      stepId: "S11",
      title: "Keluaran part-r-00000 MapReduce",
      filename: "E11_mapreduce_output_part_r.png",
      notes: "Output part-r-00000 menampilkan frekuensi 5 kata yang sesuai persis dengan formula dataset acuan.",
      timestamp: "2026-10-19 09:22:10",
    },
    E12: {
      id: "E12",
      stepId: "S12",
      title: "yarn application -list FINISHED/SUCCEEDED",
      filename: "E12_yarn_app_list_succeeded.png",
      notes: "Daftar aplikasi YARN menunjukkan riwayat job MapReduce berstatus State: FINISHED dan Final-State: SUCCEEDED.",
      timestamp: "2026-10-19 09:24:00",
    },
    E13: {
      id: "E13",
      stepId: "S13",
      title: "spark-submit exit code 0",
      filename: "E13_spark_submit_exit_code_0.png",
      notes: "Eksekusi spark-submit aplikasi wc.py ke Spark Standalone master selesai dan echo $? mengembalikan nilai 0.",
      timestamp: "2026-10-19 09:30:15",
    },
    E14: {
      id: "E14",
      stepId: "S14",
      title: "Keluaran part-00000 Spark",
      filename: "E14_spark_output_part_00000.png",
      notes: "File keluaran part-00000 dari direktori out_spark HDFS menampilkan 5 baris kata dan frekuensi yang identik.",
      timestamp: "2026-10-19 09:32:00",
    },
    E15: {
      id: "E15",
      stepId: "S15",
      title: "Spark Master JSON completedapps FINISHED",
      filename: "E15_spark_json_completedapps_finished.png",
      notes: "Endpoint master JSON /json mencatat completedapps memuat aplikasi TP1-WordCount dengan status FINISHED.",
      timestamp: "2026-10-19 09:33:45",
    },
    E16: {
      id: "E16",
      stepId: "UI",
      title: "Tangkapan layar Web UI (NameNode 9870, YARN 8088, Spark 8080, Spark App 4040)",
      filename: "E16_combined_web_ui_dashboards.png",
      notes: "Kompilasi tangkapan layar antarmuka Web UI NameNode (port 9870), YARN (port 8088), Spark Master (port 8080), dan Spark UI (port 4040).",
      timestamp: "2026-10-19 09:40:00",
    },
  },
  videoAssignments: {
    S1: "m1",
    S2: "m1",
    S3: "m1",
    S4: "m2",
    S5: "m3",
    S6: "m2",
    S7: "m3",
  },
  videoChecklist: {
    terminalReal: true,
    bukanSlideSaja: true,
    tiapAnggotaTampil: true,
    tanpaKredensial: true,
  },
  disclosureRows: [
    {
      id: "d1",
      tool: "Claude 3.7 Sonnet / ChatGPT",
      tujuan: "Membuat template awal skrip bash dan konfigurasi docker-compose",
      diambil: "Struktur service namenode dan spark-master standar",
      ditolak: "Konfigurasi memory default yang terlalu besar (>8GB) yang menyebabkan OOM di host",
      verifikasi: "Disesuaikan ke alokasi RAM 512m untuk executor dan diuji lokal pada Docker Desktop WSL2",
    },
  ],
  noAiUsage: false,
  rubricChecks: {
    "Pemahaman masalah_0": true,
    "Pemahaman masalah_1": true,
    "Pemahaman masalah_2": true,
    "Ketepatan metode_0": true,
    "Ketepatan metode_1": true,
    "Ketepatan metode_2": true,
    "Eksekusi (tools & AI + disclosure)_0": true,
    "Eksekusi (tools & AI + disclosure)_1": true,
    "Eksekusi (tools & AI + disclosure)_2": true,
    "Kualitas dan akurasi hasil_0": true,
    "Kualitas dan akurasi hasil_1": true,
    "Kualitas dan akurasi hasil_2": true,
    "Validasi dan video walkthrough_0": true,
    "Validasi dan video walkthrough_1": true,
    "Validasi dan video walkthrough_2": true,
  },
};

export const INITIAL_STATE: AppState = {
  sampleMode: false,
  theme: "dark",
  members: [
    {
      id: "m1",
      nama: "",
      nim: "",
      porsi: "Docker & HDFS",
    },
  ],
  prerequisites: {
    ramAllocated: false,
    wsl2Ready: false,
    portsFree: false,
  },
  steps: {},
  monitorLogs: {
    dfsadmin: "",
    yarnNodes: "",
    yarnApps: "",
    fsck: "",
    mrLog: "",
    sparkLog: "",
    sparkJson: "",
    sparkExitCode: "",
  },
  wordCountMR: "",
  wordCountSpark: "",
  evidence: {},
  videoAssignments: {},
  videoChecklist: {
    terminalReal: false,
    bukanSlideSaja: false,
    tiapAnggotaTampil: false,
    tanpaKredensial: false,
  },
  disclosureRows: [
    {
      id: "d1",
      tool: "[ISI]",
      tujuan: "[ISI]",
      diambil: "[ISI]",
      ditolak: "[ISI]",
      verifikasi: "[ISI]",
    },
  ],
  noAiUsage: false,
  rubricChecks: {},
};
