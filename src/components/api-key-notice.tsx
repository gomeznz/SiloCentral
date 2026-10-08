"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

// Shown once, right after a key is created or regenerated. The key is stored
// only as a hash, so this is the admin's single chance to copy it.
export function ApiKeyNotice({ customer, apiKey }: { customer: string; apiKey: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
    } catch {
      // Clipboard can be blocked (an insecure page, a locked-down browser);
      // the key is selectable in the box below, so nothing is lost.
    }
  }

  return (
    <div
      role="status"
      className="space-y-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <p className="font-medium">API key for {customer}</p>
      <p>Copy it now and send it to them securely. It can&apos;t be shown again; if it&apos;s lost, make a new one.</p>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={apiKey}
          onFocus={(e) => e.currentTarget.select()}
          aria-label={`API key for ${customer}`}
          className="h-9 flex-1 rounded-md border border-amber-300 bg-white px-3 font-mono text-xs text-slate-900 dark:border-amber-800 dark:bg-slate-900 dark:text-slate-100"
        />
        <Button type="button" size="sm" variant="outline" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
