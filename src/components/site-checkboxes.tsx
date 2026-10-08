import { Label } from "@/components/ui/label";

// The sites a customer may read. Access is an explicit allow-list: a site added
// later is not visible to anyone until it's ticked here.
export function SiteCheckboxes({
  sites,
  selected = [],
  idPrefix,
}: {
  sites: { id: number; name: string }[];
  selected?: number[];
  idPrefix: string;
}) {
  if (sites.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No sites exist yet. Add one in Setup first.</p>;
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Sites this key can read</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {sites.map((site) => (
          <div key={site.id} className="flex items-center gap-2">
            <input
              id={`${idPrefix}-site-${site.id}`}
              name="siteId"
              value={site.id}
              type="checkbox"
              defaultChecked={selected.includes(site.id)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700"
            />
            <Label htmlFor={`${idPrefix}-site-${site.id}`} className="font-normal">
              {site.name}
            </Label>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
