import { SizeHealthGrade } from "@/generated/prisma/enums";

// Display order + human labels for the Size & Health grades (CLAUDE.md §6). Pure
// and shared by client and server. Order matches the spec's grade listing.

export const SIZE_HEALTH_GRADES: readonly SizeHealthGrade[] = [
  SizeHealthGrade.ANGKAT_RAK,
  SizeHealthGrade.A_PLUS_PLUS,
  SizeHealthGrade.A_PLUS,
  SizeHealthGrade.A,
  SizeHealthGrade.B,
  SizeHealthGrade.C,
  SizeHealthGrade.KECIL,
  SizeHealthGrade.MINI,
  SizeHealthGrade.RETAK,
  SizeHealthGrade.PLASTIK,
  SizeHealthGrade.LUNAK,
];

export const GRADE_LABELS: Record<SizeHealthGrade, string> = {
  ANGKAT_RAK: "Angkat Rak",
  A_PLUS_PLUS: "A++",
  A_PLUS: "A+",
  A: "A",
  B: "B",
  C: "C",
  KECIL: "Kecil",
  MINI: "Mini",
  RETAK: "Retak",
  PLASTIK: "Plastik",
  LUNAK: "Lunak",
};

export function gradeLabel(grade: SizeHealthGrade): string {
  return GRADE_LABELS[grade];
}
