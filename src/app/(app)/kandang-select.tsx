"use client";

/**
 * Kandang picker that auto-submits its filter form on change, so the per-kandang
 * Riwayat (and, on Mixing, the pre-filled intake) appears as soon as a kandang is
 * chosen — before "Muat". `resetFields` are cleared before submitting: Mixing clears
 * the intake so it re-fills from the newly chosen kandang's history and never carries
 * the previous kandang's value. Navigation only — nothing is written.
 */
export function KandangSelect({
  name,
  defaultValue,
  options,
  className,
  resetFields = [],
}: {
  name: string;
  defaultValue: string;
  options: { id: string; label: string }[];
  className?: string;
  resetFields?: string[];
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className={className}
      onChange={(e) => {
        const form = e.currentTarget.form;
        if (!form) return;
        for (const field of resetFields) {
          const el = form.elements.namedItem(field);
          if (el instanceof HTMLInputElement) el.value = "";
        }
        form.requestSubmit();
      }}
    >
      <option value="">Pilih…</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
