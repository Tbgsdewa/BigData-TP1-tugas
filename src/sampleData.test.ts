import assert from "node:assert/strict";
import test from "node:test";
import { INITIAL_STATE, normalizeDisclosureRows } from "./sampleData";

test("initial disclosure row contains no sample markers", () => {
  const [row] = INITIAL_STATE.disclosureRows;

  assert.ok(row);
  assert.deepEqual(
    [row.tool, row.tujuan, row.diambil, row.ditolak, row.verifikasi],
    ["", "", "", "", ""]
  );
});

test("legacy disclosure markers are cleared without changing user entries", () => {
  const [row] = normalizeDisclosureRows([
    {
      id: "legacy",
      tool: "[ISI]",
      tujuan: "Tujuan yang diisi pengguna",
      diambil: "[ISI]",
      ditolak: "",
      verifikasi: "Sudah diverifikasi",
    },
  ]);

  assert.deepEqual(row, {
    id: "legacy",
    tool: "",
    tujuan: "Tujuan yang diisi pengguna",
    diambil: "",
    ditolak: "",
    verifikasi: "Sudah diverifikasi",
  });
});
