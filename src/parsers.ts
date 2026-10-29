export interface DfsAdminParsed {
  live: number;
  used?: number;
  remaining?: number;
  underRep?: number;
  corrupt?: number;
  missing?: number;
  rawMatchedLines: string[];
}

export function parseDfsAdmin(text: string): DfsAdminParsed | null {
  if (!text || !text.trim()) return null;
  const liveMatch = text.match(/Live datanodes \((\d+)\)/);
  if (!liveMatch) return null;

  const usedMatch = text.match(/DFS Used:\s+(\d+)/);
  const remainingMatch = text.match(/DFS Remaining:\s+(\d+)/);
  const underRepMatch = text.match(/Under replicated blocks:\s+(\d+)/);
  const corruptMatch = text.match(/Blocks with corrupt replicas:\s+(\d+)/);
  const missingMatch = text.match(/Missing blocks:\s+(\d+)/);

  const rawMatchedLines: string[] = [];
  if (liveMatch[0]) rawMatchedLines.push(liveMatch[0]);
  if (underRepMatch?.[0]) rawMatchedLines.push(underRepMatch[0]);

  return {
    live: parseInt(liveMatch[1], 10),
    used: usedMatch ? parseInt(usedMatch[1], 10) : undefined,
    remaining: remainingMatch ? parseInt(remainingMatch[1], 10) : undefined,
    underRep: underRepMatch ? parseInt(underRepMatch[1], 10) : undefined,
    corrupt: corruptMatch ? parseInt(corruptMatch[1], 10) : undefined,
    missing: missingMatch ? parseInt(missingMatch[1], 10) : undefined,
    rawMatchedLines,
  };
}

export interface YarnNodesParsed {
  total: number;
  running: number;
  nodeIds: string[];
}

export function parseYarnNodes(text: string): YarnNodesParsed | null {
  if (!text || !text.trim()) return null;
  const totalMatch = text.match(/Total Nodes:(\d+)/);
  if (!totalMatch) return null;

  const lines = text.split("\n");
  const runningLines = lines.filter((l) => l.includes("RUNNING"));
  const nodeIds: string[] = [];

  for (const line of runningLines) {
    const idMatch = line.match(/^(\S+:\d+)/);
    if (idMatch) nodeIds.push(idMatch[1]);
  }

  return {
    total: parseInt(totalMatch[1], 10),
    running: runningLines.length,
    nodeIds,
  };
}

export interface YarnAppsParsed {
  apps: Array<{ appId: string; state: string; finalStatus: string; appName: string }>;
  successCount: number;
}

export function parseYarnApps(text: string): YarnAppsParsed | null {
  if (!text || !text.trim()) return null;
  const lines = text.split("\n");
  const appLines = lines.filter((l) => /application_\d+_\d+/.test(l));
  if (appLines.length === 0) return null;

  const apps: Array<{ appId: string; state: string; finalStatus: string; appName: string }> = [];
  let successCount = 0;

  for (const line of appLines) {
    const idMatch = line.match(/(application_\d+_\d+)/);
    const appId = idMatch ? idMatch[1] : "";
    const isFinished = /FINISHED/.test(line);
    const isSucceeded = /SUCCEEDED/.test(line);

    // Extract app name if available
    const tokens = line.trim().split(/\s+/);
    const appName = tokens.length > 1 ? tokens[1] : "unknown";

    if (isFinished && isSucceeded) {
      successCount++;
    }
    apps.push({
      appId,
      appName,
      state: isFinished ? "FINISHED" : (/RUNNING/.test(line) ? "RUNNING" : "OTHER"),
      finalStatus: isSucceeded ? "SUCCEEDED" : (/FAILED/.test(line) ? "FAILED" : "OTHER"),
    });
  }

  return { apps, successCount };
}

export interface FsckParsed {
  status: "HEALTHY" | "CORRUPT";
  blocks: number;
  avgRep: number;
  minimallyReplicatedPct?: number;
}

