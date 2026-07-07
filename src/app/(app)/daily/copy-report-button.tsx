"use client";

import { useState } from "react";

/** Copies the pre-built WhatsApp report text to the clipboard (for admins who'd
 *  rather paste text than screenshot the card). */
export function CopyReportButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (old browser / insecure context) — ignore silently.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded border border-zinc-300 px-2.5 py-1 text-xs font-medium hover:bg-zinc-100"
    >
      {copied ? "Tersalin ✓" : "Salin teks"}
    </button>
  );
}
