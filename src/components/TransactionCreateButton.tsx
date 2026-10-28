"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import TransactionFormModal, { type TransactionFormVehicle } from "@/components/TransactionFormModal";

interface TransactionCreateButtonProps {
  lpsOptions: Array<{ id: number; name: string }>;
  vehicleOptions: TransactionFormVehicle[];
}

export default function TransactionCreateButton({
  lpsOptions,
  vehicleOptions,
}: TransactionCreateButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => setModalOpen(true)}
        style={{ gap: 6 }}
      >
        <Plus size={16} />
        <span>Transaksi Manual</span>
      </button>

      <TransactionFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        mode="create"
        lpsOptions={lpsOptions}
        vehicleOptions={vehicleOptions}
      />
    </>
  );
}
