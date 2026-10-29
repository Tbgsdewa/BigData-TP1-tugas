import { DATASET } from "./constants";
import {
  DfsAdminParsed,
  FsckParsed,
  MrLogParsed,
  SparkJsonParsed,
  SparkLogParsed,
  WordCountParseResult,
  YarnAppsParsed,
  YarnNodesParsed,
} from "./parsers";
import { StatusVerdict } from "./types";

export interface MonitorEvaluation {
  dfsAdmin: {
    verdict: StatusVerdict;
    details: string;
    subStatuses: {
      live: StatusVerdict;
      underRep: StatusVerdict;
      corrupt: StatusVerdict;
      missing: StatusVerdict;
    };
  };
  yarnNodes: {
    verdict: StatusVerdict;
    details: string;
  };
  yarnApps: {
    verdict: StatusVerdict;
    details: string;
  };
  fsck: {
    verdict: StatusVerdict;
    details: string;
  };
  mrLog: {
    verdict: StatusVerdict;
    details: string;
    durationMs: number | null; // INFORMASI ONLY - NO PASS/FAIL
  };
  sparkLog: {
    verdict: StatusVerdict;
    details: string;
    durationSec: number | null; // INFORMASI ONLY - NO PASS/FAIL
  };
  sparkJson: {
    verdict: StatusVerdict;
    details: string;
  };
  sparkExitCode: {
    verdict: StatusVerdict;
    details: string;
  };
}

export function evaluateDfsAdmin(parsed: DfsAdminParsed | null): MonitorEvaluation["dfsAdmin"] {
  if (!parsed) {
    return {
      verdict: "TIDAK TERBACA",
      details: "Output teks dfsadmin belum valid atau kosong",
      subStatuses: {
        live: "TIDAK TERBACA",
        underRep: "TIDAK TERBACA",
        corrupt: "TIDAK TERBACA",
        missing: "TIDAK TERBACA",
      },
    };
  }

  let liveVerdict: StatusVerdict = "FAIL";
  if (parsed.live === 2) liveVerdict = "PASS";
  else if (parsed.live === 1) liveVerdict = "WARN";

  let underRepVerdict: StatusVerdict = "PASS";
  if (parsed.underRep !== undefined && parsed.underRep > 0) underRepVerdict = "WARN";

  let corruptVerdict: StatusVerdict = "PASS";
  if (parsed.corrupt !== undefined && parsed.corrupt > 0) corruptVerdict = "FAIL";

  let missingVerdict: StatusVerdict = "PASS";
  if (parsed.missing !== undefined && parsed.missing > 0) missingVerdict = "FAIL";

  let overall: StatusVerdict = "PASS";
  if (liveVerdict === "FAIL" || corruptVerdict === "FAIL" || missingVerdict === "FAIL") {
    overall = "FAIL";
  } else if (liveVerdict === "WARN" || underRepVerdict === "WARN") {
    overall = "WARN";
  }

  const details = `Live DataNodes: ${parsed.live}/2, Under-replicated: ${parsed.underRep ?? 0}, Corrupt: ${parsed.corrupt ?? 0}, Missing: ${parsed.missing ?? 0}`;
  return {
    verdict: overall,
    details,
    subStatuses: {
      live: liveVerdict,
      underRep: underRepVerdict,
      corrupt: corruptVerdict,
      missing: missingVerdict,
    },
  };
}

export function evaluateYarnNodes(parsed: YarnNodesParsed | null): MonitorEvaluation["yarnNodes"] {
  if (!parsed) {
    return {
      verdict: "TIDAK TERBACA",
      details: "Output yarn node -list belum valid atau kosong",
    };
  }

  const verdict: StatusVerdict = parsed.running >= 1 ? "PASS" : "FAIL";
  return {
    verdict,
    details: `Total: ${parsed.total}, Running: ${parsed.running}`,
  };
}

export function evaluateYarnApps(parsed: YarnAppsParsed | null): MonitorEvaluation["yarnApps"] {
  if (!parsed) {
    return {
      verdict: "TIDAK TERBACA",
      details: "Output yarn application -list belum valid atau kosong",
    };
  }

  const verdict: StatusVerdict = parsed.successCount >= 1 ? "PASS" : "FAIL";
  return {
    verdict,
    details: `${parsed.successCount} aplikasi berstatus FINISHED & SUCCEEDED (total ${parsed.apps.length})`,
  };
}

