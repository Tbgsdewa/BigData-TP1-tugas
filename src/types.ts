export type MemberRole =
  | "Docker & HDFS"
  | "MapReduce & YARN"
  | "Spark & submit"
  | "Validasi & laporan";

export interface Member {
  id: string;
  nama: string;
  nim: string;
  porsi: MemberRole;
}

export interface Prerequisites {
  ramAllocated: boolean;
  wsl2Ready: boolean;
  portsFree: boolean;
}

export interface StepState {
  completed: boolean;
  notes: string;
}

export interface MonitorLogs {
  dfsadmin: string;
  yarnNodes: string;
  yarnApps: string;
  fsck: string;
  mrLog: string;
  sparkLog: string;
  sparkJson: string;
  sparkExitCode: string;
}

export type StatusVerdict = "PASS" | "WARN" | "FAIL" | "TIDAK TERBACA";

export interface EvidenceItem {
  id: string;
  stepId: string;
  title: string;
  filename: string;
  notes: string;
  timestamp: string;
}

export interface DisclosureRow {
  id: string;
  tool: string;
  tujuan: string;
  diambil: string;
  ditolak: string;
  verifikasi: string;
}

export interface RubricChecklist {
  [key: string]: boolean;
}

export interface AppState {
  sampleMode: boolean;
  theme: "light" | "dark";
  members: Member[];
  prerequisites: Prerequisites;
  steps: Record<string, StepState>;
  monitorLogs: MonitorLogs;
  wordCountMR: string;
  wordCountSpark: string;
  evidence: Record<string, EvidenceItem>;
  videoAssignments: Record<string, string>; // segmentId -> memberId
  videoChecklist: {
    terminalReal: boolean;
    bukanSlideSaja: boolean;
    tiapAnggotaTampil: boolean;
    tanpaKredensial: boolean;
  };
  disclosureRows: DisclosureRow[];
  noAiUsage: boolean;
  rubricChecks: RubricChecklist;
}
