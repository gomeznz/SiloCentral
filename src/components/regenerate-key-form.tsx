"use client";

import { useActionState } from "react";
import { regenerateKeyAction, type KeyState } from "@/app/customer-actions";
import { ApiKeyNotice } from "@/components/api-key-notice";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function RegenerateKeyForm({ customerId, customerName }: { customerId: number; customerName: string }) {
  const [state, action, pending] = useActionState<KeyState, FormData>(regenerateKeyAction, null);

  return (
    <div className="space-y-2">
      {state?.key && <ApiKeyNotice customer={state.customer ?? customerName} apiKey={state.key} />}
      <form action={action} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="id" value={customerId} />
        <div className="flex items-center gap-2">
          <input
            id={`regen-confirm-${customerId}`}
            name="confirm"
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700"
          />
          <Label htmlFor={`regen-confirm-${customerId}`} className="font-normal">
            The current key stops working immediately
          </Label>
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Working…" : "Make a new key"}
        </Button>
        {state?.error && (
          <span role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </span>
        )}
      </form>
    </div>
  );
}
