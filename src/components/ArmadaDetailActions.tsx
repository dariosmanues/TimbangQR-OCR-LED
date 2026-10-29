"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import type { VehicleRow } from "@/lib/types";
import ArmadaFormModal from "@/components/ArmadaFormModal";
import ArmadaDeleteModal from "@/components/ArmadaDeleteModal";

interface ArmadaDetailActionsProps {
  vehicle: VehicleRow;
  lpsOptions: Array<{ id: number; name: string }>;
}

export default function ArmadaDetailActions({ vehicle, lpsOptions }: ArmadaDetailActionsProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => setEditOpen(true)}
        title="Edit data armada"
        style={{ gap: 6 }}
      >
        <Pencil size={16} /> Edit Data
      </button>

      <button
        type="button"
        className="btn btn-sm"
        onClick={() => setDeleteOpen(true)}
        title="Hapus atau nonaktifkan armada ini"
        style={{
          gap: 6,
          color: "var(--danger)",
          backgroundColor: "#fff0f0",
          border: "1px solid #fed7d7",
          padding: "8px 12px",
          minHeight: 42,
        }}
      >
        <Trash2 size={16} /> Hapus
      </button>

      {editOpen && (
        <ArmadaFormModal
          isOpen
          onClose={() => setEditOpen(false)}
          mode="edit"
          vehicle={vehicle}
          lpsOptions={lpsOptions}
        />
      )}

      <ArmadaDeleteModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        vehicle={vehicle}
        onSuccess={() => {
          router.push("/armada");
        }}
      />
    </>
  );
}
