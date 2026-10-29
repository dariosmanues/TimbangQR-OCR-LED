"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import type { WeighingRow } from "@/lib/types";
import TransactionFormModal, { type TransactionFormVehicle } from "@/components/TransactionFormModal";
import TransactionDeleteModal from "@/components/TransactionDeleteModal";

interface TransactionDetailActionsProps {
  weighing: WeighingRow;
  lpsOptions: Array<{ id: number; name: string }>;
  vehicleOptions?: TransactionFormVehicle[];
}

export default function TransactionDetailActions({
  weighing,
  lpsOptions,
  vehicleOptions = [],
}: TransactionDetailActionsProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setEditOpen(true)}
          title="Edit data penimbangan ini"
          style={{ gap: 6 }}
        >
          <Pencil size={15} /> Edit Transaksi
        </button>

        <button
          type="button"
          className="btn btn-sm"
          onClick={() => setDeleteOpen(true)}
          title="Hapus penimbangan ini"
          style={{
            gap: 6,
            color: "var(--danger)",
            backgroundColor: "#fff0f0",
            border: "1px solid #fed7d7",
            padding: "8px 12px",
            minHeight: 40,
          }}
        >
          <Trash2 size={15} /> Hapus
        </button>
      </div>

      {editOpen && (
        <TransactionFormModal
          isOpen
          onClose={() => setEditOpen(false)}
          mode="edit"
          weighing={weighing}
          lpsOptions={lpsOptions}
          vehicleOptions={vehicleOptions}
        />
      )}

      <TransactionDeleteModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        weighing={weighing}
        onSuccess={() => {
          router.push("/transaksi");
        }}
      />
    </>
  );
}
