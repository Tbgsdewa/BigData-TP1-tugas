import test from "node:test";
import assert from "node:assert/strict";
import {
  parseDfsAdmin,
  parseFsck,
  parseMrLog,
  parseSparkJson,
  parseSparkLog,
  parseWordCountOutput,
  parseWordCountOutputDetailed,
  parseYarnApps,
  parseYarnNodes,
} from "./parsers.ts";
import { compareWordCounts } from "./validate.ts";
import { scanTextForCredentials } from "./scanner.ts";

test("parseDfsAdmin correctly extracts live datanodes and block health", () => {
  const sample = `
Configured Capacity: 100000000000
DFS Used: 204800
DFS Remaining: 80000000000
Live datanodes (2):
Under replicated blocks: 0
Blocks with corrupt replicas: 0
Missing blocks: 0
`;
  const result = parseDfsAdmin(sample);
  assert.ok(result);
  assert.equal(result.live, 2);
  assert.equal(result.used, 204800);
  assert.equal(result.underRep, 0);
  assert.equal(result.corrupt, 0);
  assert.equal(result.missing, 0);
});

test("parseDfsAdmin returns null on invalid or empty string", () => {
  assert.equal(parseDfsAdmin(""), null);
  assert.equal(parseDfsAdmin("Random error occurred"), null);
});

test("parseYarnNodes extracts running nodes correctly", () => {
  const sample = `
Total Nodes:1
         Node-Id             Node-State Node-Http-Address Number-of-Running-Containers
nodemanager:41234               RUNNING nodemanager:8042                            0
`;
  const result = parseYarnNodes(sample);
  assert.ok(result);
  assert.equal(result.total, 1);
  assert.equal(result.running, 1);
});

test("parseFsck extracts status, blocks and replication", () => {
  const sample = `
Status: HEALTHY
 Total size:    8192 B
 Total dirs:    1
 Total files:   1
 Total symlinks: 0
 Total blocks (validated): 1 (avg. block size 8192 B)
 Average block replication: 2.0
`;
  const result = parseFsck(sample);
  assert.ok(result);
  assert.equal(result.status, "HEALTHY");
  assert.equal(result.blocks, 1);
  assert.equal(result.avgRep, 2.0);
});

test("parseWordCountOutput parses words and counts with strict tabs", () => {
  const sample = "hadoop\t500\nspark\t400\nhdfs\t300\nyarn\t200\ndata\t100";
  const result = parseWordCountOutput(sample);
  assert.ok(result);
  assert.equal(result.get("hadoop"), 500);
  assert.equal(result.get("spark"), 400);
  assert.equal(result.get("hdfs"), 300);
  assert.equal(result.get("yarn"), 200);
  assert.equal(result.get("data"), 100);
});

test("parseWordCountOutputDetailed handles terminal space-expanded columns", () => {
  // PowerShell or terminal selection often expands tabs into multiple spaces:
  const spaceSample = "hadoop    500\nspark    400\nhdfs    300\nyarn    200\ndata    100";
  const result = parseWordCountOutputDetailed(spaceSample);
  assert.ok(result);
  assert.equal(result.hasSpaceExpandedTabs, true);
  assert.equal(result.allTabsStrict, false);
  assert.equal(result.totalSum, 1500);
  assert.equal(result.map.get("hadoop"), 500);
  assert.equal(result.map.get("spark"), 400);
});

test("parseWordCountOutputDetailed rejects genuinely malformed lines", () => {
  const malformedSample = "hadoop 500\ninvalid_token_without_count\ndata 100";
  const result = parseWordCountOutputDetailed(malformedSample);
  assert.equal(result, null);
});

test("parseSparkLog handles multiple executor formats and log4j variations", () => {
  const logSample = `
2026-10-21 14:00:00 INFO StandaloneSchedulerBackend: Connected to Spark cluster with app ID app-20261021-0001
2026-10-21 14:00:01 INFO StandaloneSchedulerBackend: Executor added: app-20261021-0001/0 on worker-1 (172.18.0.7:41123) with 1 core
2026-10-21 14:00:01 INFO StandaloneSchedulerBackend: Executor added: app-20261021-0001/1 on worker-2 (172.18.0.8:41125) with 1 core
2026-10-21 14:00:03 INFO DAGScheduler: Job 0 finished: saveAsTextFile at wc.py:6, took 3.250000 s
2026-10-21 14:00:04 INFO SparkContext: Successfully stopped SparkContext
`;
  const result = parseSparkLog(logSample);
  assert.ok(result);
  assert.equal(result.appId, "app-20261021-0001");
  assert.equal(result.executorsCount, 2);
  assert.equal(result.jobFinished, true);
  assert.equal(result.jobSeconds, 3.25);
  assert.equal(result.stopped, true);
});

test("compareWordCounts accurately validates matching datasets", () => {
  const mr = new Map([
    ["hadoop", 500],
    ["spark", 400],
    ["hdfs", 300],
    ["yarn", 200],
    ["data", 100],
  ]);
  const spark = new Map([
    ["hadoop", 500],
    ["spark", 400],
    ["hdfs", 300],
    ["yarn", 200],
    ["data", 100],
  ]);

  const res = compareWordCounts(mr, spark);
  assert.equal(res.verdict, "VALID");
  assert.equal(res.isMatchKeys, true);
  assert.equal(res.isMatchCounts, true);
  assert.equal(res.isTotalWords1500, true);
  assert.equal(res.isMrEqualsSpark, true);
  assert.equal(res.parityRatio, 100);
});

test("compareWordCounts rejects discrepant counts", () => {
  const mr = new Map([
    ["hadoop", 500],
    ["spark", 400],
    ["hdfs", 300],
    ["yarn", 200],
    ["data", 99], // mismatch
  ]);
  const spark = new Map([
    ["hadoop", 500],
    ["spark", 400],
    ["hdfs", 300],
    ["yarn", 200],
    ["data", 100],
  ]);

  const res = compareWordCounts(mr, spark);
  assert.equal(res.verdict, "BELUM VALID");
  assert.equal(res.differences.length > 0, true);
});

test("scanTextForCredentials catches passwords and tokens with line and col", () => {
  const text = "Normal line 1\napiKey = AIzaSyD9876543210123456789012345678901\npassword: supersecretpassword123";
  const findings = scanTextForCredentials(text, "test.txt");
  assert.ok(findings.length >= 2);
  assert.equal(findings[0].line, 2);
  assert.equal(findings[1].line, 3);
});
