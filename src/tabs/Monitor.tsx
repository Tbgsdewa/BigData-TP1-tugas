import React, { useState } from "react";
import { KNOWN_ISSUES } from "../constants";
import {
  parseDfsAdmin,
  parseFsck,
  parseMrLog,
  parseSparkJson,
  parseSparkLog,
  parseYarnApps,
  parseYarnNodes,
} from "../parsers";
import { AppState, StatusVerdict } from "../types";
import {
  evaluateDfsAdmin,
  evaluateFsck,
  evaluateMrLog,
  evaluateSparkExitCode,
  evaluateSparkJson,
  evaluateSparkLog,
  evaluateYarnApps,
  evaluateYarnNodes,
} from "../validate";
import { Chip, CopyButton, Panel, VerdictChip } from "../components/ui";

interface MonitorProps {
  state: AppState;
  onChange: (updater: (prev: AppState) => AppState) => void;
}

export const MonitorTab: React.FC<MonitorProps> = ({ state, onChange }) => {
  const [activeTabKey, setActiveTabKey] = useState<keyof typeof state.monitorLogs>("dfsadmin");

  const logs = state.monitorLogs;

  const handleUpdateLog = (key: keyof typeof state.monitorLogs, val: string) => {
    onChange((prev) => ({
      ...prev,
      monitorLogs: {
        ...prev.monitorLogs,
        [key]: val,
      },
    }));
  };

  // Evaluations
  const evalDfs = evaluateDfsAdmin(parseDfsAdmin(logs.dfsadmin));
  const evalYnNodes = evaluateYarnNodes(parseYarnNodes(logs.yarnNodes));
  const evalYnApps = evaluateYarnApps(parseYarnApps(logs.yarnApps));
  const evalFsck = evaluateFsck(parseFsck(logs.fsck));
  const evalMr = evaluateMrLog(parseMrLog(logs.mrLog));
  const evalSpLog = evaluateSparkLog(parseSparkLog(logs.sparkLog));
  const evalSpJson = evaluateSparkJson(parseSparkJson(logs.sparkJson));
  const evalSpExit = evaluateSparkExitCode(logs.sparkExitCode);

  // Check Known Issues in all logs
  const combinedLogText = Object.values(logs).join("\n");
  const detectedIssues = KNOWN_ISSUES.filter((ki) => ki.regex.test(combinedLogText));

  const logSources: Array<{
    key: keyof typeof state.monitorLogs;
    title: string;
    cmd: string;
    verdict: StatusVerdict;
    details: string;
  }> = [
    {
      key: "dfsadmin",
      title: "HDFS dfsadmin -report",
      cmd: "docker exec namenode hdfs dfsadmin -report",
      verdict: evalDfs.verdict,
      details: evalDfs.details,
    },
    {
      key: "yarnNodes",
      title: "YARN yarn node -list",
      cmd: "docker exec resourcemanager yarn node -list",
      verdict: evalYnNodes.verdict,
      details: evalYnNodes.details,
    },
    {
      key: "yarnApps",
      title: "YARN yarn application -list",
      cmd: "docker exec resourcemanager yarn application -list -appStates ALL",
      verdict: evalYnApps.verdict,
      details: evalYnApps.details,
    },
    {
      key: "fsck",
      title: "HDFS fsck words.txt",
      cmd: "docker exec namenode hdfs fsck /user/<NIM>/input/words.txt -files -blocks -locations",
      verdict: evalFsck.verdict,
      details: evalFsck.details,
    },
    {
      key: "mrLog",
      title: "Hadoop MapReduce Log",
      cmd: "Output terminal pada langkah S10",
      verdict: evalMr.verdict,
      details: evalMr.details,
    },
    {
      key: "sparkLog",
      title: "spark-submit Log",
      cmd: "Output terminal pada langkah S13",
      verdict: evalSpLog.verdict,
      details: evalSpLog.details,
    },
    {
      key: "sparkJson",
      title: "Spark Master JSON",
      cmd: "curl.exe -s http://localhost:8080/json",
      verdict: evalSpJson.verdict,
      details: evalSpJson.details,
    },
  ];

  const activeSource = logSources.find((s) => s.key === activeTabKey);
  const activeTitle = activeSource ? activeSource.title : "spark-submit Exit Code";
  const activeVerdict: StatusVerdict =
    activeTabKey === "dfsadmin"
      ? evalDfs.verdict
      : activeTabKey === "yarnNodes"
      ? evalYnNodes.verdict
      : activeTabKey === "yarnApps"
      ? evalYnApps.verdict
      : activeTabKey === "fsck"
      ? evalFsck.verdict
      : activeTabKey === "mrLog"
      ? evalMr.verdict
      : activeTabKey === "sparkLog"
      ? evalSpLog.verdict
      : evalSpJson.verdict;

  const rowAccent = (isActive: boolean) =>
    `border-l-2 ${isActive ? "border-l-accent" : "border-l-transparent"}`;

  return (
    <div className="space-y-6">
      {/* Panel 3 — Header pemantauan */}
      <Panel
        no="3"
        title="Pantauan Status Klaster"
        sub="Tempel keluaran terminal asli. Parser menolak menebak: format tidak cocok berarti TIDAK TERBACA, bukan status palsu."
        actions={
          <span className="page-meta">Toleransi galat: 0 · Nilai waktu hanya informasi</span>
        }
      >
        <p className="text-xs leading-relaxed text-ink-soft">
          Pilih satu sumber log pada tabel status di bawah untuk mempaste dan menguji teks mentah
          terminal. Verdict dihitung langsung dari isi textarea — kosong berarti TIDAK TERBACA.
        </p>
      </Panel>

      {/* Kendala teridentifikasi */}
      {detectedIssues.length > 0 && (
        <Panel
          title={`Terdeteksi ${detectedIssues.length} Kendala Teridentifikasi pada Log`}
          className="border-danger/50 bg-danger-wash/40"
          bodyClassName="space-y-2"
        >
          {detectedIssues.map((issue, idx) => (
            <div key={idx} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <Chip tone="danger">{issue.label}</Chip>
              <span className="text-xs text-ink-soft">Solusi: {issue.solution}</span>
            </div>
          ))}
        </Panel>
      )}

      {/* Tabel status sumber log */}
      <Panel title="Status Sumber Log" sub="Klik baris untuk memilih sumber yang aktif diedit." flush>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-xs">
            <caption className="sr-only">
              Status verdict setiap sumber log klaster; pilih baris untuk mengedit teks log
            </caption>
            <thead>
              <tr className="border-b border-line bg-surface-2">
                <th scope="col" className="label-micro px-4 py-2 font-normal">Sumber Log</th>
                <th scope="col" className="label-micro px-4 py-2 font-normal">Perintah</th>
                <th scope="col" className="label-micro px-4 py-2 font-normal">Verdict</th>
                <th scope="col" className="label-micro px-4 py-2 font-normal">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {logSources.map((item) => {
                const isActive = activeTabKey === item.key;
                return (
                  <tr
                    key={item.key}
                    onClick={() => setActiveTabKey(item.key)}
                    aria-current={isActive ? "true" : undefined}
                    className={`cursor-pointer transition-colors hover:bg-surface-2/70 ${
                      isActive ? "bg-surface-2" : ""
                    }`}
                  >
                    <td className={`px-4 py-2.5 align-top ${rowAccent(isActive)}`}>
                      <button
                        type="button"
                        onClick={() => setActiveTabKey(item.key)}
                        aria-pressed={isActive}
                        className={`text-left font-semibold transition-colors ${
                          isActive ? "text-ink" : "text-ink-soft hover:text-ink"
                        }`}
                      >
                        {item.title}
                      </button>
                    </td>
                    <td className={`px-4 py-2.5 align-top font-mono text-[11px] text-ink-muted ${rowAccent(isActive)}`}>
                      {item.cmd}
                    </td>
                    <td className={`px-4 py-2.5 align-top ${rowAccent(isActive)}`}>
                      <VerdictChip verdict={item.verdict} />
                    </td>
                    <td className={`px-4 py-2.5 align-top text-[11px] leading-relaxed text-ink-muted ${rowAccent(isActive)}`}>
                      {item.details}
                    </td>
                  </tr>
                );
              })}

              {/* Baris khusus: exit code dengan input kecil */}
              <tr className="bg-surface">
                <td className={`px-4 py-2.5 align-top ${rowAccent(false)}`}>
                  <span className="font-semibold text-ink-soft">spark-submit Exit Code</span>
                  <span className="label-micro mt-0.5 block">Input manual</span>
                </td>
                <td className={`px-4 py-2.5 align-top font-mono text-[11px] text-ink-muted ${rowAccent(false)}`}>
                  echo $LASTEXITCODE / $?
                </td>
                <td className={`px-4 py-2.5 align-top ${rowAccent(false)}`}>
                  <VerdictChip verdict={evalSpExit.verdict} />
                </td>
                <td className={`px-4 py-2.5 align-top ${rowAccent(false)}`}>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="0"
                      value={logs.sparkExitCode}
                      onChange={(e) => handleUpdateLog("sparkExitCode", e.target.value)}
                      aria-label="Kode keluar spark-submit"
                      className="field field-mono !w-16 !py-1 text-center font-semibold"
                    />
                    <span className="font-mono text-[11px] text-ink-muted">(0 = PASS)</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Informasi durasi — bukan bagian verdict */}
      <Panel
        title="Durasi Job"
        sub="Angka waktu semata-mata informasi eksekusi; tidak memengaruhi verdict validasi."
        bodyClassName="grid grid-cols-1 gap-px bg-line sm:grid-cols-2"
        flush
      >
        <div className="bg-surface px-4 py-3">
          <dt className="label-micro">Waktu CPU Map Tasks (MapReduce)</dt>
          <dd className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-sm font-semibold tabular-nums text-ink">
              {evalMr.durationMs !== null ? `${evalMr.durationMs} ms` : "N/A"}
            </span>
            <span className="status-chip chip-neutral">Informasi Saja</span>
          </dd>
        </div>
        <div className="bg-surface px-4 py-3">
          <dt className="label-micro">Durasi Job Spark (Job 0)</dt>
          <dd className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-sm font-semibold tabular-nums text-ink">
              {evalSpLog.durationSec !== null ? `${evalSpLog.durationSec} s` : "N/A"}
            </span>
            <span className="status-chip chip-neutral">Informasi Saja</span>
          </dd>
        </div>
      </Panel>

      {/* Editor log aktif */}
      <Panel
        title={
          <span className="flex flex-wrap items-baseline gap-2">
            <span>Sumber Log:</span>
            <span className="font-mono text-accent">{activeTitle}</span>
          </span>
        }
        actions={<VerdictChip verdict={activeVerdict} />}
      >
        {/* Caption perintah ala CommandBlock */}
        <div className="mb-3 flex items-center justify-between gap-2 rounded-sm border border-code-line bg-code-2 px-3 py-1.5">
          <span className="flex min-w-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-code-muted">
            <span aria-hidden="true" className="shrink-0 text-accent-strong">$</span>
            <span className="truncate normal-case">
              {activeSource ? activeSource.cmd : "spark-submit exit code manual"}
            </span>
          </span>
          <CopyButton
            text={activeSource ? activeSource.cmd : logs.sparkExitCode}
            className="!border-code-line !bg-transparent !text-code-muted hover:!text-code-ink"
          />
        </div>

        <label htmlFor="monitor-log-input" className="sr-only">
          Isi log {activeTitle}
        </label>
        <textarea
          id="monitor-log-input"
          rows={11}
          value={logs[activeTabKey]}
          onChange={(e) => handleUpdateLog(activeTabKey, e.target.value)}
          placeholder={`Tempelkan output teks mentah dari terminal untuk ${activeTabKey}...`}
          className="w-full rounded-sm border border-code-line bg-code px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-code-ink placeholder:text-code-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] text-ink-muted">
            Karakter: {logs[activeTabKey]?.length || 0}
          </span>
          <button
            type="button"
            onClick={() => handleUpdateLog(activeTabKey, "")}
            className="btn btn-ghost !text-xs"
          >
            Kosongkan Teks
          </button>
        </div>
      </Panel>
    </div>
  );
};
