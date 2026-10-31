import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { CONFIG_FILE_CONTENT, DOCKER_COMPOSE_TEMPLATE, ENV, NIM_REGEX, WC_PY_CONTENT } from "../constants";
import { AppState, Member, MemberRole } from "../types";
import { CopyButton, FieldLabel, Panel } from "../components/ui";

interface SetupProps {
  state: AppState;
  onChange: (updater: (prev: AppState) => AppState) => void;
}

const AVAILABLE_ROLES: MemberRole[] = [
  "Docker & HDFS",
  "MapReduce & YARN",
  "Spark & submit",
  "Validasi & laporan",
];

/* ------------------------------------------------------------------
   Data referensi statis: topologi desain docker-compose.
   BUKAN status runtime — hanya rujukan rancangan klaster.
-------------------------------------------------------------------- */
interface TopologyReferenceRow {
  node: string;
  peran: string;
  ports: string;
  ui: string | null;
}

const TOPOLOGY_REFERENCE: TopologyReferenceRow[] = [
  { node: "namenode", peran: "HDFS NameNode (Metadata)", ports: "9870 UI · 8020 IPC", ui: "http://localhost:9870" },
  { node: "datanode1", peran: "HDFS DataNode 1 (Blok)", ports: "9864 · 9866 IPC", ui: null },
  { node: "datanode2", peran: "HDFS DataNode 2 (Replikasi 2)", ports: "9864 · 9866 IPC", ui: null },
  { node: "resourcemanager", peran: "YARN ResourceManager", ports: "8088 · 8032 IPC", ui: "http://localhost:8088" },
  { node: "nodemanager", peran: "YARN NodeManager", ports: "8042 · 8040 IPC", ui: null },
  { node: "spark-master", peran: "Apache Spark Master", ports: "8080 · 7077 IPC", ui: "http://localhost:8080" },
  { node: "spark-worker1", peran: "Spark Worker 1 (512m/1c)", ports: "8081 · 7078 IPC", ui: null },
  { node: "spark-worker2", peran: "Spark Worker 2 (512m/1c)", ports: "8081 · 7079 IPC", ui: null },
];

/** Kartu berkas konfigurasi bergaya terminal: header + Unduh + Salin. */
const ConfigFileBlock: React.FC<{
  name: string;
  content: string;
  downloadTitle: string;
  onDownload: () => void;
}> = ({ name, content, downloadTitle, onDownload }) => (
  <div className="code-block flex h-full min-w-0 flex-col !p-0">
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-code-line bg-code-2 px-3 py-1.5">
      <span className="truncate font-mono text-[11px] font-semibold text-code-ink">{name}</span>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onDownload}
          title={downloadTitle}
          className="btn !border-code-line !bg-transparent !px-2 !py-1 font-mono !text-[11px] !text-code-muted hover:!text-code-ink"
        >
          Unduh
        </button>
        <CopyButton
          text={content}
          className="!border-code-line !bg-transparent !text-code-muted hover:!text-code-ink"
        />
      </div>
    </div>
    <pre className="max-h-64 flex-1 overflow-auto px-3 py-2.5 text-[11.5px] leading-relaxed">{content}</pre>
  </div>
);

/** Tile spesifikasi lingkungan klaster (data statis). */
const SpecTile: React.FC<{
  label: string;
  value: string;
  note: string;
  valueClass?: string;
}> = ({ label, value, note, valueClass = "text-ink" }) => (
  <div className="min-w-0 rounded-sm border border-line bg-surface-2 p-3">
    <span className="label-micro block">{label}</span>
    <span className={`mt-1 block truncate font-mono text-xs font-semibold ${valueClass}`}>{value}</span>
    <span className="mt-0.5 block text-[11px] text-ink-muted">{note}</span>
  </div>
);

