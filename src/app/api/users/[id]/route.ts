import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { dbOne, withTransaction } from "@/lib/db";

export const runtime = "nodejs";

const VALID_ROLES = ["SUPER_ADMIN", "ADMIN", "ADMIN_TRANSAKSI"] as const;

const updateUserSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").optional(),
  email: z.string().trim().email("Format email tidak valid").optional(),
  password: z.string().optional(),
  role: z.enum(VALID_ROLES).optional(),
  active: z.boolean().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !isSuperAdmin(session)) {
    return NextResponse.json(
      { error: "Akses ditolak: Hanya Master ADMIN yang dapat mengubah data user & role." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const targetId = Number(id);
  if (isNaN(targetId)) {
    return NextResponse.json({ error: "ID user tidak valid." }, { status: 400 });
  }

  const existing = await dbOne<{
    id: number;
    email: string;
    name: string;
    role: string;
    active: boolean;
  }>("SELECT id, email, name, role, active FROM users WHERE id = $1", [targetId]);

  if (!existing) {
    return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
  }

  try {
    const body = await request.json();
    const input = updateUserSchema.parse(body);

    const nextName = input.name !== undefined ? input.name : existing.name;
    const nextEmail = input.email !== undefined ? input.email.toLowerCase() : existing.email;
    const nextRole = input.role !== undefined ? input.role : existing.role;
    const nextActive = input.active !== undefined ? input.active : existing.active;

    if (targetId === session.id) {
      if (!nextActive) {
        return NextResponse.json(
          { error: "Anda tidak dapat menonaktifkan akun Master ADMIN yang sedang Anda gunakan saat ini." },
          { status: 400 }
        );
      }
      if (nextRole !== "SUPER_ADMIN") {
        return NextResponse.json(
          { error: "Anda tidak dapat menurunkan role akun Master ADMIN yang sedang Anda gunakan saat ini." },
          { status: 400 }
        );
      }
    }

    if (nextEmail.toLowerCase() !== existing.email.toLowerCase()) {
      const dup = await dbOne<{ id: number }>(
        "SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2 LIMIT 1",
        [nextEmail, targetId]
      );
      if (dup) {
        return NextResponse.json(
          { error: `Email "${nextEmail}" sudah digunakan oleh user lain.` },
          { status: 409 }
        );
      }
    }

    const rawPassword = (input.password || "").trim();
    if (rawPassword.length > 0 && rawPassword.length < 6) {
      return NextResponse.json(
        { error: "Password baru minimal 6 karakter." },
        { status: 400 }
      );
    }

    let updated;
    if (rawPassword.length >= 6) {
      const passwordHash = bcrypt.hashSync(rawPassword, 10);
      updated = await dbOne<{
        id: number;
        email: string;
        name: string;
        role: string;
        active: boolean;
        created_at: string;
      }>(
        `UPDATE users
         SET name = $1, email = $2, role = $3, active = $4, password_hash = $5
         WHERE id = $6
         RETURNING id, email, name, role, active, created_at`,
        [nextName, nextEmail, nextRole, nextActive, passwordHash, targetId]
      );
    } else {
      updated = await dbOne<{
        id: number;
        email: string;
        name: string;
        role: string;
        active: boolean;
        created_at: string;
      }>(
        `UPDATE users
         SET name = $1, email = $2, role = $3, active = $4
         WHERE id = $5
         RETURNING id, email, name, role, active, created_at`,
        [nextName, nextEmail, nextRole, nextActive, targetId]
      );
    }

    const txRow = await dbOne<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM weighings WHERE created_by = $1",
      [targetId]
    );

    return NextResponse.json({
      user: { ...updated, tx_count: txRow?.count || 0 },
      message: `Data user ${updated?.name} berhasil diperbarui.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Data user tidak valid." },
        { status: 400 }
      );
    }
    console.error("[PUT /api/users/[id]] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memperbarui user." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return PUT(request, context);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !isSuperAdmin(session)) {
    return NextResponse.json(
      { error: "Akses ditolak: Hanya Master ADMIN yang dapat menghapus user." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const targetId = Number(id);
  if (isNaN(targetId)) {
    return NextResponse.json({ error: "ID user tidak valid." }, { status: 400 });
  }

  if (targetId === session.id) {
    return NextResponse.json(
      { error: "Anda tidak dapat menghapus akun Master ADMIN yang sedang Anda gunakan saat ini." },
      { status: 400 }
    );
  }

  const existing = await dbOne<{ id: number; name: string; email: string }>(
    "SELECT id, name, email FROM users WHERE id = $1",
    [targetId]
  );

  if (!existing) {
    return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
  }

  try {
    await withTransaction(async (client) => {
      await client.query("UPDATE weighings SET created_by = NULL WHERE created_by = $1", [targetId]);
      await client.query("UPDATE audit_logs SET user_id = NULL WHERE user_id = $1", [targetId]);
      await client.query("DELETE FROM users WHERE id = $1", [targetId]);
    });

    return NextResponse.json({
      ok: true,
      message: `User ${existing.name} (${existing.email}) berhasil dihapus.`,
    });
  } catch (error) {
    console.error("[DELETE /api/users/[id]] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menghapus user." },
      { status: 500 }
    );
  }
}

