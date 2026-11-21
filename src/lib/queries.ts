import { dbOne, dbQuery } from "./db";
import { unstable_cache } from "next/cache";
import type { AssignmentRow, VehicleRow, WeighingRow } from "./types";

const appTimeZone = (process.env.APP_TIMEZONE || "Asia/Jakarta").trim();
export const DATA_START_DATE = (process.env.DATA_START_DATE || "2026-10-12").trim();

async function getDashboardDataUncached() {
  const latestMonthRow = await dbOne<{ month: string }>(`
    SELECT COALESCE(
      MAX(to_char(timezone($1, weighed_at), 'YYYY-MM')),
      to_char(timezone($1, NOW()), 'YYYY-MM')
    ) AS month
    FROM weighings
    WHERE timezone($1, weighed_at) >= ($2::text || ' 00:00:00')::timestamp
  `, [appTimeZone, DATA_START_DATE]);
  const latestMonth = latestMonthRow?.month || new Date().toISOString().slice(0, 7);

  const totals = await dbOne<{ transactions: number; tonnage: number; ritasi: number }>(`
    SELECT
      COUNT(*)::int AS transactions,
      COALESCE(SUM(netto_2_kg), 0)::bigint AS tonnage,
      COALESCE(SUM(ritasi), 0)::bigint AS ritasi
    FROM weighings
    WHERE status = 'COMPLETED'
      AND to_char(timezone($1, weighed_at), 'YYYY-MM') = $2
      AND timezone($1, weighed_at) >= ($3::text || ' 00:00:00')::timestamp
  `, [appTimeZone, latestMonth, DATA_START_DATE]) || { transactions: 0, tonnage: 0, ritasi: 0 };

  const vehicleRow = await dbOne<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM vehicles WHERE active = TRUE"
  );
  const lpsRow = await dbOne<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM lps WHERE active = TRUE"
  );

  const topLps = await dbQuery<{ lps_name: string; total_kg: number; ritasi: number }>(`
    SELECT
      lps_name,
      SUM(netto_2_kg)::bigint AS total_kg,
      SUM(ritasi)::bigint AS ritasi
    FROM weighings
    WHERE status = 'COMPLETED'
      AND to_char(timezone($1, weighed_at), 'YYYY-MM') = $2
      AND timezone($1, weighed_at) >= ($3::text || ' 00:00:00')::timestamp
    GROUP BY lps_name
    ORDER BY total_kg DESC
    LIMIT 8
  `, [appTimeZone, latestMonth, DATA_START_DATE]);

  const daily = await dbQuery<{ day: string; total_kg: number }>(`
    SELECT
      to_char(timezone($1, weighed_at), 'DD') AS day,
      SUM(netto_2_kg)::bigint AS total_kg
    FROM weighings
    WHERE status = 'COMPLETED'
      AND to_char(timezone($1, weighed_at), 'YYYY-MM') = $2
      AND timezone($1, weighed_at) >= ($3::text || ' 00:00:00')::timestamp
    GROUP BY day
    ORDER BY day
  `, [appTimeZone, latestMonth, DATA_START_DATE]);

  const latest = await dbQuery<WeighingRow>(`
    SELECT id, ticket_number, weighed_at, plate_number, driver_name, lps_name,
      gross_kg, tare_kg, netto_1_kg, rafaksi_kg, netto_2_kg, ritasi, tare_source, status
    FROM weighings
    WHERE timezone($1, weighed_at) >= ($2::text || ' 00:00:00')::timestamp
    ORDER BY weighed_at DESC, id DESC
    LIMIT 10
  `, [appTimeZone, DATA_START_DATE]);

  const reconciliationRow = await dbOne<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'source_reconciliation'"
  );
  const reconciliation = reconciliationRow ? JSON.parse(reconciliationRow.value) as {
    summarySheetTotalKg: number;
    transactionSheetsTotalKg: number;
    differenceKg: number;
    differenceDetail: Array<{
      date: string;
      lps: string;
      transactionSheetsKg: number;
      summarySheetKg: number;
      note: string;
    }>;
    sourceErrorTickets: string[];
  } : null;

  return {
    latestMonth,
    totals,
    vehicles: vehicleRow?.count || 0,
    lps: lpsRow?.count || 0,
    topLps,
    daily,
    latest,
    reconciliation,
  };
}

const getDashboardDataCached = unstable_cache(
  getDashboardDataUncached,
  ["timbangqr-dashboard", appTimeZone, DATA_START_DATE],
  { revalidate: 10 }
);

export async function getDashboardData() {
  return getDashboardDataUncached();
}

