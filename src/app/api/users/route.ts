import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { dbOne, dbQuery } from "@/lib/db";

export const runtime = "nodejs";

const VALID_ROLES = ["SUPER_ADMIN", "ADMIN", "ADMIN_TRANSAKSI"] as const;

const createUserSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter"),
  email: z.string().trim().email("Format email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  role: z.enum(VALID_ROLES),
  active: z.boolean().optional().default(true),
});

export async function GET() {
  const session = await getSession();
  if (!isSuperAdmin(session)) {
    return NextResponse.json(
      { error: "Akses ditolak: Hanya Master ADMIN yang dapat mengakses manajemen user & role." },
      { status: 403 }
    );
  }

  const users = await dbQuery<{
    id: number;
    email: string;
    name: string;
    role: string;
    active: boolean;
    created_at: string;
    tx_count: number;
  }>(`
    SELECT
      u.id,
      u.email,
      u.name,
      u.role,
      u.active,
      u.created_at,
      COUNT(w.id)::int AS tx_count
    FROM users u
    LEFT JOIN weighings w ON w.created_by = u.id
    GROUP BY u.id
    ORDER BY
      CASE
        WHEN UPPER(u.role) IN ('SUPER_ADMIN', 'SUPERADMIN') THEN 1
        WHEN UPPER(u.role) = 'ADMIN_TRANSAKSI' THEN 2
        ELSE 3
      END,
      u.id ASC
  `);

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!isSuperAdmin(session)) {
    return NextResponse.json(
      { error: "Akses ditolak: Hanya Master ADMIN yang dapat menambahkan user baru." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const input = createUserSchema.parse(body);

    const existing = await dbOne<{ id: number }>(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [input.email]
    );
    if (existing) {
      return NextResponse.json(
        { error: `Email "${input.email}" sudah terdaftar pada sistem.` },
        { status: 409 }
      );
    }

    const passwordHash = bcrypt.hashSync(input.password, 10);
    const created = await dbOne<{
      id: number;
      email: string;
      name: string;
      role: string;
      active: boolean;
      created_at: string;
    }>(
      `INSERT INTO users (email, name, password_hash, role, active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, role, active, created_at`,
      [input.email.toLowerCase(), input.name, passwordHash, input.role, input.active]
    );

    return NextResponse.json({ user: { ...created, tx_count: 0 } }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Data user tidak valid." },
        { status: 400 }
      );
    }
    console.error("[POST /api/users] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal membuat user baru." },
      { status: 500 }
    );
  }
}

