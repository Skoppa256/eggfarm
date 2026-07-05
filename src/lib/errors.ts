// Typed application errors (CLAUDE.md §7 "Errors"). Pure classes, safe to import
// from either client or server code. Server actions throw these; callers map them
// to the right user-facing outcome (403 for role/owner violations, 409 for
// conflicts, an insufficient-stock message naming the short SKU, etc.).

export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Role / Owner-is-read-only violation. 403-equivalent (CLAUDE.md §5.5). */
export class ForbiddenError extends AppError {}

/** Not authenticated. 401-equivalent. */
export class UnauthorizedError extends AppError {}

/** Duplicate / uniqueness conflict (e.g. collection for kandang+date+batch). 409. */
export class ConflictError extends AppError {}

/** A referenced record does not exist. 404-equivalent. */
export class NotFoundError extends AppError {}

/**
 * A stock OUT (or multi-line sale) would drive a balance negative. The whole
 * transaction is rejected with no partial write; the message names the short SKU
 * (CLAUDE.md §5.2 / §6).
 */
export class InsufficientStockError extends AppError {
  constructor(
    readonly sku: string,
    readonly available: number,
    readonly requested: number,
  ) {
    super(
      `Insufficient stock for ${sku}: have ${available} pcs, need ${requested} pcs.`,
    );
  }
}

/**
 * A feed-ingredient draw-down (mixing) would drive central stock negative. The whole
 * mixing transaction is rejected with no partial write; the message names the short
 * ingredient (CLAUDE.md §5.4 mirror for ingredient stock). Quantities are kg.
 */
export class InsufficientIngredientError extends AppError {
  constructor(
    readonly ingredient: string,
    readonly available: string,
    readonly requested: string,
  ) {
    super(
      `Insufficient ${ingredient}: have ${available} kg, need ${requested} kg.`,
    );
  }
}

/**
 * An OVK office→kandang transfer would drive office stock negative. The transfer is
 * rejected with no write; the message names the short item and its base unit (SRS FR-97,
 * CLAUDE.md §5.4 mirror for OVK stock).
 */
export class InsufficientOvkError extends AppError {
  constructor(
    readonly item: string,
    readonly available: string,
    readonly requested: string,
    readonly unit: string,
  ) {
    super(
      `Insufficient ${item}: have ${available} ${unit}, need ${requested} ${unit}.`,
    );
  }
}
