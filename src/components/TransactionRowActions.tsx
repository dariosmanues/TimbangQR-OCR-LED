"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import type { WeighingRow } from "@/lib/types";
import TransactionFormModal, { type TransactionFormVehicle } from "@/components/TransactionFormModal";
import TransactionDeleteModal from "@/components/TransactionDeleteModal";

interface TransactionRowActionsProps {
  weighing: WeighingRow;
  canManage: boolean;
  lpsOptions?: Array<{ id: number; name: string }>;
  vehicleOptions?: TransactionFormVehicle[];
}

export default function TransactionRowActions({
  weighing,
  canManage,
  lpsOptions = [],
  vehicleOptions = [],
}: TransactionRowActionsProps) {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  return (
    <>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          justifyContent: "flex-end",
          whiteSpace: "nowrap",
        }}
      >
        {/* Link Tiket (Read Detail) */}
        <Link className="btn btn-soft btn-sm" href={`/transaksi/${weighing.id}`}>
          Tiket
        </Link>

        {/* Khusus Admin / Admin Transaksi: Tombol Edit & Hapus */}
        {canManage && (
          <>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setEditModalOpen(true)}
              title="Edit data penimbangan ini"
              style={{ padding: "5px 9px", gap: 4 }}
            >
              <Pencil size={13} /> Edit
            </button>

            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setDeleteModalOpen(true)}
              title="Hapus data transaksi ini"
              style={{
                padding: "5px 8px",
                color: "var(--danger)",
                backgroundColor: "#fff0f0",
                border: "1px solid #fed7d7",
              }}
            >
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>

      {canManage && (
        <>
          <TransactionFormModal
            isOpen={editModalOpen}
            onClose={() => setEditModalOpen(false)}
            mode="edit"
            weighing={weighing}
            lpsOptions={lpsOptions}
            vehicleOptions={vehicleOptions}
          />

          <TransactionDeleteModal
            isOpen={deleteModalOpen}
            onClose={() => setDeleteModalOpen(false)}
            weighing={weighing}
          />
        </>
      )}
    </>
  );
}