export async function listVehicles(
  search = "",
  filter: "active" | "all" | "inactive" | "air_hitam" | "palas" | "harapan_jaya" = "active"
) {
  const term = `%${search.trim()}%`;
  return dbQuery<VehicleRow>(`
    SELECT
      v.*,
      COALESCE(v.nama_lps, STRING_AGG(DISTINCT l.name, ', ' ORDER BY l.name)) AS lps_names,
      COUNT(DISTINCT va.id)::int AS assignment_count
    FROM vehicles v
    LEFT JOIN vehicle_assignments va ON va.vehicle_id = v.id AND va.active = TRUE
    LEFT JOIN lps l ON l.id = va.lps_id
    WHERE ($1 = '%%'
      OR v.plate_number ILIKE $1
      OR v.code ILIKE $1
      OR v.nomor_izin ILIKE $1
      OR v.nama_lps ILIKE $1
      OR v.wilayah_kerja ILIKE $1
      OR v.nama_ketua_lps ILIKE $1
      OR v.kelurahan_lps ILIKE $1
      OR v.kecamatan_lps ILIKE $1
      OR l.name ILIKE $1
      OR va.driver_name ILIKE $1)
      AND (
        $2 = 'all'
        OR ($2 = 'active' AND v.active = TRUE)
        OR ($2 = 'inactive' AND v.active = FALSE)
        OR ($2 = 'air_hitam' AND v.lokasi_tps = 'AIR HITAM')
        OR ($2 = 'palas' AND v.lokasi_tps = 'PALAS')
        OR ($2 = 'harapan_jaya' AND v.lokasi_tps = 'HARAPAN JAYA')
      )
    GROUP BY v.id
    ORDER BY v.no_urut ASC NULLS LAST, v.code ASC
  `, [term, filter]);
}

export async function getVehicle(id: number) {
  const vehicle = await dbOne<VehicleRow>("SELECT * FROM vehicles WHERE id = $1", [id]);
  if (!vehicle) return null;

  const assignments = await dbQuery<AssignmentRow>(`
    SELECT va.id, va.lps_id, l.name AS lps_name, va.driver_name, va.tare_kg, va.is_primary
    FROM vehicle_assignments va
    JOIN lps l ON l.id = va.lps_id
    WHERE va.vehicle_id = $1 AND va.active = TRUE
    ORDER BY va.is_primary DESC, l.name
  `, [id]);

  const weighings = await dbQuery<WeighingRow>(`
    SELECT id, ticket_number, weighed_at, plate_number, driver_name, lps_name,
      gross_kg, tare_kg, netto_1_kg, rafaksi_kg, netto_2_kg, ritasi, tare_source, status
    FROM weighings
    WHERE vehicle_id = $1
      AND timezone($2, weighed_at) >= ($3::text || ' 00:00:00')::timestamp
    ORDER BY weighed_at DESC, id DESC
    LIMIT 20
  `, [id, appTimeZone, DATA_START_DATE]);

  return { vehicle, assignments, weighings };
}

export async function listWeighings(filters: {
  search?: string;
  month?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  lps?: string;
  limit?: number;
}) {
  const search = filters.search?.trim() || "";
  const month = filters.month?.trim() || "";
  const date = filters.date?.trim() || "";
  const startDate = filters.startDate?.trim() || "";
  const endDate = filters.endDate?.trim() || "";
  const lps = filters.lps?.trim() || "";
  const limit = Math.min(Math.max(filters.limit || 100, 1), 10000);

  const whereClauses: string[] = [];
  const params: (string | number)[] = [];

  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    whereClauses.push(
      `(ticket_number ILIKE $${idx} OR plate_number ILIKE $${idx} OR driver_name ILIKE $${idx} OR lps_name ILIKE $${idx})`
    );
  }

  if (lps) {
    params.push(lps);
    whereClauses.push(`lps_name = $${params.length}`);
  }

  if (startDate && endDate) {
    params.push(startDate);
    const sIdx = params.length;
    params.push(endDate);
    const eIdx = params.length;
    params.push(appTimeZone);
    const tzIdx = params.length;
    whereClauses.push(`(timezone($${tzIdx}, weighed_at)::date BETWEEN $${sIdx}::date AND $${eIdx}::date)`);
  } else if (startDate) {
    params.push(startDate);
    const sIdx = params.length;
    params.push(appTimeZone);
    const tzIdx = params.length;
    whereClauses.push(`(timezone($${tzIdx}, weighed_at)::date >= $${sIdx}::date)`);
  } else if (endDate) {
    params.push(endDate);
    const eIdx = params.length;
    params.push(appTimeZone);
    const tzIdx = params.length;
    whereClauses.push(`(timezone($${tzIdx}, weighed_at)::date <= $${eIdx}::date)`);
  } else if (date) {
    params.push(date);
    const dIdx = params.length;
    params.push(appTimeZone);
    const tzIdx = params.length;
    whereClauses.push(`(timezone($${tzIdx}, weighed_at)::date = $${dIdx}::date)`);
  } else if (month) {
    params.push(month);
    const mIdx = params.length;
    params.push(appTimeZone);
    const tzIdx = params.length;
    whereClauses.push(`(to_char(timezone($${tzIdx}, weighed_at), 'YYYY-MM') = $${mIdx})`);
  }

  params.push(appTimeZone);
  const tzIdx = params.length;
  params.push(DATA_START_DATE);
  const baseIdx = params.length;
  whereClauses.push(`(timezone($${tzIdx}, weighed_at) >= ($${baseIdx}::text || ' 00:00:00')::timestamp)`);

  params.push(limit);
  const limitIdx = params.length;

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  return dbQuery<WeighingRow>(`
    SELECT id, ticket_number, weighed_at, plate_number, driver_name, lps_name,
      gross_kg, tare_kg, netto_1_kg, rafaksi_kg, netto_2_kg, ritasi, tare_source, status,
      vehicle_id, lps_id, vehicle_type, waste_type, source_note
    FROM weighings
    ${whereSql}
    ORDER BY weighed_at DESC, id DESC
    LIMIT $${limitIdx}
  `, params);
}

