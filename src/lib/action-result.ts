// Shared result shape for form server actions used with useActionState.
export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };
