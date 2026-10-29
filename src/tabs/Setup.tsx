import React, { useState } from "react";
import { Copy, Check, Users, Server, Plus, Trash2, HardDrive, Code2 } from "lucide-react";
import { CONFIG_FILE_CONTENT, DOCKER_COMPOSE_TEMPLATE, ENV, NIM_REGEX, WC_PY_CONTENT } from "../constants";
import { AppState, Member, MemberRole } from "../types";

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

export const SetupTab: React.FC<SetupProps> = ({ state, onChange }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

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

  const isDark = state.theme === "dark";

  return (
    <div className="space-y-6">
      {/* Cluster Environment Specifications */}
      <section className={`border rounded-lg p-5 transition-colors ${
        isDark ? "bg-[#0d1322] border-slate-800" : "bg-white border-slate-200"
      }`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-800/60">
          <div>
            <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-400" />
              Spesifikasi Lingkungan Klaster Terdistribusi
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Topologi 8 kontainer: NameNode, 2 DataNode, ResourceManager, NodeManager, Spark Master, 2 Spark Workers
            </p>
          </div>
          <div className="text-xs text-amber-300/90 font-mono bg-amber-950/40 border border-amber-800/40 px-3 py-1.5 rounded">
            Catatan: {ENV.imageNote}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-xs font-mono">
          <div className={`p-3 rounded border ${isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
            <span className="text-slate-400 font-sans block text-[11px]">Host Platform</span>
            <span className="font-semibold text-slate-200 mt-1 block truncate">Docker Desktop (WSL2)</span>
            <span className="text-[10px] text-slate-400 font-sans">Min RAM 6GB, CPU 4</span>
          </div>

          <div className={`p-3 rounded border ${isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
            <span className="text-slate-400 font-sans block text-[11px]">HDFS Replication</span>
            <span className="font-semibold text-emerald-400 mt-1 block">Faktor 2</span>
            <span className="text-[10px] text-slate-400 font-sans">datanode1 + datanode2</span>
          </div>

          <div className={`p-3 rounded border ${isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
            <span className="text-slate-400 font-sans block text-[11px]">Spark Master & Workers</span>
            <span className="font-semibold text-cyan-400 mt-1 block">2 Cores / 1GB RAM</span>
            <span className="text-[10px] text-slate-400 font-sans">Worker 1 & 2 (Ports 8081, 8082)</span>
          </div>

          <div className={`p-3 rounded border ${isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
            <span className="text-slate-400 font-sans block text-[11px]">Spark Executor Target</span>
            <span className="font-semibold text-indigo-400 mt-1 block">512m (2 Cores)</span>
            <span className="text-[10px] text-slate-400 font-sans">Deploy mode: client</span>
          </div>
        </div>
      </section>

      {/* Member Identity Table */}
      <section className={`border rounded-lg p-5 transition-colors ${
        isDark ? "bg-[#0d1322] border-slate-800" : "bg-white border-slate-200"
      }`}>
        <div className="flex justify-between items-center pb-3 border-b border-slate-800/60 mb-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              Identitas Anggota Kelompok (1 - 3 Mahasiswa)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              NIM mahasiswa pertama secara otomatis disubstitusikan ke path HDFS (<code className="text-amber-400 font-mono">/user/&lt;NIM&gt;/</code>).
            </p>
          </div>
          {state.members.length < 3 && (
            <button
              onClick={handleAddMember}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah Mahasiswa
            </button>
          )}
        </div>

        <div className="space-y-3">
          {state.members.map((member, index) => {
            const isNimValid = !member.nim || NIM_REGEX.test(member.nim);
            return (
              <div
                key={member.id}
                className={`grid grid-cols-1 md:grid-cols-12 gap-3 p-3.5 rounded border items-center text-xs ${
                  isDark ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="md:col-span-1 font-mono font-bold text-slate-400">
                  #{index + 1} {index === 0 && <span className="block text-[10px] font-sans text-indigo-400 font-normal">Utama</span>}
                </div>

                <div className="md:col-span-4">
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Nama Lengkap</label>
                  <input
                    type="text"
                    placeholder="Nama mahasiswa"
                    value={member.nama}
                    onChange={(e) => handleUpdateMember(member.id, "nama", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">NIM Mahasiswa</label>
                  <input
                    type="text"
                    placeholder="e.g. 2101001"
                    value={member.nim}
                    onChange={(e) => handleUpdateMember(member.id, "nim", e.target.value)}
                    className={`w-full bg-slate-950 border rounded px-2.5 py-1.5 text-xs font-mono text-white placeholder-slate-600 focus:outline-none ${
                      isNimValid ? "border-slate-800 focus:border-indigo-500" : "border-rose-500 text-rose-300"
                    }`}
                  />
                  {!isNimValid && (
                    <span className="text-[10px] text-rose-400 block mt-0.5">Format NIM: 5-20 alfanumerik</span>
                  )}
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Porsi Tanggung Jawab</label>
                  <select
                    value={member.porsi}
                    onChange={(e) => handleUpdateMember(member.id, "porsi", e.target.value as MemberRole)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    {AVAILABLE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-1 flex justify-end">
                  {state.members.length > 1 && (
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"
                      title="Hapus anggota"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Host System Prerequisites */}
      <section className={`border rounded-lg p-5 transition-colors ${
        isDark ? "bg-[#0d1322] border-slate-800" : "bg-white border-slate-200"
      }`}>
        <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
          <HardDrive className="w-4 h-4 text-indigo-400" />
          Verifikasi Prasyarat Sistem Host
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Pastikan konfigurasi sumber daya sistem sebelum menjalankan docker compose.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${
            state.prerequisites.ramAllocated
              ? "bg-slate-900 border-indigo-500/40"
              : isDark
              ? "bg-slate-900/40 border-slate-800 hover:border-slate-700"
              : "bg-slate-50 border-slate-200"
          }`}>
            <input
              type="checkbox"
              checked={state.prerequisites.ramAllocated}
              onChange={() => handleTogglePrereq("ramAllocated")}
              className="mt-0.5 w-4 h-4 text-indigo-600 rounded bg-slate-950 border-slate-700"
            />
            <div>
              <span className="text-xs font-semibold text-slate-200 block">Alokasi RAM Minimal 6 GB</span>
              <span className="text-[11px] text-slate-400">Docker Desktop &gt; Settings &gt; Resources &gt; Memory &ge; 6GB</span>
            </div>
          </label>

          <label className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${
            state.prerequisites.wsl2Ready
              ? "bg-slate-900 border-indigo-500/40"
              : isDark
              ? "bg-slate-900/40 border-slate-800 hover:border-slate-700"
              : "bg-slate-50 border-slate-200"
          }`}>
            <input
              type="checkbox"
              checked={state.prerequisites.wsl2Ready}
              onChange={() => handleTogglePrereq("wsl2Ready")}
              className="mt-0.5 w-4 h-4 text-indigo-600 rounded bg-slate-950 border-slate-700"
            />
            <div>
              <span className="text-xs font-semibold text-slate-200 block">WSL2 Backend Terpasang</span>
              <span className="text-[11px] text-slate-400">WSL 2 aktif untuk efisiensi kontainer multi-service</span>
            </div>
          </label>

          <label className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${
            state.prerequisites.portsFree
              ? "bg-slate-900 border-indigo-500/40"
              : isDark
              ? "bg-slate-900/40 border-slate-800 hover:border-slate-700"
              : "bg-slate-50 border-slate-200"
          }`}>
            <input
              type="checkbox"
              checked={state.prerequisites.portsFree}
              onChange={() => handleTogglePrereq("portsFree")}
              className="mt-0.5 w-4 h-4 text-indigo-600 rounded bg-slate-950 border-slate-700"
            />
            <div>
              <span className="text-xs font-semibold text-slate-200 block">Port Web UI Bebas Konflik</span>
              <span className="text-[11px] text-slate-400">Port 9870, 8088, 8080, 8081, 8082 tidak sedang terpakai</span>
            </div>
          </label>
        </div>
      </section>

      {/* Configuration Generators & Script Downloads */}
      <section className={`border rounded-lg p-5 transition-colors ${
        isDark ? "bg-[#0d1322] border-slate-800" : "bg-white border-slate-200"
      }`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-800/60 mb-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Code2 className="w-4 h-4 text-indigo-400" />
              Generator & Pengunduhan Berkas Konfigurasi Klaster
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Unduh berkas individual atau buat skrip otomasi satu-klik untuk menyusun direktori kerja lokal.
            </p>
          </div>

          {/* Quick Script Generators */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <button
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
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-slate-200 transition-colors flex items-center gap-1.5"
            >
              Unduh setup-cluster.sh
            </button>

            <button
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
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-slate-200 transition-colors flex items-center gap-1.5"
            >
              Unduh setup-cluster.ps1
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* File 1: config */}
          <div className="flex flex-col bg-slate-950 border border-slate-800 rounded overflow-hidden">
            <div className="flex justify-between items-center px-3 py-2 bg-slate-900/80 border-b border-slate-800 text-xs">
              <span className="font-mono font-semibold text-amber-400">./config</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const blob = new Blob([CONFIG_FILE_CONTENT], { type: "text/plain;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "config";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="text-[11px] font-mono text-slate-400 hover:text-white transition-colors"
                  title="Unduh berkas config"
                >
                  Unduh
                </button>
                <button
                  onClick={() => copyToClipboard(CONFIG_FILE_CONTENT, "config")}
                  className="text-[11px] font-mono text-slate-300 hover:text-white flex items-center gap-1 transition-colors"
                >
                  {copiedKey === "config" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === "config" ? "Tersalin" : "Salin"}
                </button>
              </div>
            </div>
            <pre className="p-3 text-[11px] font-mono text-slate-300 overflow-x-auto flex-1 max-h-64 leading-relaxed">
              {CONFIG_FILE_CONTENT}
            </pre>
          </div>

          {/* File 2: docker-compose.yml */}
          <div className="flex flex-col bg-slate-950 border border-slate-800 rounded overflow-hidden">
            <div className="flex justify-between items-center px-3 py-2 bg-slate-900/80 border-b border-slate-800 text-xs">
              <span className="font-mono font-semibold text-cyan-400">./docker-compose.yml</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const blob = new Blob([DOCKER_COMPOSE_TEMPLATE], { type: "text/yaml;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "docker-compose.yml";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="text-[11px] font-mono text-slate-400 hover:text-white transition-colors"
                  title="Unduh docker-compose.yml"
                >
                  Unduh
                </button>
                <button
                  onClick={() => copyToClipboard(DOCKER_COMPOSE_TEMPLATE, "compose")}
                  className="text-[11px] font-mono text-slate-300 hover:text-white flex items-center gap-1 transition-colors"
                >
                  {copiedKey === "compose" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === "compose" ? "Tersalin" : "Salin"}
                </button>
              </div>
            </div>
            <pre className="p-3 text-[11px] font-mono text-slate-300 overflow-x-auto flex-1 max-h-64 leading-relaxed">
              {DOCKER_COMPOSE_TEMPLATE}
            </pre>
          </div>

          {/* File 3: app/wc.py */}
          <div className="flex flex-col bg-slate-950 border border-slate-800 rounded overflow-hidden">
            <div className="flex justify-between items-center px-3 py-2 bg-slate-900/80 border-b border-slate-800 text-xs">
              <span className="font-mono font-semibold text-emerald-400">./app/wc.py</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const blob = new Blob([WC_PY_CONTENT], { type: "text/x-python;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "wc.py";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="text-[11px] font-mono text-slate-400 hover:text-white transition-colors"
                  title="Unduh wc.py"
                >
                  Unduh
                </button>
                <button
                  onClick={() => copyToClipboard(WC_PY_CONTENT, "wc")}
                  className="text-[11px] font-mono text-slate-300 hover:text-white flex items-center gap-1 transition-colors"
                >
                  {copiedKey === "wc" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === "wc" ? "Tersalin" : "Salin"}
                </button>
              </div>
            </div>
            <pre className="p-3 text-[11px] font-mono text-slate-300 overflow-x-auto flex-1 max-h-64 leading-relaxed">
              {WC_PY_CONTENT}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
};
