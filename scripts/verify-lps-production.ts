/**
 * Read-only production smoke check for a known, already issued LPS QR.
 *
 * Invoke explicitly after "next build" with production environment variables.
 * Never creates a weighing, vehicle, LPS, assignment, or test ticket.
 */
import assert from "node:assert/strict";
import { dbOne, dbQuery } from "../src/lib/db";
import { fetchVerifiedLpsArmada, parseLpsQrToken } from "../src/lib/lps-qr-integration";
import { normalizeLpsName } from "../src/lib/lps-qr-identity";

const sample = process.env.LPS_QR_SMOKE_TOKEN?.trim();
if (!sample) {
  throw new Error("LPS_QR_SMOKE_TOKEN is required for a read-only production QR check.");
}
const identity = parseLpsQrToken(sample);
if (!identity) throw new Error("The supplied production QR is not in LPS armada format.");

const armada = await fetchVerifiedLpsArmada(identity);
assert.equal(armada.normalizedPlate, identity.normalizedPlate);
assert.equal(armada.qrCode, identity.token);
assert.ok(armada.isActive && armada.namaLps);
const remoteLps = normalizeLpsName(armada.namaLps);

const matches = await dbQuery<{ id: number; active: boolean }>(
  "SELECT id, active FROM vehicles WHERE plate_normalized = $1 LIMIT 3",
  [identity.normalizedPlate]
);
if (matches.length > 1) throw new Error("Duplicate local vehicle master for this LPS QR.");
if (matches[0] && !matches[0].active) throw new Error("Local master is disabled.");

const allLps = await dbQuery<{ id: number; name: string; active: boolean }>(
  "SELECT id, name, active FROM lps ORDER BY id"
);
const found = allLps.filter((x) => normalizeLpsName(x.name) === remoteLps);
if (found.length > 1) throw new Error("Duplicate local LPS name for this LPS QR.");
if (found.length === 1 && !found[0].active) throw new Error("Local LPS is disabled.");

if (matches[0] && found[0]) {
  const assignments = await dbQuery<{ id: number }>(
    "SELECT id FROM vehicle_assignments WHERE vehicle_id=$1 AND lps_id=$2 AND active=TRUE",
    [matches[0].id, found[0].id]
  );
  if (assignments.length > 1) throw new Error("Duplicate vehicle assignment.");
}

const connection = await dbOne<{ now: string }>("SELECT NOW()::text AS now");
assert.ok(connection, "Local PostgreSQL must be reachable");
console.log("LPS_LIVE_QR_READONLY_PASS", JSON.stringify({
  normalizedPlate: identity.normalizedPlate,
  upstreamVerified: true,
  localDatabaseAvailable: true,
  vehicleAlreadyRegistered: matches.length === 1,
  lpsAlreadyRegistered: found.length === 1,
  willSynchronizeOnScan: matches.length === 0 || found.length === 0,
}));