export const SetupTab: React.FC<SetupProps> = ({ state, onChange }) => {
  const handleAddMember = () => {
    if (state.members.length >= 3) return;
    const newMember: Member = {
      id: `m_${Date.now()}`,
      nama: "",
      nim: "",
      porsi: AVAILABLE_ROLES[state.members.length % AVAILABLE_ROLES.length],
    };
    onChange((prev) => ({
      ...prev,
      members: [...prev.members, newMember],
    }));
  };

  const handleRemoveMember = (id: string) => {
    if (state.members.length <= 1) return;
    onChange((prev) => ({
      ...prev,
      members: prev.members.filter((m) => m.id !== id),
    }));
  };

  const handleUpdateMember = (id: string, field: keyof Member, value: string) => {
    onChange((prev) => ({
      ...prev,
      members: prev.members.map((m) => (m.id === id ? { ...m, [field]: value } : m)),
    }));
  };

  const handleTogglePrereq = (field: keyof typeof state.prerequisites) => {
    onChange((prev) => ({
      ...prev,
      prerequisites: {
        ...prev.prerequisites,
        [field]: !prev.prerequisites[field],
      },
    }));
  };

  const PREREQ_ITEMS: { field: keyof typeof state.prerequisites; title: string; desc: string }[] = [
    {
      field: "ramAllocated",
      title: "Alokasi RAM Minimal 6 GB",
      desc: "Docker Desktop > Settings > Resources > Memory ≥ 6GB",
    },
    {
      field: "wsl2Ready",
      title: "WSL2 Backend Terpasang",
      desc: "WSL 2 aktif untuk efisiensi kontainer multi-service",
    },
    {
      field: "portsFree",
      title: "Port Web UI Bebas Konflik",
      desc: "Port 9870, 8088, 8080, 8081, 8082 tidak sedang terpakai",
    },
  ];

  return (
    <div className="space-y-5">
      {/* 1.1 Spesifikasi Lingkungan Klaster */}
      <Panel
        no="1.1"
        title="Spesifikasi Lingkungan"
        sub="Topologi 8 kontainer: NameNode, 2 DataNode, ResourceManager, NodeManager, Spark Master, 2 Spark Workers"
        actions={
          <span className="rounded-sm border border-warn/40 bg-warn-wash px-3 py-1.5 font-mono text-[11px] text-warn">
            Catatan: {ENV.imageNote}
          </span>
        }
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <SpecTile label="Host Platform" value="Docker Desktop (WSL2)" note="Min RAM 6GB, CPU 4" />
          <SpecTile label="HDFS Replication" value="Faktor 2" note="datanode1 + datanode2" valueClass="text-accent" />
          <SpecTile
            label="Spark Master & Workers"
            value="2 Cores / 1GB RAM"
            note="Worker 1 & 2 (Ports 8081, 8082)"
          />
          <SpecTile label="Spark Executor Target" value="512m (2 Cores)" note="Deploy mode: client" />
        </div>
      </Panel>

      {/* 1.2 Identitas Anggota */}
      <Panel
        no="1.2"
        title="Identitas Anggota (1–3 Mahasiswa)"
        sub={
          <>
            NIM mahasiswa pertama secara otomatis disubstitusikan ke path HDFS (
            <code className="font-mono text-ink-soft">/user/&lt;NIM&gt;/</code>).
          </>
        }
        actions={
          state.members.length < 3 ? (
            <button type="button" onClick={handleAddMember} className="btn btn-primary">
              <Plus className="h-3.5 w-3.5" /> Tambah Mahasiswa
            </button>
          ) : undefined
        }
      >
        <div className="space-y-3">
          {state.members.map((member, index) => {
            const isNimValid = !member.nim || NIM_REGEX.test(member.nim);
            return (
              <div
                key={member.id}
                className="grid grid-cols-1 items-center gap-3 rounded-sm border border-line bg-surface-2 p-3.5 text-xs md:grid-cols-12"
              >
                <div className="font-mono font-bold text-ink-muted md:col-span-1">
                  #{index + 1}
                  {index === 0 && (
                    <span className="block font-sans text-[10px] font-normal text-accent">Utama</span>
                  )}
                </div>

                <div className="min-w-0 md:col-span-4">
                  <FieldLabel htmlFor={`member-nama-${member.id}`}>Nama Lengkap</FieldLabel>
                  <input
                    id={`member-nama-${member.id}`}
                    type="text"
                    placeholder="Nama mahasiswa"
                    value={member.nama}
                    onChange={(e) => handleUpdateMember(member.id, "nama", e.target.value)}
                    className="field"
                  />
                </div>

                <div className="min-w-0 md:col-span-3">
                  <FieldLabel htmlFor={`member-nim-${member.id}`}>NIM Mahasiswa</FieldLabel>
                  <input
                    id={`member-nim-${member.id}`}
                    type="text"
                    placeholder="e.g. 2101001"
                    value={member.nim}
                    onChange={(e) => handleUpdateMember(member.id, "nim", e.target.value)}
                    className={`field field-mono ${isNimValid ? "" : "!border-danger/70"}`}
                    aria-invalid={!isNimValid}
                  />
                  {!isNimValid && (
                    <span className="mt-0.5 block text-[10px] text-danger">
                      Format NIM: 5-20 alfanumerik
                    </span>
                  )}
                </div>

                <div className="min-w-0 md:col-span-3">
                  <FieldLabel htmlFor={`member-porsi-${member.id}`}>Porsi Tanggung Jawab</FieldLabel>
                  <select
                    id={`member-porsi-${member.id}`}
                    value={member.porsi}
                    onChange={(e) => handleUpdateMember(member.id, "porsi", e.target.value as MemberRole)}
                    className="field"
                  >
                    {AVAILABLE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end md:col-span-1">
                  {state.members.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.id)}
                      className="btn btn-danger-ghost !px-2"
                      title="Hapus anggota"
                      aria-label={`Hapus anggota ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* 1.3 Prasyarat Host */}
      <Panel
        no="1.3"
        title="Prasyarat Host"
        sub="Pastikan konfigurasi sumber daya sistem sebelum menjalankan docker compose."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {PREREQ_ITEMS.map((item) => (
            <label
              key={item.field}
              className={`flex cursor-pointer items-start gap-3 rounded-sm border p-3 transition-colors ${
                state.prerequisites[item.field]
                  ? "border-accent/60 bg-accent-wash"
                  : "border-line bg-surface-2 hover:border-line-strong"
              }`}
            >
              <input
                type="checkbox"
                checked={state.prerequisites[item.field]}
                onChange={() => handleTogglePrereq(item.field)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
              />
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-ink">{item.title}</span>
                <span className="mt-0.5 block font-mono text-[11px] leading-relaxed text-ink-muted">
                  {item.desc}
                </span>
              </span>
            </label>
          ))}
        </div>
      </Panel>

      {/* 1.4 Generator Berkas Konfigurasi */}
      <Panel
        no="1.4"
        title="Berkas Konfigurasi Klaster"
        sub="Unduh config, compose, dan wc.py secara terpisah, atau satu skrip otomatis pembangun direktori kerja."
        actions={
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <button
              type="button"
              onClick={() => {
                const scriptContent = `#!/usr/bin/env bash
# Script Otomasi Pembuatan Direktori TP1 (Linux / WSL)
mkdir -p app
cat << 'EOF' > config
${CONFIG_FILE_CONTENT}
EOF

cat << 'EOF' > docker-compose.yml
${DOCKER_COMPOSE_TEMPLATE}
EOF

cat << 'EOF' > app/wc.py
${WC_PY_CONTENT}
EOF

echo "✓ Struktur direktori klaster TP1 berhasil dibuat!"
`;
                const blob = new Blob([scriptContent], { type: "text/x-sh;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "setup-cluster.sh";
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="btn btn-outline font-mono"
            >
              Unduh setup-cluster.sh
            </button>

            <button
              type="button"
              onClick={() => {
                const scriptContent = `# Script Otomasi Pembuatan Direktori TP1 (Windows PowerShell)
New-Item -ItemType Directory -Force -Path app | Out-Null
@'
${CONFIG_FILE_CONTENT}
'@ | Set-Content -Path config -Encoding UTF8

@'
${DOCKER_COMPOSE_TEMPLATE}
'@ | Set-Content -Path docker-compose.yml -Encoding UTF8

@'
${WC_PY_CONTENT}
'@ | Set-Content -Path app/wc.py -Encoding UTF8

Write-Host "✓ Struktur direktori klaster TP1 berhasil dibuat!" -ForegroundColor Green
`;
                const blob = new Blob([scriptContent], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "setup-cluster.ps1";
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="btn btn-outline font-mono"
            >
              Unduh setup-cluster.ps1
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ConfigFileBlock
            name="./config"
            content={CONFIG_FILE_CONTENT}
            downloadTitle="Unduh berkas config"
            onDownload={() => {
              const blob = new Blob([CONFIG_FILE_CONTENT], { type: "text/plain;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "config";
              a.click();
              URL.revokeObjectURL(url);
            }}
          />
          <ConfigFileBlock
            name="./docker-compose.yml"
            content={DOCKER_COMPOSE_TEMPLATE}
            downloadTitle="Unduh docker-compose.yml"
            onDownload={() => {
              const blob = new Blob([DOCKER_COMPOSE_TEMPLATE], { type: "text/yaml;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "docker-compose.yml";
              a.click();
              URL.revokeObjectURL(url);
            }}
          />
          <ConfigFileBlock
            name="./app/wc.py"
            content={WC_PY_CONTENT}
            downloadTitle="Unduh wc.py"
            onDownload={() => {
              const blob = new Blob([WC_PY_CONTENT], { type: "text/x-python;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "wc.py";
              a.click();
              URL.revokeObjectURL(url);
            }}
          />
        </div>
      </Panel>

      {/* 1.5 Referensi Topologi (Rancangan) */}
      <Panel
        no="1.5"
        title="Topologi Kontainer (Rancangan)"
        sub={
          <>
            Rujukan desain topologi berkas docker-compose, bukan status runtime. Status hidup hanya dapat
            dipastikan dari <code className="font-mono text-ink-soft">docker ps</code> / Web UI nyata.
          </>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-line">
                <th className="whitespace-nowrap py-2 pr-4 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                  Node
                </th>
                <th className="whitespace-nowrap py-2 pr-4 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                  Peran
                </th>
                <th className="whitespace-nowrap py-2 pr-4 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                  Port UI/IPC
                </th>
                <th className="whitespace-nowrap py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                  Web UI
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {TOPOLOGY_REFERENCE.map((row) => (
                <tr key={row.node}>
                  <td className="whitespace-nowrap py-2 pr-4 font-mono text-[11.5px] font-semibold text-ink">
                    {row.node}
                  </td>
                  <td className="py-2 pr-4 text-ink-soft">{row.peran}</td>
                  <td className="whitespace-nowrap py-2 pr-4 font-mono text-[11.5px] tabular-nums text-ink-soft">
                    {row.ports}
                  </td>
                  <td className="whitespace-nowrap py-2">
                    {row.ui ? (
                      <a
                        href={row.ui}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[11.5px] text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
                      >
                        {row.ui}
                      </a>
                    ) : (
                      <span className="font-mono text-[11.5px] text-ink-muted" aria-label="Tidak ada Web UI">
                        Tidak tersedia
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
};
