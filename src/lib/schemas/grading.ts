import { z } from "zod";

// Grading key (SRS §3.3). Line items (per Type × grade) are read dynamically from
// the form in the action. Both draft and submit are keyed by (kandang, date, batch).
export const gradingKeySchema = z.object({
  farmhouseId: z.string().min(1, "Choose a kandang."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
  batchNumber: z.coerce.number().int().min(1),
});
