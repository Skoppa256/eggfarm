import { OvkCategory } from "@/generated/prisma/enums";

// Pure OVK helpers (SRS §3.12). Unit conversion + labels — shared client + server, no
// I/O. Stock is held in each item's base unit; entries may use a converted unit (e.g. a
// botol → liters, or pcs → grams). The same mechanism is reusable for feed karung→kg (A35).

const round3 = (x: number): number => Math.round(x * 1000) / 1000;

/** One per-item unit conversion: `1 unitName = factorToBase × baseUnit`. */
export interface OvkConversion {
  unitName: string;
  factorToBase: number;
}

/**
 * How many base units one `unitName` is worth for an item, or null if the unit is neither
 * the base unit nor a defined conversion. The base unit is always factor 1.
 */
export function conversionFactor(
  unitName: string,
  baseUnit: string,
  conversions: OvkConversion[],
): number | null {
  if (unitName === baseUnit) return 1;
  const c = conversions.find((x) => x.unitName === unitName);
  return c ? c.factorToBase : null;
}

/**
 * Convert an entered quantity in `unitName` to the item's base unit (kg/liter/gram/…).
 * e.g. 2 botol × (1 liter/botol) = 2 liter; 3 pcs × (100 gram/pcs) = 300 gram. Throws on
 * an unknown unit (the service surfaces this as a user-facing conflict).
 */
export function convertToBaseUnit(
  quantity: number,
  unitName: string,
  baseUnit: string,
  conversions: OvkConversion[],
): number {
  const factor = conversionFactor(unitName, baseUnit, conversions);
  if (factor == null) {
    throw new Error(`Unknown unit "${unitName}" for base unit "${baseUnit}".`);
  }
  return round3(quantity * factor);
}

export const OVK_CATEGORY_ORDER: readonly OvkCategory[] = [
  OvkCategory.OBAT,
  OvkCategory.VITAMIN,
  OvkCategory.CHEMICAL,
];

export const OVK_CATEGORY_LABELS: Record<OvkCategory, string> = {
  OBAT: "Obat",
  VITAMIN: "Vitamin",
  CHEMICAL: "Kimia",
};