async function getLpsListUncached() {
  return dbQuery<{ id: number; name: string }>(
    "SELECT id, name FROM lps WHERE active = TRUE ORDER BY name"
  );
}

const getLpsListCached = unstable_cache(
  getLpsListUncached,
  ["timbangqr-lps-list"],
  { revalidate: 300 }
);

export async function getLpsList() {
  return getLpsListCached();
}

export async function getVehicleCounts() {
  const row = await dbOne<{
    total: number;
    active: number;
    inactive: number;
    airHitam: number;
    palas: number;
    harapanJaya: number;
  }>(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE active = TRUE)::int AS active,
      COUNT(*) FILTER (WHERE active = FALSE)::int AS inactive,
      COUNT(*) FILTER (WHERE lokasi_tps = 'AIR HITAM')::int AS "airHitam",
      COUNT(*) FILTER (WHERE lokasi_tps = 'PALAS')::int AS "palas",
      COUNT(*) FILTER (WHERE lokasi_tps = 'HARAPAN JAYA')::int AS "harapanJaya"
    FROM vehicles
  `);
  return row || { total: 0, active: 0, inactive: 0, airHitam: 0, palas: 0, harapanJaya: 0 };
}

async function getDeviceListUncached() {
  return dbQuery<Record<string, string | number | boolean | null>>(`
    SELECT d.*,
      latest.weight_kg AS latest_weight,
      latest.stable AS latest_stable,
      latest.recorded_at AS latest_recorded_at
    FROM weighbridge_devices d
    LEFT JOIN LATERAL (
      SELECT r.weight_kg, r.stable, r.recorded_at
      FROM device_readings r
      WHERE r.device_id = d.id
      ORDER BY r.id DESC
      LIMIT 1
    ) latest ON TRUE
    ORDER BY d.device_code
  `);
}

const getDeviceListCached = unstable_cache(
  getDeviceListUncached,
  ["timbangqr-device-list"],
  { revalidate: 10 }
);

export async function getDeviceList() {
  return getDeviceListCached();
}

export async function getMonthlyReport(month: string) {
  const rows = await dbQuery<{ lps_name: string; day: number; total_kg: number; ritasi: number }>(`
    SELECT
      lps_name,
      EXTRACT(DAY FROM timezone($1, weighed_at))::int AS day,
      SUM(netto_2_kg)::bigint AS total_kg,
      SUM(ritasi)::bigint AS ritasi
    FROM weighings
    WHERE status = 'COMPLETED'
      AND to_char(timezone($1, weighed_at), 'YYYY-MM') = $2
      AND timezone($1, weighed_at) >= ($3::text || ' 00:00:00')::timestamp
    GROUP BY lps_name, day
    ORDER BY lps_name, day
  `, [appTimeZone, month, DATA_START_DATE]);

  const map = new Map<string, { name: string; days: number[]; total: number; ritasi: number }>();
  for (const row of rows) {
    const current = map.get(row.lps_name) || {
      name: row.lps_name,
      days: Array(31).fill(0),
      total: 0,
      ritasi: 0,
    };
    current.days[row.day - 1] = row.total_kg;
    current.total += row.total_kg;
    current.ritasi += row.ritasi;
    map.set(row.lps_name, current);
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "id"));
}
