// Isolated CI test. Does NOT contact Vercel, LPS production or real DLHK database.
// Exercises the real Next.js QR and weighing endpoints with ephemeral PostgreSQL.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const code = "LPS-BM8081TT-1791568773087";
const urlBase = "http://127.0.0.1:31337";
const dbUrl = process.env.E2E_DATABASE_URL;
if (!dbUrl) throw new Error("E2E_DATABASE_URL is required. Refusing to write without isolated database.");
if (!/timbangqr_ci$/.test(new URL(dbUrl).pathname)) {
  throw new Error("E2E may only access an explicitly named timbangqr_ci database.");
}
const pool = new Pool({ connectionString: dbUrl });
let nextProcess = null;
let totalLpsLookups = 0;
let newlyRegeneratedPlate = false;
const newBmQr = "LPS-BM8264QM-1791568773999";
let mock = null;

const startMockLps = () => new Promise((resolve, reject) => {
  mock = createServer((req, res) => {
    const target = new URL(req.url || "/", "http://localhost:4011");
    if (req.method !== "GET" || target.pathname !== "/api/integrations/timbangqr/armada") {
      res.writeHead(404).end();
      return;
    }
    totalLpsLookups += 1;
    if (target.searchParams.get("plate") === "BM8264QM" && newlyRegeneratedPlate) {
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify({
        success: true, valid: true,
        data: {
          id: "lps-bm8264qm", platNomor: "BM 8264 QM",
          normalizedPlate: "BM8264QM", qrCode: newBmQr,
          namaLps: "Berseri Cinta Raja", namaSupir: "ALFREDO",
          jenisArmada: "PICKUP", isActive: true,
        },
      }));
      return;
    }
    if (target.searchParams.get("code") === newBmQr && newlyRegeneratedPlate) {
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify({
        success: true, valid: true,
        data: {
          id: "lps-bm8264qm", platNomor: "BM 8264 QM",
          normalizedPlate: "BM8264QM", qrCode: newBmQr,
          namaLps: "Berseri Cinta Raja", namaSupir: "ALFREDO",
          jenisArmada: "PICKUP", isActive: true,
        },
      }));
      return;
    }
    if (target.searchParams.get("code") !== code) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ success: false, valid: false }));
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      success: true, valid: true,
      data: {
        id: "lps-real-qr-fixture",
        platNomor: "BM 8081 TT", normalizedPlate: "BM8081TT",
        qrCode: code, namaLps: "Sejahtera Mandiri",
        namaSupir: "RIAN", jenisArmada: "PICKUP", isActive: true,
      },
    }));
  });
  mock.once("error", reject);
  mock.listen(4011, "localhost", resolve);
});

async function waitForServer() {
  for (let i = 0; i < 90; i++) {
    try {
      const result = await fetch(urlBase + "/login", { signal: AbortSignal.timeout(2000) });
      if (result.status === 200) return;
    } catch {}
    if (nextProcess && nextProcess.exitCode !== null) {
      throw new Error("Next.js exited with status " + nextProcess.exitCode);
    }
    await sleep(1000);
  }
  throw new Error("Next.js did not start in time");
}

