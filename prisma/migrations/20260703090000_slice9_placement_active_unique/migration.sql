-- Foundation for Slice 9 (backs up the in-service one-active-placement rule, A23).
-- Enforce at the database level: at most one ACTIVE placement per kandang. This is a
-- PARTIAL unique index (WHERE status = 'ACTIVE'), which Prisma cannot express in
-- schema.prisma, so it lives as raw SQL here. ENDED placements are unconstrained, so a
-- freed kandang can be re-populated and history is retained. The service check in
-- createFlock() is kept too (it fires first, inside the transaction, with a friendlier
-- message); this index is the last line of defence against a concurrent double-insert.
CREATE UNIQUE INDEX "Placement_farmhouseId_active_key"
  ON "Placement" ("farmhouseId")
  WHERE "status" = 'ACTIVE';
