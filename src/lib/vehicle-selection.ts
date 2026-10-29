export type PlateLookupVehicle = {
  id: number;
  plate_number: string;
};

/**
 * Normalizes Indonesian licence plates for a safe client-side lookup.
 * The database remains the source of truth; this only prevents the manual
 * transaction form from submitting a different vehicle by accident.
 */
export function normalizePlateForLookup(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function findVehicleByPlate<T extends PlateLookupVehicle>(
  plateNumber: string,
  vehicles: readonly T[]
): T | null {
  const normalizedPlate = normalizePlateForLookup(plateNumber);
  if (!normalizedPlate) return null;

  return vehicles.find(
    (vehicle) => normalizePlateForLookup(vehicle.plate_number) === normalizedPlate
  ) ?? null;
}
