import { z } from "zod";

// Validation for Slice 3 config & master data (shared client + server).
// Batch bounds mirror MIN/MAX_BATCHES_PER_DAY in src/lib/server/farmhouses.ts,
// which is the authoritative enforcement point.

const nameField = z.string().min(1, "Name is required.").max(120);
const codeField = z
  .string()
  .min(1, "Code is required.")
  .max(40)
  .regex(/^[A-Za-z0-9._-]+$/, "Use letters, numbers, dot, underscore or hyphen only.");
const batchField = z.coerce
  .number()
  .int("Must be a whole number.")
  .min(1, "At least 1 batch.")
  .max(10, "At most 10 batches.");

export const statusToggleSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

// Farmhouses (Admin)
export const createFarmhouseSchema = z.object({
  name: nameField,
  code: codeField,
  warehouseId: z.string().min(1, "Choose a warehouse."),
  maxBatchesPerDay: batchField,
});

export const changeMappingSchema = z.object({
  farmhouseId: z.string().min(1),
  warehouseId: z.string().min(1, "Choose a warehouse."),
});

export const changeBatchSchema = z.object({
  farmhouseId: z.string().min(1),
  maxBatchesPerDay: batchField,
});

// Warehouses (Admin)
export const createWarehouseSchema = z.object({
  name: nameField,
  code: codeField,
});

// Measurement units (Superadmin)
export const createUnitSchema = z.object({
  name: z.string().min(1, "Name is required.").max(40),
  pcsEquivalent: z.coerce
    .number()
    .int("Must be a whole number.")
    .min(1, "Must be at least 1 pcs."),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

// Grade types (Superadmin)
export const createGradeTypeSchema = z.object({
  name: z.string().min(1, "Name is required.").max(60),
  sortOrder: z.coerce.number().int().min(0).default(0),
});
