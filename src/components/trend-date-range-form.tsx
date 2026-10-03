import Form from "next/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimezoneField } from "@/components/timezone-field";

// A GET form: submitting it navigates to ?from=…&to=…&tz=… on this same
// page, which the server reads. The native date inputs show and accept dates
// in the viewer's own locale (DD/MM/YYYY in NZ) but always submit
// YYYY-MM-DD, which is what the server parses. dark:[color-scheme:dark]
// keeps the browser's calendar icon and popup readable on the dark theme.
export function TrendDateRangeForm({
  slug,
  from,
  to,
  active,
  idPrefix = "trend",
}: {
  slug: string;
  from: string | null;
  to: string | null;
  active: boolean;
  // A site page can show several charts, each with its own copy of this form
  // (all driven by the same URL, so they stay in step) — each copy needs its
  // own input ids for the labels to point at the right input.
  idPrefix?: string;
}) {
  const dateInput = "w-auto dark:[color-scheme:dark]";

  return (
    <Form action={`/${slug}`} scroll={false} prefetch={false} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-from`}>From</Label>
        <Input id={`${idPrefix}-from`} name="from" type="date" required defaultValue={from ?? ""} className={dateInput} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-to`}>To</Label>
        <Input id={`${idPrefix}-to`} name="to" type="date" required defaultValue={to ?? ""} className={dateInput} />
      </div>
      <TimezoneField />
      <Button type="submit" size="sm" variant={active ? "default" : "outline"} className="h-9">
        Show range
      </Button>
    </Form>
  );
}