async function callApi(url, { cookie, method = "GET", body } = {}) {
  const response = await fetch(urlBase + url, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  return { response, data };
}

try {
  await pool.query(await fs.readFile(path.resolve("database/001_initial_postgresql.sql"), "utf8"));
  await pool.query(
    "INSERT INTO users (email, name, password_hash, role) VALUES ($1,$2,$3,'ADMIN')",
    ["qr-ci@example.test", "QR Integration Operator", bcrypt.hashSync("QrCiTestSecret!", 10)],
  );
  await pool.query(
    "INSERT INTO settings (key,value) VALUES ('next_ticket_no','9700')",
  );
  await pool.query(
    "INSERT INTO vehicles (code,plate_number,plate_normalized,vehicle_type,waste_type,qr_token,active) VALUES ($1,$2,$3,$4,$5,$6,TRUE)",
    ["LEGACY-ARMADA", "BM 8106 QP", "BM8106QP", "PICKUP", "SAMPAH RUMAH TANGGA", "LEGACY-QR-BM8106QP"],
  );
  await startMockLps();

  const env = {
    ...process.env,
    NODE_ENV: "development",
    DATABASE_URL: dbUrl,
    DATABASE_AUTO_INIT: "false",
    APP_URL: urlBase,
    JWT_SECRET: "qr-ci-jwt-secret-must-be-at-least-32-chars",
    LPS_ARMADA_API_URL: "http://localhost:4011/api/integrations/timbangqr/armada",
    LPS_INTEGRATION_URL: "",
    LPS_INTEGRATION_SECRET: "",
    COOKIE_SECURE: "false",
  };
  nextProcess = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", "31337"], {
    cwd: process.cwd(), stdio: "inherit", detached: true, env,
  });
  await waitForServer();

  const login = await callApi("/api/auth/login", {
    method: "POST", body: { email: "qr-ci@example.test", password: "QrCiTestSecret!" },
  });
  assert.equal(login.response.status, 200, JSON.stringify(login.data));
  const cookie = login.response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie?.startsWith("timbang_session="), "Login harus memberi cookie");

  // Existing QR is resolved only within TimbangQR, with no LPS API dependency.
  const legacy = await callApi("/api/qr/LEGACY-QR-BM8106QP", { cookie });
  assert.equal(legacy.response.status, 200, JSON.stringify(legacy.data));
  assert.equal(legacy.data.vehicle.plate_number, "BM 8106 QP");
  assert.equal(totalLpsLookups, 0, "QR lama tidak boleh memanggil LPS");

  // Actual operational QR printed for BM 8264 QM: this is ARMADA- prefix,
  // not the unrelated LPS-BM8081TT fixture used in earlier tests.
  const operational = await callApi("/api/qr/ARMADA-BM8264QM", { cookie });
  assert.equal(operational.response.status, 200, JSON.stringify(operational.data));
  assert.equal(operational.data.source, "ARMADA");
  assert.equal(operational.data.vehicle.plate_normalized, "BM8264QM");
  assert.equal(operational.data.vehicle.plate_number, "BM 8264 QM");
  assert.equal(operational.data.assignments[0].lps_name.toUpperCase(), "BERSERI CINTA RAJA");
  assert.equal(operational.data.masterCreated, true);
  assert.ok(operational.data.assignments[0].lps_id > 0);

  const operationalAgain = await callApi("/api/qr/ARMADA-BM8264QM", { cookie });
  assert.equal(operationalAgain.response.status, 200, JSON.stringify(operationalAgain.data));
  assert.equal(operationalAgain.data.masterCreated, false);
  assert.equal(operationalAgain.data.vehicle.id, operational.data.vehicle.id);
  const operationalCount = await pool.query(
    "SELECT (SELECT COUNT(*)::int FROM vehicles WHERE plate_normalized='BM8264QM') AS vehicle_count, (SELECT COUNT(*)::int FROM vehicle_assignments WHERE vehicle_id=$1) AS assignment_count",
    [operational.data.vehicle.id]
  );
  assert.equal(operationalCount.rows[0].vehicle_count, 1);
  assert.equal(operationalCount.rows[0].assignment_count, 1);
  assert.ok(totalLpsLookups > 0, "ARMADA QR must check LPS regeneration status online");

  // A complete workflow also creates a weighing ticket for this actual QR format
  // ONLY inside the disposable PostgreSQL database named timbangqr_ci.
  const operationalSave = await callApi("/api/weighings", {
    cookie,
    method: "POST",
    body: {
      vehicleId: operational.data.vehicle.id,
      lpsId: operational.data.assignments[0].lps_id,
      driverName: "PENGEMUDI UJI",
      grossKg: 1280,
      tareKg: 400,
      rafaksiKg: 0,
      tareSource: "MANUAL",
      measurementSource: "OCR_LED",
      ocrStable: true,
      indicatorRaw: "OCR_LED:TEST:1280",
    },
  });
  assert.equal(operationalSave.response.status, 201, JSON.stringify(operationalSave.data));
  assert.equal(operationalSave.data.netto2Kg, 880);
  const persistedOperational = await pool.query(
    "SELECT plate_number, lps_name, netto_2_kg FROM weighings WHERE id=$1",
    [operationalSave.data.id]
  );
  assert.equal(persistedOperational.rows[0].plate_number, "BM 8264 QM");
  assert.equal(persistedOperational.rows[0].lps_name.toUpperCase(), "BERSERI CINTA RAJA");
  assert.equal(persistedOperational.rows[0].netto_2_kg, 880);

  // Exhaustive fleet test: every row in the actual Harapan Jaya Oct 2026
  // registry must open via its printed ARMADA-{normalized plate} code.
  const fleet = JSON.parse(await fs.readFile(
    path.resolve("data/master_armada_harapan_jaya_okt2026.json"), "utf8"
  ));
  assert.equal(fleet.length, 68, "Fleet registry has changed: re-audit QR coverage.");
  const grouped = new Map();
  for (const row of fleet) {
    const group = grouped.get(row.plate_normalized) || [];
    group.push(row);
    grouped.set(row.plate_normalized, group);
  }
  assert.equal(grouped.size, 67, "Unexpected plate duplication in fleet master.");
  let tested = 0;
  for (const row of fleet) {
    const lookup = "/api/qr/ARMADA-" + row.plate_normalized;
    const lookupResult = await callApi(lookup, { cookie });
    assert.equal(lookupResult.response.status, 200,
      "QR read failed for " + row.nomor_polisi + ": " + JSON.stringify(lookupResult.data));
    const duplicate = grouped.get(row.plate_normalized).length > 1;
    if (duplicate) {
      assert.equal(lookupResult.data.requiresSelection, true);
      assert.equal(lookupResult.data.choices.length, grouped.get(row.plate_normalized).length);
    } else {
      assert.equal(lookupResult.data.source, "ARMADA");
      assert.equal(lookupResult.data.vehicle.plate_normalized, row.plate_normalized);
    }
    const choice = duplicate
      ? await callApi(lookup + "?masterNo=" + row.no, { cookie })
      : lookupResult;
    assert.equal(choice.response.status, 200,
      "Master mapping failed for izin #" + row.no + ": " + JSON.stringify(choice.data));
    assert.equal(choice.data.vehicle.plate_normalized, row.plate_normalized);
    assert.equal(choice.data.assignments[0].lps_name.toUpperCase(), row.nama_lps.toUpperCase());
    assert.equal(choice.data.selectedMasterNo, row.no);
    assert.ok(choice.data.vehicle.id && choice.data.assignments[0].lps_id);
    tested++;
  }
  assert.equal(tested, fleet.length);
  const duplicateA = await callApi("/api/qr/ARMADA-BM9601TZ?masterNo=16", { cookie });
  const duplicateB = await callApi("/api/qr/ARMADA-BM9601TZ?masterNo=34", { cookie });
  assert.notEqual(duplicateA.data.vehicle.id, duplicateB.data.vehicle.id,
    "Duplicate plate permits must not share one vehicle ID.");
  assert.notEqual(duplicateA.data.assignments[0].lps_id, duplicateB.data.assignments[0].lps_id);
  console.log("ALL_HARAPAN_JAYA_QR_PASS: 68 of 68 active master records, 67 unique plates, 2 duplicate-plate permit choices.");

  // Real LPS QR payload -> mock LPS master -> local master mapping.
  const scan = await callApi("/api/qr/" + encodeURIComponent(code), { cookie });
  assert.equal(scan.response.status, 200, JSON.stringify(scan.data));
  assert.equal(scan.data.lpsVerified, true);
  assert.equal(scan.data.masterCreated, true);
  assert.equal(scan.data.vehicle.plate_normalized, "BM8081TT");
  assert.equal(scan.data.assignments[0].lps_name, "Sejahtera Mandiri");
  assert.equal(scan.data.assignments[0].driver_name, "RIAN");
  assert.ok(scan.data.assignments[0].lps_id > 0);
  assert.ok(scan.data.vehicle.id > 0);

  // Scanner may receive the LPS API URL rather than the opaque QR text.
  // Backend must recover the code= parameter and preserve the LPS path.
  const wrappedUrl = "https://lps-app-iota.vercel.app/api/qr-generator?code=" + code + "&format=svg";
  const urlScan = await callApi("/api/qr/" + encodeURIComponent(wrappedUrl), { cookie });
  assert.equal(urlScan.response.status, 200, JSON.stringify(urlScan.data));
  assert.equal(urlScan.data.vehicle.plate_normalized, "BM8081TT");
  assert.equal(urlScan.data.lpsVerified, true);
  assert.equal(urlScan.data.masterCreated, false);

  // Re-scan never duplicates masters/assignments.
  const rescan = await callApi("/api/qr/" + encodeURIComponent(code), { cookie });
  assert.equal(rescan.response.status, 200);
  assert.equal(rescan.data.masterCreated, false);
  const count = await pool.query("SELECT (SELECT COUNT(*)::int FROM vehicles WHERE plate_normalized='BM8081TT') AS vehicle_count, (SELECT COUNT(*)::int FROM vehicle_assignments WHERE vehicle_id=$1) AS assignment_count", [scan.data.vehicle.id]);
  assert.equal(count.rows[0].vehicle_count, 1);
  assert.equal(count.rows[0].assignment_count, 1);

  // Simulated, isolated weighing only. No production tickets are generated.
  const save = await callApi("/api/weighings", {
    cookie,
    method: "POST",
    body: {
      vehicleId: scan.data.vehicle.id,
      lpsId: scan.data.assignments[0].lps_id,
      driverName: "RIAN",
      grossKg: 1250,
      tareKg: 350,
      rafaksiKg: 0,
      tareSource: "MANUAL",
      measurementSource: "OCR_LED",
      ocrStable: true,
      indicatorRaw: "OCR_LED:CONFIRMED:1250",
    },
  });
  assert.equal(save.response.status, 201, JSON.stringify(save.data));
  assert.equal(save.data.netto2Kg, 900);
  assert.ok(save.data.ticketNumber);
  const saved = await pool.query(
    "SELECT plate_number, driver_name, lps_name, gross_kg, tare_kg, netto_2_kg FROM weighings WHERE id=$1",
    [save.data.id],
  );
  assert.equal(saved.rows.length, 1);
  assert.equal(saved.rows[0].plate_number, "BM 8081 TT");
  assert.equal(saved.rows[0].driver_name, "RIAN");
  assert.equal(saved.rows[0].lps_name, "Sejahtera Mandiri");
  assert.equal(saved.rows[0].gross_kg, 1250);
  assert.equal(saved.rows[0].tare_kg, 350);
  assert.equal(saved.rows[0].netto_2_kg, 900);

  // A regenerated QR immediately revokes its prior ARMADA sticker, without
  // invalidating all the other Harapan Jaya stickers.
  newlyRegeneratedPlate = true;
  const staleArmadaQr = await callApi("/api/qr/ARMADA-BM8264QM", { cookie });
  assert.equal(staleArmadaQr.response.status, 410, JSON.stringify(staleArmadaQr.data));
  assert.match(staleArmadaQr.data.error, /lama.*tidak berlaku/i);
  const newQr = await callApi("/api/qr/" + newBmQr, { cookie });
  assert.equal(newQr.response.status, 200, JSON.stringify(newQr.data));
  assert.equal(newQr.data.vehicle.plate_normalized, "BM8264QM");
  assert.equal(newQr.data.assignments[0].lps_name, "Berseri Cinta Raja");
  const otherPlate = await callApi("/api/qr/ARMADA-BM8106QP", { cookie });
  assert.equal(otherPlate.response.status, 200,
    "Regeneration of BM8264QM must not revoke unrelated armadas");

  // A fake suffix must not silently degrade to license-plate-only matching.
  const forged = await callApi("/api/qr/LPS-BM8081TT-9999999999999", { cookie });
  assert.equal(forged.response.status, 404);
  console.log("E2E PASS: operational ARMADA-BM8264QM + legacy QR + LPS QR + two persisted staging tickets.");
} finally {
  if (nextProcess?.pid) {
    try { process.kill(-nextProcess.pid, "SIGTERM"); } catch { nextProcess.kill("SIGTERM"); }
  }
  if (mock) await new Promise((resolve) => mock.close(resolve));
  await pool.end();
}
