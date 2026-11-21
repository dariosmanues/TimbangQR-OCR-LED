import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getSession } from "@/lib/auth";
import { listWeighings } from "@/lib/queries";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q") || undefined;
  const startDate = url.searchParams.get("startDate") || undefined;
  const endDate = url.searchParams.get("endDate") || undefined;
  const date = url.searchParams.get("date") || undefined;
  const month = url.searchParams.get("month") || undefined;
  const lps = url.searchParams.get("lps") || undefined;

  const rawDepo = (process.env.LPS_TRANSDEPO || "HARAPAN_JAYA").toUpperCase().replace(/[^A-Z0-9_-]/g, "_");
  const siteLabel = rawDepo.includes("HARAPAN") ? "HARAPAN_JAYA" : rawDepo.includes("AIR") ? "AIR_HITAM" : rawDepo;

  const rows = await listWeighings({
    search: q,
    startDate,
    endDate,
    date,
    month,
    lps,
    limit: 10000,
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = `TimbangQR ${siteLabel.replace(/_/g, " ")}`;
  workbook.created = new Date();

  const green = "0B7A50";
  const dark = "173B2D";
  const light = "E7F7EF";
  const border = { style: "thin" as const, color: { argb: "D4E1D9" } };

  const sheet = workbook.addWorksheet("TRANSAKSI", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.addRow([
    "NO",
    "NO TIKET",
    "WAKTU TIMBANG",
    "NO POLISI",
    "PENGEMUDI",
    "LPS / PENGIRIM",
    "JENIS ARMADA",
    "JENIS SAMPAH",
    "GROSS (KG)",
    "TARE (KG)",
    "NETTO 1 (KG)",
    "RAFAKSI (KG)",
    "NETTO 2 (KG)",
    "RITASI",
    "SUMBER TARE",
    "STATUS",
    "CATATAN",
  ]);

  rows.forEach((tx, index) => {
    sheet.addRow([
      index + 1,
      tx.ticket_number,
      new Date(String(tx.weighed_at)),
      tx.plate_number,
      tx.driver_name || "-",
      tx.lps_name,
      tx.vehicle_type || "-",
      tx.waste_type || "-",
      tx.gross_kg,
      tx.tare_kg,
      tx.netto_1_kg,
      tx.rafaksi_kg,
      tx.netto_2_kg,
      tx.ritasi,
      tx.tare_source || "-",
      tx.status,
      tx.source_note || "-",
    ]);
  });

  sheet.columns = [
    { width: 6 },
    { width: 18 },
    { width: 22 },
    { width: 16 },
    { width: 20 },
    { width: 28 },
    { width: 16 },
    { width: 22 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 15 },
    { width: 10 },
    { width: 18 },
    { width: 15 },
    { width: 35 },
  ];

  // Header styling
  const headerRow = sheet.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: green } };
    cell.font = { bold: true, color: { argb: "FFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { top: border, left: border, bottom: border, right: border };
  });

  // Date column format
  sheet.getColumn(3).numFmt = "dd-mm-yyyy hh:mm";

  // Numeric column formats
  for (let col = 9; col <= 14; col++) {
    sheet.getColumn(col).numFmt = "#,##0";
  }

  // Row borders and alignments
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.height = 20;
    row.eachCell((cell, colNumber) => {
      cell.border = { top: border, left: border, bottom: border, right: border };
      cell.alignment = {
        vertical: "middle",
        horizontal:
          colNumber === 1 || colNumber === 3 || colNumber === 4 || colNumber === 14 || colNumber === 16
            ? "center"
            : colNumber >= 9 && colNumber <= 13
            ? "right"
            : "left",
      };
    });
  });

  // Total summary row
  const totalGross = rows.reduce((s, r) => s + (r.gross_kg || 0), 0);
  const totalTare = rows.reduce((s, r) => s + (r.tare_kg || 0), 0);
  const totalNetto1 = rows.reduce((s, r) => s + (r.netto_1_kg || 0), 0);
  const totalRafaksi = rows.reduce((s, r) => s + (r.rafaksi_kg || 0), 0);
  const totalNetto2 = rows.reduce((s, r) => s + (r.netto_2_kg || 0), 0);
  const totalRitasi = rows.reduce((s, r) => s + (r.ritasi || 0), 0);

  const totalRow = sheet.addRow([
    "",
    "TOTAL",
    "",
    "",
    "",
    "",
    "",
    "",
    totalGross,
    totalTare,
    totalNetto1,
    totalRafaksi,
    totalNetto2,
    totalRitasi,
    "",
    "",
    "",
  ]);

  totalRow.height = 24;
  totalRow.eachCell((cell, colNumber) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: light } };
    cell.font = { bold: true, color: { argb: dark } };
    cell.border = { top: border, left: border, bottom: border, right: border };
    cell.alignment = {
      vertical: "middle",
      horizontal: colNumber === 2 ? "center" : colNumber >= 9 && colNumber <= 13 ? "right" : "center",
    };
    if (colNumber >= 9 && colNumber <= 14) cell.numFmt = "#,##0";
  });

  sheet.autoFilter = { from: "A1", to: "Q1" };

  let dateSegment = "SEMUA";
  if (startDate && endDate) {
    dateSegment = `${startDate}_sd_${endDate}`;
  } else if (startDate) {
    dateSegment = `DARI_${startDate}`;
  } else if (endDate) {
    dateSegment = `SD_${endDate}`;
  } else if (date) {
    dateSegment = date;
  } else if (month) {
    dateSegment = month.replace("-", "_");
  } else {
    dateSegment = new Date().toISOString().slice(0, 10);
  }

  const filename = `TRANSAKSI_${siteLabel}_${dateSegment}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
