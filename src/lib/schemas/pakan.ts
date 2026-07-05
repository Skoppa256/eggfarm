import { z } from "zod";

import { IngredientCategory } from "@/generated/prisma/enums";

// PAKAN validation (SRS §3.11). Ingredient master + delivery here; the mixing recipe
// (dynamic recipe lines) is assembled in its action.

export const ingredientSchema = z.object({
  name: z.string().trim().min(1, "Ingredient name is required.").max(120),
  category: z.enum(IngredientCategory),
  baseUnit: z.string().trim().max(20).optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const ingredientStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const deliverySchema = z.object({
  ingredientId: z.string().min(1, "Choose an ingredient."),
  quantity: z.coerce.number().positive("Quantity must be greater than 0."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
});

export const ingredientCorrectionSchema = z.object({
  ingredientId: z.string().min(1, "Choose an ingredient."),
  newQuantity: z.coerce.number().min(0, "Corrected quantity cannot be negative."),
  reason: z.string().trim().min(20, "A correction needs a reason of at least 20 characters."),
});

export const mixingKeySchema = z.object({
  farmhouseId: z.string().min(1, "Choose a kandang."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
  projectedIntake: z.coerce.number().positive("Projected intake (g/bird) must be greater than 0."),
});