export function parseFsck(text: string): FsckParsed | null {
  if (!text || !text.trim()) return null;
  const statusMatch = text.match(/Status:\s+(HEALTHY|CORRUPT)/);
  const blocksMatch = text.match(/Total blocks \(validated\):\s+(\d+)/);
  const avgRepMatch = text.match(/Average block replication:\s+([\d.]+)/);

  if (!statusMatch || !blocksMatch || !avgRepMatch) return null;

  const minRepMatch = text.match(/Minimally replicated blocks:\s+\d+\s+\(([\d.]+) %\)/);

  return {
    status: statusMatch[1] as "HEALTHY" | "CORRUPT",
    blocks: parseInt(blocksMatch[1], 10),
    avgRep: parseFloat(avgRepMatch[1]),
    minimallyReplicatedPct: minRepMatch ? parseFloat(minRepMatch[1]) : undefined,
  };
}

export interface MrLogParsed {
  ok: boolean;
  mapIn: number | null;
  redOut: number | null;
  mapMs: number | null;
  reduceMs: number | null;
}

export function parseMrLog(text: string): MrLogParsed | null {
  if (!text || !text.trim()) return null;
  const ok = /completed successfully/i.test(text);
  const mapInMatch = text.match(/Map input records=(\d+)/i);
  const redOutMatch = text.match(/Reduce output records=(\d+)/i);
  const mapMsMatch = text.match(/Total time spent by all map tasks \(ms\)=(\d+)/i);
  const redMsMatch = text.match(/Total time spent by all reduce tasks \(ms\)=(\d+)/i);

  if (!ok && !mapInMatch && !redOutMatch && !mapMsMatch) return null;

  return {
    ok,
    mapIn: mapInMatch ? parseInt(mapInMatch[1], 10) : null,
    redOut: redOutMatch ? parseInt(redOutMatch[1], 10) : null,
    mapMs: mapMsMatch ? parseInt(mapMsMatch[1], 10) : null,
    reduceMs: redMsMatch ? parseInt(redMsMatch[1], 10) : null,
  };
}

export interface SparkLogParsed {
  appId: string | null;
  executorsCount: number;
  jobFinished: boolean;
  jobSeconds: number | null;
  stopped: boolean;
  rawExecutorMatches: string[];
}

export function parseSparkLog(text: string): SparkLogParsed | null {
  if (!text || !text.trim()) return null;

  // Support both classic and Log4j2 pattern variations
  const appIdMatch = text.match(/Connected to Spark cluster with app ID\s+(app-\S+)/i);

  // Pattern 1: StandaloneSchedulerBackend "Executor added: ... with X core"
  const executorMatchesStandard = [
    ...text.matchAll(/Executor added: (\S+) on (\S+) \((\S+)\) with (\d+) core/gi),
  ];

  // Pattern 2: CoarseGrainedSchedulerBackend / Log4j2 "Granted executor ID app-... on hostPort with X cores"
  const executorMatchesAlt = [
    ...text.matchAll(/Granted executor ID (\S+) on hostPort (\S+) with (\d+) core/gi),
  ];

  // Pattern 3: Registered executor NettyRpcEndpointRef
  const executorMatchesRegistered = [
    ...text.matchAll(/Registered executor: NettyRpcEndpointRef\(spark:\/\/(\S+)\) with ID (\S+)/gi),
  ];

  const distinctExecutorIds = new Set<string>();
  const rawExecutorMatches: string[] = [];

  executorMatchesStandard.forEach((m) => {
    distinctExecutorIds.add(m[1]);
    rawExecutorMatches.push(m[0]);
  });
  executorMatchesAlt.forEach((m) => {
    distinctExecutorIds.add(m[1]);
    rawExecutorMatches.push(m[0]);
  });
  executorMatchesRegistered.forEach((m) => {
    distinctExecutorIds.add(m[2]);
    rawExecutorMatches.push(m[0]);
  });

  // Duration matcher: supports "took 3.421500 s", "finished: ... in 3.42s", or "took 3421 ms"
  const jobSecMatch = text.match(/Job (\d+) finished: .*, took ([\d.]+) s/i);
  const jobMsMatch = text.match(/Job (\d+) finished: .*, took ([\d.]+) ms/i);

  let jobSeconds: number | null = null;
  if (jobSecMatch) {
    jobSeconds = parseFloat(jobSecMatch[2]);
  } else if (jobMsMatch) {
    jobSeconds = parseFloat(jobMsMatch[2]) / 1000;
  }

  const stopped = /Successfully stopped SparkContext/i.test(text);

  if (!appIdMatch && distinctExecutorIds.size === 0 && !jobSecMatch && !stopped) {
    return null;
  }

  return {
    appId: appIdMatch ? appIdMatch[1] : null,
    executorsCount: distinctExecutorIds.size,
    jobFinished: !!jobSecMatch || !!jobMsMatch,
    jobSeconds,
    stopped,
    rawExecutorMatches,
  };
}

