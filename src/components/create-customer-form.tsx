"use client";

import { useActionState, useState } from "react";
import { createCustomerAction, type KeyState } from "@/app/customer-actions";
import { ApiKeyNotice } from "@/components/api-key-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteCheckboxes } from "@/components/site-checkboxes";

export function CreateCustomerForm({ sites }: { sites: { id: number; name: string }[] }) {
  const [state, action, pending] = useActionState<KeyState, FormData>(createCustomerAction, null);
  // Lets the admin dismiss the one-time key and add another customer.
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  if (state?.key && state.key !== dismissedKey) {
    return (
      <div className="space-y-3">
        <ApiKeyNotice customer={state.customer ?? "customer"} apiKey={state.key} />
        <Button type="button" variant="outline" size="sm" onClick={() => setDismissedKey(state.key ?? null)}>
          I&apos;ve copied it — add another customer
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state?.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="new-customer-name">Customer name</Label>
        <Input id="new-customer-name" name="name" placeholder="e.g. Acme Feeds" autoComplete="off" required />
      </div>
      <SiteCheckboxes sites={sites} idPrefix="new" />
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create customer and key"}
      </Button>
    </form>
  );
}