export function evaluateFsck(parsed: FsckParsed | null): MonitorEvaluation["fsck"] {
  if (!parsed) {
    return {
      verdict: "TIDAK TERBACA",
      details: "Output hdfs fsck belum valid atau kosong",
    };
  }

  const isHealthy = parsed.status === "HEALTHY";
  const repOk = parsed.avgRep >= 2.0;
  const verdict: StatusVerdict = isHealthy && repOk ? "PASS" : "FAIL";

  return {
    verdict,
    details: `Status: ${parsed.status}, Total Blocks: ${parsed.blocks}, Avg Replication: ${parsed.avgRep.toFixed(1)} (Min 2.0)`,
  };
}

export function evaluateMrLog(parsed: MrLogParsed | null): MonitorEvaluation["mrLog"] {
  if (!parsed) {
    return {
      verdict: "TIDAK TERBACA",
      details: "Output log MapReduce belum valid atau kosong",
      durationMs: null,
    };
  }

  const verdict: StatusVerdict = parsed.ok ? "PASS" : "FAIL";
  const details = parsed.ok
    ? `Completed successfully. Map in: ${parsed.mapIn ?? "-"}, Reduce out: ${parsed.redOut ?? "-"}`
    : "Job MapReduce belum terdeteksi 'completed successfully'";

  return {
    verdict,
    details,
    durationMs: parsed.mapMs,
  };
}

export function evaluateSparkLog(parsed: SparkLogParsed | null): MonitorEvaluation["sparkLog"] {
  if (!parsed) {
    return {
      verdict: "TIDAK TERBACA",
      details: "Output log spark-submit belum valid atau kosong",
      durationSec: null,
    };
  }

  let verdict: StatusVerdict = "FAIL";
  if (parsed.executorsCount === 2) verdict = "PASS";
  else if (parsed.executorsCount === 1) verdict = "WARN";

  let details = `Executors ditambahkan: ${parsed.executorsCount}/2`;
  if (parsed.appId) details += ` (App: ${parsed.appId})`;
  if (parsed.stopped) details += ", SparkContext stopped";

  return {
    verdict,
    details,
    durationSec: parsed.jobSeconds,
  };
}

export function evaluateSparkJson(parsed: SparkJsonParsed | null): MonitorEvaluation["sparkJson"] {
  if (!parsed) {
    return {
      verdict: "TIDAK TERBACA",
      details: "Respon JSON Spark Master belum valid atau format salah",
    };
  }

  const isAlive = parsed.status === "ALIVE";
  let workerVerdict: StatusVerdict = "FAIL";
  if (parsed.aliveworkers === 2) workerVerdict = "PASS";
  else if (parsed.aliveworkers === 1) workerVerdict = "WARN";

  let overall: StatusVerdict = "FAIL";
  if (isAlive && workerVerdict === "PASS") overall = "PASS";
  else if (isAlive && workerVerdict === "WARN") overall = "WARN";

  const finishedApps = parsed.completedapps.filter((a) => a.state === "FINISHED").length;

  return {
    verdict: overall,
    details: `Master Status: ${parsed.status}, Alive Workers: ${parsed.aliveworkers}/2, Completed Apps: ${finishedApps}`,
  };
}

export function evaluateSparkExitCode(codeStr: string): MonitorEvaluation["sparkExitCode"] {
  const trimmed = codeStr.trim();
  if (trimmed === "") {
    return {
      verdict: "TIDAK TERBACA",
      details: "Exit code belum dimasukkan",
    };
  }
  const code = parseInt(trimmed, 10);
  if (isNaN(code)) {
    return {
      verdict: "TIDAK TERBACA",
      details: "Exit code bukan angka",
    };
  }
  return {
    verdict: code === 0 ? "PASS" : "FAIL",
    details: `Exit code: ${code} (0 = PASS)`,
  };
}

export interface ValidationDifference {
  word: string;
  expected: number;
  mr: number | null;
  spark: number | null;
  diffExplanation: string;
}

export interface WordCountComparisonResult {
  verdict: "VALID" | "BELUM VALID";
  isMatchKeys: boolean;
  isMatchCounts: boolean;
  isTotalWords1500: boolean;
  isMrEqualsSpark: boolean;
  mrTotalWords: number;
  sparkTotalWords: number;
  exactMatchCount: number;
  totalDistinctWords: number;
  parityRatio: number; // 0.0 - 100.0%
  hasSpaceExpandedTabs: boolean;
  differences: ValidationDifference[];
}

