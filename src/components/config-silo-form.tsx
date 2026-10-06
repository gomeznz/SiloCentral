import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { RegisterAddressField } from "@/components/register-address-field";
import { DATA_TYPES, type ConfigPage, type ConfigSilo } from "@/lib/site-config-schema";

const checkbox =
  "mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700";

// The one set of silo fields, used both to add a silo and to edit one — every
// setting a silo has, including where and how it's read over Modbus. With
// `silo` it's pre-filled for editing; without, it starts from sensible
// defaults.
export function ConfigSiloForm({
  action,
  siteId,
  expectedVersion,
  pages,
  silo,
  submitLabel,
  defaultPageUid,
}: {
  action: (formData: FormData) => void | Promise<void>;
  siteId: number;
  expectedVersion: number;
  pages: ConfigPage[];
  silo?: ConfigSilo;
  submitLabel: string;
  defaultPageUid?: string;
}) {
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="siteId" value={siteId} />
      <input type="hidden" name="expectedVersion" value={expectedVersion} />
      {silo && <input type="hidden" name="uid" value={silo.uid} />}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="pageUid">Page</Label>
          <Select id="pageUid" name="pageUid" required defaultValue={silo?.pageUid ?? defaultPageUid}>
            {pages.map((p) => (
              <option key={p.uid} value={p.uid}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Silo name</Label>
          <Input id="name" name="name" defaultValue={silo?.name} placeholder="e.g. Silo 3 — Wheat" required />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="host">Modbus host / IP</Label>
          <Input id="host" name="host" defaultValue={silo?.host} placeholder="192.168.1.50" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="port">Port</Label>
          <Input id="port" name="port" type="number" defaultValue={silo?.port ?? 502} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unitId">Unit ID</Label>
          <Input id="unitId" name="unitId" type="number" defaultValue={silo?.unitId ?? 1} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <RegisterAddressField defaultValue={silo?.registerAddress} />
        <div className="space-y-1.5">
          <Label htmlFor="dataType">Data type</Label>
          <Select id="dataType" name="dataType" defaultValue={silo?.dataType ?? "UINT16"}>
            {DATA_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="scale">Scale factor</Label>
          <Input id="scale" name="scale" type="number" step="any" defaultValue={silo?.scale ?? 1} />
        </div>
      </div>

      <div className="flex items-start gap-2">
        <input id="invertLevel" name="invertLevel" type="checkbox" defaultChecked={silo?.invertLevel ?? false} className={checkbox} />
        <Label htmlFor="invertLevel" className="font-normal">
          Sensor measures empty space, not product depth (ultrasonic/radar distance sensors — a bigger reading means a
          more empty silo)
        </Label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="capacity">Capacity</Label>
          <Input id="capacity" name="capacity" type="number" step="any" defaultValue={silo?.capacity} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unit">Unit</Label>
          <Input id="unit" name="unit" defaultValue={silo?.unit ?? "t"} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="lowAlarmPercent">Low alarm (% of capacity, optional)</Label>
          <Input id="lowAlarmPercent" name="lowAlarmPercent" type="number" step="any" min={0} max={100} defaultValue={silo?.lowAlarmPercent ?? undefined} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="highAlarmPercent">High alarm (% of capacity, optional)</Label>
          <Input id="highAlarmPercent" name="highAlarmPercent" type="number" step="any" min={0} max={100} defaultValue={silo?.highAlarmPercent ?? undefined} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="criticalPercent">Critical level (% of capacity, optional)</Label>
          <Input id="criticalPercent" name="criticalPercent" type="number" step="any" min={0} max={100} defaultValue={silo?.criticalPercent ?? undefined} />
        </div>
      </div>

      <div className="flex items-start gap-2">
        <input id="isActive" name="isActive" type="checkbox" defaultChecked={silo?.isActive ?? true} className={checkbox} />
        <Label htmlFor="isActive" className="font-normal">
          Poll this silo (untick to stop reading it without deleting it)
        </Label>
      </div>

      {silo && (
        <div className="max-w-40 space-y-1.5">
          <Label htmlFor="sortOrder">Order on the page</Label>
          <Input id="sortOrder" name="sortOrder" type="number" min={0} defaultValue={silo.sortOrder} />
        </div>
      )}

      <Button type="submit" className="w-full" disabled={pages.length === 0}>
        {submitLabel}
      </Button>
    </form>
  );
}
