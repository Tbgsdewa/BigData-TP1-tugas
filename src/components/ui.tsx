import React, { useState } from "react";
import { Check, Copy } from "lucide-react";
import { StatusVerdict } from "../types";

/* ------------------------------------------------------------------
   Komponen bersama "Cluster Operations Workbench".
   Semua warna memakai token semantik dari index.css sehingga terang/
   gelap konsisten tanpa ternary theme di setiap tab.
-------------------------------------------------------------------- */

interface PanelProps {
  no?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  flush?: boolean;
}

export const Panel: React.FC<PanelProps> = ({
  no,
  title,
  sub,
  actions,
  children,
  className = "",
  bodyClassName = "",
  flush = false,
}) => (
  <section className={`panel ${className}`}>
    <header className="panel-header">
      <div className="min-w-0">
        <div className="flex items-baseline gap-2.5">
          {no && (
            <span className="font-mono text-[11px] font-bold text-accent" aria-hidden="true">
              {no}
            </span>
          )}
          <h2 className="text-sm font-bold tracking-tight text-ink">{title}</h2>
        </div>
        {sub && <p className="mt-1 text-xs leading-relaxed text-ink-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
    <div className={flush ? bodyClassName : `px-5 py-4 ${bodyClassName}`}>{children}</div>
  </section>
);

export const MicroLabel: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => <span className={`label-micro ${className}`}>{children}</span>;

export const FieldLabel: React.FC<{
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}> = ({ children, htmlFor, className = "" }) =>
  htmlFor ? (
    <label htmlFor={htmlFor} className={`label-micro block mb-1 ${className}`}>
      {children}
    </label>
  ) : (
    <label className={`label-micro block mb-1 ${className}`}>{children}</label>
  );

/** Badge verdict monitor/validasi — bentuk kotak, warna fungsional. */
const verdictTone: Record<StatusVerdict, string> = {
  PASS: "chip-ok",
  WARN: "chip-warn",
  FAIL: "chip-danger",
  "TIDAK TERBACA": "chip-neutral",
};

export const VerdictChip: React.FC<{ verdict: StatusVerdict; className?: string }> = ({
  verdict,
  className = "",
}) => <span className={`status-chip ${verdictTone[verdict]} ${className}`}>{verdict}</span>;

export const Chip: React.FC<{
  tone?: "ok" | "warn" | "danger" | "neutral" | "accent";
  children: React.ReactNode;
  className?: string;
  title?: string;
}> = ({ tone = "neutral", children, className = "", title }) => {
  const map = {
    ok: "chip-ok",
    warn: "chip-warn",
    danger: "chip-danger",
    neutral: "chip-neutral",
    accent: "chip-accent",
  };
  return (
    <span className={`status-chip ${map[tone]} ${className}`} title={title}>
      {children}
    </span>
  );
};

/** Tombol salin dengan feedback lokal "Tersalin" (tanpa state global). */
export const CopyButton: React.FC<{
  text: string;
  label?: string;
  className?: string;
  title?: string;
}> = ({ text, label = "Salin", className = "", title }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={title}
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className={`btn btn-outline !px-2 !py-1 font-mono !text-[11px] ${
        copied ? "!border-ok/60 !text-ok" : ""
      } ${className}`}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      <span>{copied ? "Tersalin" : label}</span>
    </button>
  );
};

/** Baris perintah terminal dengan salin; judul kecil opsional. */
export const CommandBlock: React.FC<{
  command: string;
  caption?: React.ReactNode;
}> = ({ command, caption }) => (
  <div className="code-block !p-0">
    <div className="flex items-center justify-between gap-2 border-b border-code-line bg-code-2 px-3 py-1.5">
      <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-code-muted">
        <span aria-hidden="true" className="text-accent-strong">
          $
        </span>
        {caption ?? "Perintah"}
      </span>
      <CopyButton text={command} className="!border-code-line !bg-transparent !text-code-muted hover:!text-code-ink" />
    </div>
    <pre className="whitespace-pre-wrap break-all px-3 py-2.5">{command}</pre>
  </div>
);

export const Meter: React.FC<{
  value: number;
  total: number;
  completeLabel?: string;
  className?: string;
}> = ({ value, total, completeLabel, className = "" }) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const done = total > 0 && value >= total;
  return (
    <div className={`text-xs ${className}`}>
      <div className="mb-1 flex items-baseline justify-between font-mono">
        {completeLabel && <span className="label-micro">{completeLabel}</span>}
        <span className={`tabular-nums font-semibold ${done ? "text-ok" : "text-ink-soft"}`}>
          {value}/{total}
          <span className="ml-1 font-normal text-ink-muted">({pct}%)</span>
        </span>
      </div>
      <div className="meter" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={total}>
        <div
          className="meter-fill"
          style={{ width: `${pct}%`, background: done ? "var(--c-ok)" : undefined }}
        />
      </div>
    </div>
  );
};

export const EmptyState: React.FC<{
  text: string;
  action?: React.ReactNode;
  className?: string;
}> = ({ text, action, className = "" }) => (
  <div
    className={`rounded-sm border border-dashed border-line-strong/60 px-4 py-6 text-center ${className}`}
  >
    <p className="text-xs text-ink-muted">{text}</p>
    {action && <div className="mt-3 flex justify-center">{action}</div>}
  </div>
);

/** Item toggle segmented (filter, shell, sort) — pola konsisten. */
export const SegButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
}> = ({ active, onClick, children, className = "", title }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-pressed={active}
    className={`rounded-sm border px-2.5 py-1 font-mono text-[11px] transition-colors ${
      active
        ? "border-accent bg-accent text-accent-ink font-semibold"
        : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink"
    } ${className}`}
  >
    {children}
  </button>
);

/** Logo KLASTERDECK — satu master di atas, baris node pekerja di bawah. */
export const BrandMark: React.FC<{ className?: string }> = ({ className = "h-4 w-auto" }) => (
  <svg viewBox="0 0 24 18" className={className} aria-hidden="true" focusable="false">
    <rect x="0.5" y="0.5" width="23" height="6" rx="1" fill="var(--c-accent)" />
    <rect x="0.5" y="8.5" width="4.5" height="8.5" rx="1" fill="none" stroke="currentColor" strokeOpacity="0.5" />
    <rect x="6.5" y="8.5" width="4.5" height="8.5" rx="1" fill="none" stroke="currentColor" strokeOpacity="0.5" />
    <rect x="12.5" y="8.5" width="4.5" height="8.5" rx="1" fill="currentColor" fillOpacity="0.85" />
    <rect x="18.5" y="8.5" width="5" height="8.5" rx="1" fill="none" stroke="currentColor" strokeOpacity="0.5" />
  </svg>
);

/** Inisial operator dari nama anggota pertama; fallback netral saat belum diisi. */
export const Monogram: React.FC<{ name: string; className?: string }> = ({ name, className = "" }) => {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-line-strong bg-surface-2 font-mono text-[11px] font-bold text-ink-soft ${className}`}
      aria-hidden="true"
    >
      {initials || "··"}
    </span>
  );
};
