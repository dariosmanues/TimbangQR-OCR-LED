"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import ArmadaFormModal from "@/components/ArmadaFormModal";

interface VehicleCreateFormProps {
  lpsOptions: Array<{ id: number; name: string }>;
}

export default function VehicleCreateForm({ lpsOptions }: VehicleCreateFormProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => setModalOpen(true)}
        style={{ gap: 6 }}
      >
        <Plus size={18} /> Tambah Armada
      </button>

      {modalOpen && (
        <ArmadaFormModal
          isOpen
          onClose={() => setModalOpen(false)}
          mode="create"
          lpsOptions={lpsOptions}
        />
      )}
    </>
  );
}
