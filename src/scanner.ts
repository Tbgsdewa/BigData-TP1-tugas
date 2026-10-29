import { AppState } from "./types";

export interface ScanFinding {
  source: string;
  pattern: string;
  match: string;
  line: number;
  column: number;
}

export interface IsiFinding {
  source: string;
  field: string;
  preview: string;
}

const CREDENTIAL_PATTERNS = [
  {
    name: "Password / Secret / Token / API Key Assignment",
    regex: /(password|passwd|pwd|secret|token|api[_-]?key)\s*[=:]\s*\S+/i,
  },
  {
    name: "Bearer Token",
    regex: /Bearer\s+[A-Za-z0-9._-]+/,
  },
  {
    name: "Google API Key (AIza...)",
    regex: /AIza[0-9A-Za-z_-]{35}/,
  },
  {
    name: "GitHub Token (ghp/gho/ghu/ghs...)",
    regex: /gh[pous]_[A-Za-z0-9]{36}/,
  },
];

export function scanTextForCredentials(text: string, sourceName: string): ScanFinding[] {
  if (!text) return [];
  const findings: ScanFinding[] = [];
  const lines = text.split("\n");

  lines.forEach((lineStr, lineIdx) => {
    for (const pat of CREDENTIAL_PATTERNS) {
      // Find all matches on this line
      const match = lineStr.match(pat.regex);
      if (match && match.index !== undefined) {
        findings.push({
          source: sourceName,
          pattern: pat.name,
          match: match[0].substring(0, 40),
          line: lineIdx + 1,
          column: match.index + 1,
        });
      }
    }
  });

  return findings;
}

export function scanAllCredentials(state: AppState): ScanFinding[] {
  const allFindings: ScanFinding[] = [];

  // 1. Monitor logs
  Object.entries(state.monitorLogs).forEach(([key, val]) => {
    allFindings.push(...scanTextForCredentials(val, `Monitor Log: ${key}`));
  });

  // 2. WordCount
  allFindings.push(...scanTextForCredentials(state.wordCountMR, "Validation: WordCount MR"));
  allFindings.push(...scanTextForCredentials(state.wordCountSpark, "Validation: WordCount Spark"));

  // 3. Step notes
  Object.entries(state.steps).forEach(([stepId, stepVal]) => {
    if (stepVal.notes) {
      allFindings.push(...scanTextForCredentials(stepVal.notes, `Runbook: ${stepId} Catatan`));
    }
  });

  // 4. Evidence
  Object.entries(state.evidence).forEach(([evId, item]) => {
    if (item.filename) {
      allFindings.push(...scanTextForCredentials(item.filename, `Evidence: ${evId} Filename`));
    }
    if (item.notes) {
      allFindings.push(...scanTextForCredentials(item.notes, `Evidence: ${evId} Keterangan`));
    }
  });

  // 5. Disclosure
  state.disclosureRows.forEach((row, idx) => {
    allFindings.push(...scanTextForCredentials(row.tool, `Disclosure #${idx + 1} Tool`));
    allFindings.push(...scanTextForCredentials(row.tujuan, `Disclosure #${idx + 1} Tujuan`));
    allFindings.push(...scanTextForCredentials(row.diambil, `Disclosure #${idx + 1} Diambil`));
    allFindings.push(...scanTextForCredentials(row.ditolak, `Disclosure #${idx + 1} Ditolak`));
    allFindings.push(...scanTextForCredentials(row.verifikasi, `Disclosure #${idx + 1} Verifikasi`));
  });

  return allFindings;
}

export function findRemainingIsiPlaceholders(state: AppState): IsiFinding[] {
  const isiFindings: IsiFinding[] = [];
  const checkText = (text: string, source: string, field: string) => {
    if (text && text.includes("[ISI]")) {
      isiFindings.push({ source, field, preview: text.substring(0, 60) });
    }
  };

  // Disclosure rows (unless noAiUsage is true)
  if (!state.noAiUsage) {
    state.disclosureRows.forEach((row, idx) => {
      checkText(row.tool, `Disclosure #${idx + 1}`, "Tool");
      checkText(row.tujuan, `Disclosure #${idx + 1}`, "Tujuan");
      checkText(row.diambil, `Disclosure #${idx + 1}`, "Bagian Diambil");
      checkText(row.ditolak, `Disclosure #${idx + 1}`, "Bagian Ditolak");
      checkText(row.verifikasi, `Disclosure #${idx + 1}`, "Cara Verifikasi");
    });
  }

  // Evidence notes & filenames
  Object.entries(state.evidence).forEach(([evId, item]) => {
    checkText(item.filename, `Evidence ${evId}`, "Nama File");
    checkText(item.notes, `Evidence ${evId}`, "Keterangan");
  });

  // Steps notes
  Object.entries(state.steps).forEach(([sId, item]) => {
    checkText(item.notes, `Step ${sId}`, "Catatan");
  });

  return isiFindings;
}
