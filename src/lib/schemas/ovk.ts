import { z } from "zod";

import { OvkCategory } from "@/generated/prisma/enums";

// OVK validation (SRS §3.12). The item's optional unit conversions are read from dynamic
// form rows in the create action; everything else is a fixed shape here.

export const ovkItemSchema = z.object({
  name: z.string().trim().min(1, "Item name is required.").max(120),
  category: z.enum(OvkCategory),
  baseUnit: z.string().trim().min(1, "Base unit is required.").max(30),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const ovkStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const ovkDeliverySchema = z.object({
  ovkItemId: z.string().min(1, "Choose an item."),
  quantity: z.coerce.number().positive("Quantity must be greater than 0."),
  unitName: z.string().min(1, "Choose a unit."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
});

export const ovkTransferSchema = z.object({
  ovkItemId: z.string().min(1, "Choose an item."),
  quantity: z.coerce.number().positive("Quantity must be greater than 0."),
  unitName: z.string().min(1, "Choose a unit."),
  farmhouseId: z.string().min(1, "Choose a kandang."),
  note: z.string().trim().max(300).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
});

export const ovkCorrectionSchema = z.object({
  ovkItemId: z.string().min(1, "Choose an item."),
  newQuantity: z.coerce.number().min(0, "Corrected quantity cannot be negative."),
  reason: z.string().trim().min(20, "A correction needs a reason of at least 20 characters."),
});
