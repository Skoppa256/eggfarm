import { z } from "zod";

import { SizeHealthGrade } from "@/generated/prisma/enums";

// Buyers (SRS §3.6)
export const createBuyerSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
});
export const renameBuyerSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Name is required.").max(120),
});
export const buyerStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

// Sales (SRS §3.5). The sale header; line items are read from the dynamic form rows.
export const saleHeaderSchema = z.object({
  warehouseId: z.string().min(1, "Choose a warehouse."),
  buyerId: z.string().min(1, "Choose a buyer."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
  notes: z.string().max(500).optional(),
});

export const saleLineSchema = z.object({
  sizeHealthGrade: z.enum(SizeHealthGrade),
  typeGradeId: z.string().min(1, "type is required"),
  quantity: z.coerce.number().int("whole number").min(1, "must be at least 1"),
  unit: z.enum(["RAK", "PCS"]),
});

export const voidSaleSchema = z.object({
  transactionId: z.string().min(1),
  reason: z.string().trim().min(3, "A reason (at least 3 characters) is required."),
});