export function compareWordCounts(
  mrMap: Map<string, number> | null,
  sparkMap: Map<string, number> | null,
  mrDetailed?: WordCountParseResult | null,
  sparkDetailed?: WordCountParseResult | null
): WordCountComparisonResult {
  const differences: ValidationDifference[] = [];
  const expectedCounts = DATASET.counts;
  const expectedKeys = Object.keys(expectedCounts).sort();

  if (!mrMap || !sparkMap) {
    return {
      verdict: "BELUM VALID",
      isMatchKeys: false,
      isMatchCounts: false,
      isTotalWords1500: false,
      isMrEqualsSpark: false,
      mrTotalWords: 0,
      sparkTotalWords: 0,
      exactMatchCount: 0,
      totalDistinctWords: 0,
      parityRatio: 0,
      hasSpaceExpandedTabs: false,
      differences: [
        {
          word: "STATUS",
          expected: DATASET.totalWords,
          mr: null,
          spark: null,
          diffExplanation: !mrMap && !sparkMap
            ? "Teks keluaran MapReduce dan Spark belum diisi atau format baris tidak terbaca."
            : !mrMap
            ? "Teks keluaran MapReduce belum berformat valid kata<TAB>angka."
            : "Teks keluaran Spark belum berformat valid kata<TAB>angka.",
        },
      ],
    };
  }

  // Calculate totals
  let mrTotal = 0;
  mrMap.forEach((v) => (mrTotal += v));
  let sparkTotal = 0;
  sparkMap.forEach((v) => (sparkTotal += v));

  // 1. Check keys exact
  const mrKeys = Array.from(mrMap.keys()).sort();
  const sparkKeys = Array.from(sparkMap.keys()).sort();

  const isMrKeysExact =
    mrKeys.length === expectedKeys.length &&
    mrKeys.every((k, i) => k === expectedKeys[i]);

  const isSparkKeysExact =
    sparkKeys.length === expectedKeys.length &&
    sparkKeys.every((k, i) => k === expectedKeys[i]);

  const isMatchKeys = isMrKeysExact && isSparkKeysExact;

  // 2. Check counts exact against expected
  let isMatchCounts = true;
  let exactMatchCount = 0;
  const allEncounteredKeys = Array.from(
    new Set([...expectedKeys, ...mrKeys, ...sparkKeys])
  ).sort();

  for (const word of allEncounteredKeys) {
    const exp = expectedCounts[word] ?? 0;
    const mrVal = mrMap.get(word) ?? null;
    const spVal = sparkMap.get(word) ?? null;

    const mrMatches = mrVal === exp;
    const spMatches = spVal === exp;

    if (mrMatches && spMatches && exp > 0) {
      exactMatchCount++;
    } else {
      isMatchCounts = false;
      const reasons: string[] = [];
      if (exp === 0) reasons.push("Kunci ekstra tidak ada dalam dataset acuan");
      if (mrVal !== exp) reasons.push(`MR=${mrVal ?? "hilang"} (acuan=${exp})`);
      if (spVal !== exp) reasons.push(`Spark=${spVal ?? "hilang"} (acuan=${exp})`);
      differences.push({
        word,
        expected: exp,
        mr: mrVal,
        spark: spVal,
        diffExplanation: reasons.join(", "),
      });
    }
  }

  // 3. Total words = 1500
  const isTotalWords1500 = mrTotal === DATASET.totalWords && sparkTotal === DATASET.totalWords;

  // 4. MR == Spark
  let isMrEqualsSpark = mrKeys.length === sparkKeys.length && mrTotal === sparkTotal;
  if (isMrEqualsSpark) {
    for (const [k, v] of mrMap.entries()) {
      if (sparkMap.get(k) !== v) {
        isMrEqualsSpark = false;
        break;
      }
    }
  }

  // Parity ratio
  const parityRatio =
    allEncounteredKeys.length > 0
      ? Math.round((exactMatchCount / allEncounteredKeys.length) * 1000) / 10
      : 0;

  // Space-expanded tabs detection flag
  const hasSpaceExpandedTabs =
    !!mrDetailed?.hasSpaceExpandedTabs || !!sparkDetailed?.hasSpaceExpandedTabs;

  // Verdict "VALID" hanya jika keempatnya lulus
  const verdict: "VALID" | "BELUM VALID" =
    isMatchKeys && isMatchCounts && isTotalWords1500 && isMrEqualsSpark ? "VALID" : "BELUM VALID";

  return {
    verdict,
    isMatchKeys,
    isMatchCounts,
    isTotalWords1500,
    isMrEqualsSpark,
    mrTotalWords: mrTotal,
    sparkTotalWords: sparkTotal,
    exactMatchCount,
    totalDistinctWords: allEncounteredKeys.length,
    parityRatio,
    hasSpaceExpandedTabs,
    differences,
  };
}
