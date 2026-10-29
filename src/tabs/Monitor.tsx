import React, { useState } from "react";
import { Activity, Clock, Info } from "lucide-react";
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

  // Render squared status indicator (strictly anti-pill)
  const renderBadge = (status: StatusVerdict) => {
    switch (status) {
      case "PASS":
        return (
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/80">
            PASS
          </span>
        );
      case "WARN":
        return (
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-800/80">
            WARN
          </span>
        );
      case "FAIL":
        return (
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-rose-950/80 text-rose-400 border border-rose-800/80">
            FAIL
          </span>
        );
      default:
        return (
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-700">
            TIDAK TERBACA
          </span>
        );
    }
  };

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

  const isDark = state.theme === "dark";

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <section className={`border rounded-lg p-5 transition-colors ${
        isDark ? "bg-[#0d1322] border-slate-800" : "bg-white border-slate-200"
      }`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              Pemantauan & Evaluasi Status Klaster
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Parser deterministik berbasis regex ketat. Tidak ada data sintetis; parser menghasilkan TIDAK TERBACA jika teks tidak sesuai.
            </p>
          </div>
          <div className="text-xs text-slate-400 font-mono">
            Toleransi galat: 0 · Nilai waktu hanya informasi
          </div>
        </div>
      </section>

      {/* Known Issues Alert Box */}
      {detectedIssues.length > 0 && (
        <section className="bg-rose-950/30 border border-rose-800/60 rounded-lg p-4">
          <h3 className="text-xs font-bold text-rose-300 mb-2">
            Terdeteksi {detectedIssues.length} Kendala Teridentifikasi pada Log:
          </h3>
          <div className="space-y-2">
            {detectedIssues.map((issue, idx) => (
              <div
                key={idx}
                className="bg-slate-950 p-3 rounded border border-rose-800/40 text-xs font-mono"
              >
                <span className="font-bold text-rose-400 block">{issue.label}</span>
                <span className="text-slate-300 font-sans mt-0.5 block">Solusi: {issue.solution}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Grid of Status Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {logSources.map((item) => (
          <div
            key={item.key}
            onClick={() => setActiveTabKey(item.key)}
            className={`cursor-pointer p-3.5 rounded border transition-colors ${
              activeTabKey === item.key
                ? "bg-slate-900 border-indigo-500"
                : isDark
                ? "bg-[#0d1322] border-slate-800 hover:border-slate-700"
                : "bg-white border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-semibold text-slate-200 truncate">{item.title}</span>
              {renderBadge(item.verdict)}
            </div>
            <p className="text-[11px] text-slate-400 line-clamp-2">{item.details}</p>
          </div>
        ))}

        {/* Exit Code Card */}
        <div className={`p-3.5 rounded border flex flex-col justify-between ${
          isDark ? "bg-[#0d1322] border-slate-800" : "bg-white border-slate-200"
        }`}>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs font-semibold text-slate-200">spark-submit Exit Code</span>
            {renderBadge(evalSpExit.verdict)}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="text"
              placeholder="0"
              value={logs.sparkExitCode}
              onChange={(e) => handleUpdateLog("sparkExitCode", e.target.value)}
              className="w-16 bg-slate-950 border border-slate-800 text-center font-mono font-semibold text-xs text-white py-1 rounded focus:outline-none focus:border-indigo-500"
            />
            <span className="text-[11px] text-slate-400 font-mono">(0 = PASS)</span>
          </div>
        </div>
      </div>

      {/* Informational Durations Notice */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className={`p-3 rounded border flex items-center justify-between text-xs ${
          isDark ? "bg-[#0d1322] border-slate-800" : "bg-white border-slate-200"
        }`}>
          <div className="flex items-center gap-2 text-slate-300">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>Waktu CPU Map Tasks (MapReduce):</span>
          </div>
          <div className="flex items-center gap-2 font-mono">
            <span className="font-semibold text-cyan-300 tabular-nums">
              {evalMr.durationMs !== null ? `${evalMr.durationMs} ms` : "N/A"}
            </span>
            <span className="text-[10px] text-slate-400 font-sans border-l border-slate-700 pl-2">
              Informasi Saja
            </span>
          </div>
        </div>

        <div className={`p-3 rounded border flex items-center justify-between text-xs ${
          isDark ? "bg-[#0d1322] border-slate-800" : "bg-white border-slate-200"
        }`}>
          <div className="flex items-center gap-2 text-slate-300">
            <Clock className="w-4 h-4 text-purple-400" />
            <span>Durasi Job Spark (Job 0):</span>
          </div>
          <div className="flex items-center gap-2 font-mono">
            <span className="font-semibold text-purple-300 tabular-nums">
              {evalSpLog.durationSec !== null ? `${evalSpLog.durationSec} s` : "N/A"}
            </span>
            <span className="text-[10px] text-slate-400 font-sans border-l border-slate-700 pl-2">
              Informasi Saja
            </span>
          </div>
        </div>
      </div>

      {/* Active Log Editor Section */}
      <section className={`border rounded-lg p-5 transition-colors ${
        isDark ? "bg-[#0d1322] border-slate-800" : "bg-white border-slate-200"
      }`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Sumber Log:</span>
              <span className="font-mono text-indigo-400">
                {logSources.find((s) => s.key === activeTabKey)?.title}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              {logSources.find((s) => s.key === activeTabKey)?.cmd}
            </p>
          </div>
          <div>
            {renderBadge(
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
                : evalSpJson.verdict
            )}
          </div>
        </div>

        <textarea
          rows={11}
          value={logs[activeTabKey]}
          onChange={(e) => handleUpdateLog(activeTabKey, e.target.value)}
          placeholder={`Tempelkan output teks mentah dari terminal untuk ${activeTabKey}...`}
          className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-[11px] font-mono text-slate-200 placeholder-slate-700 focus:outline-none focus:border-indigo-500 leading-relaxed"
        />
        <div className="flex justify-between items-center mt-2 text-xs text-slate-400 font-mono">
          <span>Karakter: {logs[activeTabKey]?.length || 0}</span>
          <button
            onClick={() => handleUpdateLog(activeTabKey, "")}
            className="text-slate-500 hover:text-slate-300 transition-colors font-sans text-xs"
          >
            Kosongkan Teks
          </button>
        </div>
      </section>
    </div>
  );
};