export interface SparkJsonParsed {
  status: string;
  aliveworkers: number;
  workers: Array<{ id?: string; state: string; cores?: number; memory?: number }>;
  completedapps: Array<{ id?: string; name?: string; state: string; duration?: number }>;
}

export function parseSparkJson(text: string): SparkJsonParsed | null {
  if (!text || !text.trim()) return null;
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== "object") return null;
    return {
      status: String(data.status || ""),
      aliveworkers: typeof data.aliveworkers === "number" ? data.aliveworkers : 0,
      workers: Array.isArray(data.workers) ? data.workers : [],
      completedapps: Array.isArray(data.completedapps) ? data.completedapps : [],
    };
  } catch {
    return null;
  }
}

/**
 * Diagnostic record for WordCount lines
 */
export interface WordCountLineDiagnostic {
  lineNumber: number;
  rawText: string;
  word?: string;
  count?: number;
  separatorType: "TAB" | "SPACE_EXPANDED" | "MALFORMED";
  errorMessage?: string;
}

export interface WordCountParseResult {
  map: Map<string, number>;
  totalLines: number;
  diagnostics: WordCountLineDiagnostic[];
  hasSpaceExpandedTabs: boolean;
  allTabsStrict: boolean;
  totalSum: number;
}

/**
 * Parses wordcount output with field-tolerant awareness:
 * - Detects both strict TAB (`\t`) and space-expanded columns (from terminal copy-paste)
 * - Reports exact line diagnostics on failure
 */
export function parseWordCountOutputDetailed(text: string): WordCountParseResult | null {
  if (!text || !text.trim()) return null;

  const lines = text.trim().split(/\r?\n/);
  const result = new Map<string, number>();
  const diagnostics: WordCountLineDiagnostic[] = [];
  let hasSpaceExpanded = false;
  let allStrict = true;
  let runningSum = 0;

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check strict tab match first
    const strictTabMatch = trimmed.match(/^(\S+)\t(\d+)$/);
    if (strictTabMatch) {
      const word = strictTabMatch[1].toLowerCase();
      const count = parseInt(strictTabMatch[2], 10);
      result.set(word, count);
      runningSum += count;
      diagnostics.push({
        lineNumber: idx + 1,
        rawText: line,
        word,
        count,
        separatorType: "TAB",
      });
      continue;
    }

    // Check space-expanded whitespace match (e.g. from PowerShell or terminal selection)
    const spaceMatch = trimmed.match(/^(\S+)[ \t]+(\d+)$/);
    if (spaceMatch) {
      allStrict = false;
      hasSpaceExpanded = true;
      const word = spaceMatch[1].toLowerCase();
      const count = parseInt(spaceMatch[2], 10);
      result.set(word, count);
      runningSum += count;
      diagnostics.push({
        lineNumber: idx + 1,
        rawText: line,
        word,
        count,
        separatorType: "SPACE_EXPANDED",
      });
      continue;
    }

    // If neither matches, this line is malformed
    diagnostics.push({
      lineNumber: idx + 1,
      rawText: line,
      separatorType: "MALFORMED",
      errorMessage: `Format baris tidak sesuai (harus: kata<TAB>angka). Ditemukan: "${trimmed.substring(0, 30)}"`,
    });
    return null; // Strict integrity: if any non-empty line fails, parse returns null
  }

  if (result.size === 0) return null;

  return {
    map: result,
    totalLines: diagnostics.length,
    diagnostics,
    hasSpaceExpandedTabs: hasSpaceExpanded,
    allTabsStrict: allStrict,
    totalSum: runningSum,
  };
}

/**
 * Backward compatible helper for existing callers
 */
export function parseWordCountOutput(text: string): Map<string, number> | null {
  const detailed = parseWordCountOutputDetailed(text);
  return detailed ? detailed.map : null;
}
