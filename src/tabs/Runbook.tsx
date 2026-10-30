import React, { useState, useMemo } from "react";
import { ArrowRight, Check, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { PHASES, STEPS_TEMPLATE, StepDef } from "../constants";
import { AppState } from "../types";
import { Chip, CommandBlock, EmptyState, Meter, Panel, SegButton } from "../components/ui";

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
  const completedCount = STEPS_TEMPLATE.filter((step) => state.steps[step.id]?.completed).length;

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

  return (
    <div className="space-y-6">
      {/* Panel 2 — Kontrol Runbook: progres, shell, pencarian, filter */}
      <Panel
        no="2"
        title="Runbook S01–S15"
        sub="15 langkah dalam 4 fase; perintah mengikuti shell yang dipilih (Bash/PowerShell)."
        actions={<Meter value={completedCount} total={STEPS_TEMPLATE.length} completeLabel="Total Progres" className="w-full sm:w-56" />}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          {/* Lingkungan shell */}
          <div>
            <p className="label-micro mb-1">Lingkungan Shell</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pilih lingkungan shell">
              <SegButton active={shellType === "POWERSHELL"} onClick={() => setShellType("POWERSHELL")}>
                Windows PowerShell ($LASTEXITCODE, curl.exe)
              </SegButton>
              <SegButton active={shellType === "BASH"} onClick={() => setShellType("BASH")}>
                Linux Bash / WSL ($?, curl)
              </SegButton>
            </div>
          </div>

          {/* Pencarian */}
          <div className="w-full lg:w-64">
            <label htmlFor="runbook-search" className="sr-only">
              Cari perintah atau kata kunci pada langkah runbook
            </label>
            <input
              id="runbook-search"
              type="text"
              placeholder="Cari perintah / kata kunci..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="field"
            />
          </div>
        </div>

        {/* Filter status & fase */}
        <div
          className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-3"
          role="group"
          aria-label="Filter langkah runbook"
        >
          <SegButton active={filterMode === "ALL"} onClick={() => setFilterMode("ALL")}>
            Semua ({STEPS_TEMPLATE.length})
          </SegButton>
          <SegButton active={filterMode === "PENDING"} onClick={() => setFilterMode("PENDING")}>
            Belum ({STEPS_TEMPLATE.length - completedCount})
          </SegButton>
          <SegButton active={filterMode === "COMPLETED"} onClick={() => setFilterMode("COMPLETED")}>
            Selesai ({completedCount})
          </SegButton>
          <span className="mx-1 self-center text-line-strong" aria-hidden="true">|</span>
          {PHASES.map((p) => {
            const countCompleted = p.stepIds.filter((id) => state.steps[id]?.completed).length;
            return (
              <SegButton
                key={p.id}
                active={filterMode === p.id}
                onClick={() => setFilterMode(p.id as FilterMode)}
              >
                Fase {p.id} ({countCompleted}/{p.stepIds.length})
              </SegButton>
            );
          })}
        </div>
      </Panel>

      {/* Langkah per fase */}
      {filteredSteps.length === 0 ? (
        <EmptyState text="Tidak ada langkah yang cocok dengan filter atau pencarian saat ini." />
      ) : (
        <div className="space-y-6">
          {PHASES.map((phase) => {
            // Fase hanya ditampilkan bila memiliki langkah yang terlihat
            const phaseSteps = filteredSteps.filter((s) => s.phase === phase.id);
            if (phaseSteps.length === 0) return null;

            const allPhaseSteps = STEPS_TEMPLATE.filter((s) => s.phase === phase.id);
            const phaseCompleted = allPhaseSteps.filter((s) => state.steps[s.id]?.completed).length;
            const isPhaseFullyDone = phaseCompleted === allPhaseSteps.length;
            const isCollapsed = !!collapsedPhases[phase.id];

            return (
              <Panel
                key={phase.id}
                no={`FASE ${phase.id}`}
                title={phase.title}
                sub={phase.subtitle}
                flush
                actions={
                  <>
                    <span className="font-mono text-[11px] tabular-nums text-ink-muted">
                      {phaseCompleted}/{allPhaseSteps.length} selesai
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyPhaseScript(phase.id)}
                      className="btn btn-outline !px-2 !py-1 font-mono !text-[11px]"
                      title="Salin skrip batch seluruh langkah dalam fase ini"
                    >
                      {copiedKey === `phase_${phase.id}` ? (
                        <>
                          <Check className="h-3 w-3 text-ok" />
                          <span className="text-ok">Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Salin Skrip Fase</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTogglePhaseAll(phase.id, !isPhaseFullyDone)}
                      className={`btn !px-2 !py-1 !text-[11px] ${
                        isPhaseFullyDone ? "btn-danger-ghost" : "btn-outline"
                      }`}
                    >
                      {isPhaseFullyDone ? "Reset Fase" : "Tandai Fase Selesai"}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleCollapsePhase(phase.id)}
                      className="btn btn-ghost !px-2 !py-1"
                      aria-expanded={!isCollapsed}
                      aria-label={isCollapsed ? `Buka Fase ${phase.id}` : `Tutup Fase ${phase.id}`}
                      title={isCollapsed ? "Buka Fase" : "Tutup Fase"}
                    >
                      {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                    </button>
                  </>
                }
              >
                {!isCollapsed && (
                  <div className="divide-y divide-line">
                    {phaseSteps.map((step) => {
                      const stepState = state.steps[step.id] || { completed: false, notes: "" };
                      const cmdText = getInterpolatedCommand(step);
                      const evidenceItem = state.evidence[step.evidenceId];
                      const hasEvidenceFilled =
                        evidenceItem &&
                        evidenceItem.filename.trim().length > 0 &&
                        evidenceItem.notes.trim().length >= 20;

                      return (
                        <article key={step.id} className="px-4 py-4 sm:px-5">
                          {/* Baris judul langkah */}
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <label className="flex shrink-0 cursor-pointer items-center">
                                <input
                                  type="checkbox"
                                  checked={stepState.completed}
                                  onChange={() => handleToggleComplete(step.id)}
                                  className="h-4 w-4 shrink-0 cursor-pointer"
                                  style={{ accentColor: "var(--c-accent)" }}
                                  aria-label={`Tandai ${step.id} selesai`}
                                />
                                <span className="sr-only">Tandai {step.id} selesai</span>
                              </label>
                              <span className="font-mono text-xs font-bold text-accent">{step.id}</span>
                              <span className="text-line-strong" aria-hidden="true">
                                ·
                              </span>
                              <h3
                                className={`text-xs font-bold tracking-tight ${
                                  stepState.completed ? "text-ink-muted line-through decoration-line-strong" : "text-ink"
                                }`}
                              >
                                {step.judul}
                              </h3>
                              {stepState.completed && (
                                <span className="status-chip chip-ok">Selesai</span>
                              )}
                            </div>

                            {/* Indikator + tautan bukti */}
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="label-micro">Bukti {step.evidenceId}</span>
                              {hasEvidenceFilled ? (
                                <Chip tone="ok" title={`Bukti ${step.evidenceId} lengkap`}>
                                  Bukti siap
                                </Chip>
                              ) : (
                                <Chip tone="warn" title={`Bukti ${step.evidenceId} belum lengkap`}>
                                  Bukti kurang
                                </Chip>
                              )}
                              {onNavigateToTab && (
                                <button
                                  type="button"
                                  onClick={() => onNavigateToTab("Evidence")}
                                  className="btn btn-ghost !px-1.5 !py-1"
                                  title="Buka tab bukti"
                                  aria-label={`Buka tab Bukti untuk ${step.evidenceId}`}
                                >
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Perintah langkah */}
                          <div className="mt-2.5">
                            <CommandBlock
                              command={cmdText}
                              caption={`Langkah ${step.id} · ${
                                shellType === "POWERSHELL" ? "Windows PowerShell" : "Bash / WSL"
                              }`}
                            />
                          </div>

                          {/* Keluaran diharapkan + catatan */}
                          <div className="mt-2.5 grid grid-cols-1 gap-2.5 md:grid-cols-12">
                            <div className="rounded-sm border border-line bg-surface-2 px-2.5 py-2 md:col-span-5">
                              <p className="label-micro">Keluaran diharapkan</p>
                              <p className="mt-1 break-words font-mono text-[11px] leading-relaxed text-ink-soft">
                                {step.expected}
                              </p>
                            </div>
                            <div className="md:col-span-7">
                              <label htmlFor={`notes-${step.id}`} className="sr-only">
                                Catatan pelaksanaan langkah {step.id}
                              </label>
                              <input
                                id={`notes-${step.id}`}
                                type="text"
                                placeholder="Catatan pelaksanaan atau hasil observasi langkah..."
                                value={stepState.notes}
                                onChange={(e) => handleUpdateNotes(step.id, e.target.value)}
                                className="field"
                              />
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
};
