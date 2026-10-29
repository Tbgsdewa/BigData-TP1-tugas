import React, { useState, useMemo } from "react";
import {
  Check,
  Copy,
  CheckSquare,
  Square,
  Terminal,
  ArrowRight,
  Filter,
  Layers,
  ChevronDown,
  ChevronUp,
  Search,
  CheckCheck,
  FileCode,
} from "lucide-react";
import { PHASES, STEPS_TEMPLATE, StepDef } from "../constants";
import { AppState } from "../types";

interface RunbookProps {
  state: AppState;
  onChange: (updater: (prev: AppState) => AppState) => void;
  onNavigateToTab?: (tab: string) => void;
}

type ShellType = "BASH" | "POWERSHELL";
type FilterMode = "ALL" | "PENDING" | "COMPLETED" | 1 | 2 | 3 | 4;

export const RunbookTab: React.FC<RunbookProps> = ({ state, onChange, onNavigateToTab }) => {
  const [shellType, setShellType] = useState<ShellType>("POWERSHELL");
  const [filterMode, setFilterMode] = useState<FilterMode>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedPhases, setCollapsedPhases] = useState<Record<number, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const primaryNim = state.members[0]?.nim?.trim() || "<NIM>";

  // Overall progress
  const completedCount = STEPS_TEMPLATE.filter(
    (step) => state.steps[step.id]?.completed
  ).length;
  const progressPct = Math.round((completedCount / STEPS_TEMPLATE.length) * 100);

  const handleToggleComplete = (id: string) => {
    onChange((prev) => ({
      ...prev,
      steps: {
        ...prev.steps,
        [id]: {
          completed: !prev.steps[id]?.completed,
          notes: prev.steps[id]?.notes || "",
        },
      },
    }));
  };

  const handleTogglePhaseAll = (phaseId: number, targetStatus: boolean) => {
    const phaseSteps = STEPS_TEMPLATE.filter((s) => s.phase === phaseId);
    onChange((prev) => {
      const updatedSteps = { ...prev.steps };
      phaseSteps.forEach((s) => {
        updatedSteps[s.id] = {
          completed: targetStatus,
          notes: updatedSteps[s.id]?.notes || "",
        };
      });
      return { ...prev, steps: updatedSteps };
    });
  };

  const handleUpdateNotes = (id: string, notes: string) => {
    onChange((prev) => ({
      ...prev,
      steps: {
        ...prev.steps,
        [id]: {
          completed: prev.steps[id]?.completed || false,
          notes,
        },
      },
    }));
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getInterpolatedCommand = (step: StepDef): string => {
    const raw = shellType === "POWERSHELL" && step.psCmd ? step.psCmd : step.bashCmd || step.cmd;
    return raw.replace(/<NIM>/g, primaryNim);
  };

  const handleCopyPhaseScript = (phaseId: number) => {
    const phaseSteps = STEPS_TEMPLATE.filter((s) => s.phase === phaseId);
    const scriptHeader =
      shellType === "POWERSHELL"
        ? `# Script Eksekusi Fase ${phaseId} (Windows PowerShell)\n# NIM: ${primaryNim}\n`
        : `#!/usr/bin/env bash\n# Script Eksekusi Fase ${phaseId} (Bash/WSL)\n# NIM: ${primaryNim}\n`;

    const scriptBody = phaseSteps
      .map((s) => {
        const cmd = getInterpolatedCommand(s);
        return `# [${s.id}] ${s.judul}\n${cmd}\n`;
      })
      .join("\n");

    copyToClipboard(scriptHeader + "\n" + scriptBody, `phase_${phaseId}`);
  };

  const toggleCollapsePhase = (phaseId: number) => {
    setCollapsedPhases((prev) => ({
      ...prev,
      [phaseId]: !prev[phaseId],
    }));
  };

  // Filtered steps
  const filteredSteps = useMemo(() => {
    return STEPS_TEMPLATE.filter((step) => {
      const stepState = state.steps[step.id] || { completed: false, notes: "" };

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = step.id.toLowerCase().includes(q);
        const matchesJudul = step.judul.toLowerCase().includes(q);
        const matchesCmd = step.cmd.toLowerCase().includes(q);
        const matchesExpected = step.expected.toLowerCase().includes(q);
        const matchesEvidence = step.evidenceId.toLowerCase().includes(q);
        if (!matchesId && !matchesJudul && !matchesCmd && !matchesExpected && !matchesEvidence) {
          return false;
        }
      }

      // Tab filter
      if (filterMode === "PENDING") return !stepState.completed;
      if (filterMode === "COMPLETED") return stepState.completed;
      if (typeof filterMode === "number") return step.phase === filterMode;
      return true;
    });
  }, [state.steps, searchQuery, filterMode]);

  const isDark = state.theme === "dark";

  return (
    <div className="space-y-6">
      {/* Header & Overall Progress */}
      <section
        className={`border rounded-lg p-5 transition-colors ${
          isDark ? "bg-[#0d1322] border-slate-800" : "bg-white border-slate-200"
        }`}
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-indigo-400" />
              Runbook Eksekusi Klaster & Analisis Big Data
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              15 langkah eksekusi presisi terbagi ke dalam 4 fase terstruktur dengan sintaks shell adaptif.
            </p>
          </div>

          {/* Overall Progress Widget */}
          <div className="w-full md:w-60 text-xs">
            <div className="flex justify-between items-center mb-1 font-mono">
              <span className="text-slate-400">Total Progres</span>
              <span className="font-semibold text-slate-200 tabular-nums">
                {completedCount} / {STEPS_TEMPLATE.length} ({progressPct}%)
              </span>
            </div>
            <div className="w-full bg-slate-950 rounded h-1.5 overflow-hidden border border-slate-800">
              <div
                className={`h-1.5 rounded transition-all duration-200 ${
                  completedCount === STEPS_TEMPLATE.length ? "bg-emerald-500" : "bg-indigo-500"
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Control Toolbar: Shell Selector, Search, Filter Modes */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 mt-4 text-xs font-mono">
          {/* Shell Environment Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-[11px] font-sans">Lingkungan Shell:</span>
            <div className="inline-flex rounded border border-slate-800 bg-slate-950 p-0.5">
              <button
                onClick={() => setShellType("POWERSHELL")}
                className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
                  shellType === "POWERSHELL"
                    ? "bg-indigo-600 text-white font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Windows PowerShell ($LASTEXITCODE, curl.exe)
              </button>
              <button
                onClick={() => setShellType("BASH")}
                className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
                  shellType === "BASH"
                    ? "bg-indigo-600 text-white font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Linux Bash / WSL ($?, curl)
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative w-full lg:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Cari perintah / kata kunci..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-3 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Phase Filter Tabs */}
        <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-slate-800/60 font-mono text-xs">
          <button
            onClick={() => setFilterMode("ALL")}
            className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
              filterMode === "ALL"
                ? "bg-indigo-600 text-white font-semibold"
                : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            Semua (15)
          </button>
          <button
            onClick={() => setFilterMode("PENDING")}
            className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
              filterMode === "PENDING"
                ? "bg-indigo-600 text-white font-semibold"
                : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            Belum ({STEPS_TEMPLATE.length - completedCount})
          </button>
          <button
            onClick={() => setFilterMode("COMPLETED")}
            className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
              filterMode === "COMPLETED"
                ? "bg-indigo-600 text-white font-semibold"
                : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            Selesai ({completedCount})
          </button>

          <span className="text-slate-700 mx-1">|</span>

          {PHASES.map((p) => {
            const countCompleted = p.stepIds.filter((id) => state.steps[id]?.completed).length;
            const isSelected = filterMode === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setFilterMode(p.id as FilterMode)}
                className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
                  isSelected
                    ? "bg-indigo-600 text-white font-semibold"
                    : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                Fase {p.id} ({countCompleted}/{p.stepIds.length})
              </button>
            );
          })}
        </div>
      </section>

      {/* Grouped Steps View per Phase */}
      <div className="space-y-6">
        {PHASES.map((phase) => {
          // Check if phase has any visible steps under current filter
          const phaseSteps = filteredSteps.filter((s) => s.phase === phase.id);
          if (phaseSteps.length === 0) return null;

          const allPhaseSteps = STEPS_TEMPLATE.filter((s) => s.phase === phase.id);
          const phaseCompleted = allPhaseSteps.filter((s) => state.steps[s.id]?.completed).length;
          const isPhaseFullyDone = phaseCompleted === allPhaseSteps.length;
          const isCollapsed = !!collapsedPhases[phase.id];

          return (
            <div
              key={phase.id}
              className={`border rounded-lg overflow-hidden transition-colors ${
                isDark ? "bg-[#0d1322] border-slate-800" : "bg-white border-slate-200"
              }`}
            >
              {/* Phase Milestone Header */}
              <div className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleCollapsePhase(phase.id)}
                    className="text-slate-400 hover:text-white transition-colors"
                    title={isCollapsed ? "Buka Fase" : "Tutup Fase"}
                  >
                    {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-400">
                        FASE {phase.id}
                      </span>
                      <span className="text-slate-600">·</span>
                      <h3 className="text-xs font-bold text-white tracking-tight">{phase.title}</h3>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{phase.subtitle}</p>
                  </div>
                </div>

                {/* Phase Actions: Batch Toggle & Copy Phase Script */}
                <div className="flex items-center gap-2 font-mono text-xs self-end md:self-auto">
                  <span className="text-slate-400 tabular-nums">
                    {phaseCompleted}/{allPhaseSteps.length} selesai
                  </span>

                  <button
                    onClick={() => handleCopyPhaseScript(phase.id)}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[11px] transition-colors"
                    title="Salin skrip batch seluruh langkah dalam fase ini"
                  >
                    {copiedKey === `phase_${phase.id}` ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Tersalin</span>
                      </>
                    ) : (
                      <>
                        <FileCode className="w-3 h-3 text-indigo-400" />
                        <span>Salin Skrip Fase</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleTogglePhaseAll(phase.id, !isPhaseFullyDone)}
                    className={`px-2 py-1 rounded text-[11px] border transition-colors ${
                      isPhaseFullyDone
                        ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-rose-400"
                        : "bg-slate-900 border-slate-800 text-emerald-400 hover:bg-emerald-950"
                    }`}
                  >
                    {isPhaseFullyDone ? "Reset Fase" : "Tandai Fase Selesai"}
                  </button>
                </div>
              </div>

              {/* Steps inside Phase */}
              {!isCollapsed && (
                <div className="p-4 space-y-3.5 divide-y divide-slate-800/60">
                  {phaseSteps.map((step, idx) => {
                    const stepState = state.steps[step.id] || { completed: false, notes: "" };
                    const cmdText = getInterpolatedCommand(step);
                    const evidenceItem = state.evidence[step.evidenceId];
                    const hasEvidenceFilled =
                      evidenceItem &&
                      evidenceItem.filename.trim().length > 0 &&
                      evidenceItem.notes.trim().length >= 20;

                    return (
                      <div
                        key={step.id}
                        className={`pt-3.5 first:pt-0 transition-colors ${
                          stepState.completed ? "opacity-95" : ""
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                          <div className="flex items-center gap-2.5">
                            <button
                              onClick={() => handleToggleComplete(step.id)}
                              className="text-slate-400 hover:text-white transition-colors"
                              aria-label={`Tandai langkah ${step.id} selesai`}
                            >
                              {stepState.completed ? (
                                <CheckSquare className="w-5 h-5 text-indigo-400" />
                              ) : (
                                <Square className="w-5 h-5 text-slate-600 hover:text-slate-400" />
                              )}
                            </button>
                            <span className="font-mono text-xs font-bold text-indigo-400">
                              {step.id}
                            </span>
                            <span className="text-slate-600">·</span>
                            <h4 className="text-xs font-bold text-white tracking-tight">
                              {step.judul}
                            </h4>
                          </div>

                          {/* Evidence link & indicator */}
                          <div className="flex items-center gap-2 text-xs font-mono">
                            <span className="text-slate-400 text-[11px]">
                              Bukti: <strong className="text-slate-200">{step.evidenceId}</strong>
                              {hasEvidenceFilled ? (
                                <span className="text-emerald-400 ml-1">✓</span>
                              ) : (
                                <span className="text-amber-400 ml-1">○</span>
                              )}
                            </span>
                            {onNavigateToTab && (
                              <button
                                onClick={() => onNavigateToTab("Evidence")}
                                className="text-[11px] text-slate-400 hover:text-indigo-300 transition-colors flex items-center"
                                title="Buka tab bukti"
                              >
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Command Box */}
                        <div className="rounded bg-slate-950 border border-slate-800 overflow-hidden text-xs">
                          <div className="flex justify-between items-center px-3 py-1.5 bg-slate-900/60 border-b border-slate-800 text-[11px] text-slate-400 font-mono">
                            <div className="flex items-center gap-2">
                              <span>Terminal ({shellType === "POWERSHELL" ? "PowerShell" : "Bash"})</span>
                            </div>
                            <button
                              onClick={() => copyToClipboard(cmdText, step.id)}
                              className="flex items-center gap-1 text-slate-300 hover:text-white transition-colors"
                            >
                              {copiedKey === step.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-400">Tersalin</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Salin</span>
                                </>
                              )}
                            </button>
                          </div>
                          <pre className="p-3 text-[11px] font-mono text-emerald-300/90 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                            {cmdText}
                          </pre>
                        </div>

                        {/* Expected Output & Inline Notes */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 mt-2 text-xs">
                          <div className="md:col-span-5 bg-slate-950/60 p-2 rounded border border-slate-800/80">
                            <span className="text-slate-400 text-[10px] block font-sans">
                              Keluaran Diharapkan:
                            </span>
                            <span className="font-mono text-[11px] text-slate-300">
                              {step.expected}
                            </span>
                          </div>
                          <div className="md:col-span-7">
                            <input
                              type="text"
                              placeholder="Catatan pelaksanaan atau hasil observasi langkah..."
                              value={stepState.notes}
                              onChange={(e) => handleUpdateNotes(step.id, e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-700 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
